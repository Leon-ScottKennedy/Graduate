import type { PartOption } from '../types/hardware'

export interface CompatibilityIssue {
  code: string
  message: string
}
export interface CompatibilityResult {
  errors: CompatibilityIssue[]
  warnings: CompatibilityIssue[]
  pending: CompatibilityIssue[]
}
type Build = Record<string, PartOption>
const specs = (part?: PartOption) => `${part?.name ?? ''} ${part?.specs ?? ''}`.toUpperCase()
const socket = (part?: PartOption) =>
  part?.compatibility?.socket ??
  specs(part)
    .match(/\b(AM[45]|LGA\s*\d{4})\b/)?.[1]
    ?.replace(/\s/g, '')
const memory = (part?: PartOption) =>
  part?.compatibility?.memoryType ?? specs(part).match(/DDR[345]/)?.[0]
const boardForm = (part?: PartOption) =>
  part?.compatibility?.boardForm ?? specs(part).match(/M-ATX|E-ATX|MINI-ITX|\bATX\b/)?.[0]

export function checkBuildCompatibility(build: Build): CompatibilityResult {
  const { cpu, board, ram, gpu, power, cooler, case: chassis } = build
  const result: CompatibilityResult = { errors: [], warnings: [], pending: [] }
  const error = (code: string, message: string) => result.errors.push({ code, message })
  const pending = (code: string, message: string) => result.pending.push({ code, message })
  const warn = (code: string, message: string) => result.warnings.push({ code, message })
  if (!cpu || !board || !ram || !gpu || !power || !cooler || !chassis) {
    pending('incomplete', '配置不完整，暂无法检查全部配件')
    return result
  }
  const cpuSocket = socket(cpu)
  const boardSocket = socket(board)
  if (cpuSocket && boardSocket && cpuSocket !== boardSocket)
    error('socket', `CPU ${cpuSocket} 与主板 ${boardSocket} 接口不匹配`)
  else if (!cpuSocket || !boardSocket) pending('socket', 'CPU/主板接口资料待补齐')
  const boardMemory = memory(board)
  const ramMemory = memory(ram)
  if (boardMemory && ramMemory && boardMemory !== ramMemory)
    error('memory', `主板需要 ${boardMemory}，当前内存为 ${ramMemory}`)
  else if (!boardMemory || !ramMemory) pending('memory', '主板/内存代际待核验')

  const recommendedWatts =
    gpu.minPsuWatts ?? ({ 'gpu-a': 550, 'gpu-b': 650 } as Record<string, number>)[gpu.id]
  if (recommendedWatts && power.psuWatts) {
    if (power.psuWatts < recommendedWatts)
      warn(
        'power',
        `厂商建议 ${recommendedWatts}W 电源，当前 ${power.psuWatts}W，需核验整机功耗与供电余量`,
      )
  } else pending('power', '显卡电源建议功率或电源额定功率待补齐')
  const boardTier =
    board.boardTier ?? ({ 'board-a': 1, 'board-b': 1 } as Record<string, number>)[board.id]
  const coolingTier = cooler.coolingTier ?? (cooler.id === 'cooler-a' ? 0 : undefined)
  if (cpu.minBoardTier !== undefined) {
    if (boardTier === undefined) pending('board-tier', '主板供电档位资料待补齐')
    else if (boardTier < cpu.minBoardTier)
      warn('board-tier', '当前主板低于预设供电档位，需核验供电与负载')
  }
  if (cpu.minCoolingTier !== undefined) {
    if (coolingTier === undefined) pending('cooling-tier', '散热器预设档位资料待补齐')
    else if (coolingTier < cpu.minCoolingTier)
      warn('cooling-tier', '当前散热器低于预设散热档位，需核验温度与噪声表现')
  }

  const form = boardForm(board)
  const supportedForms =
    chassis.compatibility?.supportedBoardForms ??
    (specs(chassis).includes('M-ATX')
      ? ['M-ATX', 'MINI-ITX']
      : /\bATX\b/.test(specs(chassis))
        ? ['ATX', 'M-ATX', 'MINI-ITX']
        : undefined)
  if (form && supportedForms && !supportedForms.includes(form))
    error('board-case', `机箱不支持 ${form} 主板`)
  else if (!form || !supportedForms) pending('board-case', '机箱支持的主板规格待核验')
  const mounts =
    cooler.compatibility?.coolerSockets ?? (specs(cooler).includes('AM5') ? ['AM5'] : undefined)
  if (cpuSocket && mounts && !mounts.includes(cpuSocket))
    error('cooler-socket', `散热器未提供 ${cpuSocket} 安装支持`)
  else if (!cpuSocket || !mounts) pending('cooler-socket', '散热器扣具及 CPU 接口待核验')

  const liquid = /水冷/.test(specs(cooler))
  const radiator =
    cooler.compatibility?.radiatorMm ??
    (liquid
      ? Number(specs(cooler).match(/(120|240|280|360|420)\s*(?:MM)?\s*(?:水冷|冷排)/)?.[1]) ||
        undefined
      : undefined)
  // Verified chassis facts only; M-ATX alone does not imply that 360mm is unsupported.
  const radiators =
    chassis.compatibility?.supportedRadiatorsMm ??
    (chassis.id === 'case-a'
      ? [120, 140, 240, 280, 360]
      : chassis.id === 'candidate-case-entry'
        ? [120]
        : undefined)
  if (radiator) {
    if (radiators && !radiators.includes(radiator))
      error('radiator', `机箱不支持 ${radiator}mm 冷排`)
    else pending('radiator-space', '冷排安装位置、厚度及与显卡的空间冲突待核验')
  }
  if (liquid && !radiator) pending('radiator-size', '水冷冷排尺寸待核验')
  const gpuLength = gpu.compatibility?.gpuLengthMm
  const gpuLimit = chassis.compatibility?.maxGpuLengthMm
  if (gpuLength && gpuLimit) {
    if (gpuLength > gpuLimit)
      error('gpu-length', `显卡长 ${gpuLength}mm，超过机箱限长 ${gpuLimit}mm`)
  } else pending('gpu-length', '显卡长度与机箱实际限长待核验')
  if (!liquid && !radiator) {
    const height = cooler.compatibility?.coolerHeightMm
    const limit = chassis.compatibility?.maxCoolerHeightMm
    if (height && limit) {
      if (height > limit) error('cooler-height', `散热器高 ${height}mm，超过机箱限高 ${limit}mm`)
    } else pending('cooler-height', '风冷高度与机箱限高待核验')
  }
  pending('bios', '主板 BIOS 版本及 CPU 支持列表待核验')
  pending('connectors', '显卡供电接头、线材及内存兼容列表待核验')
  return result
}

export function checkReplacement(
  build: Build,
  category: string,
  option: PartOption,
): CompatibilityResult {
  return checkBuildCompatibility({ ...build, [category]: option })
}
