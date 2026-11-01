import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import postcss from 'postcss'
import { parse } from '@vue/compiler-sfc'
import { lightColor, themeColors } from './theme-colors.mjs'

// Verify the pre-paint bootstrap, including inaccessible local storage.
for (const [saved, expected] of [['light', 'light'], ['dark', 'dark'], ['invalid', 'dark'], [null, 'dark']]) {
  const document = { documentElement: { dataset: {}, style: {} } }
  vm.runInNewContext(fs.readFileSync('public/theme-init.js', 'utf8'), { document, localStorage: { getItem: () => saved } })
  assert.equal(document.documentElement.dataset.theme, expected)
  assert.equal(document.documentElement.style.colorScheme, expected)
}
const restricted = { documentElement: { dataset: {}, style: {} } }
vm.runInNewContext(fs.readFileSync('public/theme-init.js', 'utf8'), { document: restricted, localStorage: { getItem() { throw new Error('denied') } } })
assert.equal(restricted.documentElement.dataset.theme, 'dark')
const css = '.card { background: #090909; color: #eee; border: 1px solid #333; box-shadow: 0 2px 5px #0008; --text-muted: #999; mask-image: linear-gradient(#000, transparent); background-image: url("/white-logo.svg"); } .saving { color: #a6cab9; } .cost { color: #ff6464; }'
const processed = (await postcss([themeColors()]).process(css, { from: 'fixture.css' })).css
assert.match(processed, /background: light-dark\(rgb\(247 248 250\), #090909\)/)
assert.match(processed, /color: light-dark\(rgb\(28 35 42\), #eee\)/)
assert.match(processed, /mask-image: linear-gradient\(#000, transparent\)/)
assert.match(processed, /url\("\/white-logo.svg"\)/)
assert.match(processed, /, #a6cab9\)/)
assert.match(processed, /, #ff6464\)/)
assert.equal((await postcss([themeColors()]).process(css, { from: 'src/components/ThemeToggle.vue' })).css, css)
assert.equal((await postcss([themeColors()]).process(css, { from: 'src/assets/styles/theme.css' })).css, css)
assert.equal(lightColor('rgba(255,255,255,0.1)', 'surface'), 'rgb(30 40 50 / 0.1)')
let styles = 0
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`])
}
for (const file of walk('src')) {
  const source = fs.readFileSync(file, 'utf8')
  const blocks = file.endsWith('.css') ? [source] : file.endsWith('.vue') ? parse(source).descriptor.styles.map(style => style.content) : []
  for (const block of blocks) {
    const output = await postcss([themeColors()]).process(block, { from: file })
    assert.equal(output.warnings().length, 0, file)
    postcss.parse(output.css)
    styles++
  }
}
console.log(`PASS: saved/default/restricted theme bootstrap, light/dark color pairs, semantic colors, image/mask preservation and ${styles} site style blocks.`)
