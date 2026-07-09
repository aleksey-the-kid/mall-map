<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import MallMap3D from '../components/MallMap3D.vue'
import { searchZones, findZoneById, CATEGORY_LABELS } from '../data/floors.js'
import { useMallData } from '../composables/useMallData.js'

const {
  malls,
  currentMallId,
  currentFloorId,
  currentMall,
  currentFloor,
  floorOptions,
  loading,
  error,
  loadMalls,
  setMall,
  setFloor,
} = useMallData()

const selectedZoneId = ref(null)
const searchQuery = ref('')
const showPlan = ref(false)
const mapRef = ref(null)

const renderableFloor = computed(() => {
  const floor = currentFloor.value
  if (!floor || floor.status !== 'ready') return null
  return floor
})

const searchResults = computed(() => {
  if (!searchQuery.value.trim() || !renderableFloor.value) return []
  return searchZones(renderableFloor.value, searchQuery.value).slice(0, 8)
})

const selectedZone = computed(() =>
  selectedZoneId.value ? findZoneById(renderableFloor.value, selectedZoneId.value) : null,
)

const selectedZoneCategory = computed(() => {
  const cat = selectedZone.value?.category
  return cat ? (CATEGORY_LABELS[cat] ?? cat) : null
})

onMounted(() => {
  loadMalls()
})

function onZoneClick(id) {
  selectedZoneId.value = id ? String(id) : null
}

function selectSearchResult(zone) {
  searchQuery.value = zone.name
  mapRef.value?.focusZone(zone)
  selectedZoneId.value = zone.id
}

function clearSearch() {
  searchQuery.value = ''
}

function onSelectMall(id) {
  setMall(id)
  selectedZoneId.value = null
  searchQuery.value = ''
}

function onSelectFloor(id) {
  setFloor(id)
  selectedZoneId.value = null
  searchQuery.value = ''
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header__brand">
        <span class="header__logo">{{ currentMall?.name ?? 'Карта ТЦ' }}</span>
        <span v-if="currentMall?.address" class="header__address">{{ currentMall.address }}</span>
      </div>
      <nav class="header__nav">
        <select
          v-if="malls.length > 1"
          class="header__select"
          :value="currentMallId"
          @change="onSelectMall($event.target.value)"
        >
          <option v-for="mall in malls" :key="mall.id" :value="mall.id">
            {{ mall.name }}
          </option>
        </select>
        <RouterLink to="/admin" class="header__admin">Админка</RouterLink>
      </nav>
    </header>

    <main class="main">
      <div class="toolbar">
        <div class="search">
          <svg class="search__icon" viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Найти магазин"
            class="search__input"
            :disabled="!renderableFloor"
            @keydown.escape="clearSearch"
          />
          <ul v-if="searchResults.length" class="search__results">
            <li
              v-for="zone in searchResults"
              :key="zone.id"
              @click="selectSearchResult(zone)"
            >
              {{ zone.name }}
            </li>
          </ul>
        </div>

        <div class="floor-selector">
          <button
            v-for="opt in floorOptions"
            :key="opt.id"
            class="floor-btn"
            :class="{
              'floor-btn--active': opt.id === currentFloorId,
              'floor-btn--disabled': opt.status !== 'ready',
            }"
            :disabled="opt.status !== 'ready'"
            :title="opt.status !== 'ready' ? 'Этаж ещё не готов' : opt.label"
            @click="onSelectFloor(opt.id)"
          >
            {{ opt.label.replace(' этаж', '') }}
          </button>
        </div>

        <label class="plan-toggle">
          <input v-model="showPlan" type="checkbox" :disabled="!renderableFloor" />
          План подложка
        </label>
      </div>

      <p v-if="error" class="banner banner--error">{{ error }}</p>
      <p v-if="loading" class="banner">Загрузка…</p>

      <div v-if="!renderableFloor && !loading" class="empty-state">
        <p v-if="currentFloor?.status === 'processing'">Этаж обрабатывается…</p>
        <p v-else-if="currentFloor?.status === 'empty'">План этажа ещё не загружен</p>
        <p v-else>Нет данных для отображения</p>
      </div>

      <div v-else class="map-wrap">
        <MallMap3D
          v-if="renderableFloor"
          ref="mapRef"
          :floor="renderableFloor"
          :selected-zone-id="selectedZoneId"
          :show-plan="showPlan"
          :admin-mode="false"
          @zone-click="onZoneClick"
        />

        <div class="zoom-controls">
          <button class="zoom-btn" title="Приблизить" @click="mapRef?.zoomIn()">+</button>
          <button class="zoom-btn" title="Отдалить" @click="mapRef?.zoomOut()">−</button>
        </div>

        <div v-if="selectedZone" class="info-panel">
          <p v-if="selectedZoneCategory" class="info-panel__category">{{ selectedZoneCategory }}</p>
          <h3>{{ selectedZone.name }}</h3>
          <p class="info-panel__meta">Помещение №{{ selectedZone.id }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.header__brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header__logo {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.header__address {
  font-size: 12px;
  color: #888;
}

.header__nav {
  display: flex;
  gap: 16px;
  align-items: center;
}

.header__select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
}

.header__admin {
  color: #444;
  text-decoration: none;
  font-size: 14px;
}

.header__admin:hover {
  color: #111;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 12px 24px;
  position: relative;
  flex-shrink: 0;
}

.search {
  position: absolute;
  left: 24px;
  width: 260px;
}

.search__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  pointer-events: none;
}

.search__input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1px solid #ddd;
  border-radius: 24px;
  background: #fff;
  outline: none;
  font-size: 14px;
}

.search__results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  list-style: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow: hidden;
}

.search__results li {
  padding: 10px 14px;
  font-size: 14px;
  cursor: pointer;
}

.search__results li:hover {
  background: #f5f5f5;
}

.floor-selector {
  display: flex;
  gap: 8px;
}

.floor-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border-radius: 18px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  color: #444;
}

.floor-btn--active {
  background: #1a1a1a;
  color: #fff;
  border-color: #1a1a1a;
}

.floor-btn--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.plan-toggle {
  position: absolute;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}

.banner {
  margin: 0 24px 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #e8f4fd;
  font-size: 13px;
}

.banner--error {
  background: #fdecea;
  color: #c0392b;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 15px;
}

.map-wrap {
  flex: 1;
  position: relative;
  min-height: 0;
  margin: 0 16px 16px;
  border-radius: 12px;
  overflow: hidden;
  background: #f0f0f0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.zoom-controls {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 5;
}

.zoom-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #ddd;
  font-size: 20px;
  line-height: 1;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.info-panel {
  position: absolute;
  left: 16px;
  bottom: 16px;
  background: #fff;
  padding: 14px 18px;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 5;
}

.info-panel h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.info-panel__category {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #e88388;
  margin-bottom: 4px;
}

.info-panel__meta {
  font-size: 12px;
  color: #888;
}
</style>
