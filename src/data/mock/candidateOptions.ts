import type { PartOption } from '../../types/hardware'

// Candidate-only reference fixtures. These prices are NOT current merchant quotes.
// Kept separate from automatic budget selection so adding alternatives cannot change a build.
export const candidateOptions: Record<string, PartOption[]> = {
  gpu: [
    {
      id: 'candidate-gpu-asus-4070s',
      brand: '华硕 ASUS',
      name: '华硕 Dual RTX 4070 SUPER O12G',
      price: 4799,
      specs: 'RTX 4070 SUPER · 12GB GDDR6X',
      tag: '预设参考价',
      minPsuWatts: 750,
    },
    {
      id: 'candidate-gpu-gigabyte-4070s',
      brand: '技嘉 GIGABYTE',
      name: '技嘉 RTX 4070 SUPER WINDFORCE OC 12G',
      price: 4699,
      specs: 'RTX 4070 SUPER · 12GB GDDR6X',
      tag: '预设参考价',
      minPsuWatts: 700,
    },
    {
      id: 'candidate-gpu-msi-4060',
      brand: '微星 MSI',
      name: '微星 RTX 4060 VENTUS 2X BLACK 8G OC',
      price: 2299,
      specs: 'RTX 4060 · 8GB GDDR6',
      tag: '预设参考价',
      minPsuWatts: 550,
    },
  ],
  cpu: [
    {
      id: 'candidate-cpu-7600',
      brand: 'AMD',
      name: 'AMD Ryzen 5 7600',
      price: 1099,
      specs: '6 核 12 线程 · AM5 · 集成显卡',
      tag: '预设参考价',
    },
    {
      id: 'candidate-cpu-7700x',
      brand: 'AMD',
      name: 'AMD Ryzen 7 7700X',
      price: 1899,
      specs: '8 核 16 线程 · AM5 · 集成显卡',
      tag: '预设参考价',
      minCoolingTier: 1,
    },
  ],
}

function add(
  category: string,
  id: string,
  brand: string,
  name: string,
  price: number,
  specs: string,
  constraints: Partial<PartOption> = {},
) {
  ;(candidateOptions[category] ??= []).push({
    id: `candidate-${category}-${id}`,
    brand,
    name,
    price,
    specs,
    tag: '预设参考价',
    ...constraints,
  })
}

add('cpu', '8600g', 'AMD', 'AMD Ryzen 5 8600G', 799, '6 核 12 线程 · AM5 · Radeon 760M')
add('cpu', '9800x3d', 'AMD', 'AMD Ryzen 7 9800X3D', 2899, '8 核 16 线程 · AM5 · 3D V-Cache', {
  minBoardTier: 1,
  minCoolingTier: 1,
})
add('cpu', '7900', 'AMD', 'AMD Ryzen 9 7900', 3099, '12 核 24 线程 · AM5 · 集成显卡', {
  minBoardTier: 1,
  minCoolingTier: 1,
})
add('cpu', '7950x', 'AMD', 'AMD Ryzen 9 7950X', 3899, '16 核 32 线程 · AM5 · 集成显卡', {
  minBoardTier: 1,
  minCoolingTier: 2,
})
add(
  'gpu',
  'rx6400',
  '华擎 ASRock',
  '华擎 Radeon RX 6400 Challenger ITX 4GB',
  749,
  'RX 6400 · 4GB GDDR6',
  { minPsuWatts: 450 },
)
add(
  'gpu',
  '4070tis',
  '华硕 ASUS',
  '华硕 Dual RTX 4070 Ti SUPER O16G',
  7299,
  'RTX 4070 Ti SUPER · 16GB GDDR6X',
  { minPsuWatts: 750 },
)
add(
  'gpu',
  '4080s',
  '微星 MSI',
  '微星 RTX 4080 SUPER VENTUS 3X OC',
  9299,
  'RTX 4080 SUPER · 16GB GDDR6X',
  { minPsuWatts: 850 },
)
add('gpu', '5080', '微星 MSI', '微星 RTX 5080 GAMING TRIO OC', 14499, 'RTX 5080 · 16GB GDDR7', {
  minPsuWatts: 1000,
})
add(
  'gpu',
  '4090d',
  '技嘉 GIGABYTE',
  '技嘉 RTX 4090 D WINDFORCE 24G',
  19999,
  'RTX 4090 D · 24GB GDDR6X',
  { minPsuWatts: 1000 },
)
add('board', 'a620', '华硕 ASUS', '华硕 PRIME A620M-K', 549, 'AM5 · DDR5 · M-ATX', { boardTier: 0 })
add('board', 'b650', '华擎 ASRock', '华擎 B650M Pro RS', 849, 'AM5 · DDR5 · M-ATX', {
  boardTier: 1,
})
add(
  'board',
  'b650-wifi',
  '技嘉 GIGABYTE',
  '技嘉 B650M AORUS ELITE AX',
  1199,
  'AM5 · DDR5 · M-ATX · Wi-Fi',
  { boardTier: 1 },
)
add(
  'board',
  'b850',
  '华擎 ASRock',
  '华擎 B850M Steel Legend WiFi',
  1799,
  'AM5 · DDR5 · M-ATX · Wi-Fi',
  { boardTier: 1 },
)
add(
  'board',
  'b650e',
  '华擎 ASRock',
  '华擎 B650E PG Riptide WiFi',
  2299,
  'AM5 · DDR5 · ATX · Wi-Fi',
  { boardTier: 2 },
)
add('ram', '16', '英睿达 Crucial', '英睿达 DDR5 4800 16GB 套装', 329, '8GB × 2 · DDR5 · 4800MT/s')
add(
  'ram',
  '32',
  '海盗船 CORSAIR',
  '海盗船 VENGEANCE DDR5 6000 32GB',
  649,
  '16GB × 2 · DDR5 · 6000MT/s',
)
add(
  'ram',
  '64',
  '海盗船 CORSAIR',
  '海盗船 VENGEANCE DDR5 6000 64GB',
  1199,
  '32GB × 2 · DDR5 · 6000MT/s',
)
add(
  'ram',
  '64-premium',
  '金士顿 Kingston',
  '金士顿 FURY Renegade DDR5 6000 64GB',
  1899,
  '32GB × 2 · DDR5 · 6000MT/s',
)
add(
  'ram',
  '96',
  '金士顿 Kingston',
  '金士顿 FURY Beast DDR5 6000 96GB',
  2799,
  '48GB × 2 · DDR5 · 6000MT/s',
)
add(
  'ssd',
  '500',
  '西部数据 WD',
  '西部数据 WD_BLACK SN770 500GB',
  279,
  '500GB · M.2 2280 · PCIe 4.0 · TLC · 无独立 DRAM',
)
add(
  'ssd',
  '1000',
  '西部数据 WD',
  '西部数据 WD Blue SN580 1TB',
  429,
  '1TB · M.2 2280 · PCIe 4.0 · TLC · 无独立 DRAM',
)
add(
  'ssd',
  '2000',
  '金士顿 Kingston',
  '金士顿 KC3000 2TB',
  749,
  '2TB · M.2 2280 · PCIe 4.0 · TLC · 独立 DRAM',
)
add(
  'ssd',
  '2000-high',
  '西部数据 WD',
  '西部数据 WD_BLACK SN850X 2TB',
  1499,
  '2TB · M.2 2280 · PCIe 4.0 · TLC · 独立 DRAM',
)
add(
  'ssd',
  '4000',
  '西部数据 WD',
  '西部数据 WD_BLACK SN850X 4TB',
  2699,
  '4TB · M.2 2280 · PCIe 4.0 · TLC · 独立 DRAM',
)
add('power', '500', '九州风神 DeepCool', '九州风神 PK500D', 269, '500W · 铜牌 · 供电接口待核验', {
  psuWatts: 500,
})
add('power', '650', '微星 MSI', '微星 MAG A650GL', 429, '650W · 金牌 · 全模组', { psuWatts: 650 })
add('power', '750', '微星 MSI', '微星 MAG A750GL PCIE5', 549, '750W · 金牌 · 全模组', {
  psuWatts: 750,
})
add('power', '1000', '微星 MSI', '微星 MAG A1000GL PCIE5', 849, '1000W · 金牌 · 全模组', {
  psuWatts: 1000,
})
add('power', '1200', '海盗船 CORSAIR', '海盗船 HX1200i', 1199, '1200W · 铂金 · 全模组', {
  psuWatts: 1200,
})
add('case', 'entry', '九州风神 DeepCool', '九州风神 MATREXX 30', 169, 'M-ATX · 配件尺寸待核验')
add('case', 'matx', '君主 MONTECH', '君主 AIR 100 LITE', 219, 'M-ATX · 网孔风道 · 配件尺寸待核验')
add('case', 'atx', '君主 MONTECH', '君主 AIR 903 BASE', 379, 'ATX · 网孔风道 · 配件尺寸待核验')
add('case', 'airflow', '联力 LIAN LI', '联力 LANCOOL 207', 699, 'ATX · 网孔风道 · 配件尺寸待核验')
add(
  'cooler',
  'entry',
  '九州风神 DeepCool',
  '九州风神 AG400',
  99,
  '120mm 单塔风冷 · AM5 · 安装尺寸待核验',
  { coolingTier: 0 },
)
add(
  'cooler',
  'single',
  '利民 Thermalright',
  '利民 Assassin Spirit 120 EVO',
  189,
  '120mm 单塔风冷 · AM5 · 安装尺寸待核验',
  { coolingTier: 0 },
)
add(
  'cooler',
  'dual',
  '利民 Thermalright',
  '利民 Phantom Spirit 120 SE',
  279,
  '120mm 双塔风冷 · AM5 · 安装尺寸待核验',
  { coolingTier: 1 },
)
add(
  'cooler',
  'dual-high',
  '利民 Thermalright',
  '利民 Phantom Spirit 120 EVO',
  429,
  '120mm 双塔风冷 · AM5 · 安装尺寸待核验',
  { coolingTier: 2 },
)
add(
  'cooler',
  '360',
  '九州风神 DeepCool',
  '九州风神 LT720',
  749,
  '360 水冷 · AM5 · 机箱安装空间待核验',
  { coolingTier: 2 },
)
