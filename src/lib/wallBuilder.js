import * as THREE from 'three'
import { COLORS } from '../data/floors.js'

const WALL_HEIGHT = 2.4
const WALL_SAMPLE_STEP = 8

export function buildWallMesh(imageUrl, pxPerUnit, bounds) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const cellSize = WALL_SAMPLE_STEP / pxPerUnit
      const instances = []

      for (let y = 0; y < height; y += WALL_SAMPLE_STEP) {
        for (let x = 0; x < width; x += WALL_SAMPLE_STEP) {
          const i = (y * width + x) * 4
          if (data[i] < 128) continue

          const wx = (x + WALL_SAMPLE_STEP / 2) / pxPerUnit - bounds.width / 2
          const wz = (y + WALL_SAMPLE_STEP / 2) / pxPerUnit - bounds.height / 2
          instances.push(wx, WALL_HEIGHT / 2, wz)
        }
      }

      if (!instances.length) {
        resolve(null)
        return
      }

      const geo = new THREE.BoxGeometry(cellSize, WALL_HEIGHT, cellSize)
      const mat = new THREE.MeshLambertMaterial({ color: COLORS.wall })
      const mesh = new THREE.InstancedMesh(geo, mat, instances.length / 3)
      mesh.castShadow = true
      mesh.receiveShadow = true

      const dummy = new THREE.Object3D()
      for (let i = 0; i < instances.length; i += 3) {
        dummy.position.set(instances[i], instances[i + 1], instances[i + 2])
        dummy.updateMatrix()
        mesh.setMatrixAt(i / 3, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      resolve(mesh)
    }
    img.onerror = reject
    img.src = imageUrl
  })
}
