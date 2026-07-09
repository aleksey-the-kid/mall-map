import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { COLORS } from '../data/floors.js'
import { buildWallMesh } from './wallBuilder.js'
import { BLOCK_MESH_Y, PLAN_Y } from './sceneLayout.js'
import {
  createZoneMesh,
  disposeObject3D,
  getZoneColor,
  getZoneHeight,
  getZoneOffset,
  getZoneWorldCentroid,
} from './zoneGeometry.js'

const DEFAULT_ZONE_HEIGHT = 0.15
const ZONE_OPACITY_DEFAULT = 1
const ZONE_OPACITY_HOVER = 1
const ZONE_OPACITY_SELECTED = 0.7

function createTooltip() {
  const el = document.createElement('div')
  el.className = 'zone-tooltip'
  el.style.display = 'none'
  const label = new CSS2DObject(el)
  label.visible = false
  return { el, label }
}

export class MallMapRenderer {
  constructor(container) {
    this.container = container
    this.meshes = new Map()
    this.hoveredId = null
    this.selectedId = null
    this.onZoneClick = null
    this.onZoneHover = null
    this.onZoneMove = null
    this.adminMode = false
    this._zoneHeight = DEFAULT_ZONE_HEIGHT
    this._footprintLoadId = 0
    this._planLoadId = 0
    this._suppressZoneMoveEmit = false
    this._ignoreClickAfterGizmo = false

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(COLORS.background)

    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
    this.camera.position.set(0, 280, 200)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.sortObjects = true
    container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight)
    this.labelRenderer.domElement.className = 'css2d-overlay'
    container.appendChild(this.labelRenderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2.2
    this.controls.minPolarAngle = Math.PI / 6
    this.controls.minDistance = 40
    this.controls.maxDistance = 500
    this.controls.target.set(0, 0, 0)

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement)
    this.transformControls.setMode('translate')
    this.transformControls.showY = false
    this.transformControls.space = 'world'
    this.transformControls.size = 0.8
    this.transformControls.enabled = false
    this.scene.add(this.transformControls.getHelper())

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value
      if (!event.value) {
        this._ignoreClickAfterGizmo = true
        this._commitZoneOffset()
      }
    })

    this.transformControls.addEventListener('mouseDown', () => {
      this._ignoreClickAfterGizmo = true
    })

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    this.scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a8a, 0.35)
    this.scene.add(hemi)

    const dir = new THREE.DirectionalLight(0xffffff, 0.65)
    dir.position.set(40, 80, 30)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.bias = -0.0002
    this.scene.add(dir)

    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-30, 40, -20)
    this.scene.add(fill)

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.zoneGroup = new THREE.Group()
    this.scene.add(this.zoneGroup)

    this.wallGroup = new THREE.Group()
    this.scene.add(this.wallGroup)
    this._wallLoadId = 0

    this.planMesh = null
    this.tooltip = createTooltip()
    this.scene.add(this.tooltip.label)

    this._materials = this._createMaterialCache()
    this._currentFloor = null

    this._onResize = () => this.resize()
    this._onPointerMove = (e) => this._handlePointerMove(e)
    this._onClick = (e) => this._handleClick(e)

    window.addEventListener('resize', this._onResize)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.addEventListener('click', this._onClick)

    this._animate = true
    this._tick()
  }

  _createMaterialCache() {
    const cache = new Map()

    const createSurfaceMaterial = ({ color, opacity, transparent }) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent,
        opacity,
        depthWrite: !transparent,
      })

    const createTop = (color, opacity = ZONE_OPACITY_DEFAULT) =>
      createSurfaceMaterial({ color, opacity, transparent: opacity < 1 })

    const createSide = (opacity = ZONE_OPACITY_DEFAULT) =>
      createSurfaceMaterial({ color: COLORS.side, opacity, transparent: opacity < 1 })

    const getTop = (color, opacity = ZONE_OPACITY_DEFAULT) => {
      const key = `${color}:${opacity}`
      if (!cache.has(key)) {
        cache.set(key, createTop(color, opacity))
      }
      return cache.get(key)
    }

    const sideCache = new Map()
    const getSide = (opacity = ZONE_OPACITY_DEFAULT) => {
      const key = String(opacity)
      if (!sideCache.has(key)) {
        sideCache.set(key, createSide(opacity))
      }
      return sideCache.get(key)
    }

    return {
      createZoneMaterial: (topColor) => [getTop(topColor), getSide()],
      getTopMaterial: (topColor, opacity = ZONE_OPACITY_DEFAULT) => getTop(topColor, opacity),
      getSideMaterial: (opacity = ZONE_OPACITY_DEFAULT) => getSide(opacity),
      getSelectedMaterial: () => [
        createTop(COLORS.selected, ZONE_OPACITY_SELECTED),
        createSurfaceMaterial({
          color: COLORS.selectedSide,
          opacity: ZONE_OPACITY_SELECTED,
          transparent: true,
        }),
      ],
      getHoverMaterial: () => [
        createTop(COLORS.hover, ZONE_OPACITY_HOVER),
        getSide(ZONE_OPACITY_HOVER),
      ],
    }
  }

  _isSideMesh(mesh) {
    return Boolean(mesh.name?.includes('_1'))
  }

  _applyMaterialsToZone(entry, { topMat, sideMat }) {
    for (const mesh of entry.meshes) {
      if (Array.isArray(mesh.material) && mesh.material.length > 1) {
        mesh.material = [topMat, sideMat]
        mesh.renderOrder = topMat.transparent ? 2 : 0
        continue
      }
      mesh.material = this._isSideMesh(mesh) ? sideMat : topMat
      mesh.renderOrder = topMat.transparent ? 2 : 0
    }
  }

  _pickZoneIdFromHits(hits) {
    for (const hit of hits) {
      let obj = hit.object
      while (obj && obj !== this.zoneGroup) {
        const zoneId = obj.userData?.zoneId
        if (zoneId) return String(zoneId)
        if (typeof obj.name === 'string' && obj.name.startsWith('zone-')) {
          return obj.name.slice(5)
        }
        obj = obj.parent
      }
    }
    return null
  }

  _raycastZoneId() {
    if (!this.zoneGroup.children.length) return null
    const hits = this.raycaster.intersectObjects(this.zoneGroup.children, true)
    return this._pickZoneIdFromHits(hits)
  }

  _getEntryBaseColor(entry) {
    return getZoneColor(entry.zone)
  }

  _getEntryHeight(entry) {
    return getZoneHeight(entry.zone, this._zoneHeight)
  }

  _buildZoneEntry(zone, bounds) {
    const group = new THREE.Group()
    group.name = `zone-${zone.id}`
    group.userData.zoneId = String(zone.id)
    const height = getZoneHeight(zone, this._zoneHeight)
    const offset = getZoneOffset(zone)

    const mesh = createZoneMesh(zone, bounds, this._materials, height)
    group.add(mesh)

    group.position.set(offset[0], 0, offset[1])

    this.zoneGroup.add(group)

    return {
      group,
      meshes: [mesh],
      zone,
      baseColor: getZoneColor(zone),
    }
  }

  _rebuildZoneEntry(zoneId) {
    const entry = this.meshes.get(zoneId)
    if (!entry) return

    const bounds = this._currentBounds
    const zone = entry.zone
    const height = getZoneHeight(zone, this._zoneHeight)
    const offset = getZoneOffset(zone)
    const wasAttached = this.transformControls.object === entry.group

    if (wasAttached) this.transformControls.detach()

    this.zoneGroup.remove(entry.group)
    disposeObject3D(entry.group)

    const mesh = createZoneMesh(zone, bounds, this._materials, height)
    entry.group.clear()
    entry.group.add(mesh)

    entry.meshes = [mesh]
    entry.baseColor = getZoneColor(zone)
    entry.group.position.set(offset[0], 0, offset[1])

    this.zoneGroup.add(entry.group)
    this._applySelection()

    if (wasAttached && this.adminMode) {
      this.transformControls.attach(entry.group)
    }
  }

  _loadProceduralFloor(floor) {
    const { planBounds: bounds } = floor
    for (const zone of floor.zones) {
      const entry = this._buildZoneEntry(zone, bounds)
      this.meshes.set(zone.id, entry)
    }
    this._applySelection()
  }

  loadFloor(floor, { showPlan = false, useProcedural = false } = {}) {
    this.clearFloor()
    this._currentFloor = floor
    const { planBounds: bounds } = floor
    this._currentBounds = bounds
    this._zoneHeight = Number(floor.footprintHeight ?? DEFAULT_ZONE_HEIGHT)

    if (floor.wallsImage) {
      const loadId = ++this._wallLoadId
      buildWallMesh(floor.wallsImage, floor.wallPxPerUnit ?? 10, bounds).then((mesh) => {
        if (loadId !== this._wallLoadId || !mesh) return
        this.wallGroup.add(mesh)
        this._wallMesh = mesh
      })
    }

    if (showPlan && floor.planImage) {
      const planLoadId = ++this._planLoadId
      const loader = new THREE.TextureLoader()
      loader.load(floor.planImage, (texture) => {
        if (planLoadId !== this._planLoadId) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        const geo = new THREE.PlaneGeometry(bounds.width, bounds.height)
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.25 })
        this.planMesh = new THREE.Mesh(geo, mat)
        this.planMesh.rotation.x = -Math.PI / 2
        this.planMesh.position.y = PLAN_Y
        this.scene.add(this.planMesh)
      })
    }

    if (useProcedural || !floor.footprintModel) {
      this._loadProceduralFloor(floor)
      return
    }

    const loadId = ++this._footprintLoadId
    const loader = new GLTFLoader()

    loader.load(
      floor.footprintModel,
      (gltf) => {
        if (loadId !== this._footprintLoadId) return

        const meshesByZoneId = new Map()
        gltf.scene.traverse((obj) => {
          if (!obj.isMesh) return
          obj.geometry?.computeVertexNormals()
          obj.geometry?.normalizeNormals()
          const zoneId = String(obj.name || obj.parent?.name || '')
          if (!zoneId || zoneId === 'floor-footprint') return
          obj.userData.zoneId = zoneId
          if (!meshesByZoneId.has(zoneId)) meshesByZoneId.set(zoneId, [])
          meshesByZoneId.get(zoneId).push(obj)
        })

        let added = 0
        for (const zone of floor.zones) {
          const zoneId = String(zone.id)
          const meshes = meshesByZoneId.get(zoneId)
          if (!meshes?.length) continue
          const offset = getZoneOffset(zone)
          const group = new THREE.Group()
          group.name = `zone-${zoneId}`
          group.userData.zoneId = zoneId
          for (const mesh of meshes) {
            mesh.userData.zoneId = zoneId
            mesh.position.y = BLOCK_MESH_Y
            group.add(mesh)
          }
          group.position.set(offset[0], 0, offset[1])
          this.zoneGroup.add(group)

          this.meshes.set(zoneId, {
            group,
            meshes,
            zone,
            baseColor: getZoneColor(zone),
          })
          added++
        }

        if (added === 0 && floor.zones?.length) {
          this._loadProceduralFloor(floor)
          return
        }

        this._applySelection()
      },
      undefined,
      () => {
        if (loadId !== this._footprintLoadId) return
        if (floor.zones?.length) this._loadProceduralFloor(floor)
      },
    )
  }

  clearFloor() {
    this._footprintLoadId++
    this._wallLoadId++
    this._planLoadId++
    this.transformControls.detach()
    while (this.zoneGroup.children.length) {
      const child = this.zoneGroup.children[0]
      this.zoneGroup.remove(child)
      disposeObject3D(child)
    }
    this.meshes.clear()

    while (this.wallGroup.children.length) {
      const child = this.wallGroup.children[0]
      this.wallGroup.remove(child)
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material?.dispose()
    }
    this._wallMesh = null

    if (this.planMesh) {
      this.scene.remove(this.planMesh)
      this.planMesh.geometry.dispose()
      this.planMesh.material.map?.dispose()
      this.planMesh.material.dispose()
      this.planMesh = null
    }
  }

  setAdminMode(enabled) {
    this.adminMode = enabled
    this.transformControls.enabled = enabled
    if (!enabled) {
      this.transformControls.detach()
      this.controls.enabled = true
    } else if (this.selectedId) {
      this._attachTransformControls(this.selectedId)
    }
  }

  syncZone(zone) {
    const entry = this.meshes.get(zone.id)
    if (!entry) {
      if (!this._currentBounds) return
      const newEntry = this._buildZoneEntry(zone, this._currentBounds)
      this.meshes.set(zone.id, newEntry)
      return
    }
    entry.zone = zone
    this._rebuildZoneEntry(zone.id)
  }

  setZoneOffset(zoneId, offset) {
    const entry = this.meshes.get(zoneId)
    if (!entry || this.transformControls.dragging) return

    this._suppressZoneMoveEmit = true
    entry.group.position.set(offset[0], 0, offset[1])
    entry.zone = { ...entry.zone, offset: [...offset] }
    this._suppressZoneMoveEmit = false
  }

  _commitZoneOffset() {
    if (!this.selectedId || this._suppressZoneMoveEmit) return
    const entry = this.meshes.get(this.selectedId)
    if (!entry) return

    entry.group.position.y = 0
    const offset = [entry.group.position.x, entry.group.position.z]
    const prev = getZoneOffset(entry.zone)
    if (Math.abs(prev[0] - offset[0]) < 0.001 && Math.abs(prev[1] - offset[1]) < 0.001) {
      return
    }
    entry.zone = { ...entry.zone, offset }
    this.onZoneMove?.(this.selectedId, offset)
  }

  removeZone(zoneId) {
    const entry = this.meshes.get(zoneId)
    if (!entry) return
    if (this.transformControls.object === entry.group) {
      this.transformControls.detach()
    }
    this.zoneGroup.remove(entry.group)
    disposeObject3D(entry.group)
    this.meshes.delete(zoneId)
    if (this.selectedId === zoneId) this.setSelectedZone(null)
    if (this.hoveredId === zoneId) this.hoveredId = null
  }

  reloadFloor(floor, options) {
    this.loadFloor(floor, options)
  }

  setSelectedZone(id) {
    this.selectedId = id ? String(id) : null
    this._applySelection()
    if (id) {
      const entry = this.meshes.get(id)
      if (entry) {
        const offset = getZoneOffset(entry.zone)
        const height = this._getEntryHeight(entry)
        const { x: wx, z: wz } = getZoneWorldCentroid(entry.zone, this._currentBounds ?? { width: 326, height: 446 }, offset)
        if (!this.adminMode) {
          this.tooltip.el.textContent = entry.zone.name
          this.tooltip.el.style.display = 'block'
          this.tooltip.label.position.set(wx, height + 2.5, wz)
          this.tooltip.label.visible = true
        }
        if (this.adminMode) this._attachTransformControls(id)
      }
    } else {
      this.tooltip.label.visible = false
      this.tooltip.el.style.display = 'none'
      this.transformControls.detach()
    }
  }

  _attachTransformControls(zoneId) {
    const entry = this.meshes.get(zoneId)
    if (!entry || !this.adminMode) {
      this.transformControls.detach()
      return
    }
    const offset = getZoneOffset(entry.zone)
    entry.group.position.set(offset[0], 0, offset[1])
    this.transformControls.attach(entry.group)
  }

  _applySelection() {
    for (const [id, entry] of this.meshes) {
      const baseColor = this._getEntryBaseColor(entry)
      const isSelected = String(id) === String(this.selectedId)
      const isHovered = String(id) === String(this.hoveredId)
      if (isSelected) {
        const [topMat, sideMat] = this._materials.getSelectedMaterial()
        this._applyMaterialsToZone(entry, { topMat, sideMat })
      } else if (isHovered) {
        const [topMat, sideMat] = this._materials.getHoverMaterial()
        this._applyMaterialsToZone(entry, { topMat, sideMat })
      } else {
        const topMat = this._materials.getTopMaterial(baseColor, ZONE_OPACITY_DEFAULT)
        const sideMat = this._materials.getSideMaterial(ZONE_OPACITY_DEFAULT)
        this._applyMaterialsToZone(entry, { topMat, sideMat })
      }
    }
  }

  _updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  _handlePointerMove(event) {
    if (this.transformControls.dragging) return

    this._updatePointer(event)

    const newId = this._raycastZoneId()
    if (newId !== this.hoveredId) {
      this.hoveredId = newId
      this._applySelection()
      this.onZoneHover?.(newId)
    }

    this.renderer.domElement.style.cursor = this.hoveredId ? 'pointer' : 'grab'
  }

  _handleClick(event) {
    if (this.transformControls.dragging) return
    if (this._ignoreClickAfterGizmo) {
      this._ignoreClickAfterGizmo = false
      return
    }

    this._updatePointer(event)

    const hitId = this._raycastZoneId()
    if (hitId) {
      this.setSelectedZone(hitId)
      this.onZoneClick?.(hitId)
    } else {
      this.setSelectedZone(null)
      this.onZoneClick?.(null)
    }
  }

  zoomIn() {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    this.camera.position.addScaledVector(dir, -8)
    this.controls.update()
  }

  zoomOut() {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    this.camera.position.addScaledVector(dir, 8)
    this.controls.update()
  }

  focusZone(zone, bounds) {
    const offset = getZoneOffset(zone)
    const { x: wx, z: wz } = getZoneWorldCentroid(zone, bounds, offset)
    this.controls.target.set(wx, 0, wz)
    this.controls.update()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
  }

  _tick() {
    if (!this._animate) return
    requestAnimationFrame(() => this._tick())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  dispose() {
    this._animate = false
    window.removeEventListener('resize', this._onResize)
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.removeEventListener('click', this._onClick)
    this.transformControls.disconnect()
    this.scene.remove(this.transformControls.getHelper())
    this.clearFloor()
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
    this.container.removeChild(this.labelRenderer.domElement)
  }
}
