import * as THREE from 'three'

interface Finish { color: string; metalness: number; roughness: number; opacity?: number }
const whiteCaseCoating: Finish = { color: '#E8ECF0', metalness: .25, roughness: .38 }
const fasciaMetal = /bead-blasted graphite|machined edge|dark perforation walls/

// Authored component finishes; chips, slot polymers, contact gold and rubber
// remain dark. Existing traces, solder and silkscreen get their own contrast.
function lightFinish(name: string, blade: boolean, support: boolean, fascia: boolean): Finish | undefined {
  // One painted shell, including the cut-hole walls. Real geometry/AO provides
  // the recess shading; a separate dark pigment must not tint the entire mesh.
  if (fascia && fasciaMetal.test(name)) return whiteCaseCoating
  if (/near-black multilayer solder mask/.test(name)) return { color: '#C9D2DC', metalness: .12, roughness: .48 }
  if (/brushed graphite armour/.test(name)) return { color: '#F1F3F6', metalness: .55, roughness: .30 }
  if (/Board.*machined chamfer/.test(name)) return { color: '#9CAEC2', metalness: .85, roughness: .25 }
  if (/covered copper routing/.test(name)) return { color: '#8B9EB2', metalness: .35, roughness: .44 }
  if (/understated silkscreen/.test(name)) return { color: '#475B72', metalness: 0, roughness: .65 }
  if (/solder and capacitor tops/.test(name)) return { color: '#96A8BD', metalness: .85, roughness: .28 }
  if (/ARGB.*diffuser/.test(name)) return { color: '#17283F', metalness: 0, roughness: .4 }
  // Painted carriers need a diffuse coating, not the near-conductor response
  // of bare titanium. Match the silver-white coating family, retaining cut edges.
  if (support && /powder-coated black steel/.test(name)) return { color: '#C7D2DE', metalness: .30, roughness: .43 }
  if (/powder-coated black steel/.test(name)) return whiteCaseCoating
  if (/Black powder-coated steel|satin edge trim/.test(name)) return { color: '#A7B3BF', metalness: .75, roughness: .32 }
  if (/bead-blasted graphite/.test(name)) return { color: '#DCE4ED', metalness: .28, roughness: .42 }
  if (/machined edge/.test(name)) return { color: '#DEE5EB', metalness: .8, roughness: .27 }
  if (/dark perforation walls/.test(name)) return { color: '#7D8B9B', metalness: .38, roughness: .48 }
  if (/graphite fan polymer|Graphite fan polymer/.test(name)) return { color: blade ? '#A8B8CA' : '#EDF0F4', metalness: blade ? .2 : .12, roughness: blade ? .36 : .4 }
  if (/unlit matte hub cap/.test(name)) return { color: '#A4AFBC', metalness: .25, roughness: .4 }
  if (/Anodized graphite GPU casing|black anodized casing/.test(name)) return { color: '#E3E9F0', metalness: .55, roughness: .27 }
  if (/Dark nickel cooling fins|dark aluminium fin stock/.test(name)) return { color: '#6E8199', metalness: .85, roughness: .34 }
  if (/woven black hose jacket/.test(name)) return { color: '#E2E5EB', metalness: .02, roughness: .68 }
  if (/Matte anthracite enclosure/.test(name)) return { color: '#BBC8D8', metalness: .65, roughness: .35 }
  if (/Black aluminium memory heat spreader/.test(name)) return { color: '#B8C4D0', metalness: .75, roughness: .32 }
  if (/satin machined fittings/.test(name)) return { color: '#B7C3D0', metalness: .85, roughness: .24 }
  if (/Neutral clear side glass/.test(name)) return { color: '#B5CCDF', metalness: 0, roughness: .12, opacity: .085 }
}

/** Mutate existing GPU materials in linear colour space; never reload the GLB. */
export function createPCMaterialThemes(root: THREE.Object3D) {
  const seen = new Set<THREE.Material>()
  const roleMaterials = new Map<string, THREE.MeshStandardMaterial>()
  const finishes: { material: THREE.MeshStandardMaterial; dark: { color: THREE.Color; metalness: number; roughness: number; opacity: number }; light: Finish; color: THREE.Color }[] = []
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    let blade = false, support = false, fascia = false
    for (let ancestor: THREE.Object3D | null = node; ancestor; ancestor = ancestor.parent) {
      if (ancestor.name.startsWith('Rotor_')) blade = true
      if (/^HW_(bottom_tray|side_tray|front_fan_carrier)$/.test(ancestor.name)) support = true
      if (ancestor.name === 'HW_fascia') fascia = true
    }
    // Fan parts and the fascia share source materials with other hardware.
    // Clone only role-specific finishes, never geometry, textures or the model.
    const withRole = (m: THREE.Material) => {
      if (!(m instanceof THREE.MeshStandardMaterial) || !(fascia && fasciaMetal.test(m.name) || blade && /[Gg]raphite fan polymer/.test(m.name) || support && /powder-coated black steel/.test(m.name))) return m
      const key = `${m.uuid}/${fascia ? 'fascia' : blade ? 'blade' : 'support'}`
      let clone = roleMaterials.get(key)
      if (!clone) { clone = m.clone(); roleMaterials.set(key, clone) }
      return clone
    }
    node.material = Array.isArray(node.material) ? node.material.map(withRole) : withRole(node.material)
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || seen.has(material)) continue
      seen.add(material)
      const light = lightFinish(material.name, blade, support, fascia)
      if (light) finishes.push({ material, light, color: new THREE.Color(light.color), dark: {
        color: material.color.clone(), metalness: material.metalness, roughness: material.roughness, opacity: material.opacity,
      } })
    }
  })
  return (mix: number) => {
    for (const { material, dark, light, color } of finishes) {
      material.color.lerpColors(dark.color, color, mix)
      material.metalness = THREE.MathUtils.lerp(dark.metalness, light.metalness, mix)
      material.roughness = THREE.MathUtils.lerp(dark.roughness, light.roughness, mix)
      material.opacity = THREE.MathUtils.lerp(dark.opacity, light.opacity ?? dark.opacity, mix)
    }
  }
}
