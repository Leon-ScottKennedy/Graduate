/** Preserve the stage proportions within a complete 25-second showcase. */
export const showcaseTiming = {
  halfProgress: .42,
  expand: 7 * 25 / 30,
  explodedHold: 4 * 25 / 30,
  assemble: 9 * 25 / 30,
  assembledHold: 3 * 25 / 30,
  reopen: 5 * 25 / 30,
  halfHold: 2 * 25 / 30,
} as const
export type ShowcaseTiming = { [K in keyof typeof showcaseTiming]: number }
export function showcaseDuration(timing: ShowcaseTiming = showcaseTiming) {
  return timing.expand + timing.explodedHold + timing.assemble + timing.assembledHold + timing.reopen + timing.halfHold
}
const gentle = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)
export function sampleShowcase(seconds: number, timing: ShowcaseTiming = showcaseTiming) {
  const stages = [
    [timing.expand, timing.halfProgress, 1, 'expand'],
    [timing.explodedHold, 1, 1, 'exploded-hold'],
    [timing.assemble, 1, 0, 'assemble'],
    [timing.assembledHold, 0, 0, 'assembled-hold'],
    [timing.reopen, 0, timing.halfProgress, 'reopen'],
    [timing.halfHold, timing.halfProgress, timing.halfProgress, 'half-hold'],
  ] as const
  const duration = showcaseDuration(timing)
  let time = ((seconds % duration) + duration) % duration
  for (const [length, from, to, phase] of stages) {
    if (time < length) return { progress: from + (to - from) * gentle(time / length), phase }
    time -= length
  }
  return { progress: timing.halfProgress, phase: 'half-hold' }
}
