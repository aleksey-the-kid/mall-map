<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  mergePolygonPointsList,
  splitPolygonsByThickPolyline,
  cutBladePreviewRings,
} from '../lib/polygonEdit.js'

const FILL = 'rgba(37, 99, 235, 0.4)'
const FILL_MERGE = 'rgba(234, 88, 12, 0.45)'
const STROKE = '#2563eb'
const SELECTED_STROKE = '#1e3a8a'
const MERGE_STROKE = '#c2410c'
const DRAFT_STROKE = '#1d4ed8'
const ZONE_COLOR = '#2563eb'
const CLOSE_RADIUS_PX = 10
const DEFAULT_GAP_PX = 2
const VERTEX_MERGE_PX = 5

const props = defineProps({
  planImage: { type: String, default: null },
  planBounds: { type: Object, default: null },
  wallPxPerUnit: { type: Number, default: 10 },
  zones: { type: Array, default: () => [] },
  selectedZoneId: { type: String, default: null },
  detecting: { type: Boolean, default: false },
  canDetect: { type: Boolean, default: false },
  statusMessage: { type: String, default: '' },
  defaultHeight: { type: Number, default: 2.4 },
})

const emit = defineEmits(['select', 'zones-change', 'detect', 'delete-selected'])

const mode = ref('select')
const viewportRef = ref(null)
const svgRef = ref(null)
/** Visible plan-space rectangle (SVG viewBox) — zoom by shrinking/growing this, not CSS scale */
const viewX = ref(0)
const viewY = ref(0)
const viewW = ref(100)
const viewH = ref(100)
const draftPoints = ref([])
const rectStart = ref(null)
const rectCurrent = ref(null)
const drag = ref(null)
const spacePan = ref(false)
const hasFitted = ref(false)
const mergeSelectedIds = ref([])
const splitPoints = ref([])
const toolFeedback = ref('')
const splitGapPx = ref(DEFAULT_GAP_PX)

const hasPlan = computed(
  () => Boolean(props.planImage && props.planBounds?.width && props.planBounds?.height),
)

const pxPerUnit = computed(() => props.wallPxPerUnit || 10)

const gapPlan = computed(() => Math.max(0.05, Number(splitGapPx.value) || DEFAULT_GAP_PX) / pxPerUnit.value)

const vertexMergePlan = computed(() => VERTEX_MERGE_PX / pxPerUnit.value)

const viewBox = computed(() => `${viewX.value} ${viewY.value} ${viewW.value} ${viewH.value}`)

/** Handle radius in plan units ≈ constant ~7px on screen */
const handleRadius = computed(() => {
  const vp = viewportRef.value
  const w = vp?.clientWidth || 1
  return Math.max(0.05, (7 * viewW.value) / w)
})

const canConfirmSplit = computed(() => mode.value === 'split' && splitPoints.value.length >= 2)

const splitBladeRings = computed(() => {
  if (splitPoints.value.length < 2) return []
  return cutBladePreviewRings(splitPoints.value, gapPlan.value)
})

const splitPolylineAttr = computed(() => pointsAttr(splitPoints.value))

const canConfirmMerge = computed(() => mode.value === 'merge' && mergeSelectedIds.value.length >= 2)

watch(
  () => [props.planImage, props.planBounds?.width, props.planBounds?.height, hasPlan.value],
  async () => {
    hasFitted.value = false
    if (!hasPlan.value) return
    await nextTick()
    fitToView()
  },
)

function fitToView() {
  const vp = viewportRef.value
  const b = props.planBounds
  if (!vp || !b?.width || !b?.height) return
  const vw = vp.clientWidth
  const vh = vp.clientHeight
  if (vw < 32 || vh < 32) return
  const pad = 24
  const sx = (vw - pad * 2) / b.width
  const sy = (vh - pad * 2) / b.height
  const scale = Math.min(sx, sy)
  if (!Number.isFinite(scale) || scale <= 0) return
  viewW.value = vw / scale
  viewH.value = vh / scale
  viewX.value = (b.width - viewW.value) / 2
  viewY.value = (b.height - viewH.value) / 2
  hasFitted.value = true
}

function clientToPlan(clientX, clientY) {
  const svg = svgRef.value
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const p = pt.matrixTransform(ctm.inverse())
  return [p.x, p.y]
}

function distScreen(a, b) {
  const svg = svgRef.value
  if (!svg) return Infinity
  const ctm = svg.getScreenCTM()
  if (!ctm) return Infinity
  const dx = (a[0] - b[0]) * ctm.a
  const dy = (a[1] - b[1]) * ctm.d
  return Math.hypot(dx, dy)
}

function pointInPolygon(point, vs) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0]
    const yi = vs[i][1]
    const xj = vs[j][0]
    const yj = vs[j][1]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function nextZoneId(list) {
  return String(
    list.reduce((max, z) => Math.max(max, Number.parseInt(z.id, 10) || 0), 0) + 1,
  )
}

function makeZone(points, list = props.zones) {
  const id = nextZoneId(list)
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  return {
    id,
    name: `Зона ${id}`,
    category: 'shop',
    points: points.map(([x, y]) => [round2(x), round2(y)]),
    height: props.defaultHeight,
    size: [round2(w), round2(h)],
    color: ZONE_COLOR,
    offset: [0, 0],
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function pointsAttr(points) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

function bboxSize(points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return [
    round2(Math.max(...xs) - Math.min(...xs)),
    round2(Math.max(...ys) - Math.min(...ys)),
  ]
}

function zoneFromPoints(points, list, base = null) {
  const id = nextZoneId(list)
  return {
    id,
    name: base?.name ? `${base.name}` : `Зона ${id}`,
    category: base?.category ?? 'shop',
    description: base?.description ?? '',
    tags: Array.isArray(base?.tags) ? [...base.tags] : [],
    points: points.map(([x, y]) => [round2(x), round2(y)]),
    height: base?.height ?? props.defaultHeight,
    size: bboxSize(points),
    color: base?.color ?? ZONE_COLOR,
    offset: [0, 0],
  }
}

function setMode(next) {
  mode.value = next
  draftPoints.value = []
  rectStart.value = null
  rectCurrent.value = null
  drag.value = null
  mergeSelectedIds.value = []
  splitPoints.value = []
  toolFeedback.value = ''
  if (next !== 'select') emit('select', null)
}

function cancelDraft() {
  draftPoints.value = []
  rectStart.value = null
  rectCurrent.value = null
  splitPoints.value = []
  if (mode.value === 'merge') {
    mergeSelectedIds.value = []
    toolFeedback.value = ''
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (
      draftPoints.value.length ||
      rectStart.value ||
      splitPoints.value.length ||
      mergeSelectedIds.value.length
    ) {
      cancelDraft()
      return
    }
    emit('select', null)
    return
  }
  if (e.key === ' ' && !e.repeat) {
    spacePan.value = true
    e.preventDefault()
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && props.selectedZoneId && mode.value === 'select') {
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    emit('delete-selected')
  }
  if (e.key === 'Enter' && mode.value === 'merge' && canConfirmMerge.value) {
    e.preventDefault()
    confirmMerge()
  }
  if (e.key === 'Enter' && mode.value === 'split' && canConfirmSplit.value) {
    e.preventDefault()
    confirmSplit()
  }
}

function onKeyUp(e) {
  if (e.key === ' ') spacePan.value = false
}

function onWheel(e) {
  if (!hasPlan.value) return
  e.preventDefault()
  const vp = viewportRef.value
  if (!vp) return
  const factor = e.deltaY < 0 ? 1.02 : 1 / 1.02
  const planPt = clientToPlan(e.clientX, e.clientY)
  if (!planPt) return

  const minW = (props.planBounds?.width ?? 100) / 40
  const maxW = (props.planBounds?.width ?? 100) * 8
  const nextW = Math.min(maxW, Math.max(minW, viewW.value / factor))
  const nextH = nextW * (vp.clientHeight / vp.clientWidth)
  const rx = (planPt[0] - viewX.value) / viewW.value
  const ry = (planPt[1] - viewY.value) / viewH.value
  viewW.value = nextW
  viewH.value = nextH
  viewX.value = planPt[0] - rx * nextW
  viewY.value = planPt[1] - ry * nextH
}

function hitVertex(planPt, zone) {
  if (!zone?.points) return -1
  for (let i = 0; i < zone.points.length; i++) {
    if (distScreen(planPt, zone.points[i]) <= CLOSE_RADIUS_PX) return i
  }
  return -1
}

function hitZone(planPt) {
  for (let i = props.zones.length - 1; i >= 0; i--) {
    const z = props.zones[i]
    if (z.points?.length >= 3 && pointInPolygon(planPt, z.points)) return z
  }
  return null
}

function onPointerDown(e) {
  if (!hasPlan.value || e.button !== 0) return
  const planPt = clientToPlan(e.clientX, e.clientY)
  if (!planPt) return

  if (spacePan.value || e.altKey) {
    drag.value = {
      type: 'pan',
      x: e.clientX,
      y: e.clientY,
      viewX: viewX.value,
      viewY: viewY.value,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    return
  }

  if (mode.value === 'merge') {
    const hit = hitZone(planPt)
    if (!hit) return
    const idx = mergeSelectedIds.value.indexOf(hit.id)
    if (idx === -1) {
      mergeSelectedIds.value = [...mergeSelectedIds.value, hit.id]
    } else {
      mergeSelectedIds.value = mergeSelectedIds.value.filter((id) => id !== hit.id)
    }
    emit('select', hit.id)
    const n = mergeSelectedIds.value.length
    toolFeedback.value =
      n < 2
        ? `Выбрано: ${n}. Выберите ещё зоны, затем подтвердите`
        : `Выбрано: ${n}. Нажмите «Объединить» или Enter`
    return
  }

  if (mode.value === 'split') {
    splitPoints.value = [...splitPoints.value, planPt]
    toolFeedback.value =
      splitPoints.value.length < 2
        ? 'Добавьте ещё точки линии разреза'
        : `Точек: ${splitPoints.value.length}. Нажмите «Применить разрез» или Enter`
    return
  }

  if (mode.value === 'polygon') {
    if (draftPoints.value.length >= 3) {
      const first = draftPoints.value[0]
      if (distScreen(planPt, first) <= CLOSE_RADIUS_PX) {
        const zone = makeZone([...draftPoints.value])
        emit('zones-change', [...props.zones, zone])
        emit('select', zone.id)
        draftPoints.value = []
        mode.value = 'select'
        return
      }
    }
    draftPoints.value = [...draftPoints.value, planPt]
    return
  }

  if (mode.value === 'rectangle') {
    rectStart.value = planPt
    rectCurrent.value = planPt
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.value = { type: 'rect' }
    return
  }

  // select mode
  const selected = props.zones.find((z) => z.id === props.selectedZoneId)
  if (selected) {
    const vi = hitVertex(planPt, selected)
    if (vi !== -1) {
      drag.value = {
        type: 'vertex',
        zoneId: selected.id,
        vertexIndex: vi,
        start: planPt,
        points: selected.points.map((p) => [...p]),
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (pointInPolygon(planPt, selected.points)) {
      drag.value = {
        type: 'move',
        zoneId: selected.id,
        start: planPt,
        points: selected.points.map((p) => [...p]),
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
  }

  const hit = hitZone(planPt)
  if (hit) {
    emit('select', hit.id)
    drag.value = {
      type: 'move',
      zoneId: hit.id,
      start: planPt,
      points: hit.points.map((p) => [...p]),
      justSelected: true,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    return
  }

  emit('select', null)
}

function onPointerMove(e) {
  if (!drag.value) {
    if (mode.value === 'rectangle' && rectStart.value) {
      const planPt = clientToPlan(e.clientX, e.clientY)
      if (planPt) rectCurrent.value = planPt
    }
    return
  }

  if (drag.value.type === 'pan') {
    const vp = viewportRef.value
    if (!vp?.clientWidth) return
    const dx = ((e.clientX - drag.value.x) * viewW.value) / vp.clientWidth
    const dy = ((e.clientY - drag.value.y) * viewH.value) / vp.clientHeight
    viewX.value = drag.value.viewX - dx
    viewY.value = drag.value.viewY - dy
    return
  }

  const planPt = clientToPlan(e.clientX, e.clientY)
  if (!planPt) return

  if (drag.value.type === 'rect') {
    rectCurrent.value = planPt
    return
  }

  if (drag.value.type === 'vertex') {
    const points = drag.value.points.map((p) => [...p])
    points[drag.value.vertexIndex] = planPt
    patchZonePoints(drag.value.zoneId, points)
    return
  }

  if (drag.value.type === 'move') {
    const dx = planPt[0] - drag.value.start[0]
    const dy = planPt[1] - drag.value.start[1]
    if (drag.value.justSelected && Math.hypot(dx, dy) < 0.05) return
    const points = drag.value.points.map(([x, y]) => [x + dx, y + dy])
    patchZonePoints(drag.value.zoneId, points)
  }
}

function patchZonePoints(zoneId, points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const next = props.zones.map((z) => {
    if (z.id !== zoneId) return z
    return {
      ...z,
      points: points.map(([x, y]) => [round2(x), round2(y)]),
      size: [round2(Math.max(...xs) - Math.min(...xs)), round2(Math.max(...ys) - Math.min(...ys))],
    }
  })
  emit('zones-change', next)
}

function confirmSplit() {
  if (splitPoints.value.length < 2) return
  const line = splitPoints.value.map((p) => [...p])

  const polys = props.zones.map((z) => z.points)
  const changes = splitPolygonsByThickPolyline(polys, line, gapPlan.value, vertexMergePlan.value)
  if (!changes.length) {
    toolFeedback.value = 'Линия никого не разрезала — проведите через фигуру'
    return
  }

  let next = [...props.zones]
  const ordered = [...changes].sort((x, y) => y.index - x.index)
  let created = 0
  for (const { index, parts } of ordered) {
    const base = next[index]
    const rest = next.filter((_, i) => i !== index)
    const newZones = []
    for (let p = 0; p < parts.length; p++) {
      const z = zoneFromPoints(parts[p], [...rest, ...newZones], base)
      if (base?.name) {
        z.name = `${base.name}${parts.length > 1 ? ` ${String.fromCharCode(65 + p)}` : ''}`
      }
      newZones.push(z)
      created++
    }
    next = [...rest, ...newZones]
  }

  splitPoints.value = []
  emit('zones-change', next)
  emit('select', next[next.length - 1]?.id ?? null)
  toolFeedback.value = `Разрезано зон: ${changes.length}, частей: ${created}`
  mode.value = 'select'
}

function confirmMerge() {
  if (mergeSelectedIds.value.length < 2) return
  const selected = mergeSelectedIds.value
    .map((id) => props.zones.find((z) => z.id === id))
    .filter(Boolean)
  if (selected.length < 2) return

  const mergedPts = mergePolygonPointsList(
    selected.map((z) => z.points),
    gapPlan.value,
  )
  if (!mergedPts) {
    toolFeedback.value = 'Не удалось объединить'
    return
  }

  const rest = props.zones.filter((z) => !mergeSelectedIds.value.includes(z.id))
  const zone = zoneFromPoints(mergedPts, rest, selected[0])
  const names = selected.map((z) => z.name).filter(Boolean)
  zone.name = names[0] || zone.name
  emit('zones-change', [...rest, zone])
  emit('select', zone.id)
  mergeSelectedIds.value = []
  toolFeedback.value = `Объединено зон: ${selected.length}`
  mode.value = 'select'
}

function onPointerUp(e) {
  if (drag.value?.type === 'rect' && rectStart.value && rectCurrent.value) {
    const [x0, y0] = rectStart.value
    const [x1, y1] = rectCurrent.value
    const minX = Math.min(x0, x1)
    const maxX = Math.max(x0, x1)
    const minY = Math.min(y0, y1)
    const maxY = Math.max(y0, y1)
    if (maxX - minX > 0.2 && maxY - minY > 0.2) {
      const zone = makeZone([
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ])
      emit('zones-change', [...props.zones, zone])
      emit('select', zone.id)
      mode.value = 'select'
    }
    rectStart.value = null
    rectCurrent.value = null
  }
  drag.value = null
  try {
    e.currentTarget.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

const draftPolyline = computed(() => pointsAttr(draftPoints.value))
const draftCloseHint = computed(() => {
  if (draftPoints.value.length < 3) return null
  return draftPoints.value[0]
})

const rectDraftPoints = computed(() => {
  if (!rectStart.value || !rectCurrent.value) return null
  const [x0, y0] = rectStart.value
  const [x1, y1] = rectCurrent.value
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
})

let resizeObserver = null

function observeViewport() {
  resizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined' || !viewportRef.value) return
  resizeObserver = new ResizeObserver(() => {
    if (!hasFitted.value) fitToView()
  })
  resizeObserver.observe(viewportRef.value)
}

watch(hasPlan, async (ready) => {
  if (!ready) return
  await nextTick()
  observeViewport()
  fitToView()
})

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  await nextTick()
  observeViewport()
  fitToView()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div class="editor">
    <div class="editor__toolbar">
      <div class="editor__modes">
        <button
          type="button"
          class="tool"
          :class="{ 'tool--active': mode === 'select' }"
          :disabled="!hasPlan"
          @click="setMode('select')"
        >
          Выбрать
        </button>
        <button
          type="button"
          class="tool"
          :class="{ 'tool--active': mode === 'polygon' }"
          :disabled="!hasPlan"
          @click="setMode('polygon')"
        >
          Полигон
        </button>
        <button
          type="button"
          class="tool"
          :class="{ 'tool--active': mode === 'rectangle' }"
          :disabled="!hasPlan"
          @click="setMode('rectangle')"
        >
          Прямоугольник
        </button>
        <button
          type="button"
          class="tool"
          :class="{ 'tool--active': mode === 'merge' }"
          :disabled="!hasPlan"
          @click="setMode('merge')"
        >
          Объединить
        </button>
        <button
          type="button"
          class="tool"
          :class="{ 'tool--active': mode === 'split' }"
          :disabled="!hasPlan"
          @click="setMode('split')"
        >
          Разрезать
        </button>
        <label v-if="mode === 'split'" class="tool-gap">
          Зазор
          <input
            v-model.number="splitGapPx"
            type="number"
            min="1"
            max="40"
            step="1"
            class="tool-gap__input"
          />
          px
        </label>
        <button
          v-if="mode === 'split'"
          type="button"
          class="tool tool--primary"
          :disabled="!canConfirmSplit"
          @click="confirmSplit"
        >
          Применить разрез
        </button>
        <button
          v-if="mode === 'merge'"
          type="button"
          class="tool tool--primary"
          :disabled="!canConfirmMerge"
          @click="confirmMerge"
        >
          Объединить ({{ mergeSelectedIds.length }})
        </button>
        <button
          type="button"
          class="tool"
          :disabled="!selectedZoneId"
          @click="emit('delete-selected')"
        >
          Удалить
        </button>
      </div>
      <div class="editor__actions">
        <button
          type="button"
          class="tool tool--primary"
          :disabled="!canDetect || detecting || !hasPlan"
          @click="emit('detect')"
        >
          {{ detecting ? 'Поиск…' : 'Найти магазины' }}
        </button>
        <button type="button" class="tool" :disabled="!hasPlan" @click="fitToView">Вписать</button>
      </div>
    </div>

    <p v-if="statusMessage" class="editor__status">{{ statusMessage }}</p>
    <p v-else-if="toolFeedback" class="editor__status">{{ toolFeedback }}</p>
    <p v-else-if="mode === 'polygon'" class="editor__hint">
      Кликайте точки. Клик по первой точке (≥3) замыкает фигуру. Esc — отмена.
    </p>
    <p v-else-if="mode === 'rectangle'" class="editor__hint">
      Потяните мышью, чтобы нарисовать прямоугольник.
    </p>
    <p v-else-if="mode === 'merge'" class="editor__hint">
      Кликайте зоны для мультивыбора (повторный клик снимает). Затем «Объединить» или Enter. Можно с небольшим зазором.
    </p>
    <p v-else-if="mode === 'split'" class="editor__hint">
      Кликайте точки линии разреза. Когда линия готова — «Применить разрез» или Enter (зазор {{ splitGapPx }}px). Esc — сброс.
    </p>
    <p v-else class="editor__hint">
      Клик — выбрать. Перетаскивайте фигуру или точки. Колесо — масштаб, Alt/Space — панорамирование.
    </p>

    <div
      v-if="hasPlan"
      ref="viewportRef"
      class="editor__viewport"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <svg
        ref="svgRef"
        class="editor__svg"
        :viewBox="viewBox"
        preserveAspectRatio="none"
        shape-rendering="geometricPrecision"
      >
          <image
            :href="planImage"
            x="0"
            y="0"
            :width="planBounds.width"
            :height="planBounds.height"
            preserveAspectRatio="none"
          />

          <polygon
            v-for="zone in zones"
            :key="zone.id"
            :points="pointsAttr(zone.points)"
            :fill="mergeSelectedIds.includes(zone.id) ? FILL_MERGE : FILL"
            :stroke="
              mergeSelectedIds.includes(zone.id)
                ? MERGE_STROKE
                : zone.id === selectedZoneId
                  ? SELECTED_STROKE
                  : STROKE
            "
            :stroke-width="
              zone.id === selectedZoneId || mergeSelectedIds.includes(zone.id) ? 2.5 : 1.5
            "
            vector-effect="non-scaling-stroke"
          />

          <polygon
            v-for="(ring, ri) in splitBladeRings"
            :key="`blade-${ri}`"
            :points="pointsAttr(ring)"
            fill="rgba(194, 65, 12, 0.35)"
            stroke="#c2410c"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
          />
          <polyline
            v-if="splitPoints.length"
            :points="splitPolylineAttr"
            fill="none"
            stroke="#9a3412"
            stroke-width="1.5"
            stroke-dasharray="6 4"
            vector-effect="non-scaling-stroke"
          />
          <circle
            v-for="(pt, i) in splitPoints"
            :key="`sp-${i}`"
            :cx="pt[0]"
            :cy="pt[1]"
            :r="handleRadius"
            class="handle handle--split"
            vector-effect="non-scaling-stroke"
          />

          <g v-if="selectedZoneId && mode === 'select'">
            <circle
              v-for="(pt, i) in zones.find((z) => z.id === selectedZoneId)?.points || []"
              :key="`h-${i}`"
              :cx="pt[0]"
              :cy="pt[1]"
              :r="handleRadius"
              class="handle"
              vector-effect="non-scaling-stroke"
            />
          </g>

          <polyline
            v-if="draftPoints.length"
            :points="draftPolyline"
            fill="none"
            :stroke="DRAFT_STROKE"
            stroke-width="1.5"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
          />
          <circle
            v-for="(pt, i) in draftPoints"
            :key="`d-${i}`"
            :cx="pt[0]"
            :cy="pt[1]"
            :r="i === 0 ? handleRadius * 1.15 : handleRadius * 0.85"
            class="handle handle--draft"
            :class="{ 'handle--close': i === 0 && draftPoints.length >= 3 }"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-if="draftCloseHint && draftPoints.length >= 2"
            :x1="draftPoints[draftPoints.length - 1][0]"
            :y1="draftPoints[draftPoints.length - 1][1]"
            :x2="draftCloseHint[0]"
            :y2="draftCloseHint[1]"
            stroke="#1d4ed8"
            stroke-width="1"
            stroke-dasharray="3 2"
            opacity="0.5"
            vector-effect="non-scaling-stroke"
          />

          <polygon
            v-if="rectDraftPoints"
            :points="pointsAttr(rectDraftPoints)"
            :fill="FILL"
            :stroke="DRAFT_STROKE"
            stroke-width="1.5"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
          />
        </svg>
    </div>

    <div v-else class="editor__empty">
      <h3>Нет плана этажа</h3>
      <p>Загрузите изображение плана, чтобы рисовать и искать магазины.</p>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f0f0f0;
}

.editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.editor__modes,
.editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
  color: #333;
}

.tool:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tool--active {
  background: #1a1a1a;
  color: #fff;
  border-color: #1a1a1a;
}

.tool--primary {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.tool--primary:disabled {
  background: #2563eb;
  color: #fff;
}

.tool-gap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  font-size: 12px;
  color: #555;
}

.tool-gap__input {
  width: 52px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
}

.editor__hint,
.editor__status {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: #666;
  background: #fafafa;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.editor__status {
  color: #1e3a8a;
  background: #eff6ff;
}

.editor__viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
  position: relative;
  background: #e8e8e8;
}

.editor__svg {
  display: block;
  width: 100%;
  height: 100%;
  background: #fff;
}

.handle {
  fill: #fff;
  stroke: #1e3a8a;
  stroke-width: 1.5px;
}

.handle--draft {
  stroke: #1d4ed8;
}

.handle--close {
  fill: #2563eb;
}

.handle--split {
  fill: #fff7ed;
  stroke: #c2410c;
  stroke-width: 1.5px;
}

.editor__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  padding: 24px;
  text-align: center;
}

.editor__empty h3 {
  margin: 0;
  color: #222;
}
</style>
