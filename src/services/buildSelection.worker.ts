import { selectBuild, type CpuPlatform } from './buildSelection'
import type { PartGroup } from '../types/hardware'
import type { DemandWeights } from './demandWeights'

self.onmessage = (event: MessageEvent<{ catalog: PartGroup[]; budget: number; usage: string; preference: string; platform?: CpuPlatform; demandWeights?: DemandWeights }>) => {
  try {
    const { catalog, budget, usage, preference, platform } = event.data
    self.postMessage({ selection: selectBuild(catalog, budget, usage, preference, platform, event.data.demandWeights) })
  } catch {
    self.postMessage({ error: true })
  }
}
