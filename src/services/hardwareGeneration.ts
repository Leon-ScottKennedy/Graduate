import type { PartOption } from '../types/hardware'

// Generation is a preference signal within the same family, never a benchmark.
export function hardwareGeneration(category: string, option: PartOption): number {
  if (category === 'gpu') {
    const match = option.name.match(/RTX\s*(\d)\d{3}/i)
    return match ? Number(match[1]) : 0
  }
  if (category === 'cpu') {
    const match = option.name.match(/Ryzen\s+[3579]\s+(\d)\d{3}/i)
    return match ? Number(match[1]) : 0
  }
  return 0
}

export function newerAlternative(category: string, option: PartOption, options: PartOption[]) {
  const generation = hardwareGeneration(category, option)
  if (!generation) return false
  return options.some(item => hardwareGeneration(category, item) > generation
    && item.price > 0 && !item.requiresQuote
    && (category !== 'gpu' || item.name.match(/RTX\s*\d(\d{2})/i)?.[1] === option.name.match(/RTX\s*\d(\d{2})/i)?.[1])
    && item.price >= option.price * 0.8 && item.price <= option.price * 1.2)
}
