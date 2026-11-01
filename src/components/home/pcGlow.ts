import * as THREE from 'three'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'

/** HDR colour-aware glow and optional light-studio contact occlusion.
 * Preserve alpha so the existing background grid remains visible. */
export function createPCGlow(renderer: THREE.WebGLRenderer) {
  const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
  const base = target(), bright = target(), blur = target()
  const aoTarget = target()
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  white.needsUpdate = true
  let ao: SSAOPass | null = null, aoEnabled = true, themeMix = 0
  const glass: THREE.Mesh[] = []
  base.depthBuffer = true
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const vertexShader = 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}'
  const extract = new THREE.ShaderMaterial({ vertexShader, toneMapped: false,
    uniforms: { image: { value: base.texture }, theme: { value: 0 } }, fragmentShader: `
    varying vec2 vUv; uniform sampler2D image; uniform float theme;
    void main(){vec4 source=texture2D(image,vUv);vec3 c=source.rgb; float v=max(c.r,max(c.g,c.b));
      float saturation=(v-min(c.r,min(c.g,c.b)))/max(v,.0001);
      float lightGate=max(smoothstep(.28,.62,saturation),smoothstep(2.5,3.5,v));
      float weight=mix(smoothstep(.85,1.8,v),smoothstep(.65,1.6,v)*lightGate,theme);
      // Real opaque hardware is the bloom source. A faint reflection across an
      // otherwise transparent glass pane must not bloom over the page behind it.
      gl_FragColor=vec4(c*weight*smoothstep(.18,.82,source.a),1.);}` })
  const soften = new THREE.ShaderMaterial({ vertexShader, toneMapped: false,
    uniforms: { image: { value: bright.texture }, direction: { value: new THREE.Vector2() } }, fragmentShader: `
    varying vec2 vUv; uniform sampler2D image; uniform vec2 direction;
    void main(){vec3 c=texture2D(image,vUv).rgb*.227027;
      c+=texture2D(image,vUv+direction*1.384615).rgb*.316216;
      c+=texture2D(image,vUv-direction*1.384615).rgb*.316216;
      c+=texture2D(image,vUv+direction*3.230769).rgb*.070270;
      c+=texture2D(image,vUv-direction*3.230769).rgb*.070270;
      gl_FragColor=vec4(c,1.);}` })
  const composite = new THREE.ShaderMaterial({ vertexShader, depthTest: false, depthWrite: false,
    uniforms: { image: { value: base.texture }, glow: { value: bright.texture }, strength: { value: .20 }, bloomEnabled: { value: 1 }, edgeStep: { value: new THREE.Vector2() }, ao: { value: white as THREE.Texture }, aoStrength: { value: 0 } }, fragmentShader: `
    varying vec2 vUv; uniform sampler2D image; uniform sampler2D glow; uniform float strength; uniform float bloomEnabled; uniform vec2 edgeStep; uniform sampler2D ao; uniform float aoStrength;
    float coverage(vec2 uv){return smoothstep(.18,.82,texture2D(image,uv).a);}
    void main(){vec4 b=texture2D(image,vUv);
      float core=smoothstep(.18,.82,b.a);
      float edge=core;
      vec3 rawGlow=texture2D(glow,vUv).rgb*strength*bloomEnabled;
      // Neighbour coverage can never exceed 1. For core >= .35 the
      // existing max(core, .35 * edge) is already exactly core.
      if(core < .35 && max(rawGlow.r,max(rawGlow.g,rawGlow.b)) > 0.) {
      edge=max(edge,coverage(vUv+vec2(edgeStep.x,0.)));
      edge=max(edge,coverage(vUv-vec2(edgeStep.x,0.)));
      edge=max(edge,coverage(vUv+vec2(0.,edgeStep.y)));
      edge=max(edge,coverage(vUv-vec2(0.,edgeStep.y)));
      edge=max(edge,coverage(vUv+edgeStep));edge=max(edge,coverage(vUv-edgeStep));
      edge=max(edge,coverage(vUv+vec2(edgeStep.x,-edgeStep.y)));
      edge=max(edge,coverage(vUv+vec2(-edgeStep.x,edgeStep.y)));
      }
      // Preserve full internal glow and a feathered 1.5-CSS-pixel edge halo.
      // Detached exploded parts get their own coverage, not a fixed case box.
      vec3 g=rawGlow*max(core,.35*edge);
      if(aoStrength>0.) b.rgb*=mix(1.,texture2D(ao,vUv).r,aoStrength);
      float a=max(b.a,clamp(max(g.r,max(g.g,g.b))*.65,0.,.08));
      gl_FragColor=vec4((b.rgb+g)/max(a,.0001),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb*=a;
    }` })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), extract); scene.add(quad)
  function size(width: number, height: number) {
    const ratio = renderer.getPixelRatio()
    base.setSize(Math.round(width * ratio), Math.round(height * ratio))
    composite.uniforms.edgeStep!.value.set(1.5 * ratio / base.width, 1.5 * ratio / base.height)
    bright.setSize(Math.round(width * ratio / 2), Math.round(height * ratio / 2))
    blur.setSize(bright.width, bright.height)
    const aoScale = .5
    aoTarget.setSize(Math.max(1, Math.round(base.width * aoScale)), Math.max(1, Math.round(base.height * aoScale)))
    ao?.setSize(aoTarget.width, aoTarget.height)
  }
  function render(world: THREE.Scene, view: THREE.Camera) {
    if (themeMix > 0 && aoEnabled) {
      if (!ao) {
        ao = new SSAOPass(world, view, aoTarget.width, aoTarget.height, 12)
        ao.output = SSAOPass.OUTPUT.Blur
        ao.kernelRadius = .018; ao.minDistance = .00001; ao.maxDistance = .003
        world.traverse(node => {
          if (node instanceof THREE.Mesh && (Array.isArray(node.material) ? node.material : [node.material]).some(m => m.transparent && m.opacity < .2)) glass.push(node)
        })
      }
      const hidden = glass.filter(mesh => mesh.visible)
      for (const mesh of hidden) mesh.visible = false
      const autoShadow = renderer.shadowMap.autoUpdate
      const dirtyShadow = renderer.shadowMap.needsUpdate
      renderer.shadowMap.autoUpdate = false
      renderer.shadowMap.needsUpdate = false
      try { ao.render(renderer, aoTarget, aoTarget, 0, false) } finally {
        renderer.shadowMap.autoUpdate = autoShadow
        renderer.shadowMap.needsUpdate = dirtyShadow
        for (const mesh of hidden) mesh.visible = true
      }
      composite.uniforms.ao!.value = aoTarget.texture
    }
    composite.uniforms.aoStrength!.value = aoEnabled ? themeMix * .60 : 0
    renderer.setRenderTarget(base); renderer.render(world, view)
    quad.material = extract; renderer.setRenderTarget(bright); renderer.render(scene, camera)
    quad.material = soften; soften.uniforms.image!.value = bright.texture
    soften.uniforms.direction!.value.set(1.6 / bright.width, 0)
    renderer.setRenderTarget(blur); renderer.render(scene, camera)
    soften.uniforms.image!.value = blur.texture; soften.uniforms.direction!.value.set(0, 1.6 / bright.height)
    renderer.setRenderTarget(bright); renderer.render(scene, camera)
    quad.material = composite; renderer.setRenderTarget(null); renderer.render(scene, camera)
  }
  return { render, size, setBloomEnabled: (enabled: boolean) => { composite.uniforms.bloomEnabled!.value = enabled ? 1 : 0 }, setAOEnabled: (enabled: boolean) => { aoEnabled = enabled }, setThemeMix: (mix: number) => {
    themeMix = mix
    extract.uniforms.theme!.value = mix
    composite.uniforms.strength!.value = THREE.MathUtils.lerp(.22, .32, mix)
  },
    dispose: () => {
      ao?.dispose(); ao?.ssaoMaterial.dispose(); ao?.noiseTexture.dispose(); aoTarget.dispose(); white.dispose()
      base.dispose(); bright.dispose(); blur.dispose(); quad.geometry.dispose(); extract.dispose(); soften.dispose(); composite.dispose()
    } }
}
