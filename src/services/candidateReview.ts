import type { PartOption } from '../types/hardware'
import { checkBuildCompatibility, checkReplacement } from './buildCompatibility'
import { getJson, postJson } from './apiClient'

export interface CandidateAssessment {
  id: string
  verdict: 'suitable' | 'caution' | 'not_recommended' | 'unknown'
  reason: string
  evidence: string[]
}
const cache = new Map<string, { at: number; value: CandidateAssessment[] }>()
const fields = (prefix: string, option: PartOption) =>
  Object.entries(option)
    .filter(([key, value]) => key !== 'id' && key !== 'priceSource' && value !== undefined)
    .map(([key, value]) => [
      `${prefix}.${key}`,
      typeof value === 'string' ? value : JSON.stringify(value),
    ])

export async function reviewCandidates(
  build: Record<string, PartOption>,
  category: string,
  candidates: PartOption[],
  signal: AbortSignal,
) {
  if (!candidates.length) return []
  const facts = Object.fromEntries([
    ...Object.entries(build).flatMap(([key, option]) => fields(`build.${key}`, option)),
    ...candidates.flatMap((option) => {
      const rules = checkReplacement(build, category, option)
      return [
        ...fields(`candidate.${option.id}`, option),
        [`candidate.${option.id}.errors`, JSON.stringify(rules.errors)],
        [`candidate.${option.id}.warnings`, JSON.stringify(rules.warnings)],
        [
          `candidate.${option.id}.pending`,
          rules.pending.map((item) => item.code).join(',') || 'none',
        ],
      ]
    }),
  ])
  const body = {
    facts,
    rules: checkBuildCompatibility(build),
    candidateIds: candidates.map((option) => option.id),
  }
  const key = JSON.stringify(body)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < 600000) return cached.value
  const status = await getJson<{ configured: boolean }>('/ai/status', signal)
  if (!status.configured) return []
  const result = await postJson<{ assessments: CandidateAssessment[] }>(
    '/ai/candidates',
    body,
    signal,
  )
  if (!signal.aborted) {
    if (cache.size >= 30) cache.delete(cache.keys().next().value!)
    cache.set(key, { at: Date.now(), value: result.assessments })
  }
  return result.assessments
}
