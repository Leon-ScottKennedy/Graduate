import { manufacturerSpecificationUpdates } from './manufacturerSpecificationUpdates'

// Exact model snapshots from manufacturer specification pages/PDFs.
export interface ManufacturerSpecification {
  category: string
  brand: string
  keys: string[]
  values: Record<string, string>
  source: string
  partNumber?: string
  checkedAt?: string
}
export const manufacturerSpecifications: ManufacturerSpecification[] = [
  {
    category: 'board', brand: 'ASUS', keys: ['PRIMEB760MAWIFI'], checkedAt: '2026-10-29',
    values: { '接口': 'LGA1700', '芯片组': 'Intel B760', '板型': 'M-ATX', '内存类型': 'DDR5', '内存插槽': '4 × DIMM，最高 192 GB（以 BIOS/QVL 为准）', '扩展接口': 'PCIe 4.0 ×16 / ×4 / ×1', '存储接口': '2 × M.2 / 4 × SATA 6G', '有线网络': '2.5 GbE', '无线网络': 'Wi-Fi 6 / Bluetooth 5.2' },
    source: 'https://www.asus.com/motherboards-components/motherboards/prime/prime-b760m-a-wifi/techspec/',
  },
  {
    category: 'board', brand: 'ASUS', keys: ['PRIMEZ790PWIFI'], checkedAt: '2026-10-29',
    values: { '接口': 'LGA1700', '芯片组': 'Intel Z790', '板型': 'ATX', '内存类型': 'DDR5', '内存插槽': '4 × DIMM，最高 192 GB（以 BIOS/QVL 为准）', '扩展接口': 'PCIe 5.0 ×16 / 3 × PCIe 4.0 ×4 / PCIe 3.0 ×1', '存储接口': '3 × M.2 / 4 × SATA 6G', '有线网络': '2.5 GbE', '无线网络': 'Wi-Fi 6 / Bluetooth 5.2' },
    source: 'https://www.asus.com/motherboards-components/motherboards/prime/prime-z790-p-wifi/techspec/',
  },
  {
    category: 'board', brand: 'MSI', keys: ['PROB760MAWIFI'], checkedAt: '2026-10-29',
    values: { '接口': 'LGA1700', '芯片组': 'Intel B760', '板型': 'M-ATX', '内存类型': 'DDR5', '内存插槽': '4 × DIMM，最高 256 GB', '扩展接口': 'PCIe 4.0 ×16 / PCIe 4.0 ×4 / PCIe 3.0 ×1', '存储接口': '2 × M.2 / 4 × SATA 6G', '有线网络': '2.5 GbE', '无线网络': 'Wi-Fi 6E / Bluetooth 5.3', '外形尺寸': '243.84 × 243.84 mm' },
    source: 'https://www.msi.com/Motherboard/PRO-B760M-A-WIFI/Specification',
  },
  {
    category: 'board', brand: 'MSI', keys: ['PROZ790AWIFI'], checkedAt: '2026-10-29',
    values: { '接口': 'LGA1700', '芯片组': 'Intel Z790', '板型': 'ATX', '内存类型': 'DDR5', '内存插槽': '4 × DIMM，最高 256 GB', '扩展接口': 'PCIe 5.0 ×16 / PCIe 4.0 ×4 / 2 × PCIe 3.0 ×1', '存储接口': '4 × M.2 / 6 × SATA 6G', '有线网络': '2.5 GbE', '无线网络': 'Wi-Fi 6E / Bluetooth 5.3', '外形尺寸': '304.8 × 243.84 mm' },
    source: 'https://www.msi.com/Motherboard/PRO-Z790-A-WIFI/Specification',
  },
  ...manufacturerSpecificationUpdates,
  {
    category: 'gpu', brand: 'Sapphire', keys: ['PULSERADEONRX64004GB'], checkedAt: '2026-10-29',
    values: { '显卡长度': '170 mm', '外形尺寸': '170 × 56.2 × 17.2 mm', '显存类型': 'GDDR6', '显存位宽': '64 bit', '显卡功耗': '55 W', '建议电源': '350 W', '显示接口': 'HDMI / DisplayPort 1.4' },
    source: 'https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-6400-4g-gddr6',
  },
  {
    category: 'gpu', brand: 'MSI', keys: ['RTX4070TISUPERVENTUS3X'], checkedAt: '2026-10-29',
    values: { '显卡长度': '308 mm', '外形尺寸': '308 × 120 × 50 mm', '显存类型': 'GDDR6X', '显卡功耗': '285 W', '建议电源': '700 W', '供电接口': '1 × 16-pin', '核心频率': 'Boost 2610 MHz / MSI Center 2625 MHz' },
    source: 'https://sg.msi.com/Graphics-Card/GeForce-RTX-4070-Ti-SUPER-16G-VENTUS-3X/Specification',
  },
  {
    category: 'gpu', brand: 'ASUS', keys: ['TUFGAMINGRTX4080SUPER'], checkedAt: '2026-10-29',
    values: { '显卡长度': '348.2 mm', '外形尺寸': '348.2 × 150 × 72.6 mm', '显存类型': 'GDDR6X', '建议电源': '850 W', '占用槽位': '3.65 槽', '供电接口': '1 × 16-pin' },
    source: 'https://www.asus.com/ie/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx4080s-16g-gaming/techspec/',
  },
  {
    category: 'gpu', brand: 'ASUS', keys: ['TUFGAMINGRTX4090D'], checkedAt: '2026-10-29',
    values: { '显卡长度': '348.2 mm', '外形尺寸': '348.2 × 150 × 72.6 mm', '显存类型': 'GDDR6X', '建议电源': '850 W', '占用槽位': '3.65 槽', '供电接口': '1 × 16-pin' },
    source: 'https://www.asus.com/hk-en/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx4090d-24g-gaming/techspec/',
  },
  {
    category: 'gpu', brand: 'GIGABYTE', keys: ['RTX4070SUPERWINDFORCEOC12G'], checkedAt: '2026-10-29',
    values: { '显卡长度': '261 mm', '外形尺寸': '261 × 126 × 50 mm（Rev. 1.0）', '显存类型': 'GDDR6X', '建议电源': '700 W' },
    source: 'https://www.gigabyte.com/vn/Graphics-Card/GV-N407SWF3OC-12GD-rev-10/sp',
  },
  {
    category: 'gpu', brand: 'ASRock', keys: ['RADEONRX6400CHALLENGERITX4GB'], checkedAt: '2026-10-29',
    values: { '显卡长度': '162 mm', '外形尺寸': '162 × 112 × 39 mm', '显存类型': 'GDDR6', '建议电源': '350 W', '占用槽位': '2 槽' },
    source: 'https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%206400%20Challenger%20ITX%204GB/',
  },
  {
    category: 'gpu', brand: 'GIGABYTE', keys: ['RTX5070TIWINDFORCEOCSFF16G'], checkedAt: '2026-10-29',
    values: { '显卡长度': '304 mm', '外形尺寸': '304 × 126 × 50 mm', '显存类型': 'GDDR7', '建议电源': '750 W', '供电接口': '1 × 16-pin' },
    source: 'https://www.gigabyte.com/ca/Graphics-Card/GV-N507TWF3OC-16GD/sp',
  },
  {
    category: 'gpu', brand: 'ASUS', keys: ['ATSRTX5060OC8GB'], checkedAt: '2026-10-29',
    values: { '显卡长度': '269 mm', '外形尺寸': '269 × 120 × 50 mm', '显存类型': 'GDDR7', '建议电源': '550 W', '占用槽位': '2.5 槽', '供电接口': '1 × 8-pin' },
    source: 'https://www.asus.com/br/motherboards-components/graphics-cards/asus/ats-rtx5060-o8g/techspec/',
  },
  {
    category: 'psu', brand: 'DeepCool', keys: ['PK500D'], checkedAt: '2026-10-29',
    values: { '模组类型': '非模组（固定线材）', '能效认证': '80 PLUS Bronze（铜牌）', 'ATX 版本': 'ATX12V 2.4', '外形尺寸': '150 × 140 × 86 mm', '风扇规格': '120 mm', '保护功能': 'SCP / OPP / OTP / OVP / OCP / UVP' },
    source: 'https://www.deepcool.com/products/PowerSupplyUnits/powersupplyunits/PK500D-80-PLUS-Bronze-Power-Supply/2022/15622.shtml',
  },
  {
    category: 'psu', brand: '航嘉', keys: ['WD500K'], checkedAt: '2026-10-29',
    values: { '能效认证': '80 PLUS 金牌（厂商标称）', '输入电压': '90–264 V', '+12V 输出': '单路 40 A', '风扇规格': '120 mm', '版本说明': '旧版官网资料存在尺寸与效率标签差异，以实际电源铭牌为准' },
    source: 'https://m.huntkey.cn/product/product_id%3D764.html',
  },
  {
    category: 'case', brand: '先马', keys: ['M2'], checkedAt: '2026-10-29',
    values: { '支持主板': 'Micro-ATX / Mini-ITX', '显卡限长': '345 mm', '外形尺寸': '400 × 205 × 380 mm', '电源规格': '标准 ATX', '版本说明': '原版平头哥 M2；不适用于 M2 Mesh、M2 Pro 或 V2' },
    source: 'https://www.sama.cn/archives/2968',
  },
  {
    category: 'cooler', brand: 'Thermalright', keys: ['AX120RSE'], checkedAt: '2026-10-29',
    values: { '散热器高度': '148 mm', '支持接口': 'AM4 / AM5 / LGA115x / LGA1200 / LGA1700 / LGA1851', '散热方式': '单塔风冷', '热管': '4 × 6 mm', '风扇规格': '120 × 120 × 25 mm', '风扇转速': '最高 1550 RPM ±10%', '风扇噪声': '25.6 dB(A)', '版本说明': 'AX120 R SE / Assassin X 120 Refined SE，实际扣具请核对包装批次' },
    source: 'https://www.thermalright.com/product/assassin-x-120-refined-se/',
  },
  {
    category: 'ssd', brand: 'CORSAIR', keys: ['MP600PROLPX1TB'],
    values: { '读取速度': '最高 7100 MB/s', '接口协议': 'NVMe 1.4', 'PCIe 版本': 'PCIe 4.0 ×4', '外形规格': 'M.2 2280' },
    source: 'https://www.corsair.com/us/en/p/data-storage/cssd-f1000gbmp600plp/mp600-pro-lpx-1tb-pcie-gen4-x4-nvme-m-2-ssd-ps5-compatible-cssd-f1000gbmp600plp',
  },
  {
    category: 'ram', brand: 'G.SKILL', keys: ['FLAREX5DDR5600032GB'], partNumber: 'F5-6000J3636F16GX2-FX5',
    values: { '时序': 'CL36-36-36-96（EXPO）', '测试电压': '1.35 V（EXPO）', '完整料号': 'F5-6000J3636F16GX2-FX5' },
    source: 'https://www.gskill.com/specification/165/396/1662622664/F5-6000J3636F16GX2-FX5-Specification',
  },
  {
    "category": "board",
    "brand": "ASRock",
    "keys": [
      "B650EPGRIPTIDEWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 5.0 ×16 / PCIe 3.0 ×4 / PCIe 4.0 ×1",
      "存储接口": "3 × M.2（Gen5 ×4 / Gen4 ×4 / Gen3 ×2）/ 4 × SATA",
      "通道说明": "PCIe 通道及共享限制以具体处理器和手册为准"
    },
    "source": "https://pg.asrock.com/mb/AMD/B650E%20PG%20Riptide%20WiFi/index.asp"
  },
  {
    "category": "psu",
    "brand": "CORSAIR",
    "keys": [
      "HX1200"
    ],
    "values": {
      "能效认证": "80 PLUS Platinum（白金牌）",
      "模组类型": "全模组",
      "额定功率": "1200 W"
    },
    "source": "https://www.corsair.com/ww/en/p/psu/cp-9020140-ww/hx-series-hx1200-1200-watt-80-plus-platinum-certified-fully-modular-psu-ww-cp-9020140-ww"
  },
  {
    "category": "cooler",
    "brand": "DeepCool",
    "keys": [
      "LS720"
    ],
    "values": {
      "支持接口": "AM5 / AM4 / sTRX4 / sTR4 / LGA1700 / LGA1200 / LGA115x / LGA2066 / LGA2011-v3"
    },
    "source": "https://www.deepcool.com/products/Cooling/cpuliquidcoolers/LS720-High-Performance-360mm-Liquid-CPU-Cooler-1700-AM5/2022/15826.shtml"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLACKSN770500GB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 5000 MB/s",
      "写入速度": "最高 4000 MB/s"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/western-digital/product/internal-drives/wd-black-ssd/product-brief-wd-black-sn770-nvme-ssd.pdf"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLACKSN7701TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 5150 MB/s",
      "写入速度": "最高 4900 MB/s"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/western-digital/product/internal-drives/wd-black-ssd/product-brief-wd-black-sn770-nvme-ssd.pdf"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLUESN580500GB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 4000 MB/s",
      "写入速度": "最高 3600 MB/s"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/western-digital/product/internal-drives/wd-blue-ssd/product-brief-wd-blue-sn580-nvme-ssd.pdf"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLUESN5801TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 4150 MB/s",
      "写入速度": "最高 4150 MB/s"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/western-digital/product/internal-drives/wd-blue-ssd/product-brief-wd-blue-sn580-nvme-ssd.pdf"
  },
  {
    "category": "ssd",
    "brand": "Samsung",
    "keys": [
      "980PRO2TB"
    ],
    "values": {
      "接口协议": "NVMe 1.3c",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 7000 MB/s",
      "写入速度": "最高 5100 MB/s",
      "独立缓存": "2 GB LPDDR4",
      "主控": "Samsung Elpis"
    },
    "source": "https://download.semiconductor.samsung.com/resources/data-sheet/Samsung-NVMe-SSD-980-PRO-Data-Sheet_Rev.2.1_230509_10129500052824.pdf"
  },
  {
    "category": "ssd",
    "brand": "Crucial",
    "keys": [
      "T500500GB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 7200 MB/s",
      "写入速度": "最高 5700 MB/s"
    },
    "source": "https://br.crucial.com/content/dam/crucial/ssd-products/t500/flyers/b2c/crucial-T500-b2c-product-flyer-en_combination.pdf"
  },
  {
    "category": "ssd",
    "brand": "Crucial",
    "keys": [
      "T5001TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6800 MB/s"
    },
    "source": "https://br.crucial.com/content/dam/crucial/ssd-products/t500/flyers/b2c/crucial-T500-b2c-product-flyer-en_combination.pdf"
  },
  {
    "category": "ssd",
    "brand": "Crucial",
    "keys": [
      "T5002TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "读取速度": "最高 7400 MB/s",
      "写入速度": "最高 7000 MB/s"
    },
    "source": "https://br.crucial.com/content/dam/crucial/ssd-products/t500/flyers/b2c/crucial-T500-b2c-product-flyer-en_combination.pdf"
  },
  {
    "category": "ssd",
    "brand": "KIOXIA",
    "keys": [
      "EXCERIAPROSE101TB"
    ],
    "values": {
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6400 MB/s",
      "外形规格": "M.2 2280",
      "PCIe 版本": "PCIe 4.0 ×4"
    },
    "source": "https://europe.kioxia.com/en-europe/personal/ssd/exceria-pro.html"
  },
  {
    "category": "ssd",
    "brand": "KIOXIA",
    "keys": [
      "EXCERIAPROSE102TB"
    ],
    "values": {
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6400 MB/s",
      "外形规格": "M.2 2280",
      "PCIe 版本": "PCIe 4.0 ×4"
    },
    "source": "https://europe.kioxia.com/en-europe/personal/ssd/exceria-pro.html"
  },
  {
    "category": "ssd",
    "brand": "Seagate",
    "keys": [
      "FIRECUDA5301TB"
    ],
    "values": {
      "接口协议": "NVMe 1.4",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "闪存类型": "3D TLC",
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6000 MB/s",
      "耐久度": "1275 TBW"
    },
    "source": "https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/datasheets/pdfs/firecuda-530-ssd-DS2059-3-2112US-en_US.pdf"
  },
  {
    "category": "cooler",
    "brand": "Thermalright",
    "keys": [
      "ASSASSINSPIRIT120EVO"
    ],
    "values": {
      "散热器高度": "156 mm",
      "热管": "4 × 6 mm",
      "风扇规格": "120 mm"
    },
    "source": "https://www.thermalright.com/product/assassin-spirit-120-evo/"
  },
  {
    "category": "cooler",
    "brand": "Thermalright",
    "keys": [
      "PHANTOMSPIRIT120SE"
    ],
    "values": {
      "散热器高度": "154 mm",
      "热管": "7 × 6 mm",
      "风扇规格": "120 mm"
    },
    "source": "https://www.thermalright.com/product/phantom-spirit-120-se/"
  },
  {
    "category": "cooler",
    "brand": "Thermalright",
    "keys": [
      "PHANTOMSPIRIT120EVO"
    ],
    "values": {
      "散热器高度": "157 mm",
      "热管": "7 × 6 mm",
      "风扇规格": "120 mm"
    },
    "source": "https://www.thermalright.com/product/phantom-spirit-120-evo/"
  },
  {
    "category": "cooler",
    "brand": "DeepCool",
    "keys": [
      "AG400"
    ],
    "values": {
      "散热器高度": "150 mm",
      "外形尺寸": "125 × 92 × 150 mm",
      "热管": "4 × 6 mm",
      "风扇规格": "120 mm"
    },
    "source": "https://www.deepcool.com/products/Cooling/cpuaircoolers/GAMMAXX-AG400-Single-Tower-CPU-Cooler-1851-1700-AM5/2024/15898.shtml"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "PRIMERTX5070TIOC16GB"
    ],
    "values": {
      "显卡长度": "304 mm",
      "外形尺寸": "304 × 126 × 50 mm",
      "建议电源": "750 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rtx5070ti-o16g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "PRIMERTX5070TI16GB"
    ],
    "values": {
      "显卡长度": "304 mm",
      "外形尺寸": "304 × 126 × 50 mm",
      "建议电源": "750 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rtx5070ti-16g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "TUFGAMINGRTX5070TIOC16GB"
    ],
    "values": {
      "显卡长度": "329 mm",
      "外形尺寸": "329 × 140 × 62.5 mm",
      "建议电源": "850 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5070ti-o16g-gaming/techspec/"
  },
  {
    "category": "gpu",
    "brand": "GIGABYTE",
    "keys": [
      "RTX5060TIWINDFORCEOC8G"
    ],
    "values": {
      "显卡长度": "208 mm",
      "外形尺寸": "208 × 120 × 40 mm",
      "建议电源": "650 W"
    },
    "source": "https://www.gigabyte.com/Graphics-Card/GV-N506TWF2OC-8GD/sp"
  },
  {
    "category": "gpu",
    "brand": "GIGABYTE",
    "keys": [
      "RTX5060TIWINDFORCEOC16G"
    ],
    "values": {
      "显卡长度": "208 mm",
      "外形尺寸": "208 × 120 × 40 mm",
      "建议电源": "650 W"
    },
    "source": "https://www.gigabyte.com/Graphics-Card/GV-N506TWF2OC-16GD/sp"
  },
  {
    "category": "gpu",
    "brand": "GIGABYTE",
    "keys": [
      "RTX5070TIGAMINGOC16G"
    ],
    "values": {
      "显卡长度": "342 mm",
      "外形尺寸": "342 × 142 × 70 mm",
      "建议电源": "750 W"
    },
    "source": "https://www.gigabyte.com/Graphics-Card/GV-N507TGAMING-OC-16GD/sp"
  },
  {
    "category": "gpu",
    "brand": "GIGABYTE",
    "keys": [
      "RTX5080GAMINGOC16G"
    ],
    "values": {
      "显卡长度": "340 mm",
      "外形尺寸": "340 × 140 × 70 mm",
      "建议电源": "850 W"
    },
    "source": "https://www.gigabyte.com/Graphics-Card/GV-N5080GAMING-OC-16GD/sp"
  },
  {
    "category": "board",
    "brand": "MSI",
    "keys": [
      "MAGB650MMORTARWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / PCIe 3.0 ×1 / PCIe 4.0 ×4",
      "存储接口": "2 × M.2 / 6 × SATA 6Gb/s",
      "内存插槽": "4 × DDR5 DIMM"
    },
    "source": "https://www.msi.com/Motherboard/MAG-B650M-MORTAR-WIFI/Specification"
  },
  {
    "category": "board",
    "brand": "MSI",
    "keys": [
      "MAGB850MMORTARWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 5.0 ×16 / PCIe 4.0 ×4",
      "存储接口": "3 × M.2 / 4 × SATA 6Gb/s",
      "内存插槽": "4 × DDR5 DIMM",
      "最大内存": "256 GB"
    },
    "source": "https://www.msi.com/Motherboard/MAG-B850M-MORTAR-WIFI/Specification"
  },
  {
    "category": "board",
    "brand": "MSI",
    "keys": [
      "B650MGAMINGPLUSWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / 2 × PCIe 3.0 ×1",
      "存储接口": "2 × M.2 / 4 × SATA 6Gb/s",
      "内存插槽": "4 × DDR5 DIMM"
    },
    "source": "https://www.msi.com/Motherboard/B650M-GAMING-PLUS-WIFI/Specification"
  },
  {
    "category": "board",
    "brand": "ASRock",
    "keys": [
      "A620MHDVM2"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / 2 × PCIe 3.0 ×1",
      "存储接口": "2 × M.2（Gen4 ×4 / Gen3 ×2）/ 2 × SATA",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asrock.com/mb/AMD/A620M-HDVM.2/index.asp"
  },
  {
    "category": "board",
    "brand": "ASRock",
    "keys": [
      "B650MPRORS"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / PCIe 3.0 物理 ×16",
      "存储接口": "3 × M.2（Gen5 ×4 / Gen4 ×4 / Gen4 ×2）/ 4 × SATA",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asrock.com/mb/AMD/B650M%20Pro%20RS/index.asp"
  },
  {
    "category": "board",
    "brand": "ASRock",
    "keys": [
      "B650MPRORSWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / PCIe 3.0 物理 ×16",
      "存储接口": "3 × M.2（Gen5 ×4 / Gen4 ×4 / Gen4 ×2）/ 4 × SATA",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asrock.com/mb/AMD/B650M%20Pro%20RS%20WiFi/index.asp"
  },
  {
    "category": "board",
    "brand": "ASRock",
    "keys": [
      "B850MSTEELLEGENDWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 5.0 ×16 / PCIe 4.0 ×4",
      "存储接口": "3 × M.2（Gen5 ×4 / Gen4 ×4 / Gen4 ×2）/ 4 × SATA",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asrock.com/mb/AMD/B850M%20Steel%20Legend%20WiFi/index.asp"
  },
  {
    "category": "board",
    "brand": "ASUS",
    "keys": [
      "PRIMEA620MK"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / PCIe 3.0 ×1",
      "内存插槽": "2 × DDR5 DIMM",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asus.com/motherboards-components/motherboards/prime/prime-a620m-k/techspec/"
  },
  {
    "category": "board",
    "brand": "ASUS",
    "keys": [
      "PRIMEB650MAII"
    ],
    "values": {
      "扩展接口": "PCIe 4.0 ×16 / 2 × PCIe 4.0 ×1",
      "内存插槽": "4 × DDR5 DIMM",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asus.com/motherboards-components/motherboards/prime/prime-b650m-a-ii/techspec/"
  },
  {
    "category": "board",
    "brand": "ASUS",
    "keys": [
      "TUFGAMINGB850MPLUSWIFI"
    ],
    "values": {
      "扩展接口": "主显卡槽 PCIe 5.0 ×16 / 芯片组 PCIe 4.0 ×1",
      "内存插槽": "4 × DDR5 DIMM",
      "通道说明": "实际 PCIe 通道取决于处理器和共享设备"
    },
    "source": "https://www.asus.com/motherboards-components/motherboards/tuf-gaming/tuf-gaming-b850m-plus-wifi/techspec/"
  },
  {
    "category": "board",
    "brand": "ASUS",
    "keys": [
      "ROGSTRIXB650EFGAMINGWIFI"
    ],
    "values": {
      "扩展接口": "PCIe 5.0 ×16 / PCIe 4.0 ×4 / 2 × PCIe ×1",
      "存储接口": "3 × M.2 / 4 × SATA",
      "内存插槽": "4 × DDR5 DIMM",
      "通道说明": "M.2_3 与芯片组 ×4 插槽共享带宽"
    },
    "source": "https://rog.asus.com/motherboards/rog-strix/rog-strix-b650e-f-gaming-wifi-model/spec/"
  },
  {
    "category": "board",
    "brand": "GIGABYTE",
    "keys": [
      "B650MD3HP"
    ],
    "values": {
      "扩展接口": "主显卡槽 PCIe 4.0 ×16（Ryzen 7000 / 9000）",
      "通道说明": "Ryzen 8000 按具体处理器运行于 ×8 / ×4"
    },
    "source": "https://www.gigabyte.com/Motherboard/B650M-D3HP-rev-1x/sp"
  },
  {
    "category": "board",
    "brand": "GIGABYTE",
    "keys": [
      "B650MAORUSELITEAX"
    ],
    "values": {
      "扩展接口": "主显卡槽 PCIe 4.0 ×16（Ryzen 7000 / 9000）",
      "通道说明": "Ryzen 8000 按具体处理器运行于 ×8 / ×4"
    },
    "source": "https://www.gigabyte.com/Motherboard/B650M-AORUS-ELITE-AX-rev-10-11/sp"
  },
  {
    "category": "board",
    "brand": "GIGABYTE",
    "keys": [
      "B850MAORUSELITEWIFI6EICE"
    ],
    "values": {
      "扩展接口": "主显卡槽 PCIe 5.0 ×16（Ryzen 7000 / 9000）",
      "通道说明": "Ryzen 8000 按具体处理器运行于 ×8 / ×4"
    },
    "source": "https://www.gigabyte.com/Motherboard/B850M-AORUS-ELITE-WIFI6E-ICE-rev-1x/sp"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLACKSN850X1TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "闪存类型": "TLC 3D NAND",
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6300 MB/s",
      "耐久度": "600 TBW"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/sandisk/product/internal-drives/wd-black-ssd/data-sheet-wd-black-sn850x-nvme-ssd.pdf"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLACKSN850X2TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "闪存类型": "TLC 3D NAND",
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6600 MB/s",
      "耐久度": "1200 TBW"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/sandisk/product/internal-drives/wd-black-ssd/data-sheet-wd-black-sn850x-nvme-ssd.pdf"
  },
  {
    "category": "ssd",
    "brand": "WD",
    "keys": [
      "BLACKSN850X4TB"
    ],
    "values": {
      "接口协议": "NVMe",
      "PCIe 版本": "PCIe 4.0 ×4",
      "外形规格": "M.2 2280",
      "闪存类型": "TLC 3D NAND",
      "读取速度": "最高 7300 MB/s",
      "写入速度": "最高 6600 MB/s",
      "耐久度": "2400 TBW"
    },
    "source": "https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/sandisk/product/internal-drives/wd-black-ssd/data-sheet-wd-black-sn850x-nvme-ssd.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX5060TI8GVENTUS2XOCPLUS"
    ],
    "values": {
      "显卡长度": "227 mm",
      "外形尺寸": "227 × 126 × 41 mm",
      "建议电源": "600 W",
      "显存容量": "8GB",
      "显存类型": "GDDR7",
      "显卡功耗": "180 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5060-Ti-8G-VENTUS-2X-OC-PLUS.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX5060TI16GVENTUS2XOCPLUS"
    ],
    "values": {
      "显卡长度": "227 mm",
      "外形尺寸": "227 × 126 × 41 mm",
      "建议电源": "600 W",
      "显存容量": "16GB",
      "显存类型": "GDDR7",
      "显卡功耗": "180 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5060-Ti-16G-VENTUS-2X-OC-PLUS.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX507012GVENTUS2XOC"
    ],
    "values": {
      "显卡长度": "236 mm",
      "外形尺寸": "236 × 126 × 50 mm",
      "建议电源": "650 W",
      "显存容量": "12GB",
      "显存类型": "GDDR7",
      "显卡功耗": "250 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5070-12G-VENTUS-2X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX507012GSHADOW3XOC"
    ],
    "values": {
      "显卡长度": "303 mm",
      "外形尺寸": "303 × 121 × 49 mm",
      "建议电源": "650 W",
      "显存容量": "12GB",
      "显存类型": "GDDR7",
      "显卡功耗": "250 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5070-12G-SHADOW-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX507012GSHADOW2XOC"
    ],
    "values": {
      "显卡长度": "231 mm",
      "外形尺寸": "231 × 126 × 50 mm",
      "建议电源": "650 W",
      "显存容量": "12GB",
      "显存类型": "GDDR7",
      "显卡功耗": "250 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5070-12G-SHADOW-2X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX507012GINSPIRE3XOC"
    ],
    "values": {
      "显卡长度": "288 mm",
      "外形尺寸": "288 × 112 × 50 mm",
      "建议电源": "650 W",
      "显存容量": "12GB",
      "显存类型": "GDDR7",
      "显卡功耗": "250 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5070-12G-INSPIRE-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX50608GVENTUS2XOC"
    ],
    "values": {
      "显卡长度": "197 mm",
      "外形尺寸": "197 × 120 × 41 mm",
      "建议电源": "550 W",
      "显存容量": "8GB",
      "显存类型": "GDDR7",
      "显卡功耗": "145 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5060-8G-VENTUS-2X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX50608GVENTUS3XOC"
    ],
    "values": {
      "显卡长度": "303 mm",
      "外形尺寸": "303 × 121 × 41 mm",
      "建议电源": "550 W",
      "显存容量": "8GB",
      "显存类型": "GDDR7",
      "显卡功耗": "145W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5060-8G-VENTUS-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX4070SUPER12GVENTUS2XOC",
      "RTX4070SUPERVENTUS2XOC"
    ],
    "values": {
      "显卡长度": "242 mm",
      "外形尺寸": "242 × 125 × 43 mm",
      "建议电源": "650 W",
      "显存容量": "12GB",
      "显存类型": "GDDR6X",
      "显卡功耗": "220 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-4070-SUPER-12G-VENTUS-2X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX4080SUPER16GVENTUS3XOC",
      "RTX4080SUPERVENTUS3XOC"
    ],
    "values": {
      "显卡长度": "322 mm",
      "外形尺寸": "322 × 136 × 62 mm",
      "建议电源": "750 W",
      "显存容量": "16GB",
      "显存类型": "GDDR6X",
      "显卡功耗": "320 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-4080-SUPER-16G-VENTUS-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX4060VENTUS2XBLACK8GOC"
    ],
    "values": {
      "显卡长度": "199 mm",
      "外形尺寸": "199 × 120 × 41 mm",
      "建议电源": "550 W",
      "显存容量": "8GB",
      "显存类型": "GDDR6",
      "显卡功耗": "115 W or 120 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-4060-VENTUS-2X-BLACK-8G-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX508016GVENTUS3XOC",
      "RTX5080VENTUS3XOC"
    ],
    "values": {
      "显卡长度": "303 mm",
      "外形尺寸": "303 × 121 × 49 mm",
      "建议电源": "850 W",
      "显存容量": "16GB",
      "显存类型": "GDDR7",
      "显卡功耗": "360 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5080-16G-VENTUS-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX508016GGAMINGTRIOOC",
      "RTX5080GAMINGTRIOOC"
    ],
    "values": {
      "显卡长度": "338 mm",
      "外形尺寸": "338 × 140 × 50 mm",
      "建议电源": "850 W",
      "显存容量": "16GB",
      "显存类型": "GDDR7",
      "显卡功耗": "360 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5080-16G-GAMING-TRIO-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX507012GVENTUS3XOC"
    ],
    "values": {
      "显卡长度": "302 mm",
      "外形尺寸": "302 × 121 × 49 mm",
      "建议电源": "650 W",
      "显存容量": "12GB",
      "显存类型": "GDDR7",
      "显卡功耗": "250 W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5070-12G-VENTUS-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "MSI",
    "keys": [
      "RTX5070TI16GVENTUS3XOC"
    ],
    "values": {
      "显卡长度": "303 mm",
      "外形尺寸": "303 × 121 × 49 mm",
      "建议电源": "750 W",
      "显存容量": "16GB",
      "显存类型": "GDDR7",
      "显卡功耗": "300W"
    },
    "source": "https://storage-asset.msi.com/datasheet/vga/global/GeForce-RTX-5070-Ti-16G-VENTUS-3X-OC.pdf"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "DUALRTX4060O8G"
    ],
    "values": {
      "显卡长度": "227.2 mm",
      "外形尺寸": "227.2 × 123.24 × 49.6 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx4060-o8g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "DUALRTX4070SUPERO12G"
    ],
    "values": {
      "显卡长度": "267.01 mm",
      "外形尺寸": "267.01 × 133.94 × 51.13 mm",
      "建议电源": "750 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx4070s-o12g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "DUALRTX4070TISUPERO16G"
    ],
    "values": {
      "显卡长度": "267.01 mm",
      "外形尺寸": "267.01 × 133.94 × 51.13 mm",
      "建议电源": "750 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx4070tis-o16g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "DUALRTX5060TIOC8GB"
    ],
    "values": {
      "显卡长度": "229 mm",
      "外形尺寸": "229 × 120 × 50 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx5060ti-o8g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "DUALRTX5060TIOC16GB"
    ],
    "values": {
      "显卡长度": "229 mm",
      "外形尺寸": "229 × 120 × 50 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx5060ti-o16g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "PRIMERTX5060TIOC8GB"
    ],
    "values": {
      "显卡长度": "304 mm",
      "外形尺寸": "304 × 120 × 50 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rtx5060ti-o8g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "PRIMERTX5060TIOC16GB"
    ],
    "values": {
      "显卡长度": "304 mm",
      "外形尺寸": "304 × 120 × 50 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rtx5060ti-o16g/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "TUFGAMINGRTX5060TIOC8GB"
    ],
    "values": {
      "显卡长度": "302 mm",
      "外形尺寸": "302 × 133.5 × 62 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5060ti-o8g-gaming/techspec/"
  },
  {
    "category": "gpu",
    "brand": "ASUS",
    "keys": [
      "TUFGAMINGRTX5060TIOC16GB"
    ],
    "values": {
      "显卡长度": "302 mm",
      "外形尺寸": "302 × 133.5 × 62 mm",
      "建议电源": "550 W"
    },
    "source": "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5060ti-o16g-gaming/techspec/"
  }
]
