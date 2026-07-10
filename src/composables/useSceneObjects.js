import { ref, computed, watch } from 'vue'
import { BUILTIN_SCENE_ASSETS } from '../data/sceneAssets.js'
import { normalizeSceneObject } from '../lib/sceneObjectSchema.js'

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

function normalizeObjectList(rawObjects, getAsset) {
  return (rawObjects ?? []).map((raw, index) => {
    const asset = getAsset?.(raw.assetId)
    return normalizeSceneObject(raw, {
      assetName: asset?.name,
      objectNum: index + 1,
    })
  })
}

export function useSceneObjects(floorRef, { useRemote = false, onDirty } = {}) {
  const objects = ref([])
  const originalSnapshot = ref([])
  const customAssets = ref([])
  const loadedFloorId = ref(null)

  const libraryAssets = computed(() => [...BUILTIN_SCENE_ASSETS, ...customAssets.value])

  function getAsset(assetId) {
    return libraryAssets.value.find((a) => a.id === assetId) ?? null
  }

  function persistObjectsLocal() {
    const floor = floorRef.value
    if (!floor?.id || useRemote) return
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

  function loadObjectsForFloor(floor) {
    const fromDb = floor.sceneObjects ?? floor.floorJson?.objects ?? []

    if (useRemote) {
      return normalizeObjectList(fromDb, getAsset)
    }

    const fromStorage = loadFromStorage(objectsKey(floor.id))
    if (fromStorage.length) {
      return normalizeObjectList(fromStorage, getAsset)
    }
    if (fromDb.length) {
      const normalized = normalizeObjectList(fromDb, getAsset)
      saveToStorage(objectsKey(floor.id), normalized)
      return normalized
    }
    return []
  }

  function resetFromFloor(floor) {
    if (!floor) {
      objects.value = []
      originalSnapshot.value = []
      customAssets.value = []
      loadedFloorId.value = null
      return
    }

    const snapshot = loadObjectsForFloor(floor)
    originalSnapshot.value = deepClone(snapshot)
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

  const hasEdits = computed(
    () => JSON.stringify(objects.value) !== JSON.stringify(originalSnapshot.value),
  )

  function findObjectIndex(id) {
    return objects.value.findIndex((o) => o.id === id)
  }

  function markDirty() {
    persistObjectsLocal()
    onDirty?.()
  }

  function addObject({ assetId, position }) {
    const asset = getAsset(assetId)
    const maxNum = objects.value.reduce((max, o) => {
      const n = Number.parseInt(String(o.id).replace(/\D/g, ''), 10) || 0
      return Math.max(max, n)
    }, 0)
    const objectNum = maxNum + 1
    const id = `obj-${objectNum}`
    const entry = normalizeSceneObject(
      {
        id,
        assetId,
        position: [...position],
        name: asset?.name,
      },
      { assetName: asset?.name, objectNum },
    )
    objects.value = [...objects.value, entry]
    markDirty()
    return id
  }

  function updateObject(id, patch) {
    const idx = findObjectIndex(id)
    if (idx === -1) return
    const current = objects.value[idx]
    const next = normalizeSceneObject(
      { ...current, ...patch },
      { assetName: getAsset(current.assetId)?.name },
    )
    objects.value[idx] = next
    objects.value = [...objects.value]
    markDirty()
  }

  function deleteObject(id) {
    objects.value = objects.value.filter((o) => o.id !== id)
    markDirty()
  }

  function resetAll() {
    objects.value = deepClone(originalSnapshot.value)
    markDirty()
  }

  function clearAll() {
    objects.value = []
    markDirty()
  }

  function commitSnapshot() {
    originalSnapshot.value = deepClone(objects.value)
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

  return {
    objects,
    originalSnapshot,
    hasEdits,
    customAssets,
    libraryAssets,
    addObject,
    updateObject,
    deleteObject,
    resetAll,
    clearAll,
    resetFromFloor,
    commitSnapshot,
    addCustomAsset,
    getAsset,
  }
}
