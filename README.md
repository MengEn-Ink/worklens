# WorkLens · 工作能力雷达

WorkLens 是围绕个人日常工作持续生长的开源能力雷达：发现优秀项目，结合工作画像进行评估，形成学习路线，并把高价值能力沉淀为可复用的 Skill、UI Skill 或工程脚手架。

## 当前能力

- 中文优先的 PC 与移动端编辑型知识库原型
- GitHub Search、Trending、RSS 与专题 Hub 的候选源框架
- 发现 → 去重 → 工作匹配 → 收录 → 引入 → 复盘的处理管道
- 集成实时公开资讯：GitHub Releases、HN、Lobsters、AI 官方博客、OSV、CISA KEV 与既有 AI 聚合器统一写入 `data/ai-news.json`，支持跨源实体去重及 P0/P1/P2 优先级
- 代码仓库、会议、飞书文档、播客文章等工作画像信号模型
- `❤❤ / ❤ / ✕ / 订阅` 喜好反馈，持续调整画像与推荐
- 技能工坊：将高频需求转化为 Skill 候选
- 真实 `data/discoveries.json` 已接入 PC 与移动端页面，页面优先展示 GitHub Actions 自动采集结果，采集失败时才回退种子数据
- 支持本地 RSS / 播客 OPML 脱敏导入，订阅 URL 会先去敏再散列，避免把私有参数带入仓库
- Skill 候选进入独立待审队列：固定阻断评测项 + 人工状态机（待审→评测→试用→引入/拒绝/隔离），自动化只入队不流转，永不自动安装
- 质量与安全门禁纳入 CI：单元测试、队列契约校验、密钥与内网信息扫描
- GitHub Pages 由 `scripts/build_pages.py` 统一组装，移动端、PC 端和 PC v4 Atelier 入口共享可测试发布契约
- PC v4 Atelier 已接入 `/atelier/`：只读展示 Skill 待审队列、alchaincyf 开源游戏项目证据台与 Pages 发布契约，不触发安装或外部写操作
- Idea 项目化流程已有最小公开数据契约、Atelier 只读面板与移动端袖珍摘要：`data/idea-pipeline.json` + `scripts/idea_pipeline.py validate`，自动化最多推进到 research，不创建脚手架、不自动安装 Skill
- 推荐复盘最小闭环已建立：`data/recommendation-reviews.json` + `scripts/recommendation_review.py validate|summarize`，复盘对象必须命中 discoveries 公开候选；Atelier「推荐复盘」面板只读展示，CLI 只输出待真人确认的画像调整摘要，自动化在真人策略下最多标记降权，不自动调整画像或推荐
- 四小时 Loop 健康巡检账本已建立：`data/health-checks.json` + `scripts/health_check.py validate|summarize`，只记录公开数据新鲜度、公开 Issue 与下一项，不写入私有数据、凭证或内部地址

## 页面入口

- 移动端：GitHub Pages 默认入口
- PC 端：`/desktop/`
- PC v4 Atelier：`/atelier/`
- AI 工作情报（PC/H5 响应式）：`/ai-news/`

## 数据与隐私原则

1. 推荐必须保留来源和判断证据。
2. 工作画像只记录完成推荐所需的最小信息。
3. 每类信息源可单独关闭、清理和调整权重。
4. 喜好是辅助信号，不替代项目安全、质量与许可证审查。
5. Skill 默认先进入待审队列，含脚本、网络或写操作时不得自动安装。

## 自动化节奏

- 每四小时：健康巡检与数据刷新，核验公开数据新鲜度、Actions 与未关闭 Issue，结果写入公开账本 `data/health-checks.json`（`scripts/health_check.py validate`，CI 强制校验）。
- 每日：采集、去重、补充仓库元数据（GitHub Actions 实际在每日 01:17 UTC 执行）。
- GitHub discovery 与每个公开资讯源默认使用独立 24 小时 TTL；支持 ETag/Last-Modified 条件请求，刷新失败会按源保留旧候选并标记 degraded/cached，避免中断后续链路。
- 公开资讯按 P0 > P1 > P2 > 无级、同级按时间倒序展示；canonical URL、GitHub release 实体与 CVE/OSV aliases 会跨源去重并保留来源列表。
- 采集仅调用公开 RSS/Atom/JSON/REST 数据源，不抓 HTML、不调用 LLM、零第三方 Python 依赖；瞬时网络错误、429 与 5xx 使用有限指数退避重试。
- 每周：生成精选、学习路线和待试用队列。
- 每月：复查已引入能力、信息源质量与画像规则。

## 目录

```text
worklens-mobile_8a6r/v2/  移动端当前设计
worklens_zn3k/v3/         PC v3 当前设计
worklens_zn3k/v4/         PC v4 Pages Atelier 只读工坊
config/                   信息源配置
data/                     机器可读候选与画像数据
scripts/                  采集和归纳脚本
.github/workflows/         定时采集与 Pages 发布
```

## 本地预览

直接打开：

- `worklens-mobile_8a6r/v2/worklens-mobile_8a6r_h5.html`
- `worklens_zn3k/v3/worklens_zn3k_pc.html`
- `worklens_zn3k/v4/index.html`
- `worklens-ai-news/v2/index.html`

这些源码入口使用 `../../shared/` 加载共用页面壳；Pages 构建会按发布层级重写为 `./shared/` 或 `../shared/`，不要在源码中改用站点绝对路径。

Pages 产物可用 `python3 scripts/build_pages.py` 生成；当 `worklens_zn3k/v4/` 存在时会自动发布到 `/atelier/`，当前缺源时只在 manifest 中标记 skipped。

## 路线图

- [x] 产品结构、PC 与移动端原型
- [x] 工作画像与喜好反馈模型
- [x] Pages 发布与定时采集骨架
- [x] 将真实采集结果接入页面
- [x] 接入 GitHub 公开个人仓库与 Star 关注项目（只使用公开用户接口，保留关系证据）
- [x] 建立会议、飞书文档、播客与文章的脱敏导入契约和本地导入器（拒绝原文、标题、URL 与逐字稿）
- [x] 支持通用 RSS / 播客 OPML 本地连接器（仅本地解析、脱敏聚合，不接触私有凭证）
- [x] 建立 Skill 待审队列数据契约与评测状态机（7 项阻断检查、人工流转门禁、CI 契约校验，自动化只入队不安装）
- [x] 建立核心开源者圈层数据模型与公开 GitHub 证据契约（seed/core 分层、协作/主题/follow 关系、数量上限与隐私边界）
- [x] Skill 评测清单实跑与限范围试用记录：首个真实候选已完成阻断项评测并进入只读试用，队列状态已只读接入 PC / 移动端页面
- [x] 移动端 Skill 待审袖珍对比器：按通过率、状态和待补证项做只读比较，不自动安装
- [x] WorkLens PC v4（Pages Atelier）工程化接入当前 main
- [x] Idea → 调研 → 方案 → 脚手架 → 验收的项目化流程最小数据契约、Atelier 只读接入与移动端袖珍摘要
- [x] 工作画像与推荐闭环完善
