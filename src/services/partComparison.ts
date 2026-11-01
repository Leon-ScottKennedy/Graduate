import type { PartOption } from '../types/hardware'
import { partSpecifications } from './partSpecifications'

export function comparePartSpecifications(current: PartOption, candidate: PartOption, category: string) {
  const left = new Map(partSpecifications(current, category).map(row => [row.label, row.value]))
  const right = new Map(partSpecifications(candidate, category).map(row => [row.label, row.value]))
  const unknown = (value: string) => !value.trim() || /待补充|待核验|待确认/.test(value)
  return [...new Set([...left.keys(), ...right.keys()])].map(label => {
    const absent = label === '默认TDP' && category === 'cpu' ? '不适用（Intel 使用处理器基础功耗）' : '待补充'
    const currentValue = left.get(label) || absent
    const candidateValue = right.get(label) || absent
    return { label, current: currentValue, candidate: candidateValue,
      different: currentValue !== candidateValue,
      currentUnknown: unknown(currentValue), candidateUnknown: unknown(candidateValue) }
  })
}
