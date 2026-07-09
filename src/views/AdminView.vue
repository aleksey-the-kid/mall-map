<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import MallMap3D from '../components/MallMap3D.vue'
import AdminPanel from '../components/AdminPanel.vue'
import AdminLogin from '../components/AdminLogin.vue'
import { findZoneById } from '../data/floors.js'
import { useAuth } from '../composables/useAuth.js'
import { useMallData } from '../composables/useMallData.js'
import { useFloorAdmin } from '../composables/useFloorAdmin.js'

const {
  user,
  loading: authLoading,
  error: authError,
  isAuthenticated,
  requiresAuth,
  signIn,
  signOut,
} = useAuth()

const {
  malls,
  floors,
  currentMallId,
  currentFloorId,
  currentMall,
  currentFloor,
  floorOptions,
  loading: dataLoading,
  error: dataError,
  useRemote,
  loadMalls,
  createMall,
  createFloor,
  uploadPlan,
  setMall,
  setFloor,
} = useMallData()

const selectedZoneId = ref(null)
const showPlan = ref(true)
const mapRef = ref(null)
const uploading = ref(false)
const uploadError = ref(null)
const showCreateMall = ref(false)
const showCreateFloor = ref(false)
const newMallName = ref('')
const newMallAddress = ref('')
const newFloorLabel = ref('')

const floorForAdmin = computed(() => currentFloor.value)
const {
  zones,
  hasEdits,
  saving,
  saveError,
  updateZone,
  addZone,
  deleteZone,
  resetZone,
  resetAll,
  exportJson,
  resetFromFloor,
} = useFloorAdmin(floorForAdmin, { useRemote })

const renderableFloor = computed(() => {
  const floor = currentFloor.value
  if (!floor) return null
  return { ...floor, zones: zones.value }
})

const selectedZone = computed(() =>
  selectedZoneId.value ? findZoneById(renderableFloor.value, selectedZoneId.value) : null,
)

const floorReady = computed(() => currentFloor.value?.status === 'ready')
const floorEmpty = computed(() =>
  ['empty', 'error'].includes(currentFloor.value?.status ?? ''),
)
const floorProcessing = computed(() => currentFloor.value?.status === 'processing')

onMounted(() => {
  loadMalls()
})

async function handleSignIn({ email, password }) {
  await signIn(email, password)
}

function onZoneClick(id) {
  selectedZoneId.value = id
}

function onSelectMall(id) {
  setMall(id)
  selectedZoneId.value = null
}

function onSelectFloor(id) {
  setFloor(id)
  selectedZoneId.value = null
}

function onUpdateZone(patch) {
  if (!selectedZoneId.value) return
  updateZone(selectedZoneId.value, patch)
  if (patch.offset) {
    mapRef.value?.setZoneOffset(selectedZoneId.value, patch.offset)
    return
  }
  const zone = findZoneById(renderableFloor.value, selectedZoneId.value)
  if (zone) mapRef.value?.syncZone(zone)
}

function onZoneMove(id, offset) {
  updateZone(id, { offset })
}

function onAddZone() {
  const id = addZone()
  if (!id) return
  selectedZoneId.value = id
  const zone = findZoneById(renderableFloor.value, id)
  if (zone) {
    mapRef.value?.syncZone(zone)
    mapRef.value?.focusZone(zone)
  }
}

function onDeleteZone() {
  if (!selectedZoneId.value) return
  const id = selectedZoneId.value
  deleteZone(id)
  mapRef.value?.removeZone(id)
  selectedZoneId.value = null
}

function onResetZone() {
  if (!selectedZoneId.value) return
  const id = selectedZoneId.value
  resetZone(id)
  const zone = findZoneById(renderableFloor.value, id)
  if (zone) {
    mapRef.value?.syncZone(zone)
  } else {
    mapRef.value?.removeZone(id)
    selectedZoneId.value = null
  }
}

function onResetAll() {
  if (!confirm('Сбросить все изменения к оригинальной модели?')) return
  resetAll()
  selectedZoneId.value = null
  mapRef.value?.reloadFloor()
}

function isOffsetOnlyChange(prev, next) {
  const prevCopy = { ...prev }
  const nextCopy = { ...next }
  delete prevCopy.offset
  delete nextCopy.offset
  return JSON.stringify(prevCopy) === JSON.stringify(nextCopy)
}

async function onCreateMall() {
  if (!newMallName.value.trim()) return
  await createMall(newMallName.value.trim(), newMallAddress.value.trim())
  showCreateMall.value = false
  newMallName.value = ''
  newMallAddress.value = ''
}

async function onCreateFloor() {
  if (!newFloorLabel.value.trim()) return
  await createFloor(newFloorLabel.value.trim())
  showCreateFloor.value = false
  newFloorLabel.value = ''
}

async function onPlanUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !currentFloorId.value) return
  uploadError.value = null
  uploading.value = true
  try {
    const floor = await uploadPlan(currentFloorId.value, file)
    resetFromFloor(floor)
    selectedZoneId.value = null
    mapRef.value?.reloadFloor()
  } catch (err) {
    uploadError.value = err.message
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

watch(
  () => zones.value,
  (newZones, oldZones) => {
    if (!mapRef.value || !oldZones) return
    const oldIds = new Set(oldZones.map((z) => z.id))
    const newIds = new Set(newZones.map((z) => z.id))
    for (const id of oldIds) {
      if (!newIds.has(id)) mapRef.value.removeZone(id)
    }
    for (const zone of newZones) {
      const prev = oldZones.find((z) => z.id === zone.id)
      if (!prev || JSON.stringify(prev) === JSON.stringify(zone)) continue
      if (isOffsetOnlyChange(prev, zone)) continue
      mapRef.value.syncZone(zone)
    }
  },
  { deep: true },
)
</script>

<template>
  <AdminLogin
    v-if="requiresAuth && !isAuthenticated && !authLoading"
    :loading="authLoading"
    :error="authError"
    :sign-in="handleSignIn"
  />

  <div v-else class="app app--admin">
    <header class="header">
      <div class="header__brand">
        <span class="header__logo">
          {{ currentMall?.name ?? 'Админка' }} — управление
        </span>
        <div class="header__links">
          <RouterLink to="/" class="header__back">← К карте</RouterLink>
          <button v-if="requiresAuth && isAuthenticated" type="button" class="header__logout" @click="signOut">
            Выйти
          </button>
        </div>
      </div>

      <div class="header__controls">
        <select
          v-if="malls.length"
          class="header__select"
          :value="currentMallId"
          @change="onSelectMall($event.target.value)"
        >
          <option v-for="mall in malls" :key="mall.id" :value="mall.id">
            {{ mall.name }}
          </option>
        </select>
        <button type="button" class="header__btn" :disabled="!useRemote" @click="showCreateMall = true">+ ТЦ</button>
      </div>
    </header>

    <div v-if="showCreateMall" class="modal">
      <div class="modal__card">
        <h3>Новый торговый центр</h3>
        <label class="modal__field">
          <span>Название</span>
          <input v-model="newMallName" type="text" placeholder="GREEN CITY" />
        </label>
        <label class="modal__field">
          <span>Адрес</span>
          <input v-model="newMallAddress" type="text" placeholder="г. Минск, ..." />
        </label>
        <div class="modal__actions">
          <button type="button" class="header__btn" @click="showCreateMall = false">Отмена</button>
          <button type="button" class="header__btn header__btn--primary" @click="onCreateMall">Создать</button>
        </div>
      </div>
    </div>

    <div v-if="showCreateFloor" class="modal">
      <div class="modal__card">
        <h3>Новый этаж</h3>
        <label class="modal__field">
          <span>Название</span>
          <input v-model="newFloorLabel" type="text" placeholder="2 этаж" />
        </label>
        <div class="modal__actions">
          <button type="button" class="header__btn" @click="showCreateFloor = false">Отмена</button>
          <button type="button" class="header__btn header__btn--primary" @click="onCreateFloor">Создать</button>
        </div>
      </div>
    </div>

    <main class="main">
      <div class="toolbar">
        <div class="floor-bar">
          <button
            v-for="opt in floorOptions"
            :key="opt.id"
            class="floor-btn"
            :class="{ 'floor-btn--active': opt.id === currentFloorId }"
            :title="opt.label"
            @click="onSelectFloor(opt.id)"
          >
            {{ opt.label.replace(' этаж', '') }}
          </button>
          <button
            type="button"
            class="floor-btn floor-btn--add"
            title="Добавить этаж"
            :disabled="!useRemote"
            @click="showCreateFloor = true"
          >
            +
          </button>
        </div>

        <label class="plan-toggle">
          <input v-model="showPlan" type="checkbox" :disabled="!floorReady" />
          План подложка
        </label>
      </div>

      <p v-if="dataError" class="banner banner--error">{{ dataError }}</p>
      <p v-if="saveError" class="banner banner--error">Ошибка сохранения: {{ saveError }}</p>
      <p v-if="saving" class="banner">Сохранение…</p>

      <div v-if="floorEmpty && !floorProcessing" class="upload-panel">
        <h3>Загрузите план этажа</h3>
        <p v-if="!useRemote" class="banner banner--error">
          Настройте VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY и VITE_API_URL для загрузки планов.
        </p>
        <template v-else>
          <p>PNG с зелёными зонами магазинов (как green_city). После загрузки сгенерируется 3D-модель.</p>
          <label class="upload-btn">
            <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="uploading" @change="onPlanUpload" />
            {{ uploading ? 'Загрузка…' : 'Выбрать изображение' }}
          </label>
        </template>
        <p v-if="uploadError" class="banner banner--error">{{ uploadError }}</p>
        <p v-if="currentFloor?.errorMessage" class="banner banner--error">
          {{ currentFloor.errorMessage }}
        </p>
      </div>

      <div v-else-if="floorProcessing" class="upload-panel">
        <h3>Обработка плана…</h3>
        <p>Извлекаем зоны и строим 3D-модель. Это может занять до минуты.</p>
      </div>

      <div v-else class="content">
        <div class="map-wrap">
          <MallMap3D
            v-if="renderableFloor"
            ref="mapRef"
            :floor="renderableFloor"
            :selected-zone-id="selectedZoneId"
            :show-plan="showPlan"
            :admin-mode="true"
            :has-edits="hasEdits"
            @zone-click="onZoneClick"
            @zone-move="onZoneMove"
          />

          <div class="zoom-controls">
            <button class="zoom-btn" title="Приблизить" @click="mapRef?.zoomIn()">+</button>
            <button class="zoom-btn" title="Отдалить" @click="mapRef?.zoomOut()">−</button>
          </div>
        </div>

        <AdminPanel
          :zone="selectedZone"
          :has-edits="hasEdits"
          :default-height="renderableFloor?.footprintHeight ?? 2.4"
          @update-zone="onUpdateZone"
          @delete-zone="onDeleteZone"
          @reset-zone="onResetZone"
          @reset-all="onResetAll"
          @add-zone="onAddZone"
          @export-json="exportJson"
        />
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
  gap: 16px;
}

.header__brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header__logo {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.header__links {
  display: flex;
  gap: 12px;
  align-items: center;
}

.header__back,
.header__logout {
  font-size: 13px;
  color: #666;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.header__back:hover,
.header__logout:hover {
  color: #111;
}

.header__controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header__select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  max-width: 220px;
}

.header__btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 13px;
}

.header__btn--primary {
  background: #1a1a1a;
  color: #fff;
  border-color: #1a1a1a;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal__card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.modal__field input {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.modal__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
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
  justify-content: space-between;
  padding: 12px 24px;
  flex-shrink: 0;
}

.floor-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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

.floor-btn--add {
  width: 36px;
  padding: 0;
}

.plan-toggle {
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

.upload-panel {
  margin: 24px;
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #ccc;
  text-align: center;
}

.upload-panel h3 {
  margin-bottom: 8px;
}

.upload-panel p {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
}

.upload-btn {
  display: inline-block;
  padding: 10px 20px;
  background: #1a1a1a;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.upload-btn input {
  display: none;
}

.content {
  flex: 1;
  display: flex;
  min-height: 0;
}

.map-wrap {
  flex: 1;
  position: relative;
  min-height: 0;
  margin: 0 0 16px 16px;
  border-radius: 12px 0 0 12px;
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
</style>
