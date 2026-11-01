# 四幅画境视频（组长提供）

按任务卡 §12.2 的接口约定放置：

```text
public/videos/paintings/qianli-jiangshan.mp4   → openPaintingVideo('qianli')    《千里江山图》
public/videos/paintings/shanshui.mp4           → openPaintingVideo('shanshui')  《富春山居图》
public/videos/paintings/renwu.mp4              → openPaintingVideo('renwu')     《韩熙载夜宴图》
public/videos/paintings/luoshenfu.mp4        → openPaintingVideo('luoshenfu')   《洛神赋图》
```

> 《富春山居图》最终 key 为 **`shanshui`**（2026-10-28 组长确认，对应 hall1 山水厅），
> **不使用 `shuzhai`**；视频文件名同步为 `shanshui.mp4`。key 已确认，交付视频已经接入，
> 代码里该项现在是 `status: "auto"`；视频加载失败时仍显示兜底提示。

组员1 的 `js/ink-worlds.js` 会先探测组长的画境接口
（`window.MuseumPaintingWorlds.openPaintingVideo` / `window.MuseumInkWorldApi.openPaintingVideo`），
接口不存在时才用本地兜底播放器读取上面的文件。

接口约定补充：

- `openPaintingVideo(key)` **同步返回 `true` 即视为画境已就绪**，不再等超时探测；
  返回 `false` / 抛错 / Promise reject 时走本地兜底或占位。
- 返回四画选择 / 序厅时，组员1 调用 `closePaintingVideo(key)` 让组长释放画境，
  避免画境残留和漫游继续冻结；未提供时兼容 `exitPaintingWorld(key)` /
  `closePaintingWorld(key)` 两个别名。

当前交付状态：

| 画作 | 状态 | 视频文件 |
|---|---|---|
| 《千里江山图》 | `auto` | `qianli-jiangshan.mp4` |
| 《富春山居图》 | `auto` | `shanshui.mp4` |
| 《韩熙载夜宴图》 | `auto` | `renwu.mp4` |
| 《洛神赋图》 | `auto` | `luoshenfu.mp4` |

四段原视频来自 `参考视频/交付视频`。项目内版本已修复左上角「豆包 AI 生成」水印区域，保留原有音轨、时长和 1280×720 画幅；原始交付文件未修改。

## 来源与授权

> 组长交付时请补齐，写清「生成方式 / 素材来源 / 授权情况 / 生成日期」。
