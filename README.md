# calendar-pick

按日历挑选日程的纯前端应用。Vue 3 + Vite + TypeScript + Pinia + Element Plus，无后端。

## 开发

```bash
pnpm install
pnpm gen      # 从 raw 生成显示数据（改数据后执行）
pnpm dev
pnpm build    # 会自动先执行 pnpm gen
```

启动后访问 `/` 会自动跳转到默认日历：

```text
http://127.0.0.1:5173/pick/qingdao202602
```

## 路由

- `/pick/:festivalId`：按日历 id 加载配置
- `/`：跳转到配置中 `isDefault: true` 的日历
- 未知日历 id：回退到默认日历
- 存在多个日历配置时，顶栏会出现「切换日历」入口；单日历时不显示

## 日历配置

数据分两层，`raw` 是贴近数据源的自由格式，`display` 是运行时标准配置：

- **原始数据**：`src/data/raw/*.raw.json`，字段自由，人工维护（贴近海报 / 豆瓣等来源）。
- **显示数据**：`src/data/festivals/*.json`，标准化，运行时唯一配置，由生成脚本产出。

修改数据后执行 `pnpm gen` 重新生成显示数据；构建时通过 `import.meta.glob` 自动发现，代码中不写死具体影展信息。

```json
{
  "schemaVersion": 2,
  "isDefault": true,
  "id": "qingdao202602",
  "name": "日历名称",
  "city": "城市",
  "venue": "场地",
  "venueAddress": "详细地址",
  "timeZone": "Asia/Shanghai",
  "initialDate": "2026-10-26",
  "siteOrigin": "https://cal.wind8866.top",
  "subscribeUrl": "",
  "itemNoun": "部影片",
  "updatedAt": "2026-10-26",
  "theme": { "background": "#E5CEA8", "primary": "#6A3424", "secondary": "#9AB9AF" },
  "labels": { "featured": "映后交流", "sameTitle": "同片场次" },
  "adjacency": { "normalMinutes": 60, "featuredMinutes": 120 },
  "events": [
    {
      "id": "20261029-1930",
      "title": "日程标题",
      "titlePrefix": "🎉",
      "start": "2026-10-29T19:30:00+08:00",
      "durationMinutes": 114,
      "director": "导演",
      "year": 1947,
      "language": "普通话",
      "rating": 8.4,
      "ratingCount": 23020,
      "description": "",
      "weekDesc": "",
      "url": "",
      "postScreening": false
    }
  ]
}
```

- `title` 不含前缀图标，`titlePrefix` 单独存（如 🎉），同标题联动匹配只比较 `title`。
- `durationMinutes` 用于计算结束时间；不使用显式 `end` 字段，避免两处数据不一致。
- `director` / `year` / `language` / `rating` / `ratingCount` 为结构化字段，周视图与导出使用；`description` 为自由补充（可为空），`weekDesc` 为周视图专属补充（可选）。
- `kind: 'header'` 为标题头日程（如影展封面），仅进入订阅/导出 `.ics`，不在前端日历展示、不参与选片。
- `initialDate` 决定月视图第一行所在周，也用于默认定位；缺省时自动取最早一场的日期。
- `timeZone` 缺省为 `Asia/Shanghai`，导出、周视图时间轴、日期分组都按它计算。
- `siteOrigin` 仅构建期使用：生成二维码时拼出 `siteOrigin/pick/<id>`，可在部署时用环境变量 `SITE_ORIGIN` 覆盖。运行时订阅地址默认取当前页面 origin，无需配置域名。
- `subscribeUrl` 可选，作为订阅地址的覆盖项；不填时由「页面 origin + BASE_URL + `subscribe/<id>.ics`」自动生成，保证复制出去的是绝对地址。
- `theme` 三项主色：背景、可交互主色、协助/联动色；选中、同名高亮、悬浮等衍生色都由这三色推导。周视图时间轴由全部日程动态计算，不再使用固定的 `dayStart` / `dayEnd`。
- `labels.featured` 为特色场次标签（默认「映后交流」），设为空字符串可隐藏；`labels.sameTitle` 为详情中同名场次分组标题（默认「同片场次」）。
- `adjacency` 为「两场紧挨」的间隔阈值（分钟），普通场次默认 60、特色场次默认 120；紧挨的场次不显示行程。
- 订阅日历由 `pnpm gen` 生成静态 `public/subscribe/<id>.ics`；导出与订阅按同一口径生成：不含评分与影院名/地址。
- 新增日历：在 `src/data/raw` 新增 `.raw.json` 并执行 `pnpm gen`，需要时设置 `isDefault`；二维码依赖 `qrcode`（已在 devDependencies 中），缺少 `siteOrigin` 时只跳过二维码。

## 时区与导出

- 页面内所有「日期 → 某天正午」的构造都走 `dateInZone()`，按 `config.timeZone` 解释，不再写死 `+08:00`。
- `.ics` 导出：同一偏移（如 `Asia/Shanghai`）使用 `TZID` + 该偏移的 `VTIMEZONE`；跨夏令时或偏移不一致时自动退回 UTC（`Z`），保证任何客户端显示的绝对时刻正确。
- 排序按真实时间戳比较，不依赖 ISO 字符串的字典序。

## 本地存储

已选、默认行程时间、单场路程/描述覆盖保存在：

```text
calendar-pick:v1:<当前路径>
```

例如 `calendar-pick:v1:/pick/qingdao202602`。不同日历路径天然隔离；“清除已选”会删除当前路径的整条记录。

## 导出

- **列表截图**：393px 宽的紧凑竖版 PNG（2x），适合手机查看；主题色与页面一致，缺少二维码时自动隐藏二维码块
- **导出日历**：`.ics`，按 `config.timeZone` 生成，固定偏移用 `TZID` + `VTIMEZONE`，跨夏令时退回 UTC
- **导出 Excel**：UTF-8 BOM 的 `.csv`

文件名统一为“内容名 + 浏览器本地时间戳”。页面中的真实时长来自 `doc/movie-info.png`，待补内容见 [doc/TODO.md](doc/TODO.md)。

## 部署

使用 history 路由，静态托管时需要把未知路径回退到 `index.html`；如果部署在子路径，请同时调整 Vite `base` 和路由 base。

## Nuxt 兼容

领域数据、类型、导出逻辑与框架解耦；页面/组件只做组装。未来迁移时可将 `src/pages` 映射到 Nuxt pages，并把数据加载改为 `useAsyncData`，当前不实现 SSR。
