# 四幅画境视频

按任务卡 §12.2 的接口约定放置：

```text
public/videos/paintings/qianli-jiangshan.mp4   → openPaintingVideo('qianli')    《千里江山图》
public/videos/paintings/fuchun-shanju.mp4      → openPaintingVideo('shanshui')  《富春山居图》
public/videos/paintings/hanxizai.mp4           → openPaintingVideo('renwu')     《韩熙载夜宴图》
public/videos/paintings/molan.mp4              → openPaintingVideo('huaniao')   《墨兰图》
```

> 《富春山居图》最终 key 为 **`shanshui`**（2026-10-28 组长确认，对应 hall1 山水厅），
> **不使用 `shuzhai`**。四张画卡均已切换为 `status: "auto"`，存在本地视频或组长接口时可直接进入画境。

组员1 的 `js/ink-worlds.js` 会先探测组长的画境接口
（`window.MuseumPaintingWorlds.openPaintingVideo` / `window.MuseumInkWorldApi.openPaintingVideo`），
接口不存在时才用本地兜底播放器读取上面的文件。

接口约定补充：

- `openPaintingVideo(key)` **同步返回 `true` 即视为画境已就绪**，不再等超时探测；
  返回 `false` / 抛错 / Promise reject 时走本地兜底或占位。
- 返回四画选择 / 序厅时，组员1 调用 `closePaintingVideo(key)` 让组长释放画境，
  避免画境残留和漫游继续冻结；未提供时兼容 `exitPaintingWorld(key)` /
  `closePaintingWorld(key)` 两个别名。

当前状态：

| 画作 | 文件 | 状态 |
|---|---|---|
| 《千里江山图》 | `qianli-jiangshan.mp4` | `auto` |
| 《富春山居图》 | `fuchun-shanju.mp4` | `auto` |
| 《韩熙载夜宴图》 | `hanxizai.mp4` | `auto` |
| 《墨兰图》 | `molan.mp4` | `auto` |

## 当前版本说明

- 规格：1280×720、16:9、15 秒、24fps、H.264、单文件约 1.3–1.5MB。
- 画面：使用项目内四幅画作原图制作，无教程界面、字幕、红线或水印。
- 用途：用于当前版本四画入口的完整播放与返回交互验收。
- 后续：Seedance 真正 3D 穿越成片完成后，可保持文件名不变直接替换。

## 来源与授权

> 项目画作素材 + 本地镜头运动生成；生成日期：2026-10-29。
