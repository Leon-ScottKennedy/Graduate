import { demoParts } from '../data/mock/catalog'
import type { ComparisonHardware, ConfigPlan, PartOption, PartGroup } from '../types/hardware'
import { hardwareExpansion } from '../data/hardwareExpansion'
import { frontendOnly, postJson } from './apiClient'
import { money } from '../utils/format'
import { withReferencePrice } from '../data/referencePriceBook'

// Local catalog shared by build selection, configuration plans and hardware comparison.
export function getBuildCatalog() {
  return demoParts.map(group => ({ ...group,
    options: [...group.options, ...(hardwareExpansion[group.id] ?? [])].map(item => withReferencePrice({ ...item })) as PartGroup['options'],
  }))
}

export async function loadBuildCatalog(signal?: AbortSignal) {
  const groups = getBuildCatalog()
  if (frontendOnly) return groups
  const result = await postJson<{ offers: Array<NonNullable<PartOption['marketOffer']> & { modelId: string; price: number }> }>(
    '/market/catalog-offers', { models: groups.flatMap(group => group.options.map(item => ({
      id: item.id, category: group.id, brand: item.brand, modelName: item.name, specs: item.specs,
    }))) }, signal)
  for (const group of groups) {
    for (const item of group.options) {
      const offer = result.offers.find(row => row.modelId === item.id)
      if (!offer || !Number.isFinite(offer.price) || offer.price <= 0) continue
      if (item.referencePrice) {
        item.observedMarketOffer = offer
        continue
      }
      item.price = offer.price
      item.requiresQuote = false
      item.marketOffer = { id: offer.id, shop: offer.shop, platform: offer.platform,
        productUrl: offer.productUrl, collectedAt: offer.collectedAt }
      item.tag = '已采集商品展示价 · 购买前核对 SKU'
    }
  }
  return groups
}

const planDefinitions = [
  { name: '办公影音', desc: '日常办公 · 核显输出 · 32GB 内存', parts: {
    cpu: 'library-cpu-ryzen 5 9600x', gpu: null, board: 'board-a', ram: 'ram-a',
    ssd: 'library-ssd-t500-1tb', power: 'power-a', case: 'case-a', cooler: 'cooler-b',
  } },
  { name: '主流游戏', desc: '2K 游戏参考 · RTX 5070 · 32GB 内存', featured: true, parts: {
    cpu: 'library-cpu-ryzen 5 9600x', gpu: 'library-gpu-geforce-rtx-5070-12g-ventus-3x-oc', board: 'board-c', ram: 'ram-a',
    ssd: 'library-ssd-t500-2tb', power: 'power-b', case: 'case-b', cooler: 'cooler-b',
  } },
  { name: '高端创作', desc: '12 核剪辑渲染 · 16GB 显存 · 64GB 内存', parts: {
    cpu: 'library-cpu-ryzen 9 9900x', gpu: 'library-gpu-geforce-rtx-5070-ti-16g-ventus-3x-oc', board: 'board-c', ram: 'ram-b',
    ssd: 'ssd-c', power: 'power-c', case: 'case-b', cooler: 'cooler-c',
  } },
  { name: 'AI 工作站', desc: '本地 AI 入门 · 16GB 显存 · 96GB 内存', parts: {
    cpu: 'library-cpu-ryzen 7 9700x', gpu: 'library-gpu-geforce-rtx-5060-ti-16g-ventus-2x-oc-plus', board: 'board-c', ram: 'ram-d',
    ssd: 'ssd-c', power: 'power-b', case: 'case-b', cooler: 'cooler-b',
  } },
] satisfies { name: string; desc: string; featured?: boolean; parts: Record<string, string | null> }[]

export function getConfigPlans(): ConfigPlan[] {
  const catalog = getBuildCatalog()
  return planDefinitions.map((definition) => {
    const detail = catalog.map((group) => {
      const id = (definition.parts as Record<string, string | null>)[group.id]
      // Office graphics are included in the CPU price, never charged twice.
      if (group.id === 'gpu' && id === null) return { part: group.label, name: 'Ryzen 5 9600X 集成 Radeon 显卡（无需独显）', price: 0, hardwareId: 'integrated-9600x' }
      const option = group.options.find(option => option.id === id)
      if (!option || option.requiresQuote || option.price <= 0) throw new Error(`Invalid configuration plan part: ${definition.name}/${group.id}/${id}`)
      return { part: group.label, name: option.name, price: option.price, hardwareId: option.id }
    })
    return {
      name: definition.name, desc: definition.desc, featured: 'featured' in definition ? definition.featured : undefined,
      price: money(detail.reduce((sum, item) => sum + item.price, 0)),
      specs: detail
        .filter((item) => ['处理器', '显卡', '内存', '固态硬盘'].includes(item.part))
        .map((item) => `${item.part} · ${item.name}`),
      detail,
    }
  })
}

export function getComparisonCatalog(): Record<string, ComparisonHardware[]> {
  return Object.fromEntries(
    demoParts
      .filter((group) => ['cpu', 'gpu'].includes(group.id))
      .map((group) => [
        group.id === 'cpu' ? 'CPU' : group.label,
        group.options.map((option: PartOption) => ({
          name: option.name,
          specs: {
            品牌: option.brand,
            ...option.parameters,
            规格: option.specs,
            参考价格: money(option.price),
          },
        })),
      ]),
  )
}

// Resolve exact plan IDs; never substitute automatically selected hardware.
export function getConfigPlanSelection(name: unknown) {
  if (typeof name !== 'string') return
  const plan = getConfigPlans().find(plan => plan.name === name)
  if (!plan) return
  const catalog = getBuildCatalog()
  const chosen: Record<string, PartOption> = {}
  for (const group of catalog) {
    const item = plan.detail.find(item => item.part === group.label)
    if (!item) return
    const option = group.options.find(option => option.id === item.hardwareId)
    if (option) chosen[group.id] = { ...option }
    else if (group.id === 'gpu' && item.hardwareId === 'integrated-9600x') {
      chosen.gpu = { id: item.hardwareId, brand: 'AMD', name: item.name, price: 0,
        specs: '处理器集成显卡 · 无需独立显卡，费用已包含在处理器中', tag: '核显方案',
        parameters: { 显卡类型: 'CPU 集成显卡', 独立显卡: '未安装' } }
    } else return
  }
  const total = Object.values(chosen).reduce((sum, part) => sum + part.price, 0)
  const usage = ({ '办公影音': '办公学习', '主流游戏': '游戏电竞', '高端创作': '内容创作', 'AI 工作站': 'AI 计算' } as Record<string, string>)[plan.name]!
  return { name: plan.name, chosen, budget: Math.max(3000, Math.ceil(total)), usage }
}
