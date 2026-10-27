import bpy
import os
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARTS = {
    "steps": 2.0,
    "bush": 0.8,
    "gate-tower": 11.4,
    "camphor": 5.0,
}

for asset_id, expected_max in PARTS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(ROOT, "assets", "models", "parts", "opt", asset_id + ".glb")
    bpy.ops.import_scene.gltf(filepath=path)
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not objects:
        raise RuntimeError("%s: no mesh" % asset_id)
    corners = []
    for obj in objects:
        corners.extend([obj.matrix_world @ Vector(c) for c in obj.bound_box])
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    size = max_v - min_v
    actual = max(size.x, size.y, size.z)
    print("%s: dims=(%.3f, %.3f, %.3f), max=%.3f, minY=%.3f, meshes=%d" % (
        asset_id, size.x, size.y, size.z, actual, min_v.y, len(objects)))
    if abs(actual - expected_max) > 0.05:
        raise RuntimeError("%s: expected max %.3f, got %.3f" % (asset_id, expected_max, actual))
    if min_v.y < -0.02:
        raise RuntimeError("%s: below ground (minY %.3f)" % (asset_id, min_v.y))

