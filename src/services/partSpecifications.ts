import type { PartOption } from '../types/hardware'
import { specificationReference } from '../data/specificationReference'

// Only expose recorded fields or literal values already present in the catalog.
export function partSpecifications(part: PartOption, category: string) {
  category = ({ power: 'psu', fan: 'cooler' } as Record<string, string>)[category] ?? category
  const reference = specificationReference(part, category)
  const values: Record<string, string> = { ...reference?.values, ...part.parameters }
  const put = (key: string, value?: string | number) => {
    if (!values[key] && value !== undefined && value !== '') values[key] = String(value)
  }
  const match = (pattern: RegExp) => part.specs.match(pattern)?.[0]
  const named = (pattern: RegExp) => part.name.match(pattern)?.[0]
  // An explicit "待核验" dimension is not a confirmed parameter.
  const dimension = (value?: number) => value && Number.isFinite(value) && value > 0 ? `${value} mm` : undefined
  const c = part.compatibility
  if (category === 'cpu') {
    put('核心线程', match(/\d+\s*核\s*\/?\s*\d+\s*线程/))
    put('接口', c?.socket ?? match(/\b(?:AM[45]|LGA\s*\d+)\b/i))
    put('核显', match(/无核显|集成显卡|集成核显/))
    put('最高加速频率', match(/\d+(?:\.\d+)?\s*GHz/i))
  }
  if (category === 'gpu') {
    put('芯片', named(/(?:RTX|GTX|RX)\s*\d+(?:\s*(?:Ti|SUPER|XTX|XT|D)\b)*/i) ?? match(/(?:RTX|GTX|RX)\s*\d+(?:\s*(?:Ti|SUPER|XTX|XT|D)\b)*/i))
    put('显存容量', match(/\d+\s*GB/i))
    put('显存类型', match(/GDDR\d+[X]?/i))
    put('显卡长度', c?.gpuLengthMm ? `${c.gpuLengthMm} mm` : undefined)
    put('建议电源', part.minPsuWatts ? `${part.minPsuWatts} W` : undefined)
  }
  if (category === 'board') {
    put('接口', c?.socket ?? match(/\b(?:AM[45]|LGA\s*\d+)\b/i))
    put('内存类型', c?.memoryType ?? match(/DDR[345]/i))
    put('板型', c?.boardForm ?? match(/(?:M-ATX|Micro-ATX|Mini-ITX|E-ATX|ATX)/i))
    const chipset = named(/\b(?:[ABX]\d{3}|[BHZQW]\d{3})[E]?(?=M?[-\s/]|$)/i)
    put('芯片组', chipset?.toUpperCase())
    put('无线网络', match(/Wi-?Fi(?:\s*[67]E?)?/i) ?? named(/Wi-?Fi(?:\s*[67]E?)?/i))
  }
  if (category === 'ram') {
    put('内存类型', c?.memoryType ?? match(/DDR[345]/i))
    put('套装规格', match(/\d+\s*GB\s*[×x*]\s*\d+/i))
    put('频率', match(/\d+\s*(?:MT\/s|MHz)/i))
    const kit = part.specs.match(/(\d+(?:\.\d+)?)\s*GB\s*[×x*]\s*(\d+)/i)
    if (kit) {
      put('总容量', `${Number(kit[1]) * Number(kit[2])} GB`)
      put('单条容量', `${kit[1]} GB`)
      put('数量', `${kit[2]} 条`)
    } else put('总容量', named(/\d+\s*GB/i) ?? match(/\d+\s*GB/i))
    // DDR5 6000 is a labeled transfer rate, not the DRAM clock in MHz.
    const rate = part.name.match(/DDR[345]\s+(\d{4,5})(?:\D|$)/i)?.[1]
    if (rate) put('频率', `${rate} MT/s`)
    const timing = `${part.name} ${part.specs}`.match(/\b(?:CL|C)(\d{2})(?:\b|[-])/i)?.[1]
    if (timing) put('时序', `CL${timing}`)
  }
  if (category === 'ssd') {
    put('容量', match(/\d+(?:\.\d+)?\s*(?:TB|GB)/i))
    put('接口协议', match(/(?:M\.2\s*)?NVMe/i))
    put('PCIe 版本', match(/PCIe\s*\d+(?:\.\d+)?/i))
    put('外形规格', match(/M\.2\s*\d{4}/i) ?? match(/M\.2/i))
    put('闪存类型', match(/(?:3D\s*)?(?:TLC|QLC|MLC|SLC)\b/i))
    put('独立缓存', match(/无独立\s*DRAM|独立\s*DRAM/i))
  }
  if (category === 'psu') {
    put('额定功率', part.psuWatts ? `${part.psuWatts} W` : match(/\d+\s*W/i))
    put('能效认证', match(/(?:80\s*PLUS\s*)?(?:钛金牌|白金牌|铂金|金牌|银牌|铜牌|白牌)/i))
    put('模组类型', match(/全模组|半模组|非模组/))
    put('ATX 版本', match(/ATX\s*\d+(?:\.\d+)?/i))
  }
  if (category === 'case') {
    put('支持主板', c?.supportedBoardForms?.join(' / '))
    put('机箱板型', match(/(?:M-ATX|Micro-ATX|Mini-ITX|E-ATX|ATX)/i))
    put('显卡限长', dimension(c?.maxGpuLengthMm))
    put('散热器限高', dimension(c?.maxCoolerHeightMm))
    put('支持冷排', c?.supportedRadiatorsMm?.map(size => `${size} mm`).join(' / '))
  }
  if (category === 'cooler' || category === 'fan') {
    put('支持接口', c?.coolerSockets?.join(' / ') ?? match(/\b(?:AM[45]|LGA\s*\d+)\b/i))
    put('散热器高度', c?.coolerHeightMm ? `${c.coolerHeightMm} mm` : undefined)
    put('冷排规格', c?.radiatorMm ? `${c.radiatorMm} mm` : undefined)
    put('散热方式', match(/双塔风冷|单塔风冷|塔式风冷|一体式水冷|风冷|水冷/))
    put('风扇规格', match(/\d+\s*mm(?=\s*(?:单塔|双塔|风冷))/i))
    const radiator = part.specs.match(/(\d{3})\s*(?:mm)?\s*水冷/i)?.[1]
    if (radiator) put('冷排规格', `${radiator} mm`)
    if (/风冷/.test(values['散热方式'] ?? part.specs)) put('冷排规格', '不适用（风冷）')
    if (/水冷/.test(values['散热方式'] ?? part.specs)) put('散热器高度', '不适用（水冷请核对冷排和泵头空间）')
  }
  const expected: Record<string, string[]> = {
    cpu: ['核心线程', '接口', '核显', '最高加速频率', ...(values['处理器基础功耗'] ? [] : ['默认TDP'])],
    gpu: ['芯片', '显存容量', '显存类型', '显卡长度', '建议电源'],
    board: ['接口', '内存类型', '板型', '扩展接口'],
    ram: ['内存类型', '总容量', '套装规格', '频率', '时序'],
    ssd: ['容量', '接口协议', 'PCIe 版本', '读取速度'],
    psu: ['额定功率', '能效认证', '模组类型'],
    case: ['支持主板', '显卡限长', '散热器限高'],
    cooler: ['支持接口', '散热器高度', '冷排规格'],
    fan: ['支持接口', '散热器高度', '冷排规格'],
  }
  for (const key of expected[category] ?? []) put(key, '待补充')
  return Object.entries(values).map(([label, value]) => ({ label, value }))
}
