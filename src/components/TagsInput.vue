<script setup>
import { ref } from 'vue'
import { normalizeTags } from '../lib/sceneObjectSchema.js'

const tags = defineModel('tags', { type: Array, default: () => [] })

const input = ref('')

function commitInput() {
  const parts = input.value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return
  tags.value = normalizeTags([...tags.value, ...parts])
  input.value = ''
}

function onKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commitInput()
  } else if (event.key === 'Backspace' && !input.value && tags.value.length) {
    tags.value = tags.value.slice(0, -1)
  }
}

function removeTag(index) {
  tags.value = tags.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="tags-input">
    <div class="tags-input__chips">
      <span v-for="(tag, index) in tags" :key="`${tag}-${index}`" class="tags-input__chip">
        {{ tag }}
        <button type="button" class="tags-input__remove" aria-label="Удалить тег" @click="removeTag(index)">
          ×
        </button>
      </span>
      <input
        v-model="input"
        class="tags-input__field"
        type="text"
        placeholder="Введите тег и нажмите Enter"
        @keydown="onKeydown"
        @blur="commitInput"
      />
    </div>
  </div>
</template>

<style scoped>
.tags-input__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  min-height: 40px;
  align-items: center;
}

.tags-input__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f0f0f0;
  font-size: 12px;
  color: #333;
}

.tags-input__remove {
  border: none;
  background: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.tags-input__remove:hover {
  color: #333;
}

.tags-input__field {
  flex: 1;
  min-width: 120px;
  border: none;
  outline: none;
  font-size: 13px;
  padding: 2px 4px;
  color: #1a1a1a;
}
</style>
