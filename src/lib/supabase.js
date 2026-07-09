import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null

export function storagePublicUrl(path) {
  if (!url || !path) return null
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/floor-assets/${path}`
}
