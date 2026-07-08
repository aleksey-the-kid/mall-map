import fs from 'node:fs'
import path from 'node:path'

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

const ROOT = process.cwd()

// Minimal FileReader polyfill for Node.js (GLTFExporter expects it).
// Used only for building a GLB from in-memory geometry (no textures).
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null
      this.onloadend = null
    }

    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf
        this.onloadend?.()
      })
    }

    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const base64 = Buffer.from(buf).toString('base64')
        this.result = `data:application/octet-stream;base64,${base64}`
        this.onloadend?.()
      })
    }
  }
}

const SRC_FLOORS_JSON = path.join(ROOT, 'src', 'data', 'generated', 'floor1.json')
const PUBLIC_DIR = path.join(ROOT, 'public')
const OUT_GLB = path.join(PUBLIC_DIR, 'floor-footprint.glb')

const CATEGORY_COLORS = {
  shop: '#6db56d',
  cafe: '#f5e6d3',
  corridor: '#ebebeb',
  office: '#e8e8e8',
  service: '#e0e0e0',
  entrance: '#d4edda',
  wc: '#e8e8e8',
  escalator: '#e8e8e8',
  stairs: '#e8e8e8',
}

const COLORS = {
  top: '#6db56d',
  side: '#3d6b3d',
}

const DEFAULT_FOOTPRINT_HEIGHT = 2.4

function hexToThreeColor(hex) {
  return new THREE.Color(hex)
}

function planToWorld(x, y, bounds) {
  const wx = x - bounds.width / 2
  const wz = bounds.height / 2 - y
  return { x: wx, z: wz }
}

function createWallMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: hexToThreeColor(color),
    roughness: 0.82,
    metalness: 0.02,
    flatShading: false,
    side: THREE.DoubleSide,
  })
}

function createTopMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: hexToThreeColor(color),
    roughness: 0.78,
    metalness: 0.02,
    flatShading: false,
    side: THREE.DoubleSide,
  })
}

const EXTRUDE_OPTIONS = {
  bevelEnabled: true,
  bevelThickness: 0,
  bevelSize: 0,
  bevelOffset: 0,
  bevelSegments: 1,
}

function createExtrudeGeometry(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    ...EXTRUDE_OPTIONS,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  geometry.normalizeNormals()
  return geometry
}

async function main() {
  if (!fs.existsSync(SRC_FLOORS_JSON)) {
    throw new Error(`Missing input json: ${SRC_FLOORS_JSON}`)
  }

  const floor = JSON.parse(fs.readFileSync(SRC_FLOORS_JSON, 'utf-8'))
  const bounds = floor.planBounds
  const footprintHeight = Number(floor.footprintHeight ?? DEFAULT_FOOTPRINT_HEIGHT)
  if (!bounds) throw new Error('floor.planBounds missing')

  const scene = new THREE.Scene()
  scene.name = 'floor-footprint'

  const sideMat = createWallMaterial(COLORS.side)

  for (const zone of floor.zones ?? []) {
    const shape = new THREE.Shape()
    zone.points.forEach(([px, py], i) => {
      const { x, z } = planToWorld(px, py, bounds)
      if (i === 0) shape.moveTo(x, z)
      else shape.lineTo(x, z)
    })
    shape.closePath()

    const geometry = createExtrudeGeometry(shape, footprintHeight)

    const topColor = CATEGORY_COLORS[zone.category] ?? COLORS.top
    const topMat = createTopMaterial(topColor)

    const mesh = new THREE.Mesh(geometry, [topMat, sideMat])
    mesh.userData.zoneId = zone.id
    mesh.name = String(zone.id)

    // Make it sit on y=0 plane (matches UI label/selection logic).
    mesh.position.y = footprintHeight / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  const exporter = new GLTFExporter()
  const options = { binary: true }

  const glb = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result),
      (error) => reject(error),
      options,
    )
  })

  if (glb instanceof ArrayBuffer) {
    fs.writeFileSync(OUT_GLB, Buffer.from(glb))
  } else if (glb && glb.buffer instanceof ArrayBuffer) {
    fs.writeFileSync(OUT_GLB, Buffer.from(glb.buffer))
  } else {
    throw new Error('Unexpected GLTFExporter result type')
  }

  console.log(`Written: ${OUT_GLB}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

