const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const isApiConfigured = Boolean(API_URL)

async function request(path, options = {}) {
  if (!API_URL) throw new Error('API URL is not configured')
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  listMalls: () => request('/malls'),
  createMall: (body) => request('/malls', { method: 'POST', body: JSON.stringify(body) }),
  listFloors: (mallId) => request(`/malls/${mallId}/floors`),
  createFloor: (mallId, body) =>
    request(`/malls/${mallId}/floors`, { method: 'POST', body: JSON.stringify(body) }),
  uploadPlan: (floorId, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/floors/${floorId}/upload-plan`, { method: 'POST', body: form })
  },
  floorStatus: (floorId) => request(`/floors/${floorId}/status`),
  updateFloorZones: (floorId, floorJson) =>
    request(`/floors/${floorId}/zones`, {
      method: 'PATCH',
      body: JSON.stringify({ floor_json: floorJson }),
    }),
}
