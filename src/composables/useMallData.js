import { ref, computed, watch } from 'vue'
import { isSupabaseConfigured, storagePublicUrl } from '../lib/supabase.js'
import { api, isApiConfigured } from '../lib/api.js'
import {
  FLOORS as STATIC_FLOORS,
  MALL_NAME as STATIC_MALL_NAME,
  MALL_ADDRESS as STATIC_MALL_ADDRESS,
} from '../data/floors.js'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function floorRowToRenderable(row) {
  const data = row.floor_json || {}
  const planUrl = row.plan_image_url || storagePublicUrl(row.plan_image_path)
  const glbUrl = row.glb_url || storagePublicUrl(row.glb_path)
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
    status: row.status,
    planImage: planUrl,
    wallPxPerUnit: data.wallPxPerUnit ?? 10,
    planBounds: data.planBounds ?? null,
    footprintModel: glbUrl,
    footprintHeight: row.footprint_height ?? data.footprintHeight ?? 2.4,
    zones: data.zones ?? [],
    floorJson: data,
    errorMessage: row.error_message,
  }
}

function staticMall() {
  return {
    id: 'static',
    name: STATIC_MALL_NAME,
    address: STATIC_MALL_ADDRESS,
  }
}

function staticFloors() {
  return STATIC_FLOORS.map((f) => ({
    ...f,
    status: 'ready',
    sortOrder: f.id,
    floorJson: {
      planBounds: f.planBounds,
      wallPxPerUnit: f.wallPxPerUnit,
      footprintHeight: f.footprintHeight,
      zones: f.zones,
    },
  }))
}

export function useMallData() {
  const malls = ref([])
  const floors = ref([])
  const currentMallId = ref(null)
  const currentFloorId = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const useRemote = isSupabaseConfigured && isApiConfigured

  const currentMall = computed(() =>
    malls.value.find((m) => m.id === currentMallId.value) ?? null,
  )

  const currentFloor = computed(() =>
    floors.value.find((f) => f.id === currentFloorId.value) ?? null,
  )

  const floorOptions = computed(() =>
    floors.value.map((f) => ({
      id: f.id,
      label: f.label,
      status: f.status,
    })),
  )

  async function loadMalls() {
    if (!useRemote) {
      malls.value = [staticMall()]
      currentMallId.value = 'static'
      return
    }
    loading.value = true
    error.value = null
    try {
      const data = await api.listMalls()
      malls.value = data
      if (!currentMallId.value && data.length) {
        currentMallId.value = data[0].id
      }
    } catch (err) {
      error.value = err.message
      malls.value = [staticMall()]
      currentMallId.value = 'static'
    } finally {
      loading.value = false
    }
  }

  async function loadFloors(mallId) {
    if (!mallId) {
      floors.value = []
      return
    }
    if (!useRemote || mallId === 'static') {
      floors.value = staticFloors()
      if (!currentFloorId.value && floors.value.length) {
        currentFloorId.value = floors.value[0].id
      }
      return
    }
    loading.value = true
    error.value = null
    try {
      const data = await api.listFloors(mallId)
      floors.value = data.map(floorRowToRenderable)
      if (!currentFloorId.value && floors.value.length) {
        currentFloorId.value = floors.value[0].id
      } else if (
        currentFloorId.value &&
        !floors.value.some((f) => f.id === currentFloorId.value)
      ) {
        currentFloorId.value = floors.value[0]?.id ?? null
      }
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function createMall(name, address = '') {
    const mall = await api.createMall({ name, address })
    malls.value = [...malls.value, mall]
    currentMallId.value = mall.id
    await loadFloors(mall.id)
    return mall
  }

  async function createFloor(label) {
    if (!currentMallId.value) throw new Error('No mall selected')
    const floor = await api.createFloor(currentMallId.value, { label })
    const renderable = floorRowToRenderable(floor)
    floors.value = [...floors.value, renderable]
    currentFloorId.value = renderable.id
    return renderable
  }

  async function uploadPlan(floorId, file) {
    await api.uploadPlan(floorId, file)
    return pollFloorStatus(floorId)
  }

  async function pollFloorStatus(floorId, { intervalMs = 1500, maxAttempts = 120 } = {}) {
    for (let i = 0; i < maxAttempts; i++) {
      const row = await api.floorStatus(floorId)
      const renderable = floorRowToRenderable(row)
      const idx = floors.value.findIndex((f) => f.id === floorId)
      if (idx !== -1) {
        floors.value[idx] = renderable
        floors.value = [...floors.value]
      }
      if (row.status === 'ready' || row.status === 'error') {
        return renderable
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error('Processing timeout')
  }

  async function refreshFloor(floorId) {
    const row = await api.floorStatus(floorId)
    const renderable = floorRowToRenderable(row)
    const idx = floors.value.findIndex((f) => f.id === floorId)
    if (idx !== -1) {
      floors.value[idx] = renderable
      floors.value = [...floors.value]
    }
    return renderable
  }

  function setMall(id) {
    if (id === currentMallId.value) return
    currentMallId.value = id
    currentFloorId.value = null
  }

  function setFloor(id) {
    currentFloorId.value = id
  }

  watch(currentMallId, (id) => {
    if (id) loadFloors(id)
  })

  return {
    malls,
    floors,
    currentMallId,
    currentFloorId,
    currentMall,
    currentFloor,
    floorOptions,
    loading,
    error,
    useRemote,
    loadMalls,
    loadFloors,
    createMall,
    createFloor,
    uploadPlan,
    refreshFloor,
    setMall,
    setFloor,
    floorRowToRenderable,
  }
}

export function buildFloorJsonFromFloor(floor, zones) {
  const base = deepClone(floor.floorJson || {})
  return {
    ...base,
    planBounds: floor.planBounds ?? base.planBounds,
    wallPxPerUnit: floor.wallPxPerUnit ?? base.wallPxPerUnit ?? 10,
    footprintHeight: floor.footprintHeight ?? base.footprintHeight ?? 2.4,
    footprintModel: 'footprint.glb',
    zones,
  }
}
