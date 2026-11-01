export const demandAxes = [
  { id: 'gaming', label: '游戏电竞', hint: '显卡表现与游戏处理器' },
  { id: 'creation', label: '内容创作', hint: '处理器、内存与素材存储' },
  { id: 'office', label: '日常办公', hint: '响应速度与实用性' },
  { id: 'ai', label: 'AI 计算', hint: '显存容量与计算需求' },
] as const
export type DemandKey = typeof demandAxes[number]['id']
export type DemandWeights = Record<DemandKey, number>
export function initialDemandWeights(usage: string): DemandWeights {
  const main = usage === '办公学习' ? 'office' : demandAxes.find(axis => axis.label === usage)?.id ?? 'gaming'
  return Object.fromEntries(demandAxes.map(axis => [axis.id, axis.id === main ? 70 : 10])) as DemandWeights
}
export function adjustDemandWeight(weights: DemandWeights, key: DemandKey, value: number): DemandWeights {
  const amount = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : weights[key])))
  const others = demandAxes.filter(axis => axis.id !== key)
  const total = others.reduce((sum, axis) => sum + weights[axis.id], 0)
  const shares = others.map(axis => ({ id: axis.id, value: (100 - amount) * (total ? weights[axis.id] / total : 1 / others.length) }))
  const next = { ...weights, [key]: amount }
  for (const share of shares) next[share.id] = Math.floor(share.value)
  let remainder = 100 - Object.values(next).reduce((sum, weight) => sum + weight, 0)
  for (const share of shares.sort((a, b) => (b.value % 1) - (a.value % 1))) {
    if (remainder-- > 0) next[share.id]++
  }
  return next
}
export const dominantDemand = (weights: DemandWeights) => [...demandAxes].sort((a, b) => weights[b.id] - weights[a.id])[0]!
