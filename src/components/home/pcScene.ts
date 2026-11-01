import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createPCGlow } from './pcGlow'
import { sampleShowcase, showcaseTiming } from './pcTimeline'
import { createPCMaterialThemes } from './pcMaterials'

interface RigEntry {
  name: string
  start: [number, number, number]
  end: [number, number, number]
  quaternion: [number, number, number, number]
  interval: [number, number]
  carrier?: { delta: [number, number, number]; interval: [number, number] }[]
}
interface Rig { groups: RigEntry[]; hoseSteps: number; rotors?: { name: string; axis: [number, number, number] }[] }
interface Options {
  ready: () => void; failed: () => void; model?: () => Promise<ArrayBuffer>
  decoder?: () => Promise<{ js: string; wasm: string; dispose: () => void } | undefined>
}
const smooth = (p: number, a: number, b: number) => {
  const t = THREE.MathUtils.clamp((p - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** One reusable pose rig, driven by a visibility-aware automatic 25s clock. */
export async function createPCScene(host: HTMLElement, options: Options) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  const mobile = matchMedia('(max-width: 900px)').matches
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setClearColor(0x000000, 0)
  renderer.info.autoReset = false
  renderer.shadowMap.enabled = !mobile
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  const glow = mobile ? null : createPCGlow(renderer)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, .01, 20)
  const modelRoot = new THREE.Group()
  scene.add(modelRoot)
  const room = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(room, .04)
  scene.environment = environment.texture
  room.dispose(); pmrem.dispose()
  const hemi = new THREE.HemisphereLight(0xdde7ff, 0x343141, .5)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xe9eeff, 4)
  key.position.set(-1, 2, 3); scene.add(key)
  const darkKeyPosition = key.position.clone(), lightKeyPosition = new THREE.Vector3(-2, 3, 1.4)
  key.castShadow = !mobile; key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom = -.8
  key.shadow.camera.right = key.shadow.camera.top = .8
  key.shadow.camera.near = .1; key.shadow.camera.far = 7
  key.shadow.bias = -.00003; key.shadow.normalBias = .0003
  const rim = new THREE.DirectionalLight(0x8594dd, 2.5)
  rim.position.set(2, 1, -1); scene.add(rim)
  const fill = new THREE.DirectionalLight(0xc6deff, .65)
  fill.position.set(-2, .2, 1); scene.add(fill)
  // Neutral front-side softbox: the opposite-side key cannot illuminate the
  // intake's +X facing sheet. Finite falloff and a feathered cone preserve depth.
  const panelFill = new THREE.SpotLight(0xf3f7ff, 0, 1.8, Math.PI / 3, .85, 2)
  panelFill.position.set(1.05, .36, .30); panelFill.target.position.set(.25, .06, .02)
  panelFill.castShadow = false; scene.add(panelFill, panelFill.target)
  const decoder = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}models/draco/`).setWorkerLimit(2)
  let releaseDecoder: (() => void) | undefined
  const loader = new GLTFLoader().setDRACOLoader(decoder)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let destroyed = false, loaded = false, visible = true, raf = 0, previous = 0
  let width = 1, height = 1, progress: number = showcaseTiming.halfProgress, lastPoseProgress = -1
  let elapsed = 0
  let nextFrameAt = 0, lastShadowAt = -Infinity, posedProgress = -1
  let object: THREE.Group | null = null
  const tracks: { object: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; rotation: THREE.Quaternion; entry: RigEntry }[] = []
  const hoses: THREE.Mesh[] = []
  const emitters: { material: THREE.MeshStandardMaterial; strength: number; phase: number; stable: boolean }[] = []
  const rotors: { object: THREE.Object3D; axis: THREE.Vector3; rest: THREE.Quaternion; speed: number }[] = []
  const lightTime = { value: 0 }
  const rgbTheme = { value: 0 }
  const spills: { light: THREE.PointLight; strength: number; phase: number; stable: boolean }[] = []
  const bounds = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3()
  const cameraDirection = new THREE.Vector3(1.12, 1.12, 1.7).normalize()
  const cameraTarget = new THREE.Vector3(-.055, .11, .06)
  let previewDistance: number | null = null
  const identity = new THREE.Quaternion()
  const spinQuaternion = new THREE.Quaternion()
  const budgetSamples: number[] = []
  let qualityLevel = 0
  let themeMix = document.documentElement.dataset.theme === 'light' ? 1 : 0
  let themeFrom = themeMix, themeTarget = themeMix, themeStarted = 0
  let applyMaterials: ((mix: number) => void) | undefined
  const palettes: { a: THREE.Color; b: THREE.Color; darkA: THREE.Color; darkB: THREE.Color; lightA: THREE.Color; lightB: THREE.Color }[] = []

  function applyTheme(mix: number) {
    applyMaterials?.(mix)
    rgbTheme.value = mix
    scene.environmentIntensity = THREE.MathUtils.lerp(.30, .38, mix)
    hemi.intensity = THREE.MathUtils.lerp(.35, .55, mix)
    key.intensity = THREE.MathUtils.lerp(2.4, 1.7, mix)
    key.position.lerpVectors(darkKeyPosition, lightKeyPosition, mix)
    rim.intensity = THREE.MathUtils.lerp(1.4, 1.6, mix)
    panelFill.intensity = .34 * mix
    // Bright painted faces expose shadow-map acne sooner than graphite. Keep
    // the dark calibration exact and offset the light studio shadow receiver.
    key.shadow.normalBias = THREE.MathUtils.lerp(.0003, .001, mix)
    key.shadow.bias = THREE.MathUtils.lerp(-.00003, -.000002, mix)
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.15, .92, mix)
    for (const p of palettes) {
      p.a.lerpColors(p.darkA, p.lightA, mix); p.b.lerpColors(p.darkB, p.lightB, mix)
    }
    glow?.setThemeMix(mix)
  }

  function theme() {
    themeFrom = themeMix
    themeTarget = document.documentElement.dataset.theme === 'light' ? 1 : 0
    themeStarted = performance.now()
    if (reduced.matches) { themeMix = themeTarget; applyTheme(themeMix) }
    schedule()
  }
  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight)
    // Preserve fine mesh/metal edges. Adapt cadence rather than image quality.
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 2))
    renderer.setSize(width, height, false)
    glow?.size(width, height)
    camera.aspect = width / height; camera.updateProjectionMatrix()
    schedule()
  }
  function setPose(value: number) {
    if (posedProgress === value) return
    posedProgress = value
    for (const track of tracks) {
      const t = smooth(value, ...track.entry.interval)
      track.object.position.lerpVectors(track.from, track.to, t)
      for (const shift of track.entry.carrier ?? []) {
        const amount = smooth(value, ...shift.interval)
        track.object.position.x += shift.delta[0] * amount
        track.object.position.y += shift.delta[1] * amount
        track.object.position.z += shift.delta[2] * amount
      }
      // Side panel first pulls out 70mm, then hinges away from the frame.
      track.object.quaternion.slerpQuaternions(identity, track.rotation,
        track.entry.name === 'HW_glass' ? smooth(t, .32, 1) : track.entry.name === 'HW_gpu' ? smooth(t, .48, 1) : t)
    }
    for (const hose of hoses) {
      const influences = hose.morphTargetInfluences
      if (!influences) continue
      influences.fill(0)
      const sample = value * 32, low = Math.floor(sample), high = Math.min(32, low + 1), mix = sample - low
      if (low > 0) influences[low - 1] = 1 - mix
      if (high > 0) influences[high - 1] = (influences[high - 1] ?? 0) + mix
    }
  }
  function schedule() {
    if (loaded && !raf && !destroyed && visible && !document.hidden) raf = requestAnimationFrame(paint)
  }
  function paint(now: number) {
    raf = 0
    if (destroyed || !visible || document.hidden) return
    // High-refresh monitors must not force a 165/240 Hz product renderer.
    const frameStep = 1000 / (mobile || qualityLevel === 2 ? 30 : 60)
    if (!reduced.matches && now + .5 < nextFrameAt) { schedule(); return }
    if (!nextFrameAt || now - nextFrameAt > frameStep * 4) nextFrameAt = now
    nextFrameAt += frameStep
    const dt = previous ? Math.min(100, now - previous) : 0; previous = now
    const themeProgress = reduced.matches ? 1 : smooth((now - themeStarted) / 800, 0, 1)
    const nextThemeMix = THREE.MathUtils.lerp(themeFrom, themeTarget, themeProgress)
    if (nextThemeMix !== themeMix) { themeMix = nextThemeMix; applyTheme(themeMix) }
    if (!reduced.matches) elapsed += dt / 1000
    const sample = sampleShowcase(elapsed)
    progress = reduced.matches ? showcaseTiming.halfProgress : sample.progress
    setPose(progress)
    modelRoot.position.y = reduced.matches ? 0 : Math.sin(elapsed * Math.PI * 2 / 6.4) * .004
    // Both flow rates complete an integer number of cycles in 1000 seconds.
    // Keep GPU time precise during long-running showcase sessions without a seam.
    lightTime.value = elapsed % 1000
    for (const rotor of rotors) rotor.object.quaternion.copy(rotor.rest).multiply(
      spinQuaternion.setFromAxisAngle(rotor.axis, (elapsed * rotor.speed) % (Math.PI * 2)))
    for (const emitter of emitters) emitter.material.emissiveIntensity = emitter.strength * THREE.MathUtils.lerp(1, .72, themeMix) *
      (reduced.matches || emitter.stable ? 1 : .92 + .08 * Math.sin(elapsed * 1.1 + emitter.phase))
    for (const spill of spills) spill.light.intensity = spill.strength * THREE.MathUtils.lerp(1, 2.0, themeMix) *
      (reduced.matches || spill.stable ? 1 : .92 + .08 * Math.sin(elapsed * 1.1 + spill.phase))
    const extent = THREE.MathUtils.lerp(.68, .97, smooth(progress, 0, 1))
    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const distance = import.meta.env.DEV && previewDistance !== null ? previewDistance : Math.max(extent / (2 * Math.tan(verticalFov / 2)), extent * .90 / (2 * Math.tan(verticalFov / 2) * camera.aspect)) * 1.10
    camera.position.copy(cameraTarget).addScaledVector(cameraDirection, distance)
    camera.lookAt(cameraTarget)
    const shadowStep = 1000 / (qualityLevel === 0 ? 30 : qualityLevel === 1 ? 20 : 15)
    if (now - lastShadowAt >= shadowStep || themeProgress < 1) {
      renderer.shadowMap.needsUpdate = true; lastShadowAt = now
    }
    const start = performance.now()
    renderer.info.reset()
    if (glow) glow.render(scene, camera)
    else renderer.render(scene, camera)
    if (loaded && qualityLevel < 2 && !reduced.matches) {
      budgetSamples.push(dt)
      if (budgetSamples.length === 40) {
        const average = budgetSamples.slice(8).reduce((a, b) => a + b, 0) / 32
        if (average > (qualityLevel === 0 ? 25 : 32)) {
          qualityLevel++
        }
        budgetSamples.length = 0
      }
    }
    if (import.meta.env.DEV) {
      host.dataset.progress = progress.toFixed(5)
      host.dataset.themeMix = themeMix.toFixed(4)
      host.dataset.drawCalls = String(renderer.info.render.calls)
      host.dataset.triangles = String(renderer.info.render.triangles)
      host.dataset.renderMs = (performance.now() - start).toFixed(2)
      host.dataset.elapsed = elapsed.toFixed(4)
      host.dataset.qualityLevel = String(qualityLevel)
      host.dataset.pixelRatio = renderer.getPixelRatio().toFixed(3)
      host.dataset.phase = sample.phase
      host.dataset.rotors = String(rotors.length)
      host.dataset.rotorAngle = (elapsed * (rotors[0]?.speed ?? 0)).toFixed(4)
      if (progress !== lastPoseProgress) {
        host.dataset.pose = JSON.stringify(tracks.map(track => [
          track.entry.name, ...track.object.position.toArray().map(v => +v.toFixed(6)),
          ...track.object.quaternion.toArray().map(v => +v.toFixed(6)),
        ]))
        lastPoseProgress = progress
      }
    }
    if (!reduced.matches || themeMix !== themeTarget) schedule()
  }
  function visibility() { previous = 0; nextFrameAt = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0 } else schedule() }
  function preferences() { previous = 0; nextFrameAt = 0; schedule() }
  function seek(event: Event) {
    const seconds = (event as CustomEvent<number>).detail
    if (Number.isFinite(seconds)) {
      elapsed = Math.max(0, seconds); previous = 0; schedule()
    }
  }
  // Local acceptance captures only.
  function preview(event: Event) {
    if (!import.meta.env.DEV) return
    const detail = (event as CustomEvent<{ part?: string; distance?: number; direction?: [number, number, number]; ao?: boolean; shadows?: boolean; bloom?: boolean } | null>).detail
    if (!detail) {
      cameraTarget.set(-.055, .11, .06); cameraDirection.set(1.12, 1.12, 1.7).normalize(); previewDistance = null
    } else {
      if (detail.ao !== undefined) glow?.setAOEnabled(detail.ao)
      if (detail.bloom !== undefined) glow?.setBloomEnabled(detail.bloom)
      if (detail.shadows !== undefined) {
        renderer.shadowMap.enabled = detail.shadows && !mobile
        object?.traverse(node => {
          if (node instanceof THREE.Mesh) for (const m of Array.isArray(node.material) ? node.material : [node.material]) m.needsUpdate = true
        })
      }
      const part = detail.part ? object?.getObjectByName(detail.part) : null
      if (part) { object?.updateMatrixWorld(true); bounds.setFromObject(part); bounds.getCenter(cameraTarget) }
      if (detail.direction?.every(Number.isFinite) && detail.direction.some(v => v !== 0)) cameraDirection.fromArray(detail.direction).normalize()
      previewDistance = Number.isFinite(detail.distance) ? THREE.MathUtils.clamp(detail.distance!, .25, 4) : null
    }
    const finishes: object[] = []
    for (const name of ['HW_fascia', 'HW_front_fan_carrier', 'HW_side_tray']) object?.getObjectByName(name)?.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (m instanceof THREE.MeshStandardMaterial) {
        finishes.push({ part: name, name: m.name, color: m.color.getHexString(), metalness: m.metalness, roughness: m.roughness, aoMap: !!m.aoMap, normalMap: !!m.normalMap, side: m.side })
      }
    })
    host.dataset.lightingAudit = JSON.stringify({ finishes, exposure: renderer.toneMappingExposure, shadowBias: key.shadow.bias, normalBias: key.shadow.normalBias })
    schedule()
  }
  function contextLost(event: Event) {
    event.preventDefault(); cancelAnimationFrame(raf); raf = 0; options.failed(); dispose()
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false
    if (!visible) { cancelAnimationFrame(raf); raf = 0; previous = 0; nextFrameAt = 0 } else schedule()
  }, { rootMargin: '100px' })
  const resize = new ResizeObserver(measure)
  observer.observe(host); resize.observe(host)
  window.addEventListener('resize', measure)
  window.addEventListener('nexbuild-theme-change', theme)
  document.addEventListener('visibilitychange', visibility)
  reduced.addEventListener('change', preferences)
  if (import.meta.env.DEV) {
    host.addEventListener('nexbuild-showcase-seek', seek)
    host.addEventListener('nexbuild-showcase-preview', preview)
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)

  function disposeObject(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
    const geometries = new Set<THREE.BufferGeometry>()
    root.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      geometries.add(node.geometry)
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
      }
    })
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose())
  }
  const dispose = () => {
    if (destroyed) return
    destroyed = true; cancelAnimationFrame(raf); observer.disconnect(); resize.disconnect()
    window.removeEventListener('resize', measure)
    window.removeEventListener('nexbuild-theme-change', theme)
    document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', preferences)
    if (import.meta.env.DEV) {
      host.removeEventListener('nexbuild-showcase-seek', seek)
      host.removeEventListener('nexbuild-showcase-preview', preview)
    }
    renderer.domElement.removeEventListener('webglcontextlost', contextLost)
    if (object) disposeObject(object)
    decoder.dispose(); releaseDecoder?.(); environment.dispose(); glow?.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
  }
  theme(); measure()
  // Return cleanup immediately: navigating away while GLB is loading is safe.
  void Promise.all([
    Promise.all([options.decoder?.().then(resources => {
      if (!resources) return
      if (destroyed) { resources.dispose(); throw new DOMException('Disposed', 'AbortError') }
      releaseDecoder = resources.dispose
      decoder.setDecoderPath({ js: resources.js, wasm: resources.wasm })
    }), options.model?.()]).then(([, data]) => {
      return data ? loader.parseAsync(data, new URL(`${import.meta.env.BASE_URL}models/nexbuild/`, location.href).href)
        : loader.loadAsync(`${import.meta.env.BASE_URL}models/nexbuild/pc-hardware.glb`)
    }),
    fetch(`${import.meta.env.BASE_URL}models/nexbuild/rig.json`).then(response => {
      if (!response.ok) throw new Error('Hardware rig unavailable')
      return response.json() as Promise<Rig>
    }),
  ]).then(([gltf, rig]) => {
    decoder.dispose()
    releaseDecoder?.(); releaseDecoder = undefined
    if (destroyed) { disposeObject(gltf.scene); return }
    object = gltf.scene
    for (const [index, rotor] of (rig.rotors ?? []).entries()) {
      const part = object.getObjectByName(rotor.name)
      if (!part) throw new Error(`Missing fan rotor: ${rotor.name}`)
      rotors.push({ object: part, axis: new THREE.Vector3(...rotor.axis), rest: part.quaternion.clone(), speed: (Math.PI * 2 / 2.2) * (1 + index % 3 * .08) })
    }
    for (const entry of rig.groups) {
      const part = object.getObjectByName(entry.name)
      if (!part) throw new Error(`Missing independent hardware: ${entry.name}`)
      tracks.push({ object: part, from: new THREE.Vector3(...entry.start), to: new THREE.Vector3(...entry.end),
        rotation: new THREE.Quaternion(...entry.quaternion), entry })
    }
    const cloned = new Map<string, THREE.MeshStandardMaterial>()
    object.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      node.castShadow = true; node.receiveShadow = true
      node.frustumCulled = !node.morphTargetInfluences
      if (node.morphTargetInfluences) hoses.push(node)
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue
        // Physical transmission is expensive and obscures the interior on small
        // screens. Keep glass real and subtle through alpha + specular edges.
        if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > .5) {
          mat.transmission = 0; mat.transparent = true; mat.opacity = .055
          mat.color.setRGB(.025, .035, .05); mat.envMapIntensity = .25
          mat.depthWrite = false; mat.roughness = .12; mat.side = THREE.FrontSide; mat.needsUpdate = true
          node.castShadow = false; node.receiveShadow = false
        }
        if (mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) {
          // Shared source material is cloned per hardware for independent pulses.
          let ancestor: THREE.Object3D | null = node.parent
          while (ancestor?.parent && !ancestor.name.startsWith('HW_')) ancestor = ancestor.parent
          const hardware = ancestor?.name ?? node.name
          const cloneKey = `${hardware}/${mat.uuid}`
          let clone = cloned.get(cloneKey)
          if (!clone) {
            clone = mat.clone(); cloned.set(cloneKey, clone)
            const stable = hardware === 'HW_pump'
            const bottom = hardware.includes('bottom'), side = hardware.includes('side'), memory = hardware.includes('ram')
            const a = new THREE.Color().setRGB(...(stable ? [.45,.65,.85] : bottom ? [.05,.40,.85] : [.28,.09,.85]) as [number,number,number])
            const b = new THREE.Color().setRGB(...(stable ? [.65,.80,1] : bottom ? [.12,.65,1] : side ? [.09,.40,.85] : [.08,.50,1]) as [number,number,number])
            palettes.push({ a, b, darkA: a.clone(), darkB: b.clone(),
              lightA: new THREE.Color().setRGB(...(stable ? [.025,.32,.85] : [.14,.045,.75]) as [number,number,number]),
              lightB: new THREE.Color().setRGB(.008,.34,1) })
            clone.onBeforeCompile = shader => {
              shader.uniforms.pcLightTime = lightTime
              shader.uniforms.pcRGBTheme = rgbTheme
              shader.uniforms.pcPaletteA = { value: a }; shader.uniforms.pcPaletteB = { value: b }
              shader.uniforms.pcFlowSpeed = { value: stable ? 0 : memory ? .018 : .035 }
              shader.fragmentShader = 'uniform float pcLightTime; uniform float pcFlowSpeed; uniform float pcRGBTheme; uniform vec3 pcPaletteA; uniform vec3 pcPaletteB;\n' + shader.fragmentShader
              shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
                #ifdef USE_EMISSIVEMAP
                  float band=.5+.5*sin(6.2831853*(vEmissiveMapUv.x-pcLightTime*pcFlowSpeed));
                  totalEmissiveRadiance*=mix(pcPaletteA,pcPaletteB,band);
                #endif`)
              // Keep emissive diffusers coloured in a bright studio: the white
              // plastic's reflected light must not wash out its own RGB source.
              shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
                outgoingLight=mix(outgoingLight,totalEmissiveRadiance+(outgoingLight-totalEmissiveRadiance)*.025,pcRGBTheme);
                #include <opaque_fragment>`)
            }
            clone.customProgramCacheKey = () => 'nexbuild-rgb-flow-v1'
            emitters.push({ material: clone, strength: clone.emissiveIntensity * (stable ? .65 : .85), phase: emitters.length * .75, stable })
          }
          if (Array.isArray(node.material)) node.material = node.material.map(m => m === mat ? clone : m)
          else node.material = clone
        }
      }
    })
    for (const [name, color, strength] of [
      ['HW_pump', 0xb5ddff, .035], ['HW_radiator', 0x709dff, .035],
      ['HW_gpu', 0x7e89ff, .025], ['HW_ram_1', 0x77cfff, .020],
      ['HW_bottom_fan_1', 0x55bfff, .018], ['HW_side_fan_2', 0x996fff, .018],
    ] as const) {
      const part = object.getObjectByName(name)
      if (!part) continue
      bounds.setFromObject(part); bounds.getCenter(centre); bounds.getSize(size)
      const light = new THREE.PointLight(color, strength, .28, 2)
      light.position.copy(centre).add(new THREE.Vector3(0, .015, .035))
      part.add(light); spills.push({ light, strength, phase: spills.length * .8, stable: name === 'HW_pump' })
    }
    applyMaterials = createPCMaterialThemes(object)
    applyTheme(themeMix)
    modelRoot.add(object); setPose(showcaseTiming.halfProgress)
    // compileAsync warms shaders without blocking the first frame behind poster.
    return renderer.compileAsync(scene, camera).then(() => {
      if (destroyed) return
      loaded = true; measure(); options.ready(); schedule()
    })
  }).catch(error => {
    if (import.meta.env.DEV) console.warn('NexBuild 3D fallback:', error)
    if (!destroyed) { options.failed(); dispose() }
  })
  return { dispose, resize: measure }
}
