import polygonClipping from 'polygon-clipping'

function ringArea(points) {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1]
  }
  return sum / 2
}

function ensureClosed(points) {
  if (points.length < 3) return points.map((p) => [...p])
  const ring = points.map((p) => [p[0], p[1]])
  const [fx, fy] = ring[0]
  const [lx, ly] = ring[ring.length - 1]
  if (fx !== lx || fy !== ly) ring.push([fx, fy])
  return ring
}

function openRing(ring) {
  if (ring.length < 2) return ring.map((p) => [...p])
  const [fx, fy] = ring[0]
  const [lx, ly] = ring[ring.length - 1]
  if (fx === lx && fy === ly) return ring.slice(0, -1).map((p) => [...p])
  return ring.map((p) => [...p])
}

function roundPoints(points) {
  return points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])
}

function nearlySame(a, b, eps = 1e-4) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy <= eps * eps
}

function dist2(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

/**
 * Collapse vertices closer than minDist (plan units) into one point.
 * Only operates within a single ring/figure — never across different polygons.
 * Removes consecutive near-duplicates and tiny spikes after boolean ops.
 */
export function cleanupPolygonPoints(points, minDist) {
  if (!points || points.length < 3) return points?.map((p) => [...p]) ?? []
  if (!(minDist > 0)) return roundPoints(points)

  const minDist2 = minDist * minDist
  let ring = points.map((p) => [p[0], p[1]])

  // Pass 1: drop consecutive near-duplicates (including wrap-around)
  const pass1 = []
  for (const p of ring) {
    if (!pass1.length || dist2(pass1[pass1.length - 1], p) >= minDist2) {
      pass1.push(p)
    } else {
      // average into previous to stabilize corner
      const prev = pass1[pass1.length - 1]
      prev[0] = (prev[0] + p[0]) / 2
      prev[1] = (prev[1] + p[1]) / 2
    }
  }
  while (pass1.length >= 3 && dist2(pass1[0], pass1[pass1.length - 1]) < minDist2) {
    const last = pass1.pop()
    pass1[0][0] = (pass1[0][0] + last[0]) / 2
    pass1[0][1] = (pass1[0][1] + last[1]) / 2
  }
  ring = pass1

  // Pass 2: drop middle vertex when neighbors are already within threshold (tiny spike / fold)
  let changed = true
  while (changed && ring.length >= 3) {
    changed = false
    const next = []
    const n = ring.length
    for (let i = 0; i < n; i++) {
      const prev = ring[(i - 1 + n) % n]
      const curr = ring[i]
      const nxt = ring[(i + 1) % n]
      if (dist2(prev, nxt) < minDist2) {
        changed = true
        continue
      }
      next.push(curr)
    }
    if (next.length >= 3) ring = next
    else break
  }

  if (ring.length < 3) return roundPoints(points)
  return roundPoints(ring)
}

function toGeom(points) {
  return [[ensureClosed(points)]]
}

function fromMulti(result, { minArea = 1e-4, mergeCloseDist = 0 } = {}) {
  if (!result?.length) return []
  const out = []
  for (const poly of result) {
    let ring = openRing(poly[0])
    if (mergeCloseDist > 0) {
      ring = cleanupPolygonPoints(ring, mergeCloseDist)
    } else {
      ring = roundPoints(ring)
    }
    if (ring.length >= 3 && Math.abs(ringArea(ring)) >= minArea) {
      out.push(ring)
    }
  }
  return out
}

/** Rectangle (open ring) centered on segment a→b with given width. Extends slightly past ends. */
export function cutBladePolygon(a, b, width, extend = 0) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-9 || width <= 0) return null
  const ux = dx / len
  const uy = dy / len
  const hx = (-uy * width) / 2
  const hy = (ux * width) / 2
  const ex = ux * extend
  const ey = uy * extend
  const a0 = [a[0] - ex, a[1] - ey]
  const b0 = [b[0] + ex, b[1] + ey]
  return [
    [a0[0] + hx, a0[1] + hy],
    [b0[0] + hx, b0[1] + hy],
    [b0[0] - hx, b0[1] - hy],
    [a0[0] - hx, a0[1] - hy],
  ]
}

/**
 * Split polygons crossed by a thick cut line (gap = blade width in plan units).
 * Returns { index, parts: points[][] }[] for polygons that were cut into 2+ pieces.
 */
export function splitPolygonsByThickLine(polygons, cutA, cutB, gap, mergeCloseDist = 0) {
  return splitPolygonsByThickPolyline(polygons, [cutA, cutB], gap, mergeCloseDist)
}

/** Union of thick blades along a polyline (≥2 points). */
export function cutBladeFromPolyline(points, width) {
  if (!points || points.length < 2 || width <= 0) return null
  let geom = null
  for (let i = 0; i < points.length - 1; i++) {
    const blade = cutBladePolygon(points[i], points[i + 1], width, width / 2)
    if (!blade) continue
    const g = toGeom(blade)
    geom = geom ? polygonClipping.union(geom, g) : g
  }
  return geom
}

/**
 * Split polygons with a thick polyline cut.
 * Returns { index, parts: points[][] }[] for polygons cut into 2+ pieces.
 * @param mergeCloseDist plan-units threshold to collapse near-duplicate vertices
 *   within each resulting piece only (same figure; e.g. 5px / pxPerUnit)
 */
export function splitPolygonsByThickPolyline(polygons, linePoints, gap, mergeCloseDist = 0) {
  if (!polygons?.length || !linePoints || linePoints.length < 2 || gap <= 0) return []

  const bladeGeom = cutBladeFromPolyline(linePoints, gap)
  if (!bladeGeom) return []

  const minArea = (gap * gap) / 4
  const changes = []

  for (let i = 0; i < polygons.length; i++) {
    const pts = polygons[i]
    if (!pts || pts.length < 3) continue
    let diff
    try {
      diff = polygonClipping.difference(toGeom(pts), bladeGeom)
    } catch {
      continue
    }
    // Cleanup runs per resulting ring only — never merges vertices across figures
    const parts = fromMulti(diff, { minArea, mergeCloseDist })
    if (parts.length >= 2) {
      changes.push({ index: i, parts })
    }
  }
  return changes
}

/** Preview rings for a polyline blade (may be multiple). */
export function cutBladePreviewRings(points, width) {
  const geom = cutBladeFromPolyline(points, width)
  return fromMulti(geom, { minArea: 0 })
}

/** Outward offset (approx.) by distance; winding-aware. */
export function expandPolygon(points, dist) {
  if (!points || points.length < 3 || dist <= 0) {
    return points?.map((p) => [...p]) ?? []
  }
  const area = ringArea(points)
  const sign = area >= 0 ? 1 : -1 // CCW → outward via right-ish normals flipped
  const n = points.length
  const out = []

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]
    const e1x = curr[0] - prev[0]
    const e1y = curr[1] - prev[1]
    const e2x = next[0] - curr[0]
    const e2y = next[1] - curr[1]
    const l1 = Math.hypot(e1x, e1y) || 1
    const l2 = Math.hypot(e2x, e2y) || 1
    // Outward normals for CCW: (dy, -dx); for CW flip
    const n1x = (sign * e1y) / l1
    const n1y = (sign * -e1x) / l1
    const n2x = (sign * e2y) / l2
    const n2y = (sign * -e2x) / l2
    let bx = n1x + n2x
    let by = n1y + n2y
    const bl = Math.hypot(bx, by)
    if (bl < 1e-9) {
      bx = n1x
      by = n1y
    } else {
      bx /= bl
      by /= bl
    }
    const dot = Math.max(0.2, n1x * bx + n1y * by)
    const miter = dist / dot
    out.push([curr[0] + bx * miter, curr[1] + by * miter])
  }
  return out
}

function convexHull(points) {
  const pts = points.map((p) => [p[0], p[1]])
  pts.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
  if (pts.length <= 1) return pts

  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/**
 * Merge multiple polygons. Expands by bridgeDist so small gaps close, then unions.
 * If still disconnected, falls back to convex hull of all vertices.
 */
export function mergePolygonPointsList(polygons, bridgeDist = 0) {
  const cleaned = (polygons || []).filter((p) => p && p.length >= 3)
  if (!cleaned.length) return null
  if (cleaned.length === 1) return roundPoints(cleaned[0])

  const geoms = cleaned.map((p) => toGeom(bridgeDist > 0 ? expandPolygon(p, bridgeDist) : p))

  let result = geoms[0]
  for (let i = 1; i < geoms.length; i++) {
    try {
      result = polygonClipping.union(result, geoms[i])
    } catch {
      result = null
      break
    }
  }

  const parts = fromMulti(result)
  if (parts.length === 1) return parts[0]

  // Still disconnected — convex hull so merge always succeeds
  const all = []
  for (const p of cleaned) all.push(...p)
  const hull = convexHull(all)
  if (hull.length < 3) return null
  return roundPoints(hull)
}
