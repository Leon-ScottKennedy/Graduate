import type { PartOption } from '../types/hardware'

// Public, model-specific reference snapshots. Never derive prices from the selected
// part or move a price into the filter window. These are not verified shop offers.
const zol = (id: number, category: string) => `https://detail.zol.com.cn/${category}/index${id}.shtml`
function model(id: string, brand: string, name: string, specs: string, price: number,
  sourceUrl: string, note = '完整型号公开参考价快照；不代表实时成交价或现货。'): PartOption {
  return { id: `comparison-${id}`, brand, name, specs, price, tag: '公开参考价',
    referencePrice: { amount: price, currency: 'CNY', basis: 'public', sourceName: '公开型号报价记录',
      sourceUrl, checkedAt: '2026-10-24', note } }
}
const ti5070 = 'https://detail.zol.com.cn/vga/s11069_s7264_s255_s2465_s915_s10756/pic.html'
const colorfulChannel = 'https://www.tomshardware.com/pc-components/gpus/msi-and-colorful-raise-nvidia-rtx-50-series-prices-in-china-by-up-to-59-percent-across-the-entire-lineup-change-in-distributer-pricing-suggests-gpu-price-hikes-are-on-the-way'
const channelNote = '2026-07-27报道所列七彩虹渠道调价记录；历史渠道参考，不是当前零售成交价。'
export const comparisonCatalog: Record<string, PartOption[]> = {
  gpu: [
    model('asus-5070ti-prime-oc', '华硕 ASUS', '华硕 PRIME GeForce RTX 5070 Ti OC 16GB', 'RTX 5070 Ti · 16GB GDDR7', 7699, ti5070),
    model('asus-5070ti-tuf-oc', '华硕 ASUS', '华硕 TUF Gaming GeForce RTX 5070 Ti OC 16GB', 'RTX 5070 Ti · 16GB GDDR7', 8499, ti5070),
    model('asus-5070ti-prime', '华硕 ASUS', '华硕 PRIME GeForce RTX 5070 Ti 16GB', 'RTX 5070 Ti · 16GB GDDR7', 6299, ti5070),
    model('gigabyte-5070ti-gaming', '技嘉 GIGABYTE', '技嘉 GeForce RTX 5070 Ti GAMING OC 16G', 'RTX 5070 Ti · 16GB GDDR7', 8399, zol(2121247, 'vga')),
    model('gigabyte-5070ti-windforce', '技嘉 GIGABYTE', '技嘉 GeForce RTX 5070 Ti WINDFORCE OC SFF 16G', 'RTX 5070 Ti · 16GB GDDR7', 6299, 'https://detail.zol.com.cn/2122/2121252/price.shtml'),
    model('colorful-5070ti-ultra', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5070 Ti Ultra W OC 16GB', 'RTX 5070 Ti · 16GB GDDR7', 7599, ti5070),
    model('colorful-5070ti-advanced', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5070 Ti Advanced OC 16GB', 'RTX 5070 Ti · 16GB GDDR7', 7999, ti5070),
    model('colorful-5070ti-vulcan', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5070 Ti Vulcan OC 16GB', 'RTX 5070 Ti · 16GB GDDR7', 8799, ti5070),
    model('colorful-5070-deluxe', '七彩虹 Colorful', '七彩虹 战斧 GeForce RTX 5070 豪华版 12GB', 'RTX 5070 · 12GB GDDR7', 6399, colorfulChannel, channelNote),
    model('colorful-5070-ultra', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5070 Ultra OC 12GB', 'RTX 5070 · 12GB GDDR7', 6799, colorfulChannel, channelNote),
    model('colorful-5070-vulcan', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5070 Vulcan X OC 12GB', 'RTX 5070 · 12GB GDDR7', 7199, colorfulChannel, channelNote),
    model('colorful-5080-ultra', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5080 Ultra W OC 16GB', 'RTX 5080 · 16GB GDDR7', 10499, colorfulChannel, channelNote),
    model('colorful-5080-advanced', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5080 Advanced OC 16GB', 'RTX 5080 · 16GB GDDR7', 11799, colorfulChannel, channelNote),
    model('colorful-5080-vulcan', '七彩虹 Colorful', '七彩虹 iGame GeForce RTX 5080 Vulcan OC 16GB', 'RTX 5080 · 16GB GDDR7', 12299, colorfulChannel, channelNote),
    model('gigabyte-5080-gaming', '技嘉 GIGABYTE', '技嘉 GeForce RTX 5080 GAMING OC 16G', 'RTX 5080 · 16GB GDDR7', 10999, 'https://detail.zol.com.cn/2120/2119960/price_25_662.shtml'),
    model('asus-5060-ats', '华硕 ASUS', '华硕 ATS GeForce RTX 5060 OC 8GB', 'RTX 5060 · 8GB GDDR7', 2919, zol(2131150, 'vga'), 'DUAL页面的同系列ATS-RTX5060-O8G条目列示2919；不是DUAL的报价。'),
  ],
  board: [
    model('asus-b850m-tuf', '华硕 ASUS', '华硕 TUF GAMING B850M-PLUS WIFI', 'B850 · AM5 · DDR5 · M-ATX · Wi-Fi', 1399, 'https://detail.zol.com.cn/2119/2118288/price.shtml'),
    model('gigabyte-b850m-ice', '技嘉 GIGABYTE', '技嘉 B850M AORUS ELITE WIFI6E ICE', 'B850 · AM5 · DDR5 · M-ATX · Wi-Fi', 1399, 'https://detail.zol.com.cn/2119/2118277/price_1.shtml', '公开参考区间1319—1399，采用上限1399；ICE版本，不混用黑色版报价。'),
  ],
  ram: [
    model('gskill-6000-64', '芝奇 G.SKILL', '芝奇 焰锋戟 DDR5 6000 64GB C30', '32GB × 2 · DDR5 · 6000MT/s', 1899, zol(1985128, 'memory')),
    model('corsair-sl-6000-64', '海盗船 CORSAIR', '海盗船 VENGEANCE RGB SL DDR5 6000 64GB', '32GB × 2 · DDR5 · 6000MT/s', 1499, 'https://detail.zol.com.cn/2114/2113899/price.shtml'),
    model('kingbank-6000-64', '金百达 KINGBANK', '金百达 黑刃 DDR5 6000 64GB', '32GB × 2 · DDR5 · 6000MT/s', 1299, 'https://detail.zol.com.cn/1986/1985004/price.shtml'),
  ],
  ssd: [
    model('lexar-nm790-512gb', '雷克沙 Lexar', '雷克沙 NM790 512GB', '512GB · M.2 2280 · NVMe · PCIe 4.0', 575, 'https://baojia.xinde8.com/c/ssd.html', '2026-10-24渠道表NM790 PCIE4.0 512G条目575元；未税，不是零售成交价。'),
    model('kioxia-se10-1tb', '铠侠 KIOXIA', '铠侠 EXCERIA PRO SE10 1TB', '1TB · M.2 2280 · NVMe · PCIe 4.0', 1329, zol(1380777, 'solid_state_drive')),
    model('kioxia-se10-2tb', '铠侠 KIOXIA', '铠侠 EXCERIA PRO SE10 2TB', '2TB · M.2 2280 · NVMe · PCIe 4.0', 2459, zol(1395928, 'solid_state_drive')),
    model('corsair-lpx-1tb', '海盗船 CORSAIR', '海盗船 MP600 PRO LPX 1TB', '1TB · M.2 2280 · NVMe · PCIe 4.0 · 带散热片', 1379, zol(1403668, 'solid_state_drive')),
    model('seagate-530-1tb', '希捷 Seagate', '希捷 FireCuda 530 1TB', '1TB · M.2 2280 · NVMe · PCIe 4.0', 1699, zol(1381065, 'solid_state_drive')),
  ],
}
