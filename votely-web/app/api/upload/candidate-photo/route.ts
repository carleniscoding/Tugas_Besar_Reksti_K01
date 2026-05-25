import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Create admin client with service role key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://foxpgqpclfptrkyfoivo.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function saveLocalCandidatePhoto(buffer: Buffer, filename: string) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'candidates')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)
  return `/uploads/candidates/${filename}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 9)
    const ext = extensionByType[file.type] || file.name.split('.').pop() || 'jpg'
    const filename = `${timestamp}-${randomStr}.${ext}`
    const path = `candidates/${filename}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (supabaseServiceKey) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from('fotoKandidat')
          .upload(path, buffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          })

        if (!error) {
          const { data: urlData } = supabaseAdmin.storage
            .from('fotoKandidat')
            .getPublicUrl(data.path)

          return NextResponse.json({
            success: true,
            data: {
              url: urlData.publicUrl,
              path: data.path
            }
          })
        }

        console.error('Supabase upload error:', error)
      } catch (error) {
        console.error('Supabase upload failed, falling back to local storage:', error)
      }
    }

    const localUrl = await saveLocalCandidatePhoto(buffer, filename)

    return NextResponse.json({
      success: true,
      data: {
        url: localUrl,
        path: localUrl
      }
    })
  } catch (error: unknown) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
