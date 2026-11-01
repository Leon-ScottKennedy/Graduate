import type { PartGroup, PartOption } from '../types/hardware'
import { candidateOptions } from '../data/mock/candidateOptions'
import { candidateFamilyById } from '../data/mock/candidateFamilies'
import { browseHardware } from './hardwareBrowse'
import { hardwareGeneration } from './hardwareGeneration'

const text = (part: PartOption) => `${part.name} ${part.specs}`.toUpperCase()
const capture = (value: string, pattern: RegExp) => value.match(pattern)?.[1]
const capacity = (value: string) => {
  const match = value.match(/(\d+)\s*(TB|GB)/)
  return match ? Number(match[1]) * (match[2] === 'TB' ? 1024 : 1) : undefined
}

// Cohorts are explicitly curated; text checks also protect capacity/platform boundaries.
function comparableSpecifications(
  category: string,
  selected: PartOption,
  option: PartOption,
): boolean {
  const a = text(selected)
  const b = text(option)
  if (category === 'gpu') {
    const chip = (value: string) =>
      capture(value, /((?:RTX|GTX|RX|ARC)\s*\d{3,4}(?:\s*(?:XTX|TI|XT|GRE))?(?:\s*SUPER)?(?:\s*D\b)?)/)?.replace(/\s/g, '')
    return !!chip(a) && chip(a) === chip(b) && capacity(a) === capacity(b)
  }
  if (category === 'ram') {
    const frequency = (value: string) =>
      Number(capture(value, /DDR[345]\s+(\d{4})/) ?? capture(value, /(\d{4})\s*MT\/S/))
    const fa = frequency(a)
    const fb = frequency(b)
    // Unspecified frequency remains visible as unspecified; do not invent a value.
    return (
      capacity(selected.name.toUpperCase()) === capacity(option.name.toUpperCase()) &&
      capture(a, /(DDR[345])/) === capture(b, /(DDR[345])/) &&
      (!fa || !fb || Math.abs(fb / fa - 1) <= 0.1)
    )
  }
  if (category === 'ssd') {
    const generation = (value: string) => capture(value, /PCIE\s*(\d)/)
    return capacity(a) === capacity(b) && (!generation(a) || !generation(b) || generation(a) === generation(b))
  }
  if (category === 'board') {
    const chipset = (value: string) => capture(value, /\b([ABXZHQ]\d{3}[EM]?)\b/)?.replace(/M$/, '')
    const form = (value: string) => capture(value, /(M-ATX|MINI-ITX|E-ATX|\bATX\b)/)
    const socket = (value: string) => capture(value, /\b(AM[45]|LGA\s*\d{4})\b/)?.replace(/\s/g, '')
    return !!socket(a) && socket(a) === socket(b) && !!chipset(a) && chipset(a) === chipset(b)
      && capture(a, /(DDR[345])/) === capture(b, /(DDR[345])/) && form(a) === form(b)
  }
  if (category === 'cpu') {
    const socket = (part: PartOption) => part.compatibility?.socket ?? capture(text(part), /\b(AM[45]|LGA\s*\d{4})\b/)?.replace(/\s/g, '')
    return !!socket(selected) && socket(selected) === socket(option)
  }
  if (category === 'power') return selected.psuWatts === option.psuWatts
  return true
}

export const sameGpuModel = (selected: PartOption, option: PartOption) =>
  comparableSpecifications('gpu', selected, option)

// Use whole-yuan limits consistently in filtering and the displayed explanation.
export const candidatePriceCeiling = (price: number, premium: number) =>
  Math.max(price, Math.round(price * (1 + premium)))

// Same-chip alternatives remain visible even when AI is waiting/unavailable.
// Unknown prices are visible for model discovery but never treated as in-range quotes.
export function selectComparisonCandidates(group: PartGroup, selected: PartOption,
  recommendedIds: Set<string>, filters: CandidateFilters = {}) {
  const nearbyIds = new Set(selectCandidates(group, selected, { nearbyOnly: true }).map(part => part.id))
  return selectCandidates(group, selected, { ...filters, priceRange: undefined }).filter(part => {
    const localMatch = group.id === 'cpu' ? true : group.id === 'gpu' ? sameGpuModel(selected, part)
      : nearbyIds.has(part.id)
    if (!localMatch && !recommendedIds.has(part.id)) return false
    if (part.requiresQuote || part.price <= 0) return true
    // Comparable, compatible savings are welcome at any discount. The limit only
    // constrains extra spending; it must not hide a cheaper equivalent option.
    return filters.priceRange === undefined || (selected.price > 0 && part.price <= candidatePriceCeiling(selected.price, filters.priceRange) + 1e-9)
  }).sort((a, b) => Number(a.requiresQuote || a.price <= 0) - Number(b.requiresQuote || b.price <= 0))
}

// One candidate per brand first, then remaining editions in their original order.
export function diversifyCandidates(options: PartOption[]): PartOption[] {
  const seen = new Set<string>()
  const first: PartOption[] = [], rest: PartOption[] = []
  for (const option of options) {
    if (seen.has(option.brand)) rest.push(option)
    else { seen.add(option.brand); first.push(option) }
  }
  return [...first, ...rest]
}

export function selectSpecificationCandidates(
  group: PartGroup,
  selected: PartOption,
): PartOption[] {
  const target = candidateFamilyById[selected.id]
  if (!target || selected.price <= 0) return []
  const seen = new Set<string>()
  const seenIds = new Set<string>()
  return [...group.options, ...(candidateOptions[group.id] ?? []), selected]
    .filter((option) => {
      const identity = option.name.toUpperCase().replace(/\s+/g, '')
      if (seenIds.has(option.id) || seen.has(identity)) return false
      seenIds.add(option.id)
      seen.add(identity)
      return (
        option.id !== selected.id &&
        identity !== selected.name.toUpperCase().replace(/\s+/g, '') &&
        candidateFamilyById[option.id] === target &&
        comparableSpecifications(group.id, selected, option) &&
        option.price >= selected.price * 0.8 &&
        option.price <= selected.price * 1.2
      )
    })
    .sort((a, b) => Math.abs(a.price - selected.price) - Math.abs(b.price - selected.price))
}

export interface CandidateFilters {
  nearbyOnly?: boolean
  priceRange?: number
  brand?: string
  query?: string
}

function nearbySpecifications(category: string, selected: PartOption, option: PartOption) {
  if (category !== 'gpu') return comparableSpecifications(category, selected, option)
  const chip = (item: PartOption) => text(item).match(/RTX\s*(\d)(\d{2})\d\s*(TI)?\s*(SUPER)?/)
  const a = chip(selected), b = chip(option)
  if (!a || !b) return comparableSpecifications(category, selected, option)
  // Same tier/edition and VRAM, at most one generation apart. AI reviews suitability.
  return a[2] === b[2] && a[3] === b[3] && a[4] === b[4]
    && Math.abs(Number(a[1]) - Number(b[1])) <= 1
    && capacity(text(selected)) === capacity(text(option))
}

export function selectCandidates(
  group: PartGroup,
  selected: PartOption,
  filters: CandidateFilters = {},
): PartOption[] {
  const identity = (name: string) => name.toUpperCase().replace(/\s+/g, '')
  const query = filters.query?.trim().toLocaleLowerCase() ?? ''
  return browseHardware(group)
    .filter((option) => {
      if (option.id === selected.id || identity(option.name) === identity(selected.name))
        return false
      if (filters.nearbyOnly) {
        if (!nearbySpecifications(group.id, selected, option)) return false
        if (group.id === 'cpu') {
          const family = (item: PartOption) => capture(text(item), /RYZEN\s+([3579])/) ?? capture(text(item), /CORE\s+I([3579])/)
          if (!family(selected) || family(selected) !== family(option)) return false
        }
        if (group.id === 'cooler' && selected.coolingTier !== undefined && option.coolingTier !== undefined
          && Math.abs(selected.coolingTier - option.coolingTier) > 1) return false
      }
      if (filters.brand && filters.brand !== option.brand) return false
      if (
        query &&
        !`${option.name} ${option.brand} ${option.specs}`.toLocaleLowerCase().includes(query)
      )
        return false
      if (filters.priceRange !== undefined) {
        if (selected.price <= 0 || option.price <= 0 || option.requiresQuote) return false
        if (Math.abs(option.price / selected.price - 1) > filters.priceRange + 1e-9) return false
      }
      return true
    })
    .sort((a, b) => {
      const generation = hardwareGeneration(group.id, b) - hardwareGeneration(group.id, a)
      if (generation) return generation
      const missingA = a.price <= 0 || !!a.requiresQuote
      const missingB = b.price <= 0 || !!b.requiresQuote
      if (missingA !== missingB) return Number(missingA) - Number(missingB)
      return (
        (missingA ? 0 : Math.abs(a.price - selected.price) - Math.abs(b.price - selected.price)) ||
        a.name.localeCompare(b.name, 'zh-CN')
      )
    })
}
