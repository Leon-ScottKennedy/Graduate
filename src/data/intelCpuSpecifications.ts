import type { PartOption } from '../types/hardware'
import type { SpecificationReference } from './specificationReference'

// Intel ARK snapshots checked 2026-10-29. Each suffix is a separate verified SKU.
// Model, ARK ID, P/E cores, threads, max turbo, P-core base, base/turbo power,
// L3/L2 cache (MB), DDR5 rate, max memory (GB), integrated graphics.
type IntelCpu = readonly [string, number, number, number, number, number, number, number, number, number, number, number, number, string]
const cpus: readonly IntelCpu[] = [
  ['i3-12100', 134584, 4, 0, 8, 4.3, 3.3, 60, 89, 12, 5, 4800, 128, 'Intel UHD 730'],
  ['i3-12100F', 132223, 4, 0, 8, 4.3, 3.3, 58, 89, 12, 5, 4800, 128, '无'],
  ['i3-13100', 230575, 4, 0, 8, 4.5, 3.4, 60, 110, 12, 5, 4800, 192, 'Intel UHD 730'],
  ['i3-13100F', 230576, 4, 0, 8, 4.5, 3.4, 58, 110, 12, 5, 4800, 192, '无'],
  ['i3-14100', 236774, 4, 0, 8, 4.7, 3.5, 60, 110, 12, 5, 4800, 192, 'Intel UHD 730'],
  ['i3-14100F', 236786, 4, 0, 8, 4.7, 3.5, 58, 110, 12, 5, 4800, 192, '无'],
  ['i5-12400', 134586, 6, 0, 12, 4.4, 2.5, 65, 117, 18, 7.5, 4800, 128, 'Intel UHD 730'],
  ['i5-12400F', 134587, 6, 0, 12, 4.4, 2.5, 65, 117, 18, 7.5, 4800, 128, '无'],
  ['i5-12490F', 134588, 6, 0, 12, 4.6, 3, 65, 117, 20, 7.5, 4800, 128, '无'],
  ['i5-12600KF', 134590, 6, 4, 16, 4.9, 3.7, 125, 150, 20, 9.5, 4800, 128, '无'],
  ['i5-13400', 230495, 6, 4, 16, 4.6, 2.5, 65, 148, 20, 9.5, 4800, 192, 'Intel UHD 730'],
  ['i5-13400F', 230501, 6, 4, 16, 4.6, 2.5, 65, 148, 20, 9.5, 4800, 192, '无'],
  ['i5-13490F', 232140, 6, 4, 16, 4.8, 2.5, 65, 148, 24, 9.5, 4800, 192, '无'],
  ['i5-13600KF', 230494, 6, 8, 20, 5.1, 3.5, 125, 181, 24, 20, 5600, 192, '无'],
  ['i5-14400', 236788, 6, 4, 16, 4.7, 2.5, 65, 148, 20, 9.5, 4800, 192, 'Intel UHD 730'],
  ['i5-14400F', 236777, 6, 4, 16, 4.7, 2.5, 65, 148, 20, 9.5, 4800, 192, '无'],
  ['i5-14490F', 236792, 6, 4, 16, 4.9, 2.8, 65, 148, 24, 9.5, 4800, 192, '无'],
  ['i5-14600K', 236799, 6, 8, 20, 5.3, 3.5, 125, 181, 24, 20, 5600, 192, 'Intel UHD 770'],
  ['i5-14600KF', 236778, 6, 8, 20, 5.3, 3.5, 125, 181, 24, 20, 5600, 192, '无'],
  ['i7-12700', 134591, 8, 4, 20, 4.9, 2.1, 65, 180, 25, 12, 4800, 128, 'Intel UHD 770'],
  ['i7-12700F', 134592, 8, 4, 20, 4.9, 2.1, 65, 180, 25, 12, 4800, 128, '无'],
  ['i7-12700K', 134594, 8, 4, 20, 5, 3.6, 125, 190, 25, 12, 4800, 128, 'Intel UHD 770'],
  ['i7-12700KF', 134595, 8, 4, 20, 5, 3.6, 125, 190, 25, 12, 4800, 128, '无'],
  ['i7-13700F', 230491, 8, 8, 24, 5.2, 2.1, 65, 219, 30, 24, 5600, 192, '无'],
  ['i7-13700KF', 230489, 8, 8, 24, 5.4, 3.4, 125, 253, 30, 24, 5600, 192, '无'],
  ['i7-14700', 236781, 8, 12, 28, 5.4, 2.1, 65, 219, 33, 28, 5600, 192, 'Intel UHD 770'],
  ['i7-14700F', 236854, 8, 12, 28, 5.4, 2.1, 65, 219, 33, 28, 5600, 192, '无'],
  ['i7-14700K', 236783, 8, 12, 28, 5.6, 3.4, 125, 253, 33, 28, 5600, 192, 'Intel UHD 770'],
  ['i7-14700KF', 236789, 8, 12, 28, 5.6, 3.4, 125, 253, 33, 28, 5600, 192, '无'],
  ['i9-12900KF', 134600, 8, 8, 24, 5.2, 3.2, 125, 241, 30, 14, 4800, 128, '无'],
  ['i9-13900KF', 230497, 8, 16, 32, 5.8, 3, 125, 253, 36, 32, 5600, 192, '无'],
  ['i9-14900K', 236773, 8, 16, 32, 6, 3.2, 125, 253, 36, 32, 5600, 192, 'Intel UHD 770'],
  ['i9-14900KF', 236787, 8, 16, 32, 6, 3.2, 125, 253, 36, 32, 5600, 192, '无'],
]

export function intelCpuReference(part: PartOption): SpecificationReference | undefined {
  if (!/intel|英特尔/i.test(`${part.brand} ${part.name}`)) return
  const matches = [...part.name.matchAll(/\bi([3579])\s*[-‐‑–—]?\s*(\d{4,5})([a-z]*)(?![a-z0-9])/gi)]
  const models = new Set(matches.map(match => `i${match[1]}-${match[2]}${match[3]!.toUpperCase()}`))
  if (models.size !== 1) return // Multi-model listings cannot provide an unambiguous specification.
  const numbers = new Set([...part.name.matchAll(/\b((?:12|13|14)\d{3}[a-z]*)(?![a-z0-9])/gi)].map(match => match[1]!.toUpperCase()))
  if (numbers.size > 1) return
  const row = cpus.find(row => models.has(row[0]))
  if (!row) return
  const [model, sku, p, e, threads, turbo, base, power, maxPower, cache, l2, memoryRate, memorySize, graphics] = row
  const [tier, number] = model.toLowerCase().split('-') as [string, string]
  const slug = number.startsWith('14') ? `intel-core-${tier}-processor-${number}` : `intel-core-${tier}${number}-processor`
  return {
    values: {
      '核心线程': `${p + e} 核 / ${threads} 线程`, '性能核 / 能效核': `${p} P 核 / ${e} E 核`,
      '接口': 'LGA1700', '核显': graphics, '最高加速频率': `最高 ${turbo} GHz`, '基础频率': `${base} GHz（P 核）`,
      '处理器基础功耗': `${power} W`, '最大睿频功耗': `${maxPower} W`, '三级缓存': `${cache} MB`, '二级缓存': `${l2} MB`,
      '支持内存': `DDR5 ${memoryRate} MT/s / DDR4 3200 MT/s（取决于主板）`, '最大内存容量': `${memorySize} GB`,
      '内存通道': '2 通道', 'PCIe 支持': 'PCIe 5.0 / 4.0，共 20 条 CPU 通道',
    },
    source: `https://www.intel.com/content/www/us/en/products/sku/${sku}/${slug}-${cache}m-cache-up-to-${turbo.toFixed(2).replace('.', '-')}-ghz/specifications.html`,
    scope: 'Intel 官方具体型号规格，核验于 2026-10-29；最高睿频为标称上限，功耗不是整机功耗，内存支持需核对主板和 BIOS。',
  }
}
