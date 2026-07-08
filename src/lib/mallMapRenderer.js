import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CATEGORY_COLORS, COLORS, polygonCentroid } from '../data/floors.js'
import { buildWallMesh } from './wallBuilder.js'

const DEFAULT_ZONE_HEIGHT = 0.15
const PLAN_Y = -0.02
const ZONE_OPACITY_DEFAULT = 1
const ZONE_OPACITY_HOVER = 1

function planToWorld(x, y, bounds) {
  const wx = x - bounds.width / 2
  const wz = bounds.height / 2 - y
  return { x: wx, z: wz }
}

function createZoneMesh(zone, bounds, materials, zoneHeight) {
  const shape = new THREE.Shape()
  zone.points.forEach(([px, py], i) => {
    const { x, z } = planToWorld(px, py, bounds)
    if (i === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  })
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: zoneHeight,
    bevelEnabled: true,
    bevelThickness: 0,
    bevelSize: 0,
    bevelOffset: 0,
    bevelSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  geometry.normalizeNormals()

  const topColor = CATEGORY_COLORS[zone.category] ?? COLORS.top
  const mesh = new THREE.Mesh(geometry, materials.createZoneMaterial(topColor))
  mesh.userData.zoneId = zone.id
  mesh.position.y = zoneHeight / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function createLabel(zone, bounds, zoneHeight) {
  const { x, y } = polygonCentroid(zone.points)
  const { x: wx, z: wz } = planToWorld(x, y, bounds)

  const el = document.createElement('div')
  el.className = 'zone-label'
  if (zone.icon === 'wc') el.textContent = 'WC'
  else if (zone.icon === 'escalator') el.textContent = '↕'
  else if (zone.icon === 'stairs') el.textContent = '⬆'
  else if (zone.icon === 'entrance') el.textContent = 'ВХОД'
  else el.textContent = zone.name

  const label = new CSS2DObject(el)
  label.position.set(wx, zoneHeight + 0.5, wz)
  label.userData.zoneId = zone.id
  return label
}

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
    this.labels = new Map()
    this.hoveredId = null
    this.selectedId = null
    this.onZoneClick = null
    this.onZoneHover = null
    this._zoneHeight = DEFAULT_ZONE_HEIGHT
    this._footprintLoadId = 0

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

    this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2.2
    this.controls.minPolarAngle = Math.PI / 6
    this.controls.minDistance = 40
    this.controls.maxDistance = 500
    this.controls.target.set(0, 0, 0)

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    this.scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a8a, 0.35)
    this.scene.add(hemi)

    const dir = new THREE.DirectionalLight(0xffffff, 0.65)
    dir.position.set(40, 80, 30)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
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

    this._onResize = () => this.resize()
    this._onPointerMove = (e) => this._handlePointerMove(e)
    this._onClick = (e) => this._handleClick(e)

    window.addEventListener('resize', this._onResize)
    this.labelRenderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.labelRenderer.domElement.addEventListener('click', this._onClick)

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
        createTop(COLORS.selected, 1),
        createSurfaceMaterial({ color: COLORS.selectedSide, opacity: 1, transparent: false }),
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
        continue
      }
      mesh.material = this._isSideMesh(mesh) ? sideMat : topMat
      mesh.renderOrder = topMat.transparent ? 1 : 0
    }
  }

  _disposeObject3D(root) {
    root.traverse((obj) => {
      obj.geometry?.dispose?.()
      const mat = obj.material
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
        else mat.dispose?.()
      }
    })
  }

  loadFloor(floor, { showPlan = false } = {}) {
    this.clearFloor()
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
      const loader = new THREE.TextureLoader()
      loader.load(floor.planImage, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        const geo = new THREE.PlaneGeometry(bounds.width, bounds.height)
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.25 })
        this.planMesh = new THREE.Mesh(geo, mat)
        this.planMesh.rotation.x = -Math.PI / 2
        this.planMesh.position.y = PLAN_Y
        this.scene.add(this.planMesh)
      })
    }

    // Primary path: load precomputed footprint GLB.
    if (floor.footprintModel) {
      const loadId = ++this._footprintLoadId
      const loader = new GLTFLoader()

      loader.load(floor.footprintModel, (gltf) => {
        if (loadId !== this._footprintLoadId) return

        const meshesByZoneId = new Map()
        gltf.scene.traverse((obj) => {
          if (!obj.isMesh) return
          obj.geometry?.computeVertexNormals()
          obj.geometry?.normalizeNormals()
          const zoneId = obj.parent?.name
          if (!zoneId) return
          obj.userData.zoneId = zoneId
          if (!meshesByZoneId.has(zoneId)) meshesByZoneId.set(zoneId, [])
          meshesByZoneId.get(zoneId).push(obj)
        })

        this.zoneGroup.add(gltf.scene)
        for (const zone of floor.zones) {
          const meshes = meshesByZoneId.get(zone.id)
          if (!meshes?.length) continue
          this.meshes.set(zone.id, {
            meshes,
            zone,
            baseColor: CATEGORY_COLORS[zone.category] ?? COLORS.top,
          })
        }

        this._applySelection()
      })

      return
    }

    // Fallback: build geometry from `floor.zones`.
    for (const zone of floor.zones) {
      const mesh = createZoneMesh(zone, bounds, this._materials, this._zoneHeight)
      this.zoneGroup.add(mesh)
      this.meshes.set(zone.id, {
        meshes: [mesh],
        zone,
        baseColor: CATEGORY_COLORS[zone.category] ?? COLORS.top,
      })
    }

    this._applySelection()
  }

  clearFloor() {
    this._footprintLoadId++
    this._wallLoadId++
    while (this.zoneGroup.children.length) {
      const child = this.zoneGroup.children[0]
      this.zoneGroup.remove(child)
      this._disposeObject3D(child)
    }
    this.meshes.clear()
    this.labels.clear()

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

  setSelectedZone(id) {
    this.selectedId = id
    this._applySelection()
    if (id) {
      const entry = this.meshes.get(id)
      if (entry) {
        const { x, y } = polygonCentroid(entry.zone.points)
        const bounds = this._currentBounds ?? { width: 326, height: 446 }
        const { x: wx, z: wz } = planToWorld(x, y, bounds)
        this.tooltip.el.textContent = entry.zone.name
        this.tooltip.el.style.display = 'block'
        this.tooltip.label.position.set(wx, this._zoneHeight + 2.5, wz)
        this.tooltip.label.visible = true
      }
    } else {
      this.tooltip.label.visible = false
      this.tooltip.el.style.display = 'none'
    }
  }

  _applySelection() {
    for (const [id, entry] of this.meshes) {
      const baseColor = CATEGORY_COLORS[entry.zone.category] ?? COLORS.top
      if (id === this.selectedId) {
        const [topMat, sideMat] = this._materials.getSelectedMaterial()
        this._applyMaterialsToZone(entry, { topMat, sideMat })
      } else if (id === this.hoveredId) {
        const [topMat, sideMat] = this._materials.getHoverMaterial()
        this._applyMaterialsToZone(entry, { topMat, sideMat })
      } else {
        const topMat = this._materials.getTopMaterial(baseColor, ZONE_OPACITY_DEFAULT)
        const sideMat = this._materials.getSideMaterial(ZONE_OPACITY_DEFAULT)
        this._applyMaterialsToZone(entry, { topMat, sideMat })
      }
    }
  }

  _handlePointerMove(event) {
    const rect = this.labelRenderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(
      [...this.meshes.values()].flatMap((e) => e.meshes),
    )

    const hit = hits[0]
    const newId = hit?.object.userData.zoneId ?? null
    if (newId !== this.hoveredId) {
      this.hoveredId = newId
      this._applySelection()
      this.labelRenderer.domElement.style.cursor = newId ? 'pointer' : 'grab'
      this.onZoneHover?.(newId)
    }
  }

  _handleClick() {
    if (this.hoveredId) {
      this.setSelectedZone(this.hoveredId)
      this.onZoneClick?.(this.hoveredId)
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
    const { x, y } = polygonCentroid(zone.points)
    const { x: wx, z: wz } = planToWorld(x, y, bounds)
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
    this.labelRenderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.labelRenderer.domElement.removeEventListener('click', this._onClick)
    this.clearFloor()
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
    this.container.removeChild(this.labelRenderer.domElement)
  }
}
