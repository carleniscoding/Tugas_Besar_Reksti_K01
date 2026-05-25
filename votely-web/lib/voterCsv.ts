import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Role, type Prisma } from '@prisma/client'
import { generateWallet } from '@/lib/wallet'

export type VoterCsvIssue = {
  row: number
  identifier?: string
  reason: string
}

export type ParsedVoterRow = {
  row: number
  nik: string
  faceEmbedding: number[]
}

export type ParsedVoterCsv = {
  totalRows: number
  valid: ParsedVoterRow[]
  invalid: VoterCsvIssue[]
  duplicates: VoterCsvIssue[]
}

export type VoterImportSummary = {
  totalRows: number
  imported: number
  created: number
  updated: number
  participants: number
  invalid: VoterCsvIssue[]
  duplicates: VoterCsvIssue[]
}

const REQUIRED_FIELDS = ['nik', 'faceEmbedding']
const PLACEHOLDER_DATE = new Date('2000-01-01T00:00:00.000Z')
const PLACEHOLDER_REGION = 'TEST'

function normalizeHeader(header: string) {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)

  const headers = lines[0] ? splitCsvLine(lines[0]) : []
  const rows = lines.slice(1).map((line, index) => ({
    rowNumber: index + 2,
    values: splitCsvLine(line),
  }))

  return { headers, rows }
}

function getValue(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[alias]
    if (value) return value.trim()
  }
  return ''
}

function parseEmbedding(value: string) {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed.every((item) => typeof item === 'number' && Number.isFinite(item))) return null
    return parsed
  } catch {
    return null
  }
}

export function parseVoterCsv(text: string): ParsedVoterCsv {
  const { headers, rows } = parseCsv(text)
  const normalizedHeaders = headers.map(normalizeHeader)
  const hasNik = normalizedHeaders.includes('nik')
  const hasFaceEmbedding = normalizedHeaders.some((header) => ['faceembedding', 'embeddingvector'].includes(header))
  const missingColumns = REQUIRED_FIELDS.filter((field) => {
    if (field === 'nik') return !hasNik
    return !hasFaceEmbedding
  })

  const invalid: VoterCsvIssue[] = []
  const duplicates: VoterCsvIssue[] = []
  const valid: ParsedVoterRow[] = []
  const seen = new Set<string>()

  if (missingColumns.length > 0) {
    return {
      totalRows: rows.length,
      valid,
      invalid: [{ row: 1, reason: `Kolom wajib tidak ditemukan: ${missingColumns.join(', ')}` }],
      duplicates,
    }
  }

  for (const row of rows) {
    const record = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, row.values[index]?.trim() || ''])
    )
    const nik = getValue(record, ['nik']).replace(/[\s-]/g, '')
    const embeddingText = getValue(record, ['faceembedding', 'embeddingvector'])
    const faceEmbedding = parseEmbedding(embeddingText)

    if (!nik) {
      invalid.push({ row: row.rowNumber, reason: 'NIK wajib diisi.' })
      continue
    }

    if (!/^[0-9]{16}$/.test(nik)) {
      invalid.push({ row: row.rowNumber, identifier: nik, reason: 'NIK harus 16 digit angka.' })
      continue
    }

    if (!faceEmbedding) {
      invalid.push({ row: row.rowNumber, identifier: nik, reason: 'faceEmbedding harus berupa JSON array angka.' })
      continue
    }

    if (seen.has(nik)) {
      duplicates.push({ row: row.rowNumber, identifier: nik, reason: 'Duplikat NIK di file CSV. Baris ini dilewati.' })
      continue
    }

    seen.add(nik)
    valid.push({ row: row.rowNumber, nik, faceEmbedding })
  }

  return { totalRows: rows.length, valid, invalid, duplicates }
}

export async function importElectionParticipants(
  client: Prisma.TransactionClient,
  electionId: bigint,
  parsed: ParsedVoterCsv
): Promise<VoterImportSummary> {
  if (parsed.valid.length === 0) {
    return {
      totalRows: parsed.totalRows,
      imported: 0,
      created: 0,
      updated: 0,
      participants: 0,
      invalid: parsed.invalid,
      duplicates: parsed.duplicates,
    }
  }

  const existing = await client.penduduk.findMany({
    where: { nik: { in: parsed.valid.map((row) => row.nik) } },
    select: { nik: true },
  })
  const existingNik = new Set(existing.map((row) => row.nik))
  const importedUserIds: string[] = []
  const invalid = [...parsed.invalid]

  for (const row of parsed.valid) {
    const penduduk = await client.penduduk.upsert({
      where: { nik: row.nik },
      update: {
        foto: {
          embedding_vector: row.faceEmbedding,
          registered_at: new Date().toISOString(),
          source: 'admin_csv',
        },
      },
      create: {
        nik: row.nik,
        namaLengkap: `Pemilih ${row.nik}`,
        tanggalLahir: PLACEHOLDER_DATE,
        provinsi: PLACEHOLDER_REGION,
        kabKota: PLACEHOLDER_REGION,
        kecamatan: PLACEHOLDER_REGION,
        kelurahan: PLACEHOLDER_REGION,
        foto: {
          embedding_vector: row.faceEmbedding,
          registered_at: new Date().toISOString(),
          source: 'admin_csv',
        },
      },
      include: { user: true },
    })

    if (penduduk.user?.role === Role.ADMIN) {
      invalid.push({ row: row.row, identifier: row.nik, reason: 'NIK milik admin tidak boleh dijadikan peserta.' })
      continue
    }

    const wallet = penduduk.user?.walletAddress ? null : generateWallet()
    const password = await bcrypt.hash(randomUUID(), 10)
    const user = penduduk.user
      ? await client.user.update({
          where: { id: penduduk.user.id },
          data: {
            role: Role.WARGA,
            ...(wallet
              ? {
                  walletAddress: wallet.walletAddress,
                  encryptedPrivateKey: wallet.encryptedPrivateKey,
                }
              : {}),
          },
        })
      : await client.user.create({
          data: {
            pendudukId: penduduk.id,
            password,
            role: Role.WARGA,
            walletAddress: wallet!.walletAddress,
            encryptedPrivateKey: wallet!.encryptedPrivateKey,
          },
        })

    await client.electionParticipant.upsert({
      where: { electionId_userId: { electionId, userId: user.id } },
      update: {},
      create: { electionId, userId: user.id },
    })
    importedUserIds.push(user.id)
  }

  return {
    totalRows: parsed.totalRows,
    imported: importedUserIds.length,
    created: parsed.valid.filter((row) => !existingNik.has(row.nik)).length,
    updated: importedUserIds.length - parsed.valid.filter((row) => !existingNik.has(row.nik)).length,
    participants: importedUserIds.length,
    invalid,
    duplicates: parsed.duplicates,
  }
}
