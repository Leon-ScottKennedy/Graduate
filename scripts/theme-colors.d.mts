import type { Plugin } from 'postcss'
export function lightColor(value: string, role: 'text' | 'surface' | 'border' | 'shadow'): string
export function themeColors(): Plugin
