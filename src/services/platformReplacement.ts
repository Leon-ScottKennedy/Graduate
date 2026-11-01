import type { PartGroup, PartOption } from '../types/hardware'
import { checkBuildCompatibility, hardwareSocket } from './buildCompatibility'

export function planCpuReplacement(build: Record<string, PartOption>, cpu: PartOption, catalog: PartGroup[], budget: number) {
  if (!Number.isFinite(budget) || budget <= 0) return null
  const socket = hardwareSocket(cpu)
  if (!socket || cpu.requiresQuote || cpu.price <= 0) return null
  const choices = (category: string) => {
    const group = catalog.find(group => group.id === category)
    return [...new Map([build[category]!, ...(group?.options ?? [])].map(part => [part.id, part])).values()]
      .filter(part => part.price > 0 && !part.requiresQuote)
  }
  let best: { chosen: Record<string, PartOption>; total: number; changes: string[]; check: ReturnType<typeof checkBuildCompatibility> } | null = null
  for (const board of choices('board')) {
    if (hardwareSocket(board) !== socket || (board.boardTier ?? 1) < (cpu.minBoardTier ?? 0)) continue
    for (const cooler of choices('cooler')) {
      // A cross-platform switch needs explicit evidence of a compatible mounting kit.
      if (!cooler.compatibility?.coolerSockets?.includes(socket) || (cooler.coolingTier ?? 0) < (cpu.minCoolingTier ?? 0)) continue
      const chosen: Record<string, PartOption> = { ...build, cpu, board, cooler }
      const check = checkBuildCompatibility(chosen)
      if (check.errors.length) continue
      const total = Math.round(Object.values(chosen).reduce((sum, part) => sum + part.price, 0) * 100) / 100
      if (total > budget) continue
      const changes = Object.keys(chosen).filter(key => chosen[key]!.id !== build[key]?.id)
      if (!best || changes.length < best.changes.length || (changes.length === best.changes.length && total < best.total)) best = { chosen, total, changes, check }
    }
  }
  return best
}
