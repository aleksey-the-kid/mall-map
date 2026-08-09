<script setup>
import { computed } from 'vue'
import { CATEGORY_LABELS } from '../data/floors.js'
import TagsInput from './TagsInput.vue'

const props = defineProps({
  zone: { type: Object, default: null },
  hasEdits: { type: Boolean, default: false },
  /** '2d' = edit metadata; '3d' = preview only */
  editorMode: { type: String, default: '3d' },
})

const emit = defineEmits([
  'update-zone',
  'delete-zone',
  'reset-all',
  'export-json',
])

const is2d = computed(() => props.editorMode === '2d')
const isPreview = computed(() => props.editorMode === '3d')
const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const categoryLabel = computed(
  () => CATEGORY_LABELS[props.zone?.category] ?? props.zone?.category ?? '—',
)

const zoneName = computed({
  get: () => props.zone?.name ?? '',
  set: (v) => emit('update-zone', { name: v }),
})

const zoneCategory = computed({
  get: () => props.zone?.category ?? 'shop',
  set: (v) => emit('update-zone', { category: v }),
})

const zoneTags = computed({
  get: () => props.zone?.tags ?? [],
  set: (v) => emit('update-zone', { tags: v }),
})

const zoneDescription = computed({
  get: () => props.zone?.description ?? '',
  set: (v) => emit('update-zone', { description: v }),
})
</script>

<template>
  <aside class="admin-panel">
    <div class="admin-panel__header">
      <h2>{{ isPreview ? 'Просмотр' : 'Зона' }}</h2>
      <span v-if="hasEdits && is2d" class="admin-panel__badge">Есть изменения</span>
    </div>

    <div v-if="is2d" class="admin-panel__actions">
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

    <p v-if="is2d" class="admin-panel__hint">
      Выберите зону на плане, чтобы задать название, категорию и теги.
    </p>
    <p v-else class="admin-panel__hint">
      Режим предпросмотра 3D. Редактирование — на вкладке «План 2D».
    </p>

    <div v-if="isPreview && zone" class="admin-panel__form">
      <h3>{{ zone.name || `Зона №${zone.id}` }}</h3>
      <p class="admin-field__meta">Категория: {{ categoryLabel }}</p>
      <p v-if="zone.tags?.length" class="admin-field__meta">
        Теги: {{ zone.tags.join(', ') }}
      </p>
      <p v-if="zone.description" class="admin-field__meta">{{ zone.description }}</p>
    </div>

    <div v-else-if="is2d && zone" class="admin-panel__form">
      <h3>Зона №{{ zone.id }}</h3>

      <label class="admin-field">
        <span>Название</span>
        <input v-model="zoneName" type="text" placeholder="Название" />
      </label>

      <label class="admin-field">
        <span>Категория</span>
        <select v-model="zoneCategory" class="admin-field__select">
          <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="admin-field">
        <span>Теги</span>
        <TagsInput v-model:tags="zoneTags" />
        <span class="admin-field__hint">Для поиска: майка, кофе, аптека…</span>
      </label>

      <label class="admin-field">
        <span>Описание</span>
        <textarea
          v-model="zoneDescription"
          class="admin-field__textarea"
          rows="3"
          placeholder="Короткое описание"
        />
      </label>

      <div class="admin-panel__zone-actions">
        <button type="button" class="admin-btn admin-btn--danger" @click="emit('delete-zone')">
          Удалить
        </button>
      </div>
    </div>

    <p v-else class="admin-panel__empty">
      {{ isPreview ? 'Кликните зону на карте' : 'Выберите зону на плане' }}
    </p>
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
.admin-field select,
.admin-field textarea {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  color: #1a1a1a;
}

.admin-field__select {
  background: #fff;
}

.admin-field__textarea {
  resize: vertical;
  min-height: 72px;
  font-family: inherit;
}

.admin-field__hint {
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.admin-field__meta {
  font-size: 13px;
  color: #333;
  margin: 0;
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
