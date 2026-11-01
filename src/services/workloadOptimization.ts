import type { PartGroup, PartOption } from '../types/hardware'
import type { DemandWeights } from './demandWeights'
import { buildSignature, type OptimizationPlan } from './buildOptimization'
import { checkBuildCompatibility } from './buildCompatibility'
import { partSpecifications } from './partSpecifications'

export interface WorkloadProposal { title: string; parts: Record<string, string>; reasons: Record<string, string>; tradeoffs: string[] }
export interface WorkloadAdvice { provider: string; summary: string; demandWeights: DemandWeights; questions: string[]; plans: WorkloadProposal[] }
const categories = ['cpu', 'gpu', 'board', 'ram', 'ssd', 'power', 'case', 'cooler']
export function workloadCatalog(catalog: PartGroup[], current: Record<string, PartOption>) {
  return catalog.map(group => ({ ...group, options: [...new Map([...group.options, current[group.id]!]
    .filter(part => part && !part.requiresQuote && (part.price > 0 || (group.id === 'gpu' && part.id.startsWith('integrated-'))))
    .map(part => [part.id, part])).values()] as PartGroup['options'] }))
}
export function workloadFacts(build: Record<string, PartOption>, budget: number, weights: DemandWeights) {
  const facts: Record<string, string> = { 'context.budget': String(budget), 'context.demandWeights': JSON.stringify(weights),
    'context.priceBasis': '项目参考价或已记录报价，不是实时成交价；不能编造帧率、跑分、噪声分贝。',
    'context.capacity': 'AI或创作占比>=25%时不得减少当前内存、SSD容量；AI占比>=25%时不得减少显存。' }
  for (const [key, part] of Object.entries(build)) {
    facts[`build.${key}.name`] = part.name
    facts[`build.${key}.price`] = String(part.price)
    facts[`build.${key}.specs`] = partSpecifications(part, key).map(row => `${row.label}:${row.value}`).join('；').slice(0, 600) || part.specs
  }
  return facts
}
export function workloadChoices(catalog: PartGroup[]) {
  return catalog.flatMap(group => group.options.map(part => ({ id: part.id, category: group.id, name: part.name, price: part.price,
    specs: `${part.specs}；${partSpecifications(part, group.id).map(row => `${row.label}:${row.value}`).join('；')}；安装:${JSON.stringify(part.compatibility ?? {})}`.slice(0, 600) })))
}
function capacity(part: PartOption | undefined, category: string) {
  if (!part) return 0
  const values = Object.fromEntries(partSpecifications(part, category).map(row => [row.label, row.value]))
  const source = values[category === 'ram' ? '总容量' : category === 'gpu' ? '显存容量' : '容量'] ?? `${part.name} ${part.specs}`
  const match = source.match(/(\d+(?:\.\d+)?)\s*(TB|GB)/i)
  return match ? Number(match[1]) * (match[2]!.toUpperCase() === 'TB' ? 1024 : 1) : 0
}
export function workloadLocalCatalog(catalog: PartGroup[], current: Record<string, PartOption>, weights: DemandWeights) {
  return catalog.map(group => ({ ...group, options: group.options.filter(part => {
    if ((weights.ai >= 25 || weights.creation >= 25) && ['ram', 'ssd'].includes(group.id)) return capacity(part, group.id) >= capacity(current[group.id], group.id)
    if (weights.ai >= 25 && group.id === 'gpu') return capacity(part, 'gpu') >= capacity(current.gpu, 'gpu')
    return true
  }) as PartGroup['options'] }))
}
export function validateWorkloadPlan(proposal: WorkloadProposal, catalog: PartGroup[], current: Record<string, PartOption>, budget: number, weights: DemandWeights) {
  const errors: string[] = []
  const chosen: Record<string, PartOption> = {}
  if (Object.keys(proposal.parts).sort().join() !== [...categories].sort().join()) errors.push('方案必须包含完整的八类配件')
  for (const group of catalog) {
    const option = group.options.find(part => part.id === proposal.parts[group.id])
    if (!option || option.requiresQuote || (option.price <= 0 && !(group.id === 'gpu' && option.id.startsWith('integrated-')))) errors.push(`${group.label}型号未入库或无有效价格`)
    else chosen[group.id] = option
  }
  if (errors.length) return { errors, plan: null }
  const compatibility = checkBuildCompatibility(chosen)
  errors.push(...compatibility.errors.map(issue => issue.message))
  errors.push(...compatibility.warnings.filter(issue => ['power', 'board-tier', 'cooling-tier'].includes(issue.code)).map(issue => issue.message))
  const total = Object.values(chosen).reduce((sum, part) => sum + Math.round(part.price * 100), 0) / 100
  if (chosen.gpu!.id.startsWith('integrated-')) {
    const graphics = partSpecifications(chosen.cpu!, 'cpu').find(row => row.label === '核显')?.value
    if (!graphics || /无|待补充|待核验/.test(graphics)) errors.push('核显方案要求处理器具备已确认的集成显卡')
  }
  if (weights.ai >= 25 || weights.creation >= 25) {
    for (const category of ['ram', 'ssd']) {
      if (capacity(chosen[category], category) < capacity(current[category], category)) errors.push(`${category === 'ram' ? '内存' : '存储'}容量不能低于当前配置`)
    }
  }
  if (weights.ai >= 25 && capacity(chosen.gpu, 'gpu') < capacity(current.gpu, 'gpu')) errors.push('AI需求下不得减少当前显存容量')
  if (errors.length) return { errors, plan: null }
  const changes = catalog.filter(group => current[group.id]?.id !== chosen[group.id]?.id || current[group.id]?.price !== chosen[group.id]?.price)
    .map(group => ({ category: group.id, label: group.label, before: current[group.id]!, after: chosen[group.id]!, delta: chosen[group.id]!.price - current[group.id]!.price }))
  const targetCategory = changes[0]?.category ?? 'cpu'
  const plan: OptimizationPlan = { allowOverBudget: true, id: buildSignature(chosen), targetCategory, target: chosen[targetCategory]!, baseline: buildSignature(current), chosen,
    total, beforeTotal: Object.values(current).reduce((sum, part) => sum + part.price, 0), maxGpuPrice: budget, trialPrice: false, status: 'ready', changes, compatibility }
  return { errors, plan }
}
export function proposalFromBuild(chosen: Record<string, PartOption>): WorkloadProposal {
  return { title: '本地规则方案', parts: Object.fromEntries(Object.entries(chosen).map(([key, part]) => [key, part.id])),
    reasons: Object.fromEntries(categories.map(key => [key, '按四项用途权重、预算和兼容规则计算；不是实测性能评分。'])),
    tradeoffs: ['本地规则按用途加权的选配倾向计算，不能替代 AI 对具体软件、游戏和安静偏好的理解。'] }
}
