import type { PartGroup, PartOption } from '../types/hardware'
import { checkBuildCompatibility } from './buildCompatibility'

type Build = Record<string, PartOption>
export const buildSignature = (build: Build) => JSON.stringify(Object.keys(build).sort().map(key => [key, build[key]!.id, build[key]!.price]))
const cents = (part: PartOption) => Math.round(part.price * 100)
const capacity = (part: PartOption) => {
  const match = `${part.name} ${part.specs}`.match(/(\d+)\s*(TB|GB)/i)
  return match ? Number(match[1]) * (match[2]!.toUpperCase() === 'TB' ? 1024 : 1) : 0
}
const gpuTier = (part: PartOption) => {
  const match = part.name.match(/RTX\s*(\d)(\d{2})\d\s*(Ti)?\s*(SUPER)?/i)
  return match ? { generation: Number(match[1]), tier: Number(match[2]) + (match[3] ? 0.5 : match[4] ? 0.25 : 0) } : null
}
export interface OptimizationPlan {
  allowOverBudget?: boolean
  targetCategory: string
  id: string
  baseline: string
  target: PartOption
  chosen: Build
  beforeTotal: number
  total: number | null
  maxGpuPrice: number
  status: 'ready' | 'needs_quote' | 'over_budget'
  trialPrice: boolean
  changes: { category: string; label: string; before: PartOption; after: PartOption; delta: number | null }[]
  compatibility: ReturnType<typeof checkBuildCompatibility>
}

export function optimizeGamingBuild(groups: PartGroup[], current: Build, budget: number, usage: string,
  quotes: Record<string, number | string | undefined> = {},
  strategy?: { category: string; targets: { id: string; reduceCategories: string[] }[]; preserveCapacity?: boolean; preserveGpuMemory?: boolean }): OptimizationPlan[] {
  if ((!strategy && !['游戏电竞', 'AI 计算'].includes(usage)) || !Number.isFinite(budget) || budget <= 0 || groups.some(group => !current[group.id])) return []
  const targetCategory = strategy?.category ?? 'gpu'
  const source = gpuTier(current.gpu!)
  if (!strategy && !source) return []
  const targets = groups.find(group => group.id === targetCategory)?.options.filter(option => {
    if (strategy?.preserveCapacity && ['ram', 'ssd'].includes(targetCategory) && capacity(option) < capacity(current[targetCategory]!)) return false
    if (strategy?.preserveGpuMemory && targetCategory === 'gpu' && capacity(option) < capacity(current.gpu!)) return false
    if (targetCategory === 'power' && (option.psuWatts ?? 0) < Math.max(current.power?.psuWatts ?? 0, current.gpu?.minPsuWatts ?? 0)) return false
    if (strategy) return option.id !== current[targetCategory]!.id && strategy.targets.some(item => item.id === option.id)
    const tier = gpuTier(option)
    return tier && option.minPsuWatts && option.id !== current.gpu!.id && tier.generation >= source!.generation
      && tier.tier > source!.tier && tier.tier - source!.tier <= 1
      && capacity(option) >= capacity(current.gpu!)
  }).sort((a, b) => (strategy ? 0 : gpuTier(a)!.tier - gpuTier(b)!.tier) || Number(!!a.requiresQuote) - Number(!!b.requiresQuote) || a.price - b.price) ?? []
  const seen = new Set<string>()
  const plans: OptimizationPlan[] = []
  for (const option of targets) {
    const tier = gpuTier(option)
    const key = strategy ? option.id : `${tier!.generation}-${tier!.tier}-${capacity(option)}`
    if (seen.has(key)) continue
    seen.add(key)
    const quoted = Number(quotes[option.id])
    const trialPrice = Number.isFinite(quoted) && quoted > 0
    const target: PartOption = trialPrice
      ? { ...option, price: quoted, requiresQuote: false, marketOffer: undefined, priceSource: undefined, referencePrice: undefined, observedMarketOffer: undefined, tag: '用户输入试算价 · 非采集报价' }
      : option
    const priced = target.price > 0 && !target.requiresQuote
    const reductions = strategy?.targets.find(item => item.id === option.id)?.reduceCategories
    const candidates = groups.filter(group => group.id !== targetCategory).map(group => {
      const original = current[group.id]!
      const allowed = [...group.options, original].filter(part => {
        if (part.price <= 0 || part.requiresQuote) return false
        if (reductions && !reductions.includes(group.id) && group.id !== 'power') return part.id === original.id
        if (group.id === 'board' || (group.id === 'case' && !reductions?.includes('case'))) return part.id === original.id
        if (group.id === 'power') return (part.psuWatts ?? 0) >= Math.max(original.psuWatts ?? 0, (targetCategory === 'gpu' ? target : current.gpu)?.minPsuWatts ?? 0)
        if (part.price > original.price && part.id !== original.id) return false
        if (group.id === 'ram') return capacity(part) >= (usage === 'AI 计算' || strategy?.preserveCapacity ? capacity(original) : Math.min(capacity(original), 32))
        if (group.id === 'ssd') return capacity(part) >= (usage === 'AI 计算' || strategy?.preserveCapacity ? capacity(original) : Math.min(capacity(original), 1024))
        if (group.id === 'cpu') return /Ryzen\s+[579]\s|Core\s+i[579]/i.test(part.name)
        return true
      })
      return { ...group, options: [...new Map(allowed.map(part => [part.id, part])).values()] }
    })
    let cheapest: { build: Build; cost: number } | undefined
    let best: { build: Build; cost: number; changes: number } | undefined
    const visit = (index: number, picks: Build, cost: number) => {
      if (index === candidates.length) {
        const cpu = picks.cpu!, cooler = picks.cooler!, board = picks.board!
        if ((cooler.coolingTier ?? 0) < (cpu.minCoolingTier ?? 0) || (board.boardTier ?? 0) < (cpu.minBoardTier ?? 0)) return
        if (checkBuildCompatibility(picks).errors.length) return
        if (!cheapest || cost < cheapest.cost) cheapest = { build: { ...picks }, cost }
        if (!priced || cost + cents(target) > Math.round(budget * 100)) return
        const changed = candidates.filter(group => picks[group.id]!.id !== current[group.id]!.id).length
        if (!best || changed < best.changes || (changed === best.changes && cost > best.cost)) best = { build: { ...picks }, cost, changes: changed }
        return
      }
      const group = candidates[index]!
      for (const part of group.options) visit(index + 1, { ...picks, [group.id]: part }, cost + cents(part))
    }
    visit(0, { [targetCategory]: target }, 0)
    if (!cheapest || cheapest.cost >= Math.round(budget * 100)) continue
    const picked = best ?? cheapest
    const chosen = picked.build
    const total = priced ? (picked.cost + cents(target)) / 100 : null
    plans.push({ id: option.id, targetCategory, baseline: buildSignature(current), target, chosen,
      beforeTotal: Object.values(current).reduce((sum, part) => sum + cents(part), 0) / 100,
      total, maxGpuPrice: (Math.round(budget * 100) - cheapest.cost) / 100,
      status: !priced ? 'needs_quote' : best ? 'ready' : 'over_budget', trialPrice,
      changes: groups.filter(group => current[group.id]!.id !== chosen[group.id]!.id || current[group.id]!.price !== chosen[group.id]!.price)
        .map(group => ({ category: group.id, label: group.label, before: current[group.id]!, after: chosen[group.id]!,
          delta: group.id === targetCategory && !priced ? null : (cents(chosen[group.id]!) - cents(current[group.id]!)) / 100 })),
      compatibility: checkBuildCompatibility(chosen),
    })
    if (plans.length === 2) break
  }
  return plans
}
