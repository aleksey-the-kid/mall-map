/** Optional fallback when API returns storage paths without full URLs. */
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')

export function storagePublicUrl(path) {
  if (!url || !path) return null
  return `${url}/storage/v1/object/public/floor-assets/${path}`
}
