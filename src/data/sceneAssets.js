export const BUILTIN_SCENE_ASSETS = [
  {
    id: 'cube',
    name: 'Куб (тест)',
    type: 'builtin',
    previewColor: '#4a90d9',
  },
]

export function findSceneAsset(assets, id) {
  return assets.find((a) => a.id === id) ?? null
}
