const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export function getStoredToken() {
  return localStorage.getItem('votely_token')
}

export function setStoredToken(token) {
  if (token) localStorage.setItem('votely_token', token)
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`)
  }
  return data
}

export async function login(nik, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nik, password }),
  })
  setStoredToken(data.token)
  return data
}
