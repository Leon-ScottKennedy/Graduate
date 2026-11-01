import type { PartOption } from '../types/hardware'
import { manufacturerSpecifications } from './manufacturerSpecifications'
import { intelCpuReference } from './intelCpuSpecifications'

// Manufacturer snapshots checked 2026-10-28. These enrich the inspector only;
// reference GPU properties must never become board-specific compatibility limits.
export interface SpecificationReference { values: Record<string, string>; source: string; scope: string; additionalSources?: string[] }
const amd7000 = 'https://gpuopen.com/gdc-presentations/2024/GDC2024_AMD_Ryzen_Processor_Software_Optimization.pdf'
const amd9000 = 'https://www.amd.com/en/partner/articles/ryzen-9000-series-processors.html'
const amd8000 = 'https://ir.amd.com/news-events/press-releases/detail/1177/amd-reveals-next-gen-desktop-processors-for-extreme-pc-gaming-and-creator-performance'
const nvidia = 'https://www.nvidia.com/en-gb/geforce/graphics-cards/compare/'
type Cpu = [string, number, number, number, number, string?]
const ryzen7000: Cpu[] = [
  ['7500F', 6, 12, 5, 65, '无'], ['7600', 6, 12, 5.1, 65], ['7600X', 6, 12, 5.3, 105],
  ['7700', 8, 16, 5.3, 65], ['7700X', 8, 16, 5.4, 105], ['7800X3D', 8, 16, 5, 120],
  ['7900', 12, 24, 5.4, 65], ['7900X', 12, 24, 5.6, 170], ['7900X3D', 12, 24, 5.6, 120],
  ['7950X', 16, 32, 5.7, 170], ['7950X3D', 16, 32, 5.7, 120],
]
const ryzen9000: Cpu[] = [
  ['9600X', 6, 12, 5.4, 65], ['9700X', 8, 16, 5.5, 65], ['9900X', 12, 24, 5.6, 120],
  ['9950X', 16, 32, 5.7, 170], ['9800X3D', 8, 16, 5.2, 120], ['9900X3D', 12, 24, 5.5, 120], ['9950X3D', 16, 32, 5.7, 170],
]
const ryzen8000: Cpu[] = [['8500G', 6, 12, 5, 65, '集成 Radeon 显卡'], ['8600G', 6, 12, 5, 65, 'Radeon 760M'], ['8700G', 8, 16, 5.1, 65, 'Radeon 780M']]
// Only chip-invariant properties are shared across partner cards. No reference clocks or dimensions.
const gpuChips: [string, number, number, string][] = [
  ['RTX 5090', 21760, 512, 'Blackwell'], ['RTX 5080', 10752, 256, 'Blackwell'],
  ['RTX 5070 Ti', 8960, 256, 'Blackwell'], ['RTX 5070', 6144, 192, 'Blackwell'],
  ['RTX 5060 Ti', 4608, 128, 'Blackwell'], ['RTX 5060', 3840, 128, 'Blackwell'],
  ['RTX 4090', 16384, 384, 'Ada Lovelace'], ['RTX 4080 SUPER', 10240, 256, 'Ada Lovelace'],
  ['RTX 4080', 9728, 256, 'Ada Lovelace'], ['RTX 4070 Ti SUPER', 8448, 256, 'Ada Lovelace'],
  ['RTX 4070 Ti', 7680, 192, 'Ada Lovelace'], ['RTX 4070 SUPER', 7168, 192, 'Ada Lovelace'],
  ['RTX 4070', 5888, 192, 'Ada Lovelace'], ['RTX 4060 Ti', 4352, 128, 'Ada Lovelace'], ['RTX 4060', 3072, 128, 'Ada Lovelace'],
]
function cpuReference(row: Cpu, source: string): SpecificationReference {
  const model = row[0]
  const detail = amdDetails[model]!
  const series = model[0]!
  const tier = row[1] >= 12 ? 9 : row[1] === 8 ? 7 : 5
  return { values: {
    核心线程: `${row[1]} 核 / ${row[2]} 线程`, 接口: 'AM5', 核显: model === '8500G' ? 'Radeon 740M' : row[5] ?? '集成 Radeon 显卡',
    最高加速频率: `最高 ${row[3]} GHz`, 默认TDP: `${row[4]} W`, 基础频率: `${detail[0]} GHz`,
    二级缓存: `${row[1]} MB`, 三级缓存: `${detail[1]} MB`,
    支持内存: `DDR5 ${series === '9' ? 5600 : 5200} MT/s（双条；四条最高 3600 MT/s）`,
    最大内存容量: `${detail[2]} GB`, 内存通道: '2 通道',
    'PCIe 支持': series === '8' ? `PCIe 4.0，共 ${model === '8500G' ? 14 : 20} 条 / 可用 ${model === '8500G' ? 10 : 16} 条` : 'PCIe 5.0，共 28 条 / 可用 24 条',
    '性能核 / 能效核': model === '8500G' ? '2 × Zen 4 / 4 × Zen 4c（非 Intel P/E 核）' : '不适用（无 Intel P/E 核划分）',
    处理器基础功耗: '不适用（AMD 使用默认 TDP）', 最大睿频功耗: '不适用（AMD 未提供同口径规格）',
  }, source: `https://www.amd.com/en/products/processors/desktops/ryzen/${series}000-series/amd-ryzen-${tier}-${model.toLowerCase()}.html`, additionalSources: [source], scope: 'AMD 具体型号官方规格，核验于 2026-10-29；内存容量与速度需结合主板、BIOS 和 DIMM 配置，默认 TDP 不等于 Intel 基础功耗。' }
}
// Base GHz, L3 MB, maximum memory GB; AMD product-page snapshots, 2026-10-29.
const amdDetails: Record<string, readonly [number, number, number]> = {
  '7500F': [3.7, 32, 128], '7600': [3.8, 32, 128], '7600X': [4.7, 32, 128],
  '7700': [3.8, 32, 128], '7700X': [4.5, 32, 128], '7800X3D': [4.2, 96, 128],
  '7900': [3.7, 64, 128], '7900X': [4.7, 64, 128], '7900X3D': [4.4, 128, 128],
  '7950X': [4.5, 64, 128], '7950X3D': [4.2, 128, 128],
  '9600X': [3.9, 32, 256], '9700X': [3.8, 32, 256], '9900X': [4.4, 64, 256],
  '9950X': [4.3, 64, 256], '9800X3D': [4.7, 96, 256], '9900X3D': [4.4, 128, 256], '9950X3D': [4.3, 128, 256],
  '8500G': [3.5, 16, 96], '8600G': [4.3, 16, 256], '8700G': [4.2, 16, 256], '8400F': [4.2, 16, 256],
}
const exact: [string, RegExp, Record<string, string>, string][] = [
  ['psu', /(?:^|\s)RM1000e$/i, { 额定功率: '1000 W', 能效认证: '金牌（认证体系随版本变化）', 模组类型: '全模组' }, 'https://assets.corsair.com/image/upload/corsairmedia/sys_master/productcontent/49_002627_AA_WW_RMe_Series_Web_QSG_F.pdf'],
  ['case', /(?:^|\s)MATREXX 30$/i, { 支持主板: 'Micro-ATX / Mini-ITX', 显卡限长: '250 mm', 散热器限高: '151 mm', 外形尺寸: '405.8 × 193 × 378.2 mm', 电源限长: '170 mm' }, 'https://www.deepcool.com/products/Cases/fulltowercases/2021/11958.shtml'],
  ['case', /(?:^|\s)AIR 100 LITE$/i, { 支持主板: 'Micro-ATX / Mini-ITX', 显卡限长: '330 mm', 散热器限高: '161 mm', 外形尺寸: '405 × 210 × 425 mm', 电源限长: '160 mm' }, 'https://www.montechpc.com/air-100-lite'],
  ['case', /(?:^|\s)AIR 903 BASE$/i, { 支持主板: 'E-ATX / ATX / Micro-ATX / Mini-ITX', 显卡限长: '400 mm', 散热器限高: '180 mm', 外形尺寸: '478 × 230 × 493 mm', 电源限长: '240 mm' }, 'https://www.montechpc.com/air-903-base'],
  ['case', /(?:^|\s)LANCOOL 207$/i, { 支持主板: 'ATX（宽度 ≤244 mm）/ Micro-ATX / Mini-ITX', 显卡限长: '375 mm', 散热器限高: '180 mm', 外形尺寸: '455.6 × 219 × 456 mm', 电源限长: '160 mm' }, 'https://lian-li.com/fr/product/lancool-207/'],
  ['cooler', /(?:^|\s)Peerless Assassin 120 SE$/i, { 散热方式: '双塔风冷', 支持接口: 'AM4 / AM5 / LGA115x / LGA1200 / LGA1700 / LGA1851', 散热器高度: '155 mm', 热管: '6 × 6 mm', 风扇规格: '120 mm', 风扇转速: '最高 1550 RPM ±10%', 风扇噪声: '25.6 dB(A)' }, 'https://www.thermalright.com/product/peerless-assassin-120-se/'],
  ['board', /(?:^|\s)B650M D3HP$/i, { 芯片组: 'AMD B650', 内存插槽: '4 × DDR5 DIMM', 有线网络: '2.5 GbE', 视频接口: '2 × DP / HDMI' }, 'https://www.gigabyte.com/Motherboard/B650M-D3HP-rev-1x'],
  ['case', /(?:^|\s)CH370$/i, { 支持主板: 'Micro-ATX / Mini-ITX', 显卡限长: '320 mm', 散热器限高: '165 mm', 外形尺寸: '413 × 215 × 431 mm', 前置接口: '2 × USB 3.0 / 音频', 电源限长: '160 mm' }, 'https://www.deepcool.com/products/Cases/fulltowercases/CH370-Micro-ATX-Case/2022/15949.shtml'],
  ['case', /(?:^|\s)CH560$/i, { 支持主板: 'E-ATX / ATX / Micro-ATX / Mini-ITX', 显卡限长: '380 mm', 散热器限高: '175 mm', 外形尺寸: '458 × 230 × 471 mm', 前置接口: 'USB 3.0 / USB-C / 音频', 电源限长: '170 mm' }, 'https://global.deepcool.com/products/Cases/CH560-New-Generation-of-Airflow-Case/2023/17101.shtml'],
  ['case', /(?:^|\s)LANCOOL 216$/i, { 支持主板: 'E-ATX（宽度 < 280 mm）/ ATX / Micro-ATX / Mini-ITX', 显卡限长: '392 mm', 散热器限高: '180.5 mm', 外形尺寸: '480.9 × 235 × 491.7 mm', 电源限长: '220 mm' }, 'https://lian-li.com/fr/product/lancool-216/'],
  ['cooler', /(?:^|\s)AK400$/i, { 散热方式: '单塔风冷', 支持接口: 'AM5 / AM4 / LGA1700 / LGA1200 / LGA115x', 散热器高度: '155 mm', 热管: '4 × 6 mm', 风扇规格: '120 mm', 风扇转速: '500–1850 RPM ±10%', 风扇噪声: '≤29 dB(A)' }, 'https://www.deepcool.com/products/Cooling/cpuaircoolers/AK400-Performance-CPU-Cooler/2021/15222.shtml'],
  ['cooler', /(?:^|\s)AK620$/i, { 散热方式: '双塔风冷', 支持接口: 'AM5 / AM4 / LGA1700 / LGA1200 / LGA115x / LGA20xx', 散热器高度: '160 mm', 热管: '6 × 6 mm', 风扇规格: '2 × 120 mm', 风扇转速: '500–1850 RPM ±10%', 风扇噪声: '≤28 dB(A)' }, 'https://www.deepcool.com/products/Cooling/cpuaircoolers/AK620-High-Performance-CPU-Cooler-1700-AM5/2021/13067.shtml'],
  ['cooler', /(?:^|\s)LS720$/i, { 散热方式: '一体式水冷', 冷排规格: '360 mm', 冷排尺寸: '402 × 120 × 27 mm', 风扇规格: '3 × 120 mm', 风扇转速: '500–2250 RPM ±10%', 水泵转速: '3100 RPM ±10%', 风扇噪声: '≤32.9 dB(A)' }, 'https://global.deepcool.com/products/Cooling/cpuliquidcoolers/LS720-High-Performance-360mm-Liquid-CPU-Cooler/2022/15826.shtml'],
]

function baseReference(part: PartOption, category: string): SpecificationReference | undefined {
  category = ({ power: 'psu', fan: 'cooler' } as Record<string, string>)[category] ?? category
  const name = part.name.replace(/\s+/g, ' ').trim()
  if (category === 'cpu') {
    const intel = intelCpuReference(part)
    if (intel) return intel
    const model = name.match(/\bRyzen\s+[3579]\s+(\d{4}[A-Z0-9]*)\b/i)?.[1]?.toUpperCase()
    for (const [rows, source] of [[ryzen7000, amd7000], [ryzen9000, amd9000], [ryzen8000, amd8000]] as const) {
      const row = rows.find(row => row[0] === model)
      if (row) return cpuReference(row, source)
    }
    if (model === '8400F') return cpuReference(['8400F', 6, 12, 4.7, 65, '无'], 'https://www.amd.com/en/products/processors/desktops/ryzen/8000-series/amd-ryzen-5-8400f.html')
  }
  if (category === 'gpu') {
    const family = `${name} ${part.specs}`.match(/RTX\s*\d{4}(?:\s*Ti)?(?:\s*SUPER)?(?:\s*D\b)?/i)?.[0]?.toUpperCase().replace(/RTX\s*/, 'RTX ').replace(/\s+/g, ' ')
    const row = gpuChips.find(row => row[0].toUpperCase() === family)
    if (row) return { values: { GPU架构: row[3], CUDA核心: String(row[1]), 显存位宽: `${row[2]} bit` }, source: nvidia, scope: 'GPU 芯片通用规格；频率、供电和尺寸以具体品牌版本为准' }
  }
  if (category === 'ssd') {
    const capacity = `${part.name} ${part.specs}`.match(/\b(\d+(?:\.\d+)?)\s*(TB|GB)\b/i)
    const gb = capacity ? Number(capacity[1]) * (capacity[2]!.toUpperCase() === 'TB' ? 1024 : 1) : 0
    if (/\bKC3000\b/i.test(name) && [512, 1024, 2048, 4096].includes(gb)) return {
      values: { 接口协议: 'NVMe', 'PCIe 版本': 'PCIe 4.0 ×4', 外形规格: 'M.2 2280', 主控: 'Phison E18', 闪存类型: '3D TLC', 独立缓存: '有 DRAM', 读取速度: '最高 7000 MB/s', 写入速度: `最高 ${gb === 512 ? 3900 : gb === 1024 ? 6000 : 7000} MB/s`, 耐久度: `${gb / 512 * 400} TBW` },
      source: 'https://www.kingston.com/datasheets/KC3000_en.pdf', scope: '对应容量官方规格；速度为厂商标称上限',
    }
    if (/\bNM790\b/i.test(name) && [512, 1024, 2048, 4096, 8192].includes(gb)) return {
      values: { 接口协议: 'NVMe', 'PCIe 版本': 'PCIe 4.0 ×4', 外形规格: 'M.2 2280', 读取速度: `最高 ${gb === 512 ? 7200 : gb === 8192 ? 7000 : 7400} MB/s`, 写入速度: `最高 ${gb === 512 ? 4400 : gb === 8192 ? 6200 : 6500} MB/s`, 缓存方案: 'HMB 3.0 / 动态 SLC 缓存' },
      source: 'https://resources.lexar.com/download/1048/documents/13165/lexar-productsheet-ssd-nm790-en-202410.pdf', scope: '对应容量官方规格；速度为厂商标称上限',
    }
    if (/\b990 PRO\b/i.test(name) && [1024, 2048, 4096].includes(gb)) return {
      values: { 接口协议: 'NVMe 2.0', 'PCIe 版本': 'PCIe 4.0 ×4', 外形规格: 'M.2 2280', 闪存类型: 'Samsung V-NAND TLC', 独立缓存: `${gb / 1024} GB LPDDR4`, 读取速度: '最高 7450 MB/s', 写入速度: '最高 6900 MB/s' },
      source: 'https://semiconductor.samsung.com/news-events/news/samsung-electronics-unveils-high-performance-990-pro-ssd-optimized-for-gaming-and-creative-applications/', scope: '对应容量官方规格；速度为厂商标称上限',
    }
  }
  const record = exact.find(([type, pattern]) => type === category && pattern.test(name))
  return record ? { values: record[2], source: record[3], scope: '具体型号官方规格，安装尺寸请同时核对机箱布局' } : undefined
}

export function specificationReference(part: PartOption, category: string): SpecificationReference | undefined {
  category = ({ power: 'psu', fan: 'cooler' } as Record<string, string>)[category] ?? category
  const base = baseReference(part, category)
  const normalize = (value: string) => value.replace(/GeForce/ig, '').replace(/[^a-z0-9]/ig, '').toUpperCase()
  const normalizeBrand = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()
  const name = normalize(part.name)
  const specific = manufacturerSpecifications.find(record => record.category === category
    && normalizeBrand(part.brand).includes(normalizeBrand(record.brand))
    && (!record.partNumber || `${part.name} ${part.specSource ?? ''}`.toUpperCase().includes(record.partNumber.toUpperCase()))
    && record.keys.some(key => name.endsWith(key)))
  if (!specific) return base
  return {
    values: { ...base?.values, ...specific.values }, source: specific.source,
    additionalSources: base && base.source !== specific.source ? [base.source] : [],
    scope: '具体型号厂商规格；速度为标称上限，接口和安装空间请核对实际版本。',
  }
}
