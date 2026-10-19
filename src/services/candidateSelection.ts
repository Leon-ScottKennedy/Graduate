import type { PartGroup, PartOption } from '../types/hardware'
import { candidateOptions } from '../data/mock/candidateOptions'
import { candidateFamilyById } from '../data/mock/candidateFamilies'

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
      capture(value, /((?:RTX|RX)\s*\d{4}(?:\s*TI)?(?:\s*SUPER)?(?:\s*D\b)?)/)?.replace(/\s/g, '')
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
  if (category === 'ssd') return capacity(a) === capacity(b)
  if (category === 'cpu' || category === 'board') return a.includes('AM5') && b.includes('AM5')
  if (category === 'power') return selected.psuWatts === option.psuWatts
  return true
}

export function selectCandidates(group: PartGroup, selected: PartOption): PartOption[] {
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
