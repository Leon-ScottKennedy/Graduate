import type { PartGroup, PartOption } from '../types/hardware'

// Heuristic spending profiles, not measured hardware performance or an ML model.
const profiles: Record<string, Record<string, number>> = {
  游戏电竞: {
    cpu: 0.2,
    gpu: 0.44,
    board: 0.09,
    ram: 0.07,
    ssd: 0.07,
    power: 0.05,
    case: 0.04,
    cooler: 0.04,
  },
  内容创作: {
    cpu: 0.25,
    gpu: 0.3,
    board: 0.09,
    ram: 0.13,
    ssd: 0.12,
    power: 0.05,
    case: 0.03,
    cooler: 0.03,
  },
  办公学习: {
    cpu: 0.23,
    gpu: 0.24,
    board: 0.12,
    ram: 0.12,
    ssd: 0.13,
    power: 0.06,
    case: 0.06,
    cooler: 0.04,
  },
  'AI 计算': {
    cpu: 0.17,
    gpu: 0.49,
    board: 0.07,
    ram: 0.12,
    ssd: 0.07,
    power: 0.04,
    case: 0.02,
    cooler: 0.02,
  },
}
type State = { score: number; picks: Record<string, PartOption> }

export function selectBuild(
  groups: PartGroup[],
  budget: number,
  usage: string,
  preference: string,
) {
  if (!Number.isFinite(budget) || budget <= 0) return null
  const limit = Math.round(budget * 100)
  const target = limit * (preference === '控制预算' ? 0.9 : 1)
  const profile = { ...(profiles[usage] ?? profiles['游戏电竞']!) }
  if (preference === '静音优先') {
    profile.gpu! -= 0.04
    profile.case! += 0.02
    profile.cooler! += 0.02
  }
  const cents = (option: PartOption) => Math.round(option.price * 100)
  const score = (category: string, option: PartOption) => {
    const share = profile[category] ?? 0.05
    return -((cents(option) / target - share) ** 2) / share
  }
  const cpus = groups.find((group) => group.id === 'cpu')!
  const gpus = groups.find((group) => group.id === 'gpu')!
  let best: { score: number; total: number; picks: Record<string, PartOption> } | undefined
  for (const cpu of cpus.options) {
    for (const gpu of gpus.options) {
      const initialCost = cents(cpu) + cents(gpu)
      if (initialCost > limit) continue
      let states = new Map<number, State>([
        [
          initialCost,
          {
            score: score('cpu', cpu) + score('gpu', gpu),
            picks: { cpu, gpu },
          },
        ],
      ])
      for (const group of groups.filter((group) => !['cpu', 'gpu'].includes(group.id))) {
        const next = new Map<number, State>()
        for (const [cost, state] of states) {
          for (const option of group.options) {
            if (
              group.id === 'power' &&
              (option.psuWatts ?? 0) < (gpu.minPsuWatts ?? (gpu.id === 'gpu-b' ? 650 : 550))
            )
              continue
            if (group.id === 'board' && (option.boardTier ?? 1) < (cpu.minBoardTier ?? 0)) continue
            if (group.id === 'cooler' && (option.coolingTier ?? 0) < (cpu.minCoolingTier ?? 0))
              continue
            // These M-ATX cases cannot take an ATX board. Radiator support is separate.
            if (
              group.id === 'case' &&
              ['case-a', 'case-entry'].includes(option.id) &&
              state.picks.board?.specs.includes('· ATX')
            )
              continue
            if (
              group.id === 'cooler' &&
              option.id === 'cooler-d' &&
              state.picks.case!.id === 'case-entry'
            )
              continue
            const total = cost + cents(option)
            if (total > limit) continue
            const utility = state.score + score(group.id, option)
            const key = total
            if (!next.has(key) || utility > next.get(key)!.score) {
              next.set(key, { score: utility, picks: { ...state.picks, [group.id]: option } })
            }
          }
        }
        states = next
      }
      for (const [total, state] of states) {
        const utility = state.score - 40 * ((target - total) / target) ** 2
        if (!best || utility > best.score) best = { score: utility, total, picks: state.picks }
      }
    }
  }
  return best ? { chosen: best.picks, total: best.total / 100 } : null
}
