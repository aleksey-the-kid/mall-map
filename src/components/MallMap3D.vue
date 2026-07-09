<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { MallMapRenderer } from '../lib/mallMapRenderer.js'

const props = defineProps({
  floor: { type: Object, required: true },
  selectedZoneId: { type: String, default: null },
  selectedSceneObjectId: { type: String, default: null },
  sceneObjects: { type: Array, default: () => [] },
  resolveSceneAsset: { type: Function, default: null },
  showPlan: { type: Boolean, default: false },
  adminMode: { type: Boolean, default: false },
  hasEdits: { type: Boolean, default: false },
})

const emit = defineEmits([
  'zone-click',
  'zone-hover',
  'zone-move',
  'scene-object-click',
  'scene-object-move',
  'scene-object-drop',
])

const containerRef = ref(null)
let renderer = null

const useProcedural = computed(
  () =>
    props.adminMode ||
    props.hasEdits ||
    Boolean(props.floor?.zones?.length),
)

function loadCurrentFloor() {
  if (!renderer || !props.floor) return
  renderer.loadFloor(props.floor, {
    showPlan: props.showPlan,
    useProcedural: useProcedural.value,
  })
  loadSceneObjects()
}

async function loadSceneObjects() {
  if (!renderer || !props.resolveSceneAsset) return
  await renderer.loadSceneObjects(props.sceneObjects, props.resolveSceneAsset)
}

watch(
  () => [props.floor?.id, props.floor?.zones?.length, props.showPlan, useProcedural.value],
  () => loadCurrentFloor(),
)

watch(
  () => props.selectedZoneId,
  (id) => {
    if (id) renderer?.setSelectedZone(id)
    else if (!props.selectedSceneObjectId) renderer?.setSelectedZone(null)
  },
)

watch(
  () => props.selectedSceneObjectId,
  (id) => {
    if (id) renderer?.setSelectedSceneObject(id)
    else if (!props.selectedZoneId) renderer?.setSelectedSceneObject(null)
  },
)

watch(
  () => props.showPlan,
  () => loadCurrentFloor(),
)

watch(
  () => props.adminMode,
  (enabled) => {
    renderer?.setAdminMode(enabled)
    loadCurrentFloor()
  },
)

watch(
  () => props.hasEdits,
  () => {
    if (!props.adminMode) loadCurrentFloor()
  },
)

onMounted(() => {
  renderer = new MallMapRenderer(containerRef.value)
  renderer.onZoneClick = (id) => emit('zone-click', id)
  renderer.onZoneHover = (id) => emit('zone-hover', id)
  renderer.onZoneMove = (id, offset) => emit('zone-move', id, offset)
  renderer.onSceneObjectClick = (id) => emit('scene-object-click', id)
  renderer.onSceneObjectMove = (id, position) => emit('scene-object-move', id, position)
  renderer.onSceneObjectDrop = (assetId, position) => emit('scene-object-drop', assetId, position)
  renderer.setAdminMode(props.adminMode)
  loadCurrentFloor()
  if (props.selectedZoneId) renderer.setSelectedZone(props.selectedZoneId)
  if (props.selectedSceneObjectId) renderer.setSelectedSceneObject(props.selectedSceneObjectId)
})

onUnmounted(() => {
  renderer?.dispose()
  renderer = null
})

function zoomIn() {
  renderer?.zoomIn()
}

function zoomOut() {
  renderer?.zoomOut()
}

function focusZone(zone) {
  if (renderer && zone) {
    renderer.focusZone(zone, props.floor.planBounds)
    renderer.setSelectedZone(zone.id)
  }
}

function syncZone(zone) {
  renderer?.syncZone(zone)
}

function setZoneOffset(zoneId, offset) {
  renderer?.setZoneOffset(zoneId, offset)
}

function removeZone(zoneId) {
  renderer?.removeZone(zoneId)
}

function reloadFloor() {
  loadCurrentFloor()
}

async function addSceneObject(objectData, asset) {
  return renderer?.addSceneObject(objectData, asset)
}

function removeSceneObject(objectId) {
  renderer?.removeSceneObject(objectId)
}

function setSceneObjectPosition(objectId, position) {
  renderer?.setSceneObjectPosition(objectId, position)
}

function raycastGround(clientX, clientY) {
  return renderer?.raycastGround(clientX, clientY)
}

defineExpose({
  zoomIn,
  zoomOut,
  focusZone,
  syncZone,
  setZoneOffset,
  removeZone,
  reloadFloor,
  addSceneObject,
  removeSceneObject,
  setSceneObjectPosition,
  raycastGround,
})
</script>

<template>
  <div ref="containerRef" class="map-container" />
</template>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
