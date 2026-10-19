import type { PartGroup, PartOption } from '../types/hardware'
import { candidateOptions } from '../data/mock/candidateOptions'
import { hardwareExpansion } from '../data/hardwareExpansion'

export function browseHardware(group: PartGroup): PartOption[] {
  const seen = new Set<string>()
  return [
    ...group.options,
    ...(candidateOptions[group.id] ?? []),
    ...(hardwareExpansion[group.id] ?? []),
  ].filter((option) => {
    const name = option.name.toUpperCase().replace(/\s+/g, '')
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
}
