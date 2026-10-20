import bpy
from pathlib import Path

src = Path(r"D:\University\2026-2027\semester1\鉴赏类作业\美术鉴赏\3d-gesture-museum\assets\models\jiangnan-source\FBX_OBJ\FBX_OBJ\C4D.obj")
dst = Path(r"D:\University\2026-2027\semester1\鉴赏类作业\美术鉴赏\3d-gesture-museum\assets\models\jiangnan_town_preview.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(src))

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0] if meshes else None

bpy.ops.export_scene.gltf(
    filepath=str(dst),
    export_format='GLB',
    use_selection=True,
    export_materials='EXPORT',
    export_texcoords=True,
    export_normals=True,
    export_apply=False,
)
print('EXPORTED', dst, 'MESHES', len(meshes))
