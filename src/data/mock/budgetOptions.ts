// Synthetic reference prices for budget-selection testing, NOT collected JD offers.
// All CPU/board candidates use AM5/DDR5. Dimensions/BIOS remain unverified.
import type { PartOption } from '../../types/hardware'

function part(
  id: string,
  brand: string,
  name: string,
  price: number,
  specs: string,
  constraints: Partial<PartOption> = {},
): PartOption {
  return { id, brand, name, price, specs, tag: '预设参考', ...constraints }
}

export const budgetOptions: Record<string, PartOption[]> = {
  cpu: [
    part('cpu-entry', 'AMD', 'AMD Ryzen 5 8400F', 699, 'AM5 · 无核显'),
    part('cpu-c', 'AMD', 'AMD Ryzen 7 7800X3D', 2499, 'AM5 · 游戏用途参考', {
      minBoardTier: 1,
      minCoolingTier: 1,
    }),
    part('cpu-d', 'AMD', 'AMD Ryzen 9 7900X', 3499, 'AM5 · 多任务用途参考', {
      minBoardTier: 1,
      minCoolingTier: 2,
    }),
    part('cpu-e', 'AMD', 'AMD Ryzen 9 9950X', 4299, 'AM5 · 创作用途参考', {
      minBoardTier: 1,
      minCoolingTier: 2,
    }),
  ],
  gpu: [
    part('gpu-entry', '蓝宝石 SAPPHIRE', '蓝宝石 PULSE Radeon RX 6400 4GB', 699, '独立显卡 · 4GB', {
      minPsuWatts: 450,
    }),
    part('gpu-c', '微星 MSI', '微星 RTX 4070 Ti SUPER VENTUS 3X', 6999, '独立显卡 · 16GB', {
      minPsuWatts: 750,
    }),
    part('gpu-d', '华硕 ASUS', '华硕 TUF Gaming RTX 4080 SUPER', 8999, '独立显卡 · 16GB', {
      minPsuWatts: 850,
    }),
    part('gpu-e', '微星 MSI', '微星 GeForce RTX 5080 VENTUS 3X OC', 13999, '独立显卡 · 16GB', {
      minPsuWatts: 1000,
    }),
    part('gpu-f', '华硕 ASUS', '华硕 TUF Gaming RTX 4090 D', 18999, '独立显卡 · 24GB', {
      minPsuWatts: 1000,
    }),
  ],
  board: [
    part('board-entry', '华擎 ASRock', '华擎 A620M-HDV/M.2', 499, 'AM5 · DDR5 · M-ATX', {
      boardTier: 0,
    }),
    part('board-c', '微星 MSI', '微星 MAG B850M MORTAR WIFI', 1699, 'AM5 · DDR5 · M-ATX', {
      boardTier: 1,
    }),
    part('board-d', '华硕 ASUS', '华硕 ROG STRIX B650E-F GAMING WIFI', 2499, 'AM5 · DDR5 · ATX', {
      boardTier: 2,
    }),
  ],
  ram: [
    part('ram-entry', '金士顿 Kingston', '金士顿 FURY Beast DDR5 16GB 套装', 299, '8GB × 2 · DDR5'),
    part('ram-c', '芝奇 G.SKILL', '芝奇 Trident Z5 Neo DDR5 64GB', 1799, '32GB × 2 · DDR5'),
    part('ram-d', '海盗船 CORSAIR', '海盗船 VENGEANCE DDR5 96GB', 2599, '48GB × 2 · DDR5'),
  ],
  ssd: [
    part('ssd-entry', '西部数据 WD', '西部数据 WD Blue SN580 500GB', 249, '500GB · M.2 · PCIe 4.0'),
    part('ssd-c', '三星 Samsung', '三星 990 PRO 2TB', 1399, '2TB · M.2 · PCIe 4.0'),
    part('ssd-d', '三星 Samsung', '三星 990 PRO 4TB', 2499, '4TB · M.2 · PCIe 4.0'),
  ],
  power: [
    part('power-entry', '航嘉 Huntkey', '航嘉 WD500K', 249, '500W · 供电接口待核验', {
      psuWatts: 500,
    }),
    part('power-c', '海盗船 CORSAIR', '海盗船 RM1000e', 799, '1000W · 全模组', { psuWatts: 1000 }),
    part('power-d', '海盗船 CORSAIR', '海盗船 HX1200', 1099, '1200W · 全模组', { psuWatts: 1200 }),
  ],
  case: [
    part('case-entry', '先马 SAMA', '先马 平头哥 M2', 149, 'M-ATX · 配件尺寸待核验'),
    part('case-c', '联力 LIAN LI', '联力 LANCOOL 216', 749, 'ATX · 配件尺寸待核验'),
  ],
  cooler: [
    part(
      'cooler-entry',
      '利民 Thermalright',
      '利民 AX120 R SE',
      89,
      '塔式风冷 · 安装兼容性待核验',
      { coolingTier: 0 },
    ),
    part('cooler-c', '九州风神 DeepCool', '九州风神 AK620', 499, '双塔风冷 · 安装兼容性待核验', {
      coolingTier: 2,
    }),
    part('cooler-d', '九州风神 DeepCool', '九州风神 LS720', 699, '360 水冷 · 机箱安装空间待核验', {
      coolingTier: 2,
    }),
  ],
}
