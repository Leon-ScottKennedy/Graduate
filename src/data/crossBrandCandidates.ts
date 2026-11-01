import type { PartOption } from '../types/hardware'

// Model identities from manufacturer documentation. Prices are populated only from quotes.
const model = (id: string, brand: string, name: string, specs: string, specSource: string,
  compatibility?: PartOption['compatibility']): PartOption => ({ id: `cross-${id}`, brand, name, specs, specSource,
  compatibility, price: 0, requiresQuote: true, tag: '标准型号 · 待采集报价' })
const asus5060 = 'https://press.asus.com/news/press-releases/asus-announces-nvidia-ge-force-rtx-5060-5060-ti-graphics-cards/'
export const crossBrandCandidates: Record<string, PartOption[]> = {
  gpu: [
    ...['Dual', 'PRIME', 'TUF Gaming'].flatMap(series => [8, 16].map(size => model(
      `asus-${series.replace(/\s/g, '-').toLowerCase()}-5060ti-${size}`, '华硕 ASUS',
      `华硕 ${series} GeForce RTX 5060 Ti OC ${size}GB`, `RTX 5060 Ti · ${size}GB GDDR7`, asus5060))),
    model('msi-5060ti-ventus-8', '微星 MSI', '微星 GeForce RTX 5060 Ti 8G VENTUS 2X OC PLUS',
      'RTX 5060 Ti · 8GB GDDR7', 'https://storage-asset.msi.com/datasheet/vga/hk/GeForce-RTX-5060-Ti-8G-VENTUS-2X-OC-PLUS.pdf'),
    ...[8,16].map(size => model(`gigabyte-5060ti-windforce-${size}`, '技嘉 GIGABYTE',
      `技嘉 GeForce RTX 5060 Ti WINDFORCE OC ${size}G`, `RTX 5060 Ti · ${size}GB GDDR7`,
      `https://www.gigabyte.com/Graphics-Card/GV-N506TWF2OC-${size}GD`)),
    model('colorful-5060ti-deluxe-8', '七彩虹 Colorful', '七彩虹 战斧 GeForce RTX 5060 Ti 豪华版 8GB',
      'RTX 5060 Ti · 8GB GDDR7', 'https://www.colorful.cn/home/product?id=50f7f597-c6cd-4bb4-85f1-6cf41d3ec70b&mid=102'),
  ],
  board: [
    model('msi-b650m-gaming-plus-wifi', '微星 MSI', '微星 B650M GAMING PLUS WIFI', 'B650 · AM5 · DDR5 · M-ATX · Wi-Fi',
      'https://us.msi.com/Motherboard/B650M-GAMING-PLUS-WIFI/Specification', { socket: 'AM5', memoryType: 'DDR5', boardForm: 'M-ATX' }),
    model('asus-b650ma-ii', '华硕 ASUS', '华硕 PRIME B650M-A II', 'B650 · AM5 · DDR5 · M-ATX',
      'https://www.asus.com/uk/motherboards-components/motherboards/prime/prime-b650m-a-ii/techspec/', { socket: 'AM5', memoryType: 'DDR5', boardForm: 'M-ATX' }),
    model('asrock-b650m-pro-rs-wifi', '华擎 ASRock', '华擎 B650M Pro RS WiFi', 'B650 · AM5 · DDR5 · M-ATX · Wi-Fi',
      'https://www.asrock.com/mb/AMD/B650M%20Pro%20RS%20WiFi/index.asp', { socket: 'AM5', memoryType: 'DDR5', boardForm: 'M-ATX' }),
  ],
  ram: [
    model('gskill-flare-x5-6000-32', '芝奇 G.SKILL', '芝奇 Flare X5 DDR5 6000 32GB', '16GB × 2 · DDR5 · 6000MT/s',
      'https://www.gskill.com/specification/165/396/1662622664/F5-6000J3636F16GX2-FX5-Specification'),
    ...[32,64].map(size => model(`team-vulcan-6000-${size}`, '十铨 TEAMGROUP', `十铨 T-FORCE VULCAN DDR5 6000 ${size}GB`,
      `${size/2}GB × 2 · DDR5 · 6000MT/s`, 'https://images.teamgroupinc.com/products/memory/u-dimm/ddr5/vulcan/spec-sheet/vulcan-en.pdf')),
    ...[32,64].map(size => model(`corsair-vengeance-rgb-6000-${size}`, '海盗船 CORSAIR',
      `海盗船 VENGEANCE RGB DDR5 6000 ${size}GB`, `${size/2}GB × 2 · DDR5 · 6000MT/s`,
      'https://www.corsair.com/us/en/c/memory/vengeance-rgb-ddr5-memory')),
  ],
  ssd: ['1TB', '2TB'].map(size => model(`lexar-nm790-${size.toLowerCase()}`, '雷克沙 Lexar', `雷克沙 NM790 ${size}`,
      `${size} · M.2 2280 · NVMe · PCIe 4.0`, 'https://resources.lexar.com/download/1048/documents/13165/lexar-productsheet-ssd-nm790-en-202410.pdf')),
}
