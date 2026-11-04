# calendar-pick

按日历挑选日程的纯前端应用。Vue 3 + Vite + TypeScript + Pinia + Element Plus，无后端。

## 开发

```bash
pnpm install
pnpm gen                 # 从 raw 生成显示数据（改数据后执行）
pnpm split:cfa           # 把 doc/data/cfa.json 拆成北京 / 江南两份
pnpm import:cfa-beijing  # doc/data/cfa-beijing.json -> 北京双馆（cfa-beijing）raw
pnpm import:cfa-jiangnan # doc/data/jiangnan.json -> 江南分馆（cfa-jiangnan）raw
pnpm dev
pnpm build       # 会自动先执行 pnpm gen
```

启动后访问 `/` 会进入影展列表 `/pick`，再点卡片进入具体日历：

```text
http://127.0.0.1:5173/pick                  # 影展列表
http://127.0.0.1:5173/pick/qingdao202602
http://127.0.0.1:5173/pick/cfa-beijing
http://127.0.0.1:5173/pick/cfa-jiangnan
```

## 路由

- `/pick`：影展列表，以卡片展示所有日历
- `/pick/:festivalId`：按日历 id 加载配置
- `/`：跳转到 `/pick`
- 未知日历 id / 未知路径：回退到 `/pick`
- 日历页顶栏右侧「全部影展」图标（全屏 / 收起侧栏按钮左侧）可返回列表；移动端收在标题左侧
- 顶栏与列表页的 logo 都可点击回首页（`/pick`）

## 影展列表

- 卡片内容：日历名称、城市 · 场地、`updatedAt`（原始数据提供日期）；封面暂无图片，用该日历主题色 + `cover.text` 短名排字。
- 封面文字动效由 `cover.style` 决定：`scatter` 错落旋转（风格万相）、`breath` 极慢呼吸闪烁（电影资料馆）、`ripple` 水波浮动 + 压缩倒影（江南分馆）、`plain` 静止。
- 排序：`order` 升序（缺省 999）→ `updatedAt` 倒序 → id；青岛 `order: 0` 固定第一个。
- 列表页使用中性主题，卡片封面使用各日历自己的 `theme` 三色。

## 现有日历

| id | 内容 | 数据来源 |
| --- | --- | --- |
| `qingdao202602` | 风格万相 · 中外经典影片展（青岛站） | `doc/20260201.jpg`、`doc/movie-info.png` |
| `cfa-beijing` | 中国电影资料馆 · 北京双馆（2026-11-01 – 12-06） | `doc/data/cfa-beijing.json`，由 `pnpm import:cfa-beijing` 转换 |
| `cfa-jiangnan` | 电影资料馆江南分馆（2026-11-01 – 12-06） | `doc/data/jiangnan.json`，由 `pnpm import:cfa-jiangnan` 转换 |

### 北京双馆（cfa-beijing）

- 数据源拆分：
  - `doc/data/cfa.json`：原始导出（格式损坏，仅作源文件，由 `scripts/split-cfa.mjs` 括号匹配拆分）；
  - `doc/data/cfa-beijing.json`：北京两个场馆（小西天 1/2 号厅 + 百子湾 1 号厅），145 场；
  - `doc/data/jiangnan.json`：江南分馆影院，109 场（独立日历 `cfa-jiangnan`）。
- 日历只取 **2026-11-01 及以后**：129 场 / 28 天 / 3 个厅 + 1 条头日程（`2026-11-01 09:00`）。
- **不增加「场馆」筛选维度**：`location` 直接写成 `小西天 1号厅` / `小西天 2号厅` / `百子湾 1号厅`，
  复用现有影厅多选筛选。
- 配置：主题 `#F6EAE2 / #6D2E27 / #C1AD86`；计数单位「部影片」；活动标签「映后交流」；
  活动场加 🎉；描述模板「年代 地区 类型 · 厅号」；`defaultView: "month"`；`order: 1`。
- 描述里的影片类型用 `/` 分隔（如 `剧情/爱情/喜剧`），地区和厅号仍用空格 / `·`。
- 厅色：`小西天 1号厅 #6D2E27`、`小西天 2号厅 #ee3e3699`、`百子湾 1号厅 rgb(98, 138, 240)`。
- 票价、评分、海报、购票链接不展示。
- 更新流程：`pnpm split:cfa` → `pnpm import:cfa-beijing` → `pnpm gen`。

### 江南分馆（cfa-jiangnan）

- 数据源 `doc/data/jiangnan.json`，只取 **2026-11-01 及以后**：100 场 / 4 个厅 + 1 条头日程。
- 名称「电影资料馆江南分馆」；城市「苏州」；场地「江南分馆影院」。
- `location` 写成 `江南 1号厅 … 江南 4号厅`；每个厅一个厅色：
  `#3A7133` / `#B08A45` / `#54788C` / `#A15C48`。
- 配置：主题 `#F3F1E7 / #3A7133 / #AFC0A2`（绿色由 `#53c346` 借色相，饱和度 / 亮度对齐青岛）；
  计数单位「部影片」；活动标签「映后交流」；描述模板「年代 地区 类型 · 厅号」（类型用 `/` 分隔）；
  `defaultView: "month"`；`order: 2`。
- 更新流程：`pnpm split:cfa` → `pnpm import:cfa-jiangnan` → `pnpm gen`。

## 日历配置

数据分两层，`raw` 是贴近数据源的自由格式，`display` 是运行时标准配置：

- **原始数据**：`src/data/raw/*.raw.json`，字段自由，人工维护（贴近海报 / 豆瓣等来源）。
- **显示数据**：`src/data/festivals/*.json`，标准化，运行时唯一配置，由生成脚本产出。

修改数据后执行 `pnpm gen` 重新生成显示数据；构建时通过 `import.meta.glob` 自动发现，代码中不写死具体影展信息。

```json
{
  "schemaVersion": 2,
  "order": 0,
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
  "cover": { "text": "封面短名", "style": "breath" },
  "defaultView": "month",
  "theme": { "background": "#E5CEA8", "primary": "#6A3424", "secondary": "#9AB9AF" },
  "labels": { "featured": "映后交流", "sameTitle": "同片场次" },
  "adjacency": { "normalMinutes": 60, "featuredMinutes": 120 },
  "hallColors": { "1号厅": "#EE3E36", "2号厅": "rgb(98, 138, 240)" },
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
      "location": "1号厅",
      "url": "",
      "postScreening": false
    }
  ]
}
```

- `title` 不含前缀图标，`titlePrefix` 单独存（如 🎉），同标题联动匹配只比较 `title`。
- `id` 可由数据源提供（如票务场次 id）；缺省时由生成脚本用「日期-时间」生成。显式 id 更稳：改期不会让本地已选失联。
- `durationMinutes` 用于计算结束时间；不使用显式 `end` 字段，避免两处数据不一致。
- `director` / `year` / `language` / `rating` / `ratingCount` 为结构化字段，周视图与导出使用；`description` 为自由补充（可为空），`weekDesc` 为周视图专属补充（可选）。`description` 非空时优先使用它，不再自动拼「年代/导演/语言」。
- `location` 为影厅 / 场地（可选）。同一影院有多个 `location` 时，工具栏「今天」左侧会出现多选筛选（移动端会单独占一行）；周视图副标题和日期弹窗也会显示厅号。
- `hallColors` 为影厅配色（可选，键与 `location` 完全一致）。配置后只影响日程左侧 3px 竖线和筛选下拉里的色块，不改变日程背景；未配置的厅回退到主题主色。移动端按既定设计不显示左侧竖线，只在筛选下拉里显示色块。
- `kind: 'header'` 为标题头日程（如影展封面），仅进入订阅/导出 `.ics`，不在前端日历展示、不参与选片。
- `order` 控制影展列表排序，数字越小越靠前；缺省按 `updatedAt` 倒序。青岛为 `0`。
- `initialDate` 决定月视图第一行所在周，也用于默认定位；缺省时自动取最早一场的日期。
- `timeZone` 缺省为 `Asia/Shanghai`，导出、周视图时间轴、日期分组都按它计算。
- `defaultView` 可选 `month` / `week`；缺省时桌面用月视图、移动端用周视图。多厅、单日场次密集的日历建议设 `month`。
- `cover` 为列表卡片封面：`text` 是封面短名（缺省用 `name`），`style` 可选 `plain` / `scatter` / `breath` / `ripple`；动效尊重系统「减少动态效果」设置。封面文字只是装饰，卡片的可访问名称仍取自 `h2`。
  - `scatter`：逐字起伏 + 旋转 / 缩放，形成从左到右的波浪动线；
  - `breath`：每字独立周期与相位地极慢明暗呼吸，另加三两颗小星星闪烁；
  - `ripple`：逐字轻微浮动，倒影以文字横向中线为轴翻转 180° 叠在原字上。
- `updatedAt` 表示**原始数据提供的日期**，不取构建当天，避免每次 `pnpm gen` 都把“数据更新”改成今天。
- `siteOrigin` 仅构建期使用：生成二维码时拼出 `siteOrigin/pick/<id>`，可在部署时用环境变量 `SITE_ORIGIN` 覆盖。运行时订阅地址默认取当前页面 origin，无需配置域名。
- `subscribeUrl` 可选，作为订阅地址的覆盖项；不填时由「页面 origin + BASE_URL + `subscribe/<id>.ics`」自动生成，保证复制出去的是绝对地址。
- `theme` 三项主色：背景、可交互主色、协助/联动色。主色只用于点亮、选中、聚焦、提醒、按钮等交互态；日历网格、卡片边框、分隔线等结构色由背景 + 固定中性线色推导，避免亮色主题把线框全部染色。周视图时间轴由全部日程动态计算，不再使用固定的 `dayStart` / `dayEnd`。新日历建议主色的饱和度 / 亮度与青岛（`#6A3424` 约 S49 / L28）同档，背景同饱和度但明显更浅；参考 [配色口径](doc/TODO.md)。
- `labels.featured` 为特色场次标签（默认「映后交流」），设为空字符串可隐藏；`labels.sameTitle` 为详情中同名场次分组标题（默认「同片场次」）。
- `adjacency` 为「两场紧挨」的间隔阈值（分钟），普通场次默认 60、特色场次默认 120；紧挨的场次不显示行程。
- 同一天有场次重叠时（多厅同时放映），周视图会自动按「重叠簇」并排分列（最多 2 列时每列占一半宽）；不重叠时仍占满整格。
- 工具栏的「↕ / ↔ 展开」按钮按当前视图生效：
  - 月视图「↕」：每行高度按当天最多场次撑开，当天全部日程都显示（原来固定 5 行、溢出显示 +N）；再次点击恢复 5 行铺满。
  - 周视图「↔」：可见天数收窄为桌面 4 天 / 移动端 2 天，列宽变大；左右两侧出现翻页按钮。
  - 周视图的日程标题最多两行（桌面与移动端一致），超出省略；展开态列更宽，同样保持两行上限。
  - 周视图工具栏的上一页 / 下一页按「可见天数」翻页：折叠时 7 天、展开时 4 天（移动端 2 天），不会展开后仍整周跳。
- 加入日程时若与已选场次时间重叠，会弹出 message 提示「与已选「xx」时间冲突 N 分钟」；已选列表和截图里的「时间冲突 N 分钟」固定用红色（`--danger`），不随主题主色变化。
- 订阅日历由 `pnpm gen` 生成静态 `public/subscribe/<id>.ics`；导出与订阅按同一口径生成：不含评分与影院名/地址。
- 新增日历：先填 [新日历配置问卷](doc/calendar-questionnaire.md)，再在 `src/data/raw` 新增 `.raw.json` 并执行 `pnpm gen`；需要排序时设置 `order`。二维码依赖 `qrcode`（已在 devDependencies 中），缺少 `siteOrigin` 时只跳过二维码。

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
