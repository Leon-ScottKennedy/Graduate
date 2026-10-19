import type { PartOption } from '../types/hardware'

// Verified model/specification references. Zero is an internal missing-price sentinel,
// never a free product: these models require a recorded quote before replacement.
const amd9000 = 'https://www.amd.com/en/partner/articles/ryzen-9000-series-processors.html'
const amd7000 =
  'https://ir.amd.com/news-events/press-releases/detail/1089/amdlaunches-ryzen-7000-series-desktop-processors-with-zen-4-architecture-the-fastest-core-in-gaming'
const amdX3D =
  'https://www.amd.com/content/dam/amd/en/documents/partner-hub/ryzen/amd-ryzen-7000x3d-series-gaming-processor-how-to-sell-guide-generational.pdf'
const amdG = 'https://www.amd.com/en/partner/articles/ryzen-8000G-series-processors.html'
const intel = 'https://cdrdv2-public.intel.com/843205/Gaming_CPU_Reference_Sheet.pdf'
const entry = (
  id: string,
  brand: string,
  name: string,
  specs: string,
  specSource: string,
  compatibility?: PartOption['compatibility'],
): PartOption => ({
  id: `library-${id}`,
  brand,
  name,
  specs,
  specSource,
  compatibility,
  price: 0,
  requiresQuote: true,
  tag: '官方型号资料 · 价格待录入',
})
const cpu = (model: string, socket: string, source: string, brand = 'AMD') =>
  entry(
    `cpu-${model.toLowerCase()}`,
    brand,
    `${brand} ${model}`,
    `${socket} · 内存及 BIOS 支持需核对主板`,
    source,
    { socket },
  )
const msi = (model: string, memory: string, source?: string) =>
  entry(
    `gpu-${model.toLowerCase().replace(/\s+/g, '-')}`,
    '微星 MSI',
    `微星 ${model}`,
    `${memory} · 显卡尺寸及供电接口待核验`,
    source ?? `https://www.msi.com/Graphics-Card/${model.replace(/\s+/g, '-')}`,
  )
const ssd = (id: string, brand: string, name: string, capacity: string, source: string) =>
  entry(`ssd-${id}`, brand, name, `${capacity} · M.2 NVMe · PCIe 4.0`, source)
export const hardwareExpansion: Record<string, PartOption[]> = {
  cpu: [
    cpu('Ryzen 5 9600X', 'AM5', amd9000),
    cpu('Ryzen 7 9700X', 'AM5', amd9000),
    cpu('Ryzen 9 9900X', 'AM5', amd9000),
    cpu(
      'Ryzen 9 9900X3D',
      'AM5',
      'https://www.amd.com/content/dam/amd/en/documents/partner-hub/ryzen/amd-ryzen-9000-series-quick-reference-guide-non-competitive.pdf',
    ),
    cpu(
      'Ryzen 9 9950X3D',
      'AM5',
      'https://www.amd.com/content/dam/amd/en/documents/partner-hub/ryzen/amd-ryzen-9000-series-quick-reference-guide-non-competitive.pdf',
    ),
    cpu('Ryzen 7 8700G', 'AM5', amdG),
    cpu('Ryzen 5 8500G', 'AM5', amdG),
    cpu('Ryzen 5 7600X', 'AM5', amd7000),
    cpu('Ryzen 9 7900X3D', 'AM5', amdX3D),
    cpu('Ryzen 9 7950X3D', 'AM5', amdX3D),
    cpu('Core i5-14600K', 'LGA1700', intel, 'Intel'),
    cpu('Core i7-14700K', 'LGA1700', intel, 'Intel'),
    cpu('Core i9-14900K', 'LGA1700', intel, 'Intel'),
  ],
  gpu: [
    msi('GeForce RTX 5070 12G VENTUS 3X OC', '12GB GDDR7'),
    msi('GeForce RTX 5070 12G VENTUS 2X OC', '12GB GDDR7'),
    msi('GeForce RTX 5070 12G SHADOW 3X OC', '12GB GDDR7'),
    msi('GeForce RTX 5070 12G SHADOW 2X OC', '12GB GDDR7'),
    msi('GeForce RTX 5070 12G INSPIRE 3X OC', '12GB GDDR7'),
    msi('GeForce RTX 5060 8G VENTUS 2X OC', '8GB GDDR7'),
    msi('GeForce RTX 5060 8G VENTUS 3X OC', '8GB GDDR7'),
    msi('GeForce RTX 5060 Ti 16G VENTUS 2X OC PLUS', '16GB GDDR7'),
    msi('GeForce RTX 5070 Ti 16G VENTUS 3X OC', '16GB GDDR7'),
  ],
  ssd: [
    ssd(
      '990-pro-1tb',
      '三星 Samsung',
      '三星 990 PRO 1TB',
      '1TB',
      'https://www.samsung.com/uk/memory-storage/nvme-ssd/990-pro-1tb-nvme-pcie-gen-4-mz-v9p1t0bw/',
    ),
    ...['500GB', '1TB', '2TB'].map((capacity) =>
      ssd(
        `t500-${capacity.toLowerCase()}`,
        '英睿达 Crucial',
        `英睿达 T500 ${capacity}`,
        capacity,
        'https://www.crucial.com/content/dam/crucial/ssd-products/t500/flyers/b2c/crucial-T500-b2c-product-flyer-en_combination.pdf',
      ),
    ),
    ...['512GB', '1TB', '4TB'].map((capacity) =>
      ssd(
        `kc3000-${capacity.toLowerCase()}`,
        '金士顿 Kingston',
        `金士顿 KC3000 ${capacity}`,
        capacity,
        'https://www.kingston.com/ssd/kc3000-nvme-m2-solid-state-drive',
      ),
    ),
    ssd(
      'sn850x-1tb',
      '西部数据 WD',
      '西部数据 WD_BLACK SN850X 1TB',
      '1TB',
      'https://www.sandisk.com/en-us/products/ssd/internal-ssd/wd-black-sn850x-nvme-ssd',
    ),
  ],
}
