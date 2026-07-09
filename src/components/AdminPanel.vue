<script setup>
import { computed } from 'vue'
import { CATEGORY_COLORS } from '../data/floors.js'
import { getZoneSize } from '../lib/zoneGeometry.js'

const props = defineProps({
  zone: { type: Object, default: null },
  sceneObject: { type: Object, default: null },
  sceneObjectAsset: { type: Object, default: null },
  hasEdits: { type: Boolean, default: false },
  defaultHeight: { type: Number, default: 2.4 },
})

const emit = defineEmits([
  'update-zone',
  'delete-zone',
  'reset-zone',
  'reset-all',
  'add-zone',
  'add-object',
  'delete-scene-object',
  'export-json',
])

const OFFSET_MIN = -30
const OFFSET_MAX = 30

function clampOffset(value) {
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Number(value) || 0))
}

const zoneHeight = computed({
  get: () => props.zone?.height ?? props.defaultHeight,
  set: (v) => emit('update-zone', { height: Number(v) }),
})

const zoneColor = computed({
  get: () => props.zone?.color ?? CATEGORY_COLORS[props.zone?.category] ?? '#6db56d',
  set: (v) => emit('update-zone', { color: v }),
})

const zoneName = computed({
  get: () => props.zone?.name ?? '',
  set: (v) => emit('update-zone', { name: v }),
})

const zoneWidth = computed({
  get: () => (props.zone ? getZoneSize(props.zone)[0] : 0),
  set: (v) => {
    if (!props.zone) return
    const [, depth] = getZoneSize(props.zone)
    emit('update-zone', { size: [Math.max(0.5, Number(v)), depth] })
  },
})

const zoneDepth = computed({
  get: () => (props.zone ? getZoneSize(props.zone)[1] : 0),
  set: (v) => {
    if (!props.zone) return
    const [width] = getZoneSize(props.zone)
    emit('update-zone', { size: [width, Math.max(0.5, Number(v))] })
  },
})

const zoneOffsetX = computed({
  get: () => props.zone?.offset?.[0] ?? 0,
  set: (v) => {
    if (!props.zone) return
    emit('update-zone', {
      offset: [clampOffset(v), props.zone?.offset?.[1] ?? 0],
    })
  },
})

const zoneOffsetZ = computed({
  get: () => props.zone?.offset?.[1] ?? 0,
  set: (v) => {
    if (!props.zone) return
    emit('update-zone', {
      offset: [props.zone?.offset?.[0] ?? 0, clampOffset(v)],
    })
  },
})
</script>

<template>
  <aside class="admin-panel">
    <div class="admin-panel__header">
      <h2>Админка</h2>
      <span v-if="hasEdits" class="admin-panel__badge">Есть изменения</span>
    </div>

    <div class="admin-panel__actions">
      <button type="button" class="admin-btn admin-btn--primary" @click="emit('add-zone')">
        + Добавить блок
      </button>
      <button type="button" class="admin-btn admin-btn--primary" @click="emit('add-object')">
        + Добавить объект
      </button>
      <button type="button" class="admin-btn" @click="emit('export-json')">
        Экспорт JSON
      </button>
      <button
        type="button"
        class="admin-btn admin-btn--danger"
        :disabled="!hasEdits"
        @click="emit('reset-all')"
      >
        Сбросить всё
      </button>
    </div>

    <p class="admin-panel__hint">
      Выберите блок и двигайте его стрелками гизмо (красная — X, синяя — Z) или задайте смещение
      вручную. Оригинальные координаты сохранены — сброс вернёт позицию и размер.
    </p>

    <div v-if="sceneObject" class="admin-panel__form">
      <h3>Объект {{ sceneObject.id }}</h3>

      <p class="admin-field__meta">
        Модель: {{ sceneObjectAsset?.name ?? sceneObject.assetId }}
      </p>

      <p class="admin-field__meta">
        Позиция: X {{ (sceneObject.position?.[0] ?? 0).toFixed(1) }},
        Z {{ (sceneObject.position?.[1] ?? 0).toFixed(1) }}
      </p>

      <p class="admin-panel__hint">
        Двигайте объект стрелками гизмо (красная — X, синяя — Z).
      </p>

      <div class="admin-panel__zone-actions">
        <button type="button" class="admin-btn admin-btn--danger" @click="emit('delete-scene-object')">
          Удалить объект
        </button>
      </div>
    </div>

    <div v-else-if="zone" class="admin-panel__form">
      <h3>Блок №{{ zone.id }}</h3>

      <label class="admin-field">
        <span>Название</span>
        <input v-model="zoneName" type="text" placeholder="Название" />
      </label>

      <label class="admin-field">
        <span>Высота</span>
        <div class="admin-field__row">
          <input v-model.number="zoneHeight" type="range" min="0.5" max="8" step="0.1" />
          <input v-model.number="zoneHeight" type="number" min="0.5" max="8" step="0.1" class="admin-field__num" />
        </div>
      </label>

      <label class="admin-field">
        <span>Ширина</span>
        <div class="admin-field__row">
          <input v-model.number="zoneWidth" type="range" min="0.5" max="40" step="0.1" />
          <input v-model.number="zoneWidth" type="number" min="0.5" max="40" step="0.1" class="admin-field__num" />
        </div>
      </label>

      <label class="admin-field">
        <span>Глубина</span>
        <div class="admin-field__row">
          <input v-model.number="zoneDepth" type="range" min="0.5" max="40" step="0.1" />
          <input v-model.number="zoneDepth" type="number" min="0.5" max="40" step="0.1" class="admin-field__num" />
        </div>
      </label>

      <label class="admin-field">
        <span>Цвет</span>
        <div class="admin-field__row">
          <input v-model="zoneColor" type="color" class="admin-field__color" />
          <input v-model="zoneColor" type="text" class="admin-field__hex" />
        </div>
      </label>

      <label class="admin-field">
        <span>Смещение X</span>
        <div class="admin-field__row">
          <input v-model.number="zoneOffsetX" type="range" :min="OFFSET_MIN" :max="OFFSET_MAX" step="0.1" />
          <input v-model.number="zoneOffsetX" type="number" :min="OFFSET_MIN" :max="OFFSET_MAX" step="0.1" class="admin-field__num" />
        </div>
      </label>

      <label class="admin-field">
        <span>Смещение Z</span>
        <div class="admin-field__row">
          <input v-model.number="zoneOffsetZ" type="range" :min="OFFSET_MIN" :max="OFFSET_MAX" step="0.1" />
          <input v-model.number="zoneOffsetZ" type="number" :min="OFFSET_MIN" :max="OFFSET_MAX" step="0.1" class="admin-field__num" />
        </div>
      </label>

      <div class="admin-panel__zone-actions">
        <button type="button" class="admin-btn" @click="emit('reset-zone')">
          Сбросить блок
        </button>
        <button type="button" class="admin-btn admin-btn--danger" @click="emit('delete-zone')">
          Удалить
        </button>
      </div>
    </div>

    <p v-else class="admin-panel__empty">Выберите блок на карте для редактирования</p>
  </aside>
</template>

<style scoped>
.admin-panel {
  width: 300px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-panel__header h2 {
  font-size: 16px;
  font-weight: 600;
}

.admin-panel__badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #fff3cd;
  color: #856404;
}

.admin-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
  text-align: left;
  transition: background 0.15s;
}

.admin-btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.admin-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-btn--primary {
  background: #1a1a1a;
  color: #fff;
  border-color: #1a1a1a;
}

.admin-btn--primary:hover:not(:disabled) {
  background: #333;
}

.admin-btn--danger {
  color: #c0392b;
  border-color: #f0c4c0;
}

.admin-panel__hint {
  font-size: 12px;
  color: #777;
  line-height: 1.45;
}

.admin-panel__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.admin-panel__form h3 {
  font-size: 14px;
  font-weight: 600;
}

.admin-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.admin-field input[type='text'],
.admin-field input[type='number'] {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  color: #1a1a1a;
}

.admin-field__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-field__row input[type='range'] {
  flex: 1;
}

.admin-field__num {
  width: 64px;
}

.admin-field__color {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
}

.admin-field__hex {
  flex: 1;
}

.admin-field__meta {
  font-size: 13px;
  color: #333;
}

.admin-panel__zone-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.admin-panel__empty {
  font-size: 13px;
  color: #999;
  padding-top: 8px;
  border-top: 1px solid #eee;
}
</style>
