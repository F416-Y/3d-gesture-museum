import bpy
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "screenshots", "verification", "member7-parts")
os.makedirs(OUT, exist_ok=True)
PARTS = ["steps", "bush", "gate-tower", "camphor"]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_camera(target, distance):
    bpy.ops.object.camera_add(location=(distance * 0.9, distance * 0.62, distance * 0.72))
    cam = bpy.context.object
    direction = Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    cam.data.lens = 52


def make_lights(distance):
    bpy.ops.object.light_add(type="AREA", location=(distance * 0.6, distance * 1.1, distance * 0.8))
    key = bpy.context.object
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = distance * 0.7
    key.rotation_euler = (0.35, 0.0, 2.8)
    bpy.ops.object.light_add(type="AREA", location=(-distance * 0.8, distance * 0.5, distance * 0.4))
    fill = bpy.context.object
    fill.data.energy = 650
    fill.data.size = distance * 0.6
    fill.rotation_euler = (0.7, 0.0, -0.8)
    bpy.ops.object.light_add(type="AREA", location=(0, -distance * 0.4, distance * 0.8))
    rim = bpy.context.object
    rim.data.energy = 500
    rim.data.size = distance * 0.5
    rim.rotation_euler = (0.0, 0.0, 0.0)


for asset_id in PARTS:
    reset()
    path = os.path.join(ROOT, "assets", "models", "parts", "opt", asset_id + ".glb")
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    corners = []
    for obj in meshes:
        corners.extend([obj.matrix_world @ Vector(c) for c in obj.bound_box])
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    center = (min_v + max_v) / 2
    extent = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z)
    distance = max(extent * 2.5, 3.0)
    make_camera((center.x, center.y, center.z), distance)
    make_lights(distance)
    world = bpy.context.scene.world or bpy.data.worlds.new("PreviewWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.065, 0.08, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = os.path.join(OUT, asset_id + "-preview.png")
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)

