<script setup>
import { ref, computed } from 'vue'
import MallMap3D from './components/MallMap3D.vue'
import {
  FLOORS,
  FLOOR_OPTIONS,
  MALL_NAME,
  MALL_ADDRESS,
  searchZones,
  findZoneById,
} from './data/floors.js'

const currentFloorId = ref(1)
const selectedZoneId = ref(null)
const searchQuery = ref('')
const showPlan = ref(false)
const mapRef = ref(null)

const currentFloor = computed(() => FLOORS.find((f) => f.id === currentFloorId.value))

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  return searchZones(currentFloor.value, searchQuery.value).slice(0, 8)
})

const selectedZone = computed(() =>
  selectedZoneId.value ? findZoneById(currentFloor.value, selectedZoneId.value) : null,
)

function onZoneClick(id) {
  selectedZoneId.value = id
}

function selectSearchResult(zone) {
  searchQuery.value = zone.name
  mapRef.value?.focusZone(zone)
  selectedZoneId.value = zone.id
}

function clearSearch() {
  searchQuery.value = ''
}

function setFloor(id) {
  if (id === currentFloorId.value) return
  currentFloorId.value = id
  selectedZoneId.value = null
  searchQuery.value = ''
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header__brand">
        <span class="header__logo">{{ MALL_NAME }}</span>
        <span class="header__address">{{ MALL_ADDRESS }}</span>
      </div>
      <nav class="header__nav">
        <a href="#">Магазины</a>
        <a href="#">Кафе</a>
        <a href="#">Акции</a>
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
            v-for="opt in FLOOR_OPTIONS"
            :key="opt.id"
            class="floor-btn"
            :class="{ 'floor-btn--active': opt.id === currentFloorId }"
            @click="setFloor(opt.id)"
          >
            {{ opt.id }}
          </button>
          <button
            v-for="n in 3"
            :key="'placeholder-' + n"
            class="floor-btn floor-btn--disabled"
            disabled
            :title="'Этаж ' + (currentFloorId + n) + ' — скоро'"
          >
            {{ currentFloorId + n }}
          </button>
        </div>

        <label class="plan-toggle">
          <input v-model="showPlan" type="checkbox" />
          План подложка
        </label>
      </div>

      <div class="map-wrap">
        <MallMap3D
          ref="mapRef"
          :floor="currentFloor"
          :selected-zone-id="selectedZoneId"
          :show-plan="showPlan"
          @zone-click="onZoneClick"
        />

        <div class="zoom-controls">
          <button class="zoom-btn" title="Приблизить" @click="mapRef?.zoomIn()">+</button>
          <button class="zoom-btn" title="Отдалить" @click="mapRef?.zoomOut()">−</button>
        </div>

        <div v-if="selectedZone" class="info-panel">
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
  gap: 24px;
}

.header__nav a {
  color: #444;
  text-decoration: none;
  font-size: 14px;
}

.header__nav a:hover {
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

.search__input:focus {
  border-color: #aaa;
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 14px;
  font-weight: 500;
  color: #444;
  transition: all 0.15s;
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
  user-select: none;
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
  transition: background 0.15s;
}

.zoom-btn:hover {
  background: #f8f8f8;
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

.info-panel__meta {
  font-size: 12px;
  color: #888;
}
</style>
