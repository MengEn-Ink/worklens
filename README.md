# WorkLens · 工作能力雷达

WorkLens 是围绕个人日常工作持续生长的开源能力雷达：发现优秀项目，结合公开数据与个人喜好做判断，并把高价值能力沉淀为经过人工审核的 Skill。

主线只有一条：**看（本期 / 情报）→ 判（待审）→ 用（我的）**。

## 页面入口（4 个）

| 入口 | 地址 | 内容 |
| --- | --- | --- |
| 本期 | `/`（`#issue`） | GitHub 候选按编辑优先级排序：头条 + 精选 + 本机相关 + 全部候选（类型筛选 / 搜索 / 编辑优先·本机相关·Stars 排序），仓库卡片指标动画，30 秒速读抽屉（结论、指标、评分算法逐项解释），❤ / ✕ 反馈 |
| 情报 | `/ai-news/` | AI 工作情报，P0/P1/P2 优先级、跨源去重、缓存/降级徽标 |
| 待审 | `/#review` | Skill 待审队列（7 项阻断检查刻度、状态筛选）+ 正式引入账本 |
| 我的 | `/#me` | 喜好账本（仅本地）、信号源与隐私开关、实验室（核心开源者 / Idea / 推荐复盘 / 健康巡检，折叠） |

PC 与 H5 共用一套响应式页面。旧地址 `/desktop/` 会跳到 `/`，`/atelier/` 会跳到 `/#review`，原链接不会 404。

### 2026-10 收敛说明

已砍掉：推送中心、学习路径、引入复盘、画像页大部分子标签（时间地图、能力雷达、词汇表等示意数据）、技能工坊空标签，以及独立的 PC v3 / H5 v2 / Atelier v4 三套实现。页面只展示 `data/*.json` 里的真实数据，不再生成演示数据。

2026-10 补回：仓库卡片指标动画（Stars / Forks / Issues 实测数字滚动 + 12 点星标曲线 + 7 格活跃度）。曲线与活跃度由当前快照推演，界面统一标注「示意」：推演段画成虚线，只有末端朱砂实心点是实测值。另新增「本机相关」：仅用本浏览器 localStorage 里的 ❤ / ✕ 学习话题、类型、语言、作者权重，在本机给候选打 0–99 分并说明理由，不上传、不扫描设备。

## 当前能力

- GitHub Search、Trending、RSS 与专题 Hub 的候选源框架，结果写入 `data/discoveries.json`
- 实时公开资讯：GitHub Releases、HN、Lobsters、AI 官方博客、OSV、CISA KEV 与 AI 聚合器统一写入 `data/ai-news.json`，跨源实体去重并按 P0/P1/P2 分级
- 喜好反馈 ❤ / ✕ 只存浏览器 localStorage（`worklens.taste.v1`），不上传
- 本地 RSS / 播客 OPML 脱敏导入，订阅 URL 先去敏再散列
- Skill 待审队列：7 项固定阻断检查 + 人工状态机（待审→评测→试用→引入/拒绝/隔离），自动化只入队不流转，永不自动安装
- 核心开源者圈层、Idea 项目化、推荐复盘、四小时健康巡检均有公开数据契约与 CLI 校验，页面上收进「我的 · 实验室」只读展示
- CI 门禁：单元测试、队列契约校验、密钥与内网信息扫描

## 数据与隐私原则

1. 推荐必须保留来源和判断证据。
2. 画像只记录完成推荐所需的最小信息；会议、飞书文档等私有信号默认关闭。
3. 每类信息源可单独关闭、清理和调整权重。
4. 喜好是辅助信号，不替代项目安全、质量与许可证审查。
5. 页面只读：不安装、不执行任何 Skill。

## 自动化节奏

- 每四小时：健康巡检与数据刷新，结果写入 `data/health-checks.json`（`scripts/health_check.py validate`，CI 强制校验）。
- 每日：采集、去重、补充仓库元数据（GitHub Actions 每日 01:17 UTC）。
- 每个公开源默认独立 24 小时 TTL，支持 ETag/Last-Modified；刷新失败按源保留旧数据并标记 degraded/cached。
- 采集仅调用公开 RSS/Atom/JSON/REST，不抓 HTML、不调用 LLM、零第三方 Python 依赖。

## 目录

```text
worklens-hub_9bx8/v1/     主站（本期 / 待审 / 我的，响应式）
  data-adapter.js         discoveries → 页面模型（可在 Node 测试）
  review-model.js         Skill 待审 / 引入账本模型
  atelier-model.js        实验室数据模型（圈层 / Idea / 复盘 / 巡检）
  components.jsx views.jsx app.jsx styles.css
worklens-ai-news/v2/      AI 情报页
shared/worklens-shell.js  全站四入口导航壳
config/                   信息源配置
data/                     机器可读候选与画像数据
scripts/                  采集、校验与 Pages 组装脚本
.github/workflows/        定时采集、CI 与 Pages 发布
```

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/worklens-hub_9bx8/v1/worklens-hub_9bx8_pc.html
# 打开 http://localhost:8000/worklens-ai-news/v2/index.html
```

源码入口使用 `../../shared/`、`../../data/` 加载共享资源；Pages 构建会重写为发布层级路径，不要在源码中改用站点绝对路径。

生成 Pages 产物：`python3 scripts/build_pages.py`（输出 `_site/`，含 `/`、`/ai-news/` 与旧地址重定向）。

## 测试

```bash
node --test tests/*.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

## 路线图

- [x] 产品结构、工作画像与喜好反馈模型
- [x] Pages 发布与定时采集骨架，真实采集结果接入页面
- [x] GitHub 公开仓库 / Star 信号、脱敏导入契约与 RSS/OPML 本地连接器
- [x] Skill 待审队列数据契约、评测状态机与首个限范围试用
- [x] 核心开源者圈层、Idea 项目化、推荐复盘、健康巡检数据契约
- [x] 信息架构收敛：4 个入口、PC/H5 合一、移除演示数据
- [ ] 喜好账本反哺排序（真人确认后再调整画像权重）
