// Pair existing CSS colors with a light palette, preserving each exact dark value.
// This operates on CSS declarations only, never images, SVG attributes or model data.
const colorPattern = /#[\da-f]{3,8}\b|rgba?\([\d\s.,/%]+\)|\b(?:white|black)\b/gi
function channels(value) {
  if (/^(white|black)$/i.test(value)) return [...Array(3).fill(value.toLowerCase() === 'white' ? 255 : 0), 1]
  if (value.startsWith('#')) {
    let hex = value.slice(1)
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(char => char + char).join('')
    if (hex.length !== 6 && hex.length !== 8) return null
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1]
  }
  const parts = value.match(/[\d.]+%?/g)
  if (!parts || parts.length < 3) return null
  return parts.map((part, index) => part.endsWith('%') ? parseFloat(part) * (index < 3 ? 2.55 : .01) : Number(part)).concat(parts.length === 3 ? [1] : [])
}
function luminance(rgb) {
  return rgb.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
}
export function lightColor(value, role) {
  const parsed = channels(value)
  if (!parsed) return value
  let rgb = parsed.slice(0, 3), alpha = parsed[3]
  const average = rgb.reduce((sum, channel) => sum + channel, 0) / 3
  const neutral = Math.max(...rgb) - Math.min(...rgb) <= 28
  if (role === 'shadow') { rgb = [35, 45, 55]; alpha *= .18 }
  else if (role === 'border') rgb = neutral ? [average > 170 ? 147 : 212, average > 170 ? 159 : 219, average > 170 ? 170 : 226] : rgb
  else if (role === 'surface') {
    if (neutral && alpha < .5 && average > 200) rgb = [30, 40, 50]
    else if (neutral && average < 18) rgb = [247, 248, 250]
    else if (neutral && average < 35) rgb = [255, 255, 255]
    else if (neutral && average < 100) rgb = [238, 241, 244]
    else if (!neutral && average < 170) rgb = rgb.map(channel => channel * .1 + 255 * .9)
  } else {
    if (neutral) rgb = average > 205 ? [28, 35, 42] : average > 150 ? [83, 93, 103] : average > 95 ? [99, 110, 121] : rgb
    else while ((1.02 / (luminance(rgb) + .05)) < 4.5) rgb = rgb.map(channel => channel * .9)
  }
  const output = rgb.map(channel => Math.round(channel))
  return alpha < 1 ? `rgb(${output.join(' ')} / ${Number(alpha.toFixed(3))})` : `rgb(${output.join(' ')})`
}
function roleFor(property, selector) {
  if (/shadow/.test(property)) return 'shadow'
  if (/scrollbar-thumb/.test(selector)) return 'text'
  if (/border|outline|line$/.test(property)) return 'border'
  if (/background|^--bg|gradient|fill|surface/.test(property)) return 'surface'
  if (/color|^--text|^--nb-(muted|accent)|stroke/.test(property)) return 'text'
  return null
}
export function themeColors() {
  return {
    postcssPlugin: 'nexbuild-theme-colors',
    Once(root) {
      if (/ThemeToggle\.vue|[\\/]theme\.css/.test(root.source?.input.file ?? '')) return
      root.walkDecls(declaration => {
        const role = roleFor(declaration.prop, declaration.parent.selector ?? '')
        if (!role || /url\(|light-dark\(/i.test(declaration.value)) return
        let index = 0
        declaration.value = declaration.value.replace(colorPattern, value => {
          const actualRole = declaration.prop === 'scrollbar-color' ? (index++ ? 'surface' : 'text') : role
          return `light-dark(${lightColor(value, actualRole)}, ${value})`
        })
      })
    },
  }
}
