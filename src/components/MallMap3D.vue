<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { MallMapRenderer } from '../lib/mallMapRenderer.js'

const props = defineProps({
  floor: { type: Object, required: true },
  selectedZoneId: { type: String, default: null },
  showPlan: { type: Boolean, default: false },
})

const emit = defineEmits(['zone-click', 'zone-hover'])

const containerRef = ref(null)
let renderer = null

watch(
  () => props.floor,
  (floor) => {
    if (renderer && floor) {
      renderer.loadFloor(floor, { showPlan: props.showPlan })
    }
  },
)

watch(
  () => props.selectedZoneId,
  (id) => renderer?.setSelectedZone(id),
)

watch(
  () => props.showPlan,
  () => {
    if (renderer && props.floor) {
      renderer.loadFloor(props.floor, { showPlan: props.showPlan })
    }
  },
)

onMounted(() => {
  renderer = new MallMapRenderer(containerRef.value)
  renderer.onZoneClick = (id) => emit('zone-click', id)
  renderer.onZoneHover = (id) => emit('zone-hover', id)
  renderer.loadFloor(props.floor, { showPlan: props.showPlan })
  if (props.selectedZoneId) renderer.setSelectedZone(props.selectedZoneId)
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

defineExpose({ zoomIn, zoomOut, focusZone })
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
