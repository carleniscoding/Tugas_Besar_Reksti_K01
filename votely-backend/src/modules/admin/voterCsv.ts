import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma, Prisma, Role } from "../../shared/prisma.js";
import { generateWallet } from "../wallet/service.js";

export type CsvIssue = { row: number; identifier?: string; reason: string };
export type ParsedVoterRow = { row: number; nik: string; faceEmbedding: number[] };
export type ParsedVoterCsv = {
  totalRows: number;
  valid: ParsedVoterRow[];
  invalid: CsvIssue[];
  duplicates: CsvIssue[];
};

const PLACEHOLDER_DATE = new Date("2000-01-01T00:00:00.000Z");
const PLACEHOLDER_REGION = "TEST";

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseEmbedding(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseVoterCsv(text: string): ParsedVoterCsv {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim());
  const headers = lines[0] ? splitCsvLine(lines[0]).map(normalizeHeader) : [];
  const rows = lines.slice(1).map((line, index) => ({ rowNumber: index + 2, values: splitCsvLine(line) }));
  const hasNik = headers.includes("nik");
  const faceHeader = headers.find((header) => ["faceembedding", "embeddingvector"].includes(header));

  if (!hasNik || !faceHeader) {
    const missing = [!hasNik ? "nik" : "", !faceHeader ? "faceEmbedding" : ""].filter(Boolean).join(", ");
    return { totalRows: rows.length, valid: [], invalid: [{ row: 1, reason: `Kolom wajib tidak ditemukan: ${missing}` }], duplicates: [] };
  }

  const valid: ParsedVoterRow[] = [];
  const invalid: CsvIssue[] = [];
  const duplicates: CsvIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const record = Object.fromEntries(headers.map((header, index) => [header, row.values[index]?.trim() || ""]));
    const nik = String(record.nik || "").replace(/[\s-]/g, "");
    const faceEmbedding = parseEmbedding(String(record[faceHeader] || ""));

    if (!nik) {
      invalid.push({ row: row.rowNumber, reason: "NIK wajib diisi." });
      continue;
    }
    if (!/^[0-9]{16}$/.test(nik)) {
      invalid.push({ row: row.rowNumber, identifier: nik, reason: "NIK harus 16 digit angka." });
      continue;
    }
    if (!faceEmbedding) {
      invalid.push({ row: row.rowNumber, identifier: nik, reason: "faceEmbedding harus berupa JSON array angka." });
      continue;
    }
    if (seen.has(nik)) {
      duplicates.push({ row: row.rowNumber, identifier: nik, reason: "Duplikat NIK di file CSV. Baris ini dilewati." });
      continue;
    }

    seen.add(nik);
    valid.push({ row: row.rowNumber, nik, faceEmbedding });
  }

  return { totalRows: rows.length, valid, invalid, duplicates };
}

export async function importElectionParticipants(
  tx: Prisma.TransactionClient,
  electionId: bigint,
  parsed: ParsedVoterCsv,
) {
  const existing = parsed.valid.length
    ? await tx.penduduk.findMany({ where: { nik: { in: parsed.valid.map((row) => row.nik) } }, select: { nik: true } })
    : [];
  const existingNik = new Set(existing.map((row) => row.nik));
  const invalid = [...parsed.invalid];
  let imported = 0;
  let created = 0;
  let updated = 0;

  for (const row of parsed.valid) {
    const penduduk = await tx.penduduk.upsert({
      where: { nik: row.nik },
      update: {
        foto: { embedding_vector: row.faceEmbedding, registered_at: new Date().toISOString(), source: "admin_csv" },
      },
      create: {
        nik: row.nik,
        namaLengkap: `Pemilih ${row.nik}`,
        tanggalLahir: PLACEHOLDER_DATE,
        provinsi: PLACEHOLDER_REGION,
        kabKota: PLACEHOLDER_REGION,
        kecamatan: PLACEHOLDER_REGION,
        kelurahan: PLACEHOLDER_REGION,
        foto: { embedding_vector: row.faceEmbedding, registered_at: new Date().toISOString(), source: "admin_csv" },
      },
      include: { user: true },
    });

    if (penduduk.user?.role === Role.ADMIN) {
      invalid.push({ row: row.row, identifier: row.nik, reason: "NIK milik admin tidak boleh dijadikan peserta." });
      continue;
    }

    const wallet = penduduk.user?.walletAddress ? null : generateWallet();
    const user = penduduk.user
      ? await tx.user.update({
          where: { id: penduduk.user.id },
          data: wallet ? { role: Role.WARGA, walletAddress: wallet.walletAddress, encryptedPrivateKey: wallet.encryptedPrivateKey } : { role: Role.WARGA },
        })
      : await tx.user.create({
          data: {
            pendudukId: penduduk.id,
            password: await bcrypt.hash(randomUUID(), 10),
            role: Role.WARGA,
            walletAddress: wallet!.walletAddress,
            encryptedPrivateKey: wallet!.encryptedPrivateKey,
          },
        });

    await tx.electionParticipant.upsert({
      where: { electionId_userId: { electionId, userId: user.id } },
      update: {},
      create: { electionId, userId: user.id },
    });

    imported += 1;
    if (existingNik.has(row.nik)) updated += 1;
    else created += 1;
  }

  return {
    totalRows: parsed.totalRows,
    imported,
    created,
    updated,
    participants: imported,
    invalid,
    duplicates: parsed.duplicates,
  };
}

export async function importElectionParticipantsCsv(electionId: string, csv: string, adminId: string) {
  const parsed = parseVoterCsv(csv);
  return prisma.$transaction(async (tx) => {
    const result = await importElectionParticipants(tx, BigInt(electionId), parsed);
    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "IMPORT_ELECTION_PARTICIPANTS_CSV",
        entityType: "Election",
        entityId: electionId,
        metadata: {
          totalRows: result.totalRows,
          imported: result.imported,
          created: result.created,
          updated: result.updated,
          participants: result.participants,
          duplicates: result.duplicates.length,
          invalid: result.invalid.length,
        },
      },
    });
    return result;
  });
}
