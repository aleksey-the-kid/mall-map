<script setup>
const DRAG_MIME = 'application/x-scene-asset'

const props = defineProps({
  assets: { type: Array, default: () => [] },
})

const emit = defineEmits(['back', 'upload-glb'])

function onDragStart(event, assetId) {
  event.dataTransfer.setData(DRAG_MIME, assetId)
  event.dataTransfer.effectAllowed = 'copy'
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  emit('upload-glb', file)
  event.target.value = ''
}
</script>

<template>
  <aside class="object-library">
    <div class="object-library__header">
      <button type="button" class="object-library__back" @click="emit('back')">
        ← Назад
      </button>
      <h2>Объекты</h2>
    </div>

    <p class="object-library__hint">
      Перетащите объект на карту. Объекты стоят на полу и двигаются только по горизонтали.
      Размещения хранятся локально в браузере, не в базе данных.
    </p>

    <label class="object-library__upload">
      <input type="file" accept=".glb,model/gltf-binary" @change="onFileChange" />
      + Загрузить GLB
    </label>

    <div class="object-library__grid">
      <div
        v-for="asset in assets"
        :key="asset.id"
        class="object-card"
        draggable="true"
        :title="`Перетащите «${asset.name}» на карту`"
        @dragstart="onDragStart($event, asset.id)"
      >
        <div
          class="object-card__preview"
          :class="{ 'object-card__preview--glb': asset.type === 'glb' }"
          :style="asset.previewColor ? { background: asset.previewColor } : undefined"
        >
          <span v-if="asset.type === 'glb'" class="object-card__badge">GLB</span>
        </div>
        <span class="object-card__name">{{ asset.name }}</span>
      </div>
    </div>

    <p v-if="!assets.length" class="object-library__empty">
      Нет доступных объектов. Загрузите GLB или используйте встроенные.
    </p>
  </aside>
</template>

<style scoped>
.object-library {
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

.object-library__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.object-library__back {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}

.object-library__back:hover {
  color: #111;
}

.object-library__header h2 {
  font-size: 16px;
  font-weight: 600;
}

.object-library__hint {
  font-size: 12px;
  color: #777;
  line-height: 1.45;
}

.object-library__upload {
  display: block;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed #ccc;
  background: #fafafa;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s;
}

.object-library__upload:hover {
  background: #f0f0f0;
}

.object-library__upload input {
  display: none;
}

.object-library__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.object-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 10px;
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s;
  user-select: none;
}

.object-card:hover {
  border-color: #ccc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.object-card:active {
  cursor: grabbing;
}

.object-card__preview {
  aspect-ratio: 1;
  border-radius: 8px;
  background: #4a90d9;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.object-card__preview--glb {
  background: linear-gradient(135deg, #e8e8e8, #d0d0d0);
}

.object-card__badge {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  letter-spacing: 0.04em;
}

.object-card__name {
  font-size: 12px;
  color: #333;
  text-align: center;
  line-height: 1.3;
  word-break: break-word;
}

.object-library__empty {
  font-size: 13px;
  color: #999;
}
</style>
