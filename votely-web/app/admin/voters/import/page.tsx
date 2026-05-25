'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2, Database, Download, FileText, Loader2, Upload, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

type ImportIssue = {
  row: number
  identifier?: string
  reason: string
}

type ImportResult = {
  totalRows: number
  imported: number
  created: number
  updated: number
  participants: number
  invalid: ImportIssue[]
  duplicates: ImportIssue[]
}

const TEMPLATE = [
  'nik,faceEmbedding',
  '3173010101010001,"[0.01,0.02,0.03,0.04]"',
].join('\n')

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'template-data-pemilih.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function IssueList({ title, issues }: { title: string; issues: ImportIssue[] }) {
  if (issues.length === 0) return null

  return (
    <div className="rounded-lg border border-[#DDE6F4] bg-white">
      <div className="flex items-center justify-between border-b border-[#DDE6F4] px-4 py-3">
        <p className="text-sm font-semibold text-[#3A3F52]">{title}</p>
        <span className="text-xs font-medium text-[#9AA3B8]">{issues.length} baris</span>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#F8FAFD] text-xs uppercase text-[#9AA3B8]">
            <tr>
              <th className="w-20 px-4 py-3 font-semibold">Baris</th>
              <th className="w-40 px-4 py-3 font-semibold">NIK/NIM</th>
              <th className="px-4 py-3 font-semibold">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F7] text-[#3A3F52]">
            {issues.map((issue, index) => (
              <tr key={`${issue.row}-${issue.identifier || index}`}>
                <td className="px-4 py-3 font-mono text-xs">{issue.row}</td>
                <td className="px-4 py-3 font-mono text-xs">{issue.identifier || '-'}</td>
                <td className="px-4 py-3">{issue.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ImportVotersPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [electionId, setElectionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileChange = (selectedFile?: File) => {
    setError('')
    setResult(null)

    if (!selectedFile) {
      setFile(null)
      return
    }

    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv') || selectedFile.type.includes('csv')
    if (!isCsv) {
      setFile(null)
      setError('File harus berformat CSV.')
      return
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setFile(null)
      setError('Ukuran file maksimal 2 MB.')
      return
    }

    setFile(selectedFile)
  }

  const handleSubmit = async () => {
    if (!file) {
      setError('Pilih file CSV terlebih dahulu.')
      return
    }
    if (!electionId) {
      setError('Election ID wajib diisi.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('electionId', electionId)

      const response = await fetch('/api/admin/voters/import', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        setResult(payload.data || null)
        throw new Error(payload.error || 'Import data pemilih gagal.')
      }

      setResult(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import data pemilih gagal.')
    } finally {
      setLoading(false)
    }
  }

  const hasWarnings = Boolean(result && (result.invalid.length > 0 || result.duplicates.length > 0))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-[#9AA3B8] hover:text-[#3A3F52]">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-[#3A3F52]">Import Data Pemilih</h1>
            <p className="text-sm text-[#9AA3B8]">Unggah daftar pemilih melalui CSV.</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          Template
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-[#DDE6F4]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-[#3A3F52]">CSV Pemilih</CardTitle>
              <CardDescription>Kolom wajib: nik, faceEmbedding. Peserta akan ditautkan ke Election ID yang dipilih.</CardDescription>
            </div>
            <Database className="h-5 w-5 text-[#1FD7BE]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleFileChange(event.target.files?.[0])}
          />

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#3A3F52]" htmlFor="electionId">Election ID</label>
            <input
              id="electionId"
              value={electionId}
              onChange={(event) => setElectionId(event.target.value)}
              className="w-full rounded-lg border border-[#DDE6F4] bg-white px-4 py-3 text-sm text-[#3A3F52] outline-none focus:border-[#1FD7BE]"
              placeholder="Masukkan ID election"
            />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={(event) => {
              event.preventDefault()
              handleFileChange(event.dataTransfer.files[0])
            }}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#BFD3E8] bg-[#F8FAFD] px-6 py-8 text-center transition-colors hover:border-[#1FD7BE] hover:bg-[#F4FFFD]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#1FD7BE] shadow-sm">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#3A3F52]">{file ? file.name : 'Pilih file CSV'}</p>
              <p className="text-xs text-[#9AA3B8]">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Maksimal 2 MB'}</p>
            </div>
          </button>

          {file && (
            <div className="flex items-center justify-between rounded-lg border border-[#DDE6F4] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-[#1FD7BE]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#3A3F52]">{file.name}</p>
                  <p className="text-xs text-[#9AA3B8]">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button type="button" disabled={loading} onClick={handleSubmit} className="gap-2 bg-[#1FD7BE] text-white hover:bg-[#17c5ae]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-5">
              <Alert className={hasWarnings ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}>
                {hasWarnings ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <AlertDescription>
                  {hasWarnings ? 'Import selesai dengan beberapa catatan.' : 'Import data pemilih berhasil.'}
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ['Total Baris', result.totalRows],
                  ['Diimport', result.imported],
                  ['Peserta', result.participants],
                  ['Baru', result.created],
                  ['Diperbarui', result.updated],
                  ['Dilewati', result.invalid.length + result.duplicates.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[#DDE6F4] bg-white p-4">
                    <p className="text-xs font-medium uppercase text-[#9AA3B8]">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-[#3A3F52]">{value}</p>
                  </div>
                ))}
              </div>

              {result.imported === 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>Tidak ada data valid yang tersimpan.</AlertDescription>
                </Alert>
              )}

              <IssueList title="Data Tidak Valid" issues={result.invalid} />
              <IssueList title="Duplikasi NIK/NIM" issues={result.duplicates} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
