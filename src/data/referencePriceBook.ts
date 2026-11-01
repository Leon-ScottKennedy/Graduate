import type { PartOption } from '../types/hardware'

type Reference = NonNullable<PartOption['referencePrice']>
const ref = (amount: number, sourceUrl: string, note: string, basis: Reference['basis'] = 'public', sourceName = '中关村在线公开参考价'): Reference =>
  ({ amount, currency: 'CNY', basis, sourceName, sourceUrl, checkedAt: '2026-10-24', note })
const asus8 = 'https://wap.zol.com.cn/2132/2131127/models.html'
const asus16 = 'https://baojia.xinde8.com/'
const msi8 = 'https://detail.zol.com.cn/vga/index2130978.shtml'
const giga16 = 'https://www.ithome.com/0/845/788.htm'
const team32 = 'https://diy.zol.com.cn/3/manu_33090.shtml'
const rgb32 = 'https://g.pconline.com.cn/product/memory/corsair/1857227.html'
const kc = 'https://detail.zol.com.cn/series/626/10706243_1.html'
const t500 = 'https://detail.zol.com.cn/solid_state_drive/index1978024.shtml'
const cpuChannel = 'https://baojia.xinde8.com/c/cpu.html'
const msi5070 = 'https://detail.zol.com.cn/vga/index2133499.shtml'
const msi5060 = 'https://wap.zol.com.cn/2134/2133531/index.html'

// Reference snapshots are independent of merchant products/quotes. Estimated entries
// state their exact anchor and method; none of these records claim a current checkout price.
export const referencePriceBook: Record<string, Reference> = {
  'library-board-asus-prime-b760m-a-wifi': { ...ref(999, 'https://wap.zol.com.cn/1985/1984958/index.html', '未核实本型号独立现价；按已登记微星 PRO B760M-A WIFI DDR5 的999元参考价做同平台预算估算，不是华硕报价。', 'estimated', '同平台主板预算估算'), checkedAt: '2026-10-29' },
  'library-board-asus-prime-z790-p-wifi': { ...ref(1999, 'https://detail.zol.com.cn/motherboard/index1465973.shtml', 'PRIME Z790-P WIFI DDR5 型号页公开参考价，非 D4、非实时成交价。'), checkedAt: '2026-10-29' },
  'library-board-msi-pro-b760m-a-wifi': { ...ref(999, 'https://wap.zol.com.cn/1985/1984958/index.html', 'PRO B760M-A WIFI DDR5 型号页列示价；不采用 DDR4、II 或其他变体，非实时成交价。'), checkedAt: '2026-10-29' },
  'library-board-msi-pro-z790-a-wifi': { ...ref(1699, 'https://wap.zol.com.cn/1434/1433087/price.html', 'PRO Z790-A WIFI DDR5 型号报价页列示价；不混用 MAX 或 DDR4 版本，购买前核价。'), checkedAt: '2026-10-29' },
  'library-cpu-ryzen 5 9600x': ref(1020, cpuChannel, '2026-10-24渠道表R5-9600X；未税，盒装/散片及保修需另核。', 'public', '今日配件渠道参考'),
  'library-cpu-ryzen 7 9700x': ref(1360, cpuChannel, '2026-10-24渠道表R7-9700X；未税，盒装/散片及保修需另核。', 'public', '今日配件渠道参考'),
  'library-cpu-ryzen 9 9900x': ref(2899, 'https://detail.zol.com.cn/cpu/index2018965.shtml', '公开型号页列示电商价格，未核SKU，不建立店铺报价关联。'),
  'library-cpu-ryzen 9 9900x3d': ref(Math.round(2899 * 3910 / 2710 * 100) / 100, cpuChannel, '本型号缺独立报价；9900X公开参考2899×(9950X3D渠道3910÷9950X渠道2710)作同代X3D溢价估算；非实测售价。', 'estimated', '同代型号比值估算'),
  'library-cpu-ryzen 9 9950x3d': ref(3910, cpuChannel, '2026-10-24渠道表R9-9950X3D；未税，包装/保修另核。', 'public', '今日配件渠道参考'),
  'library-cpu-ryzen 7 8700g': ref(2499, 'https://m.mydrivers.com/newsview/961174_all.html', '2024年首发评测记录的国行发售价，仅作历史参考。', 'public', '快科技首发价格记录'),
  'library-cpu-ryzen 5 8500g': ref(1253, 'https://post.smzdm.com/p/a7p6332o/', '历史首发USD179，按预算常数7元/美元折算1253元；非实时汇率，非当前国行价。', 'estimated', '历史指导价预算折算'),
  'library-cpu-ryzen 5 7600x': ref(2249, 'https://detail.zol.com.cn/cpu/index1367038.shtml', '型号页参考价，可能保留上市期水平，不代表当前散片价格。'),
  'library-cpu-ryzen 9 7900x3d': ref(4499, 'https://detail.zol.com.cn/1441/1440582/price.shtml', '完整型号公开参考价，非最低店铺报价。'),
  'library-cpu-ryzen 9 7950x3d': ref(5299, 'https://detail.zol.com.cn/1441/1440581/price.shtml', '完整型号公开参考价，非最低店铺报价。'),
  'library-cpu-core i5-14600k': ref(1370, cpuChannel, '渠道表I5-14600K，不是KF；未税，包装/保修另核。', 'public', '今日配件渠道参考'),
  'library-cpu-core i7-14700k': ref(2130, cpuChannel, '渠道表I7-14700K，不是KF；未税，包装/保修另核。', 'public', '今日配件渠道参考'),
  'library-cpu-core i9-14900k': ref(2885, cpuChannel, '渠道表I9-14900K，不是KF；未税，包装/保修另核。', 'public', '今日配件渠道参考'),
  'candidate-gpu-colorful-4070tis': ref(6499, 'https://detail.zol.com.cn/1981/1980409/price.shtml', '战斧4070 Ti SUPER豪华版16GB完整型号参考价，非当前库存承诺。'),
  'candidate-gpu-gigabyte-4070tis': ref(6499, 'https://detail.zol.com.cn/vga/index1980409.shtml', '本版本缺独立参考价，借同芯片同16GB容量战斧参考6499估算；技嘉版本溢价未知。', 'estimated', '同芯片同容量估算'),
  'library-gpu-galax-5060ti-saint-oc-8gb': ref(3999, 'https://jingfen.jd.com/detail/BWQ93VhcToxZ8c7rRqm6Z8c7rRqm6Q_3rtcvZ2NIl98a80mhG.html', '项目已保存的2026-10-18采集展示价3999快照；不承诺链接当前仍可用或当前售价不变。', 'public', '已采集展示价历史快照'),
  'library-gpu-geforce-rtx-5070-12g-ventus-3x-oc': ref(6599, msi5070, '完整型号页列示的京东展示价，仅作公开参考，未核当前SKU与库存。'),
  ...Object.fromEntries(['ventus-2x', 'shadow-3x', 'shadow-2x', 'inspire-3x'].map(version => [
    `library-gpu-geforce-rtx-5070-12g-${version}-oc`, ref(6599, msi5070, '缺本版本独立报价，按同品牌5070 12GB VENTUS 3X OC公开参考6599估算，未计版本溢价。', 'estimated', '同品牌同芯片估算'),
  ])),
  ...Object.fromEntries(['2x', '3x'].map(fans => [`library-gpu-geforce-rtx-5060-8g-ventus-${fans}-oc`,
    ref(2699, msi5060, '本OC版本缺独立报价；采用同系列5060 8GB公开参考区间2699—2899的下限作估算，OC/风扇版本溢价未知。', 'estimated', '同系列同容量估算')])),
  'library-gpu-geforce-rtx-5060-ti-16g-ventus-2x-oc-plus': ref(3599, giga16, '本微星版本缺独立参考价；采用技嘉同5060 Ti 16GB首发价3599作跨品牌预算估算，不代表本型号当前售价。', 'estimated', '同芯片历史基准估算'),
  'library-gpu-geforce-rtx-5070-ti-16g-ventus-3x-oc': ref(8099, 'https://detail.zol.com.cn/vga/index2121256.shtml', '完整VENTUS 3X OC 16GB型号页参考价，非最低成交价。'),
  'cross-asus-dual-5060ti-8': ref(3700, 'https://m.zgytpc.com/col.jsp?id=112', '公开经销报价表，2026-09-10；标有预定，非现货承诺。', 'public', '智慧家公开经销报价'),
  'cross-asus-prime-5060ti-8': ref(3599, 'https://wap.zol.com.cn/2132/2131136/index.html', '对应 PRIME O8G 页面参考价；与店铺实时成交价不同。'),
  'cross-asus-tuf-gaming-5060ti-8': ref(3979, asus8, '对应 TUF O8G GAMING 型号列示价，不是整个系列的最低价。'),
  'cross-msi-5060ti-ventus-8': ref(3199, msi8, '对应 VENTUS 2X OC PLUS 8GB 页面参考报价。'),
  'cross-gigabyte-5060ti-windforce-8': ref(3499, 'https://detail.zol.com.cn/vga/index2162758.shtml', '对应 WINDFORCE OC 8G 页面参考报价。'),
  'cross-colorful-5060ti-deluxe-8': ref(4499, 'https://detail.zol.com.cn/vga/index2131017.shtml', '战斧豪华版 8GB 页面参考报价；该页另列京东展示价3649元，不将其当作已核验SKU店铺报价。'),
  'cross-asus-dual-5060ti-16': ref(6220, asus16, '公开渠道表列 DUAL O16G 6220元；未税，非最终零售价。', 'public', '今日配件渠道参考'),
  'cross-asus-prime-5060ti-16': ref(6220, asus16, '未取得本版本独立报价；按同品牌同芯片同16GB容量的DUAL O16G 6220元作预算估算，不含系列溢价。', 'estimated', '同品牌同规格估算'),
  'cross-asus-tuf-gaming-5060ti-16': ref(6220, asus16, '未取得本版本独立报价；按同品牌同芯片同16GB容量的DUAL O16G 6220元作预算估算，不含TUF溢价。', 'estimated', '同品牌同规格估算'),
  'cross-gigabyte-5060ti-windforce-16': ref(3599, giga16, '2025-04-16报道的WINDFORCE OC 16G首发价；历史指导参考，非当前售价。', 'public', 'IT之家首发价格记录'),
  'cross-msi-b650m-gaming-plus-wifi': ref(999, 'https://detail.zol.com.cn/motherboard/index2071207.shtml', '完整型号对应的页面参考报价。'),
  'cross-asus-b650ma-ii': ref(1399, 'https://detail.zol.com.cn/motherboard/s2449/good_pic.html', '对应PRIME B650M-A II条目，页面标注2026-10-17；不是WIFI II版本。'),
  'cross-asrock-b650m-pro-rs-wifi': ref(892.43, 'https://www.bestbuy.com/product/asrock-b650m-pro-rs-wifi-am5-amd-b650-micro-atx-motherboard/C34K265LFR', '海外标价USD127.49，按预算换算常数7元/美元估算892.43元；该常数不是实时汇率，未含进口税运费。', 'estimated', '海外标价预算折算'),
  'cross-team-vulcan-6000-32': ref(689, team32, 'VULCAN DDR5 6000 32GB(2×16GB)条目的公开参考价。'),
  'cross-team-vulcan-6000-64': ref(1378, team32, '无64GB套装独立报价；按同系列32GB套装689元×2估算，仅用于容量预算，不是64GB现货报价。', 'estimated', '同系列容量估算'),
  'cross-gskill-flare-x5-6000-32': ref(2616.12, 'https://cn.ebay.com/b/G-SKILL-DIMM-Computer-Memory-RAM-32-GB-Total-Capacity/170083/bn_113553074', '全新F5-6000J3636F16GX2-FX5条目人民币展示价2616.12元；海外参考，另列运费39.51元，未核进口税。', 'overseas', 'eBay海外公开展示价'),
  'cross-corsair-vengeance-rgb-6000-32': ref(899, rgb32, '复仇者RGB DDR5 6000 32GB(16GB×2)参考价；时序与套装SKU购买前核对。', 'public', '太平洋公开参考价'),
  'cross-corsair-vengeance-rgb-6000-64': ref(1798, rgb32, '无64GB套装独立报价；按同系列32GB RGB套装899元×2估算，不是64GB商品报价。', 'estimated', '同系列容量估算'),
  'cross-lexar-nm790-1tb': ref(885, 'https://baojia.xinde8.com/c/ssd.html', '2026-10-24渠道表列NM790 PCIe4.0 1TB，未税，非最终零售价。', 'public', '今日配件渠道参考'),
  'cross-lexar-nm790-2tb': ref(1680, 'https://baojia.xinde8.com/c/ssd.html', '2026-10-24渠道表列NM790 PCIe4.0 2TB，未税，非最终零售价。', 'public', '今日配件渠道参考'),
  'library-ssd-kc3000-1tb': ref(759, kc, 'KC3000 1TB条目参考价，不采用同页2TB或店铺混卖报价。'),
  'library-ssd-kc3000-512gb': ref(489, kc, 'KC3000 512GB条目参考价。'),
  'library-ssd-kc3000-4tb': ref(4499, kc, 'KC3000 4TB条目参考价；系列表部分规格存在错误，仅采用明确标为4TB的价格条目。'),
  'library-ssd-990-pro-1tb': ref(1099, 'https://detail.zol.com.cn/1426/1425885/price.shtml', '990 PRO无散热片1TB参考价，不混用散热片版669元。'),
  'library-ssd-t500-1tb': ref(629, t500, 'T500 1TB页面参考报价。'),
  'library-ssd-t500-500gb': ref(314.5, t500, '未取得500GB独立报价，按T500 1TB参考价629元×0.5估算，不保证容量与价格线性。', 'estimated', '同系列容量估算'),
  'library-ssd-t500-2tb': ref(1258, t500, '未取得2TB独立报价，按T500 1TB参考价629元×2估算，不保证容量与价格线性。', 'estimated', '同系列容量估算'),
  'library-ssd-sn850x-1tb': ref(659, 'https://ssd.zol.com.cn/manu_178.shtml', 'WD_BLACK SN850X无散热片1TB条目参考价。'),
}

export function withReferencePrice(option: PartOption): PartOption {
  const reference = referencePriceBook[option.id]
  if (!reference || option.referencePrice || option.priceSource || option.marketOffer || (option.price > 0 && !option.requiresQuote)) return option
  return { ...option, price: reference.amount, requiresQuote: false, referencePrice: reference,
    tag: reference.basis === 'estimated' ? '估算参考价 · 非店铺报价' : reference.basis === 'overseas' ? '海外参考价 · 非国内成交价' : '公开参考价 · 非实时售价' }
}
