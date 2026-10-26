# 四幅画境视频（组长提供）

按任务卡 §12.2 的接口约定放置：

```text
public/videos/paintings/qianli-jiangshan.mp4   → openPaintingVideo('qianli')   《千里江山图》
public/videos/paintings/shuzhai.mp4            → openPaintingVideo('shuzhai')  《富春山居图》
public/videos/paintings/renwu.mp4              → openPaintingVideo('renwu')    《韩熙载夜宴图》
public/videos/paintings/huaniao.mp4            → openPaintingVideo('huaniao')  《墨兰图》
```

组员1 的 `js/ink-worlds.js` 会先探测组长的画境接口
（`window.MuseumPaintingWorlds.openPaintingVideo` / `window.MuseumInkWorldApi.openPaintingVideo`），
接口不存在时才用本地兜底播放器读取上面的文件。

第一阶段默认状态：

| 画作 | 状态 | 说明 |
|---|---|---|
| 《千里江山图》 | `auto` | 尝试播放视频，文件缺失时显示「画境准备中」 |
| 其余三幅 | `placeholder` | 只显示选择卡与占位状态 |

组长交付视频后，在 `js/ink-worlds.js` 的 `PAINTINGS` 里把对应项 `status` 改成 `"auto"` 即可开放。

## 来源与授权

> 组长交付时请补齐，写清「生成方式 / 素材来源 / 授权情况 / 生成日期」。
