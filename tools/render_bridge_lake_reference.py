import bpy, math
from mathutils import Vector

OUT = r"D:\University\2026-2027\semester1\鉴赏类作业\美术鉴赏\3d-gesture-museum\assets\reference\generated-bridge\bridge-lake-actual-glb-rear-v1.png"
GLB = r"D:\University\2026-2027\semester1\鉴赏类作业\美术鉴赏\3d-gesture-museum\assets\models\parts\bridge-workbench\rodin_bridge_single.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)

def make_mat(name, color, rough=0.7):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = rough
    return m

water_mat = make_mat('center lake water', (0.025, 0.09, 0.11), 0.18)
rock_mat = make_mat('existing shore stones', (0.28, 0.27, 0.23), 0.9)
ground_mat = make_mat('neutral studio ground', (0.72, 0.72, 0.70), 0.95)

bpy.ops.mesh.primitive_plane_add(size=80, location=(0, -0.18, -2.2))
ground = bpy.context.object
ground.data.materials.append(ground_mat)

# Actual current project geometry: irregularPond(0, -2.2, 16.0, 8.0, 55).
verts, faces, n = [], [], 96
for i in range(n):
    a = 2 * math.pi * i / n
    r = 0.95 + 0.075 * math.sin(a * 3 + 0.6) + 0.045 * math.sin(a * 5 - 0.9)
    verts.append((math.cos(a) * 16.0 * r, 0.06, -2.2 + math.sin(a) * 8.0 * r))
faces.append(tuple(range(n)))
mesh = bpy.data.meshes.new('center_lake_water_mesh')
mesh.from_pydata(verts, [], faces)
water = bpy.data.objects.new('center_lake_actual_32x16m', mesh)
bpy.context.collection.objects.link(water)
water.data.materials.append(water_mat)

for i in range(64):
    a = 2 * math.pi * i / 64
    r = 0.95 + 0.075 * math.sin(a * 3 + 0.6) + 0.045 * math.sin(a * 5 - 0.9)
    x = math.cos(a) * (16.0 * r + 0.18)
    z = -2.2 + math.sin(a) * (8.0 * r + 0.18)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=(x, 0.10, z))
    stone = bpy.context.object
    stone.scale = (0.48, 0.30, 0.30)
    stone.rotation_euler[1] = a * 1.7
    stone.data.materials.append(rock_mat)

bpy.ops.import_scene.gltf(filepath=GLB)
bridge = bpy.context.selected_objects[0] if bpy.context.selected_objects else bpy.context.scene.objects[-1]
bridge.name = 'rodin_bridge_actual_glb'

def bounds(obj):
    bpy.context.view_layer.update()
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

mn, mx = bounds(bridge)
sx, sy, sz = mx.x - mn.x, mx.y - mn.y, mx.z - mn.z
bridge.scale = (15.0 / sx, 2.6 / sy, 2.2 / sz)
if sx >= sz:
    bridge.rotation_euler[2] = math.pi / 2
bpy.context.view_layer.update()
mn, mx = bounds(bridge)
center = (mn + mx) * 0.5
bridge.location += Vector((-center.x, 0.06 - mn.y, -2.2 - center.z))

bpy.ops.object.camera_add(location=(25, 21, 25))
cam = bpy.context.object
direction = Vector((0, 0.8, -2.2)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 52
bpy.context.scene.camera = cam

for loc, energy, size in [((4, 28, 10), 4200, 20), ((-22, 10, 8), 2400, 16), ((18, 7, -18), 2600, 14)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.object
    light.data.energy = energy
    light.data.size = size

bpy.ops.object.light_add(type='SUN', location=(0, 20, 0))
sun = bpy.context.object
sun.data.energy = 2.2
sun.rotation_euler = (math.radians(25), math.radians(-20), math.radians(25))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
scene.world = bpy.data.worlds.new('neutral reference world')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.70, 0.70, 0.70, 1)
bg.inputs['Strength'].default_value = 0.55
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
