import nvidiaSvg from '../../assets/brands/nvidia.svg?raw'
import asusSvg from '../../assets/brands/asus.svg?raw'
import gigabyteSvg from '../../assets/brands/gigabyte.svg?raw'
import amdSvg from '../../assets/brands/amd.svg?raw'
import intelSvg from '../../assets/brands/intel.svg?raw'
import msiSvg from '../../assets/brands/msi.svg?raw'
import corsairSvg from '../../assets/brands/corsair.svg?raw'
import kingstontechnologySvg from '../../assets/brands/kingstontechnology.svg?raw'
import samsungSvg from '../../assets/brands/samsung.svg?raw'
import seagateSvg from '../../assets/brands/seagate.svg?raw'
import coolermasterSvg from '../../assets/brands/coolermaster.svg?raw'
import razerSvg from '../../assets/brands/razer.svg?raw'
import nzxtSvg from '../../assets/brands/nzxt.svg?raw'
import deepcoolSvg from '../../assets/brands/deepcool.svg?raw'
import acerSvg from '../../assets/brands/acer.svg?raw'
import dellSvg from '../../assets/brands/dell.svg?raw'

export async function createCubeBrandTextures(): Promise<HTMLCanvasElement[]> {
  const brands = [
    { name: 'NVIDIA', svg: nvidiaSvg, color: '#76b900', viewBox: '0 3 24 18' },
    { name: 'ASUS', svg: asusSvg, color: '#00539b', viewBox: '0 8.5 24 7' },
    { name: 'GIGABYTE', svg: gigabyteSvg, color: '#005daa', viewBox: null },
    { name: "AMD", svg: amdSvg, color: '#ED1C24', viewBox: null },
    { name: "Intel", svg: intelSvg, color: '#0071C5', viewBox: null },
    { name: "MSI", svg: msiSvg, color: '#FF0000', viewBox: null },
    { name: "Corsair", svg: corsairSvg, color: '#231F20', viewBox: null },
    { name: "Kingston Technology", svg: kingstontechnologySvg, color: '#000000', viewBox: null },
    { name: "Samsung", svg: samsungSvg, color: '#1428A0', viewBox: null },
    { name: "Seagate", svg: seagateSvg, color: '#6EBE49', viewBox: null },
    { name: "Cooler Master", svg: coolermasterSvg, color: '#1E1E28', viewBox: null },
    { name: "Razer", svg: razerSvg, color: '#00FF00', viewBox: null },
    { name: "NZXT", svg: nzxtSvg, color: '#000000', viewBox: null },
    { name: "DeepCool", svg: deepcoolSvg, color: '#068584', viewBox: null },
    { name: "Acer", svg: acerSvg, color: '#83B81A', viewBox: null },
    { name: "Dell", svg: dellSvg, color: '#007DB8', viewBox: null },
  ]
  return Promise.all(brands.map(async brand => {
    const document = new DOMParser().parseFromString(brand.svg, 'image/svg+xml')
    const svg = document.documentElement
    svg.setAttribute('fill', brand.color)
    if (brand.viewBox) svg.setAttribute('viewBox', brand.viewBox)
    const [, , width = 24, height = 24] = (svg.getAttribute('viewBox') ?? '0 0 24 24').split(/\s+/).map(Number)
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
    await image.decode()
    const texture = window.document.createElement('canvas')
    texture.dataset.brand = brand.name
    texture.width = texture.height = 128
    const context = texture.getContext('2d')!
    // Keep the logo background transparent so the shaded cube face stays uniform.
    const scale = Math.min(108 / width, 90 / height)
    const logoWidth = width * scale
    const logoHeight = height * scale
    context.drawImage(image, (128 - logoWidth) / 2, (128 - logoHeight) / 2, logoWidth, logoHeight)
    return texture
  }))
}
