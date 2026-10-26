# 文创零件参考与坐标规格

本目录的美化图只用于形体、材质和细节方向；建模尺寸与落位以本文件、`assets/models/parts/parts-manifest.json` 和 `js/scene.js` 为准。

## 统一建模约束

- 坐标系：Three.js / Blender Z-up 约定，网页坐标写作 `(x, y, z)`。
- 原点：单体模型 footprint 中心；底部落地到 `y=0`。
- Hyper3D：只生成单个零件，不生成地面、背景建筑、相机、灯光或其他物件。
- GLB 接入：`assets/models/parts/opt/<id>.glb`；网页加载后仍会按 manifest 的 `sizeM` 归一化。

## 零件参数

| ID | 参考图 | 尺寸约束 | 网页坐标 / 放置规则 | 备注 |
|---|---|---:|---|---|
| `steps` | `steps-beautified-reference.png` | 最大尺寸 `2.0m`；三级踏跺，底部 `y=0` | 随门洞局部坐标放置；`x=u`，`z` 朝门外；不得单独漂浮 | 由 `buildPartDoorSteps` 生成/替换 |
| `bush` | `bush-beautified-reference.png` | 最大尺寸 `0.8m`；底部 `y=0` | 北侧：`(x,0,-42.4)`，`x=-42..42` 步长 `4m`；东西侧：`(±42.4,0,z)`，`z=-42..42` 步长 `4m`；南侧：`(±x,0,42.4)`，`x=8..42` 步长 `4m` | 绿篱散点；避开南侧入口门洞 |
| `gate-tower` | `gate-tower-beautified-reference.png` | 最大尺寸 `11.4m`；底部 `y=0` | 中心 `(0,0,42.2)` | 外景南侧主入口门楼 |
| `camphor` | `camphor-beautified-reference.png` | 最大高度 `5.0m`；底部 `y=0` | 当前两处：`(7.5,0,35.5)`、`(-7.5,0,40)`；前者为 `camphor`，后者为 `camphor` | 不得与门楼、湖面或建筑重叠 |

## 验收顺序

1. Blender 中检查正面、背面、左右、顶部、底部 360°。
2. 检查尺寸、原点和最低点；最低点不得低于 `y=0`。
3. 网页固定机位检查门楼、乔木、灌木是否遮挡建筑或道路。
4. `steps` 必须与实际门洞对齐，不能用网页旋转补救模型方向。

