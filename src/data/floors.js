import floor1 from './generated/floor1.json'

function publicAsset(path) {
  const file = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${file}`
}

/**
 * Floor plan data for GREEN CITY shopping center.
 * Coordinates are in plan space (origin top-left, y grows downward).
 * Generated from assets/floor-plan.png via scripts/extract_colored_footprint.py
 */

export const FLOORS = [
  {
    id: 1,
    label: '1 этаж',
    planImage: publicAsset('floor-plan.png'),
    wallPxPerUnit: floor1.wallPxPerUnit,
    planBounds: floor1.planBounds,
    footprintModel: publicAsset(floor1.footprintModel),
    footprintHeight: floor1.footprintHeight,
    zones: floor1.zones,
  },
]

export const CATEGORY_COLORS = {
  shop: '#6db56d',
  cafe: '#f5e6d3',
  corridor: '#ebebeb',
  office: '#e8e8e8',
  service: '#e0e0e0',
  entrance: '#d4edda',
  wc: '#e8e8e8',
  escalator: '#e8e8e8',
  stairs: '#e8e8e8',
}

export const CATEGORY_LABELS = {
  shop: 'Магазин',
  cafe: 'Кафе',
  corridor: 'Коридор',
  office: 'Офис',
  service: 'Сервис',
  entrance: 'Вход',
  wc: 'Туалет',
  escalator: 'Эскалатор',
  stairs: 'Лестница',
}

export const COLORS = {
  top: '#f0f0f0',
  side: '#3d6b3d',
  hover: '#d5d5d5',
  selected: '#e88388',
  selectedSide: '#c0392b',
  plan: '#fafafa',
  background: '#f5f5f5',
  wall: '#2a2a2a',
}

export function polygonCentroid(points) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length
  return { x: cx, y: cy }
}

export function getAllZones(floor) {
  return floor?.zones ?? []
}

export function findZoneById(floor, id) {
  return getAllZones(floor).find((z) => z.id === id)
}

export function searchZones(floor, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return getAllZones(floor).filter(
    (z) => z.name.toLowerCase().includes(q) || z.id.includes(q),
  )
}

export const FLOOR_OPTIONS = FLOORS.map((f) => ({ id: f.id, label: f.label }))

export const MALL_NAME = 'GREEN CITY'
export const MALL_ADDRESS = 'г. Минск, ул. Притыцкого, 156/1'
