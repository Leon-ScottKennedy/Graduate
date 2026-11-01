import type { PartOption } from '../types/hardware'
import { checkReplacement } from './buildCompatibility'

export function previewPartDrop(build: Record<string, PartOption>, sourceCategory: string,
  targetCategory: string, option: PartOption, budget: number) {
  if (sourceCategory !== targetCategory || !build[targetCategory]) return null
  if (option.requiresQuote || !Number.isFinite(option.price) || option.price <= 0) return null
  const compatibility = checkReplacement(build, targetCategory, option)
  const totalCents = Object.entries(build).reduce((sum, [category, part]) =>
    sum + Math.round((category === targetCategory ? option.price : part.price) * 100), 0)
  return { allowed: !compatibility.errors.length, compatibility, total: totalCents / 100,
    remaining: (Math.round(budget * 100) - totalCents) / 100 }
}
