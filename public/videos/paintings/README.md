# 四幅画境视频（组长提供）

按任务卡 §12.2 的接口约定放置：

```text
public/videos/paintings/qianli-jiangshan.mp4   → openPaintingVideo('qianli')    《千里江山图》
public/videos/paintings/shanshui.mp4           → openPaintingVideo('shanshui')  《富春山居图》
public/videos/paintings/renwu.mp4              → openPaintingVideo('renwu')     《韩熙载夜宴图》
public/videos/paintings/huaniao.mp4            → openPaintingVideo('huaniao')   《墨兰图》
```

> 《富春山居图》最终 key 为 **`shanshui`**（2026-10-28 组长确认，对应 hall1 山水厅），
> **不使用 `shuzhai`**；视频文件名同步为 `shanshui.mp4`。key 已确认，但视频尚未交付，
> 代码里该项仍是 `status: "placeholder"`，只显示「画境准备中」；交付后改成 `"auto"` 即可。

组员1 的 `js/ink-worlds.js` 会先探测组长的画境接口
（`window.MuseumPaintingWorlds.openPaintingVideo` / `window.MuseumInkWorldApi.openPaintingVideo`），
接口不存在时才用本地兜底播放器读取上面的文件。

接口约定补充：

- `openPaintingVideo(key)` **同步返回 `true` 即视为画境已就绪**，不再等超时探测；
  返回 `false` / 抛错 / Promise reject 时走本地兜底或占位。
- 返回四画选择 / 序厅时，组员1 调用 `closePaintingVideo(key)` 让组长释放画境，
  避免画境残留和漫游继续冻结；未提供时兼容 `exitPaintingWorld(key)` /
  `closePaintingWorld(key)` 两个别名。

第一阶段默认状态：

| 画作 | 状态 | 说明 |
|---|---|---|
| 《千里江山图》 | `auto` | 尝试播放视频，文件缺失时显示「画境准备中」 |
| 其余三幅 | `placeholder` | 只显示选择卡与占位状态 |

组长交付视频后，在 `js/ink-worlds.js` 的 `PAINTINGS` 里把对应项 `status` 改成 `"auto"` 即可开放。

## 来源与授权

> 组长交付时请补齐，写清「生成方式 / 素材来源 / 授权情况 / 生成日期」。
