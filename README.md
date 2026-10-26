# calendar-pick

按日历挑选日程的纯前端应用。Vue 3 + Vite + TypeScript + Pinia + Element Plus，无后端。

## 开发

```bash
pnpm install
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

配置放在 `src/data/festivals/*.json`，构建时通过 `import.meta.glob` 自动发现，代码中不写死具体影展信息。

```json
{
  "schemaVersion": 1,
  "isDefault": true,
  "id": "qingdao202602",
  "name": "日历名称",
  "city": "城市",
  "venue": "场地",
  "venueAddress": "详细地址",
  "timeZone": "Asia/Shanghai",
  "initialDate": "2026-10-26",
  "dayStart": "12:00",
  "dayEnd": "23:00",
  "subscribeUrl": "",
  "itemNoun": "部影片",
  "updatedAt": "2026-10-26",
  "events": [
    {
      "id": "20261029-1930",
      "title": "日程标题",
      "start": "2026-10-29T19:30:00+08:00",
      "durationMinutes": 114,
      "description": "描述",
      "url": "",
      "postScreening": false
    }
  ]
}
```

- `durationMinutes` 用于计算结束时间；不使用显式 `end` 字段，避免两处数据不一致。
- `initialDate` 决定月视图第一行所在周，也用于默认定位。
- `subscribeUrl` 为空时“订阅日历”按钮不可用。
- 新增日历只需新增 JSON，并在需要时设置 `isDefault`。

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
