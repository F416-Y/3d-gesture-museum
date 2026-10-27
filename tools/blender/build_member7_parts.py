import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "models", "parts", "opt")
os.makedirs(OUT, exist_ok=True)


def mat(name, color, roughness=0.78):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


STONE = mat("stone_warm_gray", (0.62, 0.58, 0.49))
STONE_LIGHT = mat("stone_edge", (0.76, 0.71, 0.61))
WOOD = mat("gate_red_wood", (0.34, 0.12, 0.07))
ROOF = mat("roof_dark_tile", (0.10, 0.08, 0.06))
TRUNK = mat("camphor_trunk", (0.18, 0.09, 0.045))
LEAF = mat("camphor_leaf", (0.10, 0.24, 0.08))
LEAF_LIGHT = mat("leaf_highlight", (0.22, 0.38, 0.11))


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    # Keep shared materials alive between the four exports; removing them here
    # invalidates the material references held by the builders below.
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def cube(name, loc, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("soft_edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    return o


def cylinder(name, loc, radius, depth, material, vertices=16, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation or (0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o


def export(asset_id):
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
    path = os.path.join(OUT, asset_id + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True)
    return path


def normalize_asset(expected_max):
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    corners = []
    for obj in meshes:
        corners.extend([obj.matrix_world @ Vector(c) for c in obj.bound_box])
    min_y = min(v.y for v in corners)
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    min_v = Vector((min(v.x for v in corners), min_y, min(v.z for v in corners)))
    current_max = max((max_v - min_v).x, (max_v - min_v).y, (max_v - min_v).z)
    factor = expected_max / current_max
    for obj in meshes:
        obj.location *= factor
        obj.scale *= factor
        obj.location.y -= min_y * factor
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def make_steps():
    # 2.2m wide, three grounded stone risers; front points toward -Z.
    for i in range(3):
        depth = 0.62
        z = 0.27 + i * depth
        width = 2.0 - i * 0.04
        height = 0.20 + i * 0.02
        cube("steps_riser_%02d" % i, (0, height / 2, z), (width, height, depth), STONE_LIGHT, 0.035)
    cube("steps_landing", (0, 0.42, 1.69), (1.95, 0.22, 0.46), STONE, 0.04)


def make_bush():
    # Compact natural cluster, not a perfect sphere; maximum width about 0.8m.
    for i, (x, y, z, sx, sy, sz) in enumerate([
        (-0.14, 0.28, 0.00, 0.28, 0.20, 0.23),
        (0.10, 0.30, 0.02, 0.30, 0.22, 0.25),
        (0.00, 0.50, 0.00, 0.23, 0.24, 0.22),
        (-0.16, 0.46, 0.08, 0.16, 0.18, 0.17),
        (0.17, 0.44, -0.06, 0.18, 0.20, 0.16),
    ]):
        sphere("bush_cluster_%02d" % i, (x, y, z), (sx, sy, sz), LEAF if i % 2 else LEAF_LIGHT)
    cylinder("bush_stem", (0, 0.15, 0), 0.035, 0.3, TRUNK, 8)


def make_gate_tower():
    # Jiangnan gate tower: two red columns, lintel, shallow dark tile roof.
    for x in (-4.5, 4.5):
        cube("gate_column", (x, 2.0, 0), (0.65, 4.0, 0.65), WOOD, 0.06)
        cube("gate_base", (x, 0.18, 0), (1.0, 0.36, 1.0), STONE_LIGHT, 0.05)
        sphere("gate_cap", (x, 4.35, 0), (0.34, 0.22, 0.34), STONE_LIGHT)
    cube("gate_lintel", (0, 3.55, 0), (9.7, 0.55, 0.7), WOOD, 0.05)
    cube("gate_plaque", (0, 3.7, -0.38), (3.5, 0.6, 0.06), STONE_LIGHT, 0.03)
    # Roof slab with a restrained ridge; no surrounding building or ground plane.
    cube("gate_roof", (0, 4.55, 0), (11.4, 0.22, 2.2), ROOF, 0.05)
    cube("gate_ridge", (0, 4.78, 0), (8.6, 0.16, 0.22), ROOF, 0.03)


def make_camphor():
    # 5m mature courtyard tree, layered canopy with visible trunk/branches.
    cylinder("camphor_trunk", (0, 1.45, 0), 0.24, 2.9, TRUNK, 18)
    for i, (x, y, z, r, rot) in enumerate([
        (0.35, 2.2, 0.0, 0.12, 0.5), (-0.32, 2.45, 0.0, 0.11, -0.6),
        (0.15, 2.9, 0.1, 0.09, 0.35), (-0.18, 3.25, -0.05, 0.08, -0.35),
    ]):
        cylinder("camphor_branch_%02d" % i, (x / 2, y, z), r, 1.4, TRUNK, 12, (0, rot, 0))
    for i, (x, y, z, sx, sy, sz) in enumerate([
        (0.0, 3.15, 0.0, 1.15, 0.55, 0.95), (-0.55, 3.65, 0.0, 0.85, 0.48, 0.75),
        (0.55, 3.78, 0.12, 0.82, 0.50, 0.72), (0.0, 4.25, -0.05, 0.95, 0.48, 0.78),
        (0.0, 4.72, 0.0, 0.55, 0.28, 0.48),
    ]):
        sphere("camphor_canopy_%02d" % i, (x, y, z), (sx, sy, sz), LEAF if i % 2 else LEAF_LIGHT)


BUILDERS = {
    "steps": make_steps,
    "bush": make_bush,
    "gate-tower": make_gate_tower,
    "camphor": make_camphor,
}


for asset_id, builder in BUILDERS.items():
    clear()
    builder()
    normalize_asset({"steps": 2.0, "bush": 0.8, "gate-tower": 11.4, "camphor": 5.0}[asset_id])
    for obj in bpy.context.scene.objects:
        obj["asset_id"] = asset_id
        obj["coordinate_system"] = "Z-up; origin at footprint center; bottom grounded at y=0"
    export(asset_id)

