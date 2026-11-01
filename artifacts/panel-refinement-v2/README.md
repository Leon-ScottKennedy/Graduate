# NexBuild final modeling source

Only the final approved panel-refined.blend is retained here. Historical scenes,
preview images and isolated rendering tools were removed at the user's request.

- Inspected with Blender 5.2.3 LTS: 214 objects and 119 meshes.
- The image is packed; no external libraries, fonts or cache files are needed.
- Runtime model: ../../public/models/nexbuild/pc-hardware.glb
- Runtime animation rig: ../../public/models/nexbuild/rig.json (29 groups, 14 rotors).
- Website themes, RGB and the 25-second loop live in ../../src/components/home/.
- Future edits must preserve HW_* groups, rotor nodes and hose morph targets,
  and be checked together with rig.json before replacing web assets.
- Attribution and license: ../../public/models/nexbuild/SOURCES.md

This cleanup did not change the final Blender scene, runtime GLB, rig, fallback
posters, geometry, materials, lights or animation code.
