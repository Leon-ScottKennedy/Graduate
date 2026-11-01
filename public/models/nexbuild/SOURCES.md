# NexBuild interactive computer - final assets

Base CAD: **Desktop PC**, **SpencerFrank**.
Source: https://www.cadcrowd.com/3d-models/desktop-pc
License: **CC BY-NC 4.0**, https://creativecommons.org/licenses/by-nc/4.0/

The user supplied the original desktop-pc.zip. NexBuild's derivative retains
this source attribution and noncommercial license. It is a brand-free product
visualization, not certified manufacturing CAD.

## Retained final source

`artifacts/panel-refinement-v2/panel-refined.blend` is the final approved source.
It includes the top-360 chassis, detailed motherboard, AIO with outside-DIMM
hoses, RGB hardware, front fascia and carrier refinements, and hose morphs.
Its image is packed; no external libraries, fonts or caches are required.
It was inspected with Blender 5.2.3 LTS and contains all 29 rig group nodes.

## Runtime files

- `pc-hardware.glb`: final independent hardware, PBR/RGB materials and Draco compression.
- `rig.json`: assembled/exploded transforms, carrier motion, hose sampling and 14 fan rotors.
- `pc-half.webp`: dark-theme transparent fallback captured from the final WebGL rig.
- `pc-half-light.webp`: light-theme transparent fallback.
- Draco runtime files and their upstream licensing are retained in `../draco/`.

The current 25-second loop, light/dark materials and RGB are controlled by
`src/components/home/pcTimeline.ts`, `pcScene.ts`, `pcMaterials.ts` and `pcGlow.ts`.
Hose meshes retain their basis and 32 progress morph targets for reversible motion.

## Historical workflow

On 2026-11-01 the user requested retaining only the final modeling source and
runtime assets. Historical CAD inputs, older Blender versions, render tools,
preview images, test captures and obsolete exporters were removed from the
working project after a verified recovery archive was created outside it.
Historical exporter commands are no longer part of the current project.
The assembled-state reference poster and the earlier static beauty/RGB AOV
images were also removed because the current frontend does not load them.

No final geometry, rig, runtime poster, material or animation code was changed
by this cleanup. Keep final source, GLB, rig and source attribution together.
