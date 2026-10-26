import bpy
import math
import os
from mathutils import Vector

ROOT = r"D:\University\2026-2027\semester1\鉴赏类作业\美术鉴赏\3d-gesture-museum"
MODEL_DIR = os.path.join(ROOT, "assets", "models", "parts", "opt")
OUT_DIR = os.path.join(ROOT, "assets", "images", "paper-cards")
os.makedirs(OUT_DIR, exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def render_card(filename, angle):
    clear()
    path = os.path.join(MODEL_DIR, filename + '.glb')
    bpy.ops.import_scene.gltf(filepath=path)
    roots = list(bpy.context.selected_objects)
    if not roots:
        return
    for obj in roots:
        if obj.type == 'MESH':
            obj.select_set(True)
    bpy.context.view_layer.objects.active = roots[0]
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'paper-card-source'
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    obj.location = (0, 0, 0)
    # Normalize so every card has a predictable height.
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    center = (min_v + max_v) * 0.5
    obj.location -= center
    extent = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z, 0.001)
    obj.scale *= 4.8 / extent
    obj.rotation_euler[2] = math.radians(angle)

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    width = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z)

    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.image_settings.color_mode = 'RGBA'
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.world.color = (0.02, 0.02, 0.02)

    light = bpy.data.lights.new('softbox', type='AREA')
    light.energy = 900
    light.size = 5
    lamp = bpy.data.objects.new('softbox', light)
    bpy.context.collection.objects.link(lamp)
    lamp.location = (3, -4, 7)
    look_at(lamp, (0, 0, 2))
    fill = bpy.data.lights.new('fill', type='AREA')
    fill.energy = 400
    fill.size = 6
    fill_obj = bpy.data.objects.new('fill', fill)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (-4, 1, 4)
    look_at(fill_obj, (0, 0, 2))

    cam_data = bpy.data.cameras.new('card-camera')
    cam = bpy.data.objects.new('card-camera', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, -12, 0)
    look_at(cam, (0, 0, 0))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(6.0, width * 1.35)
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = os.path.join(OUT_DIR, filename + '-card.png')
    bpy.ops.render.render(write_still=True)

for asset in ('tree', 'fir-tree', 'willow'):
    for angle in (0, 18, -18):
        render_card(asset, angle)
