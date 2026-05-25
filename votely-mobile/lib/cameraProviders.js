const ESP32_CAMERA_URL_KEY = 'votely_esp32_camera_url'
const CAPTURE_TIMEOUT_MS = 5000

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('IP atau URL ESP32-CAM wajib diisi.')

  let url
  try {
    url = new URL(trimmed)
  } catch {
    url = new URL(`http://${trimmed}`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL ESP32-CAM harus memakai http:// atau https://.')
  }

  return url.origin
}

function withTimeout(ms = CAPTURE_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeout),
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Gagal membaca gambar dari ESP32-CAM.'))
    reader.readAsDataURL(blob)
  })
}

export function getSavedEsp32CameraUrl() {
  try {
    return localStorage.getItem(ESP32_CAMERA_URL_KEY) || ''
  } catch {
    return ''
  }
}

export function saveEsp32CameraUrl(value) {
  try {
    localStorage.setItem(ESP32_CAMERA_URL_KEY, normalizeBaseUrl(value))
  } catch {
    // localStorage can be unavailable in private or locked-down contexts.
  }
}

export function isEsp32CameraUrlValid(value) {
  try {
    normalizeBaseUrl(value)
    return true
  } catch {
    return false
  }
}

export async function testEsp32WifiCamera(baseUrl) {
  const normalizedUrl = normalizeBaseUrl(baseUrl)
  const timeout = withTimeout(CAPTURE_TIMEOUT_MS)

  try {
    const response = await fetch(`${normalizedUrl}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: timeout.signal,
    })

    if (!response.ok) throw new Error(`ESP32-CAM membalas status ${response.status}.`)
    const data = await response.json().catch(() => ({}))
    if (data?.ok === false) throw new Error('ESP32-CAM belum siap.')

    saveEsp32CameraUrl(normalizedUrl)
    return {
      baseUrl: normalizedUrl,
      device: data?.device || 'Votely-CAM',
      ip: data?.ip || normalizedUrl.replace(/^https?:\/\//, ''),
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('ESP32-CAM tidak merespons. Periksa IP dan jaringan WiFi.')
    }
    throw err
  } finally {
    timeout.clear()
  }
}

export async function captureEsp32WifiFrame(baseUrl) {
  const normalizedUrl = normalizeBaseUrl(baseUrl)
  const timeout = withTimeout(CAPTURE_TIMEOUT_MS)

  try {
    const response = await fetch(`${normalizedUrl}/capture?ts=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: timeout.signal,
    })

    if (!response.ok) throw new Error(`Capture ESP32-CAM gagal (${response.status}).`)

    const blob = await response.blob()
    if (!blob.type.includes('image') || blob.size === 0) {
      throw new Error('ESP32-CAM tidak mengirim JPEG valid.')
    }

    return blobToDataUrl(blob)
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Capture ESP32-CAM timeout. Coba ulangi.')
    }
    throw err
  } finally {
    timeout.clear()
  }
}

export function createBrowserFrameCapture(video) {
  if (!video) return ''
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}
