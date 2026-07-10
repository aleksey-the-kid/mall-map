import { ref, computed, watch } from 'vue'
import { api, isApiConfigured } from '../lib/api.js'
import { buildFloorJsonFromFloor } from './useMallData.js'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

let saveTimer = null

export function useFloorAdmin(floorRef, { useRemote = false, getObjects = () => [] } = {}) {
  const zones = ref([])
  const originalSnapshot = ref([])
  const saving = ref(false)
  const saveError = ref(null)
  const loadedFloorId = ref(null)

  function resetFromFloor(floor) {
    if (!floor) {
      zones.value = []
      originalSnapshot.value = []
      loadedFloorId.value = null
      return
    }
    const snapshot = deepClone(floor.zones ?? [])
    originalSnapshot.value = snapshot
    zones.value = deepClone(snapshot)
    loadedFloorId.value = floor.id
  }

  watch(
    () => floorRef.value,
    (floor) => {
      if (!floor || floor.id === loadedFloorId.value) return
      resetFromFloor(floor)
    },
    { immediate: true },
  )

  const hasEdits = computed(
    () => JSON.stringify(zones.value) !== JSON.stringify(originalSnapshot.value),
  )

  function findZoneIndex(id) {
    return zones.value.findIndex((z) => z.id === id)
  }

  function scheduleSave() {
    if (!useRemote || !isApiConfigured || !floorRef.value?.id) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const floor = floorRef.value
      if (!floor) return
      saving.value = true
      saveError.value = null
      try {
        const floorJson = buildFloorJsonFromFloor(floor, zones.value, getObjects())
        await api.updateFloorZones(floor.id, floorJson)
      } catch (err) {
        saveError.value = err.message
      } finally {
        saving.value = false
      }
    }, 600)
  }

  function updateZone(id, patch) {
    const idx = findZoneIndex(id)
    if (idx === -1) return
    zones.value[idx] = { ...zones.value[idx], ...patch }
    zones.value = [...zones.value]
    scheduleSave()
  }

  function addZone() {
    const floor = floorRef.value
    if (!floor?.planBounds) return null
    const maxId = zones.value.reduce(
      (max, z) => Math.max(max, Number.parseInt(z.id, 10) || 0),
      0,
    )
    const { width, height } = floor.planBounds
    const cx = width / 2
    const cy = height / 2
    const size = 4
    const id = String(maxId + 1)
    zones.value = [
      ...zones.value,
      {
        id,
        name: `Зона ${id}`,
        category: 'shop',
        points: [
          [cx - size, cy - size],
          [cx + size, cy - size],
          [cx + size, cy + size],
          [cx - size, cy + size],
        ],
        height: floor.footprintHeight ?? 2.4,
        size: [size * 2, size * 2],
        color: '#6db56d',
        offset: [0, 0],
      },
    ]
    scheduleSave()
    return id
  }

  function deleteZone(id) {
    zones.value = zones.value.filter((z) => z.id !== id)
    scheduleSave()
  }

  function resetZone(id) {
    const original = originalSnapshot.value.find((z) => z.id === id)
    if (!original) {
      deleteZone(id)
      return
    }
    const idx = findZoneIndex(id)
    if (idx === -1) return
    zones.value[idx] = deepClone(original)
    zones.value = [...zones.value]
    scheduleSave()
  }

  function resetAll() {
    zones.value = deepClone(originalSnapshot.value)
    scheduleSave()
  }

  function exportJson() {
    const floor = floorRef.value
    if (!floor) return
    const payload = buildFloorJsonFromFloor(floor, zones.value, getObjects())
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `floor-${floor.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function commitSnapshot() {
    originalSnapshot.value = deepClone(zones.value)
  }

  return {
    zones,
    hasEdits,
    originalSnapshot,
    saving,
    saveError,
    updateZone,
    addZone,
    deleteZone,
    resetZone,
    resetAll,
    exportJson,
    resetFromFloor,
    commitSnapshot,
    scheduleSave,
  }
}
