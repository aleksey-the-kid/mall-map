import { ref, computed, watch } from 'vue'
import { BUILTIN_SCENE_ASSETS } from '../data/sceneAssets.js'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function objectsKey(floorId) {
  return `mall-map:scene-objects:${floorId}`
}

function assetsKey(floorId) {
  return `mall-map:scene-assets:${floorId}`
}

function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function useSceneObjects(floorRef) {
  const objects = ref([])
  const customAssets = ref([])
  const loadedFloorId = ref(null)

  const libraryAssets = computed(() => [...BUILTIN_SCENE_ASSETS, ...customAssets.value])

  function persistObjects() {
    const floor = floorRef.value
    if (!floor?.id) return
    saveToStorage(objectsKey(floor.id), objects.value)
  }

  function persistAssets() {
    const floor = floorRef.value
    if (!floor?.id) return
    const persistable = customAssets.value
      .filter((a) => a.type === 'glb' && a.url && !a.url.startsWith('blob:'))
      .map(({ id, name, type, url }) => ({ id, name, type, url }))
    saveToStorage(assetsKey(floor.id), persistable)
  }

  function resetFromFloor(floor) {
    if (!floor) {
      objects.value = []
      customAssets.value = []
      loadedFloorId.value = null
      return
    }

    let snapshot = loadFromStorage(objectsKey(floor.id))
    const legacyFromDb = floor.sceneObjects ?? floor.floorJson?.objects ?? []
    if (!snapshot.length && legacyFromDb.length) {
      snapshot = deepClone(legacyFromDb)
      saveToStorage(objectsKey(floor.id), snapshot)
    }

    objects.value = deepClone(snapshot)
    customAssets.value = loadFromStorage(assetsKey(floor.id))
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

  function findObjectIndex(id) {
    return objects.value.findIndex((o) => o.id === id)
  }

  function addObject({ assetId, position }) {
    const maxNum = objects.value.reduce((max, o) => {
      const n = Number.parseInt(String(o.id).replace(/\D/g, ''), 10) || 0
      return Math.max(max, n)
    }, 0)
    const id = `obj-${maxNum + 1}`
    const entry = {
      id,
      assetId,
      position: [...position],
    }
    objects.value = [...objects.value, entry]
    persistObjects()
    return id
  }

  function updateObject(id, patch) {
    const idx = findObjectIndex(id)
    if (idx === -1) return
    objects.value[idx] = { ...objects.value[idx], ...patch }
    objects.value = [...objects.value]
    persistObjects()
  }

  function deleteObject(id) {
    objects.value = objects.value.filter((o) => o.id !== id)
    persistObjects()
  }

  function clearAll() {
    objects.value = []
    persistObjects()
  }

  function addCustomAsset(file) {
    const floor = floorRef.value
    if (!floor) return null
    const id = `glb-${Date.now()}`
    const url = URL.createObjectURL(file)
    const asset = {
      id,
      name: file.name.replace(/\.glb$/i, ''),
      type: 'glb',
      url,
      previewColor: '#888',
    }
    customAssets.value = [...customAssets.value, asset]
    persistAssets()
    return asset
  }

  function getAsset(assetId) {
    return libraryAssets.value.find((a) => a.id === assetId) ?? null
  }

  return {
    objects,
    customAssets,
    libraryAssets,
    addObject,
    updateObject,
    deleteObject,
    clearAll,
    resetFromFloor,
    addCustomAsset,
    getAsset,
  }
}
