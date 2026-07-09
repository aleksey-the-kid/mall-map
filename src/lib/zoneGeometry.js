import * as THREE from 'three'
import { CATEGORY_COLORS, COLORS, polygonCentroid } from '../data/floors.js'
import { BLOCK_MESH_Y } from './sceneLayout.js'

export function planToWorld(x, y, bounds) {
  const wx = x - bounds.width / 2
  const wz = bounds.height / 2 - y
  return { x: wx, z: wz }
}

export function worldToPlan(wx, wz, bounds) {
  return {
    x: wx + bounds.width / 2,
    y: bounds.height / 2 - wz,
  }
}

export function getZoneHeight(zone, floorDefaultHeight) {
  return Number(zone.height ?? floorDefaultHeight)
}

export function getZoneColor(zone) {
  return zone.color ?? CATEGORY_COLORS[zone.category] ?? COLORS.top
}

export function getZoneOffset(zone) {
  const o = zone.offset
  if (!o) return [0, 0]
  return [Number(o[0]) || 0, Number(o[1]) || 0]
}

export function getZonePlanBBox(points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
  }
}

export function getZoneSize(zone) {
  if (Array.isArray(zone.size) && zone.size.length === 2) {
    return [Number(zone.size[0]) || 0, Number(zone.size[1]) || 0]
  }
  const { width, depth } = getZonePlanBBox(zone.points)
  return [width, depth]
}

export function scalePointsToSize(points, targetSize) {
  const bbox = getZonePlanBBox(points)
  if (bbox.width <= 0 || bbox.depth <= 0) return points

  const cx = (bbox.minX + bbox.maxX) / 2
  const cy = (bbox.minY + bbox.maxY) / 2
  const sx = targetSize[0] / bbox.width
  const sy = targetSize[1] / bbox.depth

  return points.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy])
}

export function getZoneRenderPoints(zone) {
  if (!Array.isArray(zone.size) || zone.size.length !== 2) return zone.points
  return scalePointsToSize(zone.points, getZoneSize(zone))
}

export function getZoneWorldCentroid(zone, bounds, offset = [0, 0]) {
  const { x, y } = polygonCentroid(getZoneRenderPoints(zone))
  const { x: wx, z: wz } = planToWorld(x, y, bounds)
  return { x: wx + offset[0], z: wz + offset[1] }
}

export function createZoneMesh(zone, bounds, materials, zoneHeight) {
  const shape = new THREE.Shape()
  getZoneRenderPoints(zone).forEach(([px, py], i) => {
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

  const topColor = getZoneColor(zone)
  const mesh = new THREE.Mesh(geometry, materials.createZoneMaterial(topColor))
  mesh.userData.zoneId = zone.id
  mesh.position.y = BLOCK_MESH_Y
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function disposeObject3D(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.()
    const mat = obj.material
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
      else mat.dispose?.()
    }
  })
}
