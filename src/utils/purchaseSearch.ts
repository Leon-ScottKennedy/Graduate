export function purchaseSearchLinks(name: string, specs = '') {
  const model = name.trim().replace(/\s+/g, ' ')
  const capacity = specs.match(/\b\d+\s*(?:GB|TB)\b/i)?.[0]
  const keyword = capacity && !/\d+\s*(?:GB|TB|G)\b/i.test(model) ? `${model} ${capacity}` : model
  return [
    { platform: 'jd', label: '前往京东搜索', url: `https://search.jd.com/Search?keyword=${encodeURIComponent(keyword)}` },
    { platform: 'taobao', label: '前往淘宝搜索', url: `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}` },
  ]
}
