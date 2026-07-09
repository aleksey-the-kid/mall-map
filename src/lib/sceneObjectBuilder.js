import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const gltfCache = new Map()

function loadGltf(url) {
  if (!gltfCache.has(url)) {
    const loader = new GLTFLoader()
    gltfCache.set(
      url,
      new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject)
      }),
    )
  }
  return gltfCache.get(url)
}

export function alignObjectBottomToGround(object) {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return
  object.position.y -= box.min.y
}

function buildCube() {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({
    color: 0x4a90d9,
    roughness: 0.55,
    metalness: 0.05,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const group = new THREE.Group()
  group.add(mesh)
  alignObjectBottomToGround(group)
  return group
}

export async function buildSceneObjectModel(asset) {
  if (asset.type === 'builtin' && asset.id === 'cube') {
    return buildCube()
  }

  if (asset.type === 'glb' && asset.url) {
    const gltf = await loadGltf(asset.url)
    const model = gltf.scene.clone(true)
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    const group = new THREE.Group()
    group.add(model)
    alignObjectBottomToGround(group)
    return group
  }

  throw new Error(`Unknown scene asset: ${asset.id}`)
}
