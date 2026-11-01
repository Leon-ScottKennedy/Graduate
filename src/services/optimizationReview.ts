import type { PartOption } from '../types/hardware'
import type { OptimizationPlan } from './buildOptimization'
import { postJson } from './apiClient'
import { demandAxes, type DemandWeights } from './demandWeights'

export async function reviewOptimization(plan: OptimizationPlan, current: Record<string, PartOption>, budget: number, usage: string, signal: AbortSignal, demandWeights?: DemandWeights) {
  const body = optimizationReviewRequest(plan, current, budget, usage, demandWeights)
  const response = await postJson<{ findings: { kind: string; message: string; evidence: string[] }[] }>('/ai/optimization', body, signal)
  return response.findings.map(item => item.message)
}

export function optimizationReviewRequest(plan: OptimizationPlan, current: Record<string, PartOption>, budget: number, usage: string, demandWeights?: DemandWeights) {
  const facts: Record<string, string> = {
    'context.goal': `评价一套${plan.targetCategory}优先的整机预算重分配方案：说明节省哪些配件、升级取舍、用途适配和待核验项。不得编造报价、性能分数或帧率；规则警告不可说成硬冲突。`,
    'context.budget': String(budget), 'context.usage': usage,
    'plan.status': plan.status, 'plan.total': plan.total === null ? '显卡价格未知，整机总价尚未确定' : String(plan.total),
    'plan.targetCategory': plan.targetCategory,
    'plan.targetPriceCeiling': String(plan.maxGpuPrice),
    'plan.priceBasis': plan.trialPrice ? '用户输入试算价，不是采集报价' : 'marketOffer为采集展示价，其余为预设参考价；缺价不得补造。needs_quote仅为条件方案，不能称已可应用。',
  }
  if (demandWeights) {
    for (const axis of demandAxes) facts[`context.demand.${axis.id}`] = `${axis.label} ${demandWeights[axis.id]}%`
  }
  for (const [prefix, build] of [['before', current], ['after', plan.chosen]] as const) {
    for (const [category, part] of Object.entries(build)) {
      facts[`${prefix}.${category}.name`] = part.name
      facts[`${prefix}.${category}.specs`] = part.specs
      facts[`${prefix}.${category}.price`] = part.requiresQuote ? '价格待确认' : String(part.price)
      facts[`${prefix}.${category}.priceBasis`] = part.referencePrice
        ? `${part.referencePrice.basis}参考：${part.referencePrice.note}`
        : part.marketOffer ? '采集展示价，非实时成交价' : part.priceSource ? '用户记录报价' : part.tag
      facts[`${prefix}.${category}.constraints`] = JSON.stringify({
        compatibility: part.compatibility, minPsuWatts: part.minPsuWatts,
        psuWatts: part.psuWatts, specSource: part.specSource,
      })
    }
  }
  return { mode: 'budget_optimization', facts, rules: plan.compatibility }
}
