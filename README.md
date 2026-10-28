# calendar-pick

按日历挑选日程的纯前端应用。Vue 3 + Vite + TypeScript + Pinia + Element Plus，无后端。

## 开发

```bash
pnpm install
pnpm gen      # 从 raw 生成显示数据（改数据后执行）
pnpm dev
pnpm build
```

启动后访问 `/` 会自动跳转到默认日历：

```text
http://127.0.0.1:5173/pick/qingdao202602
```

## 路由

- `/pick/:festivalId`：按日历 id 加载配置
- `/`：跳转到配置中 `isDefault: true` 的日历
- 未知日历 id：回退到默认日历

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
  "subscribeUrl": "",
  "itemNoun": "部影片",
  "updatedAt": "2026-10-26",
  "theme": { "background": "#E5CEA8", "primary": "#6A3424", "secondary": "#9AB9AF" },
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
- `initialDate` 决定月视图第一行所在周，也用于默认定位。
- 订阅日历由 `pnpm gen` 生成静态 `public/subscribe/<id>.ics`；按钮点击复制该地址，`subscribeUrl` 可选，用于覆盖为正式在线地址。订阅文件按导出口径生成：不含评分与影院名/地址。
- `theme` 三项主色：背景、可交互主色、协助/联动色；周视图时间轴由全部日程动态计算，不再使用固定的 `dayStart` / `dayEnd`。
- 新增日历：在 `src/data/raw` 新增 `.raw.json` 并执行 `pnpm gen`，需要时设置 `isDefault`。

## 本地存储

已选、默认行程时间、单场路程/描述覆盖保存在：

```text
calendar-pick:v1:<当前路径>
```

例如 `calendar-pick:v1:/pick/qingdao202602`。不同日历路径天然隔离；“清除已选”会删除当前路径的整条记录。

## 导出

- **列表截图**：750px 宽的紧凑竖版 PNG（2x），适合手机查看
- **导出日历**：`.ics`，`Asia/Shanghai` 时区，带 `VTIMEZONE`
- **导出 Excel**：UTF-8 BOM 的 `.csv`

文件名统一为“内容名 + 浏览器本地时间戳”。页面中的真实时长来自 `doc/movie-info.png`，待补内容见 [doc/TODO.md](doc/TODO.md)。

## 部署

使用 history 路由，静态托管时需要把未知路径回退到 `index.html`；如果部署在子路径，请同时调整 Vite `base` 和路由 base。

## Nuxt 兼容

领域数据、类型、导出逻辑与框架解耦；页面/组件只做组装。未来迁移时可将 `src/pages` 映射到 Nuxt pages，并把数据加载改为 `useAsyncData`，当前不实现 SSR。
