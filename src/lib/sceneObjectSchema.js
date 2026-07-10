export const SCENE_OBJECT_CATEGORIES = [
  { value: 'poi', label: 'Точка интереса' },
  { value: 'amenity', label: 'Удобство' },
  { value: 'food', label: 'Еда и напитки' },
  { value: 'service', label: 'Сервис' },
  { value: 'landmark', label: 'Ориентир' },
]

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  const result = []
  for (const tag of tags) {
    const value = String(tag).trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function normalizeSceneObject(raw, { assetName, objectNum } = {}) {
  const id = raw?.id
  const num =
    objectNum ??
    (Number.parseInt(String(id).replace(/\D/g, ''), 10) || undefined)

  return {
    id,
    assetId: raw.assetId,
    position: Array.isArray(raw.position) ? [...raw.position] : [0, 0],
    name: String(raw.name ?? '').trim() || assetName || `Объект ${num ?? id}`,
    category: raw.category || 'poi',
    tags: normalizeTags(raw.tags),
    description: String(raw.description ?? '').trim(),
  }
}
