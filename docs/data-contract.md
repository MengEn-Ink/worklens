# WorkLens 数据契约

## discoveries.json

由每日采集工作流生成，保存 GitHub 官方 API 或配置的已整理公开数据源中的事实字段。摘要、推荐和工作匹配判断不应覆盖这些字段。

### 已整理数据源与缓存

`config/sources.json` 的 `curated_feeds` 在 GitHub API 之前导入。每项可配置仓库内相对 `path`，或公开 `https://` 的 `url`；支持顶层数组，以及顶层 `candidates`、`items`、`repositories` 数组。候选必须包含 `full_name`，或可从 `https://github.com/{owner}/{repo}` 形式的 `html_url` 推导。采集器会规范化 GitHub API 计数字段与已整理的 `stars`、`forks`、`open_issues`、字符串许可证等字段。

默认配置提供禁用的 `data/curated-repositories.json` 本地路径示例，不放置未经确认的远程链接。接入上游时，将其 JSON 同步到该路径后启用，或配置已验证的公开 HTTPS 原始 JSON URL。

- 导入顺序固定为 `curated_feeds → repositories → github_profiles → github_queries`。
- feed 的 `generated_at`（缺失时按本次读取时间）在 `max_stale_hours` / `policy.curated_feed_max_stale_hours` 内时，显式仓库复用其数据并跳过 repo API；过期后自动回源刷新。
- profile/search 是列表发现请求，可在 `policy.discovery_cache_hours` 内按 source 复用已有 `data/discoveries.json`。每个成功请求在 `source_status` 记录真实 `fetched_at`；缓存命中沿用该时间而不会续期，超过 TTL 后自动重新请求。旧数据首次可回退顶层 `generated_at`，并将该时间写入 `fetched_at`。缓存候选继续保留 `source`、`also_seen_in` 和 `relationships`。
- 过期 feed 与 GitHub 刷新结果重复时，以新 API 事实字段替换旧字段，同时将 curated 来源保留在 `also_seen_in`。
- feed 读取或解析失败只在 `source_status` 留痕，不阻断 GitHub 抓取。缓存状态也通过 `cached`、`cache_source` 或 `fetched_at` 明示。
- 输出继续保持 `schema_version: 1`，候选字段兼容 `skill_review.py` 等下游。

关键字段：

- `generated_at`：本轮采集时间。
- `candidates`：去重后的仓库候选。
- `source_status`：每个来源是否采集成功；失败不能解释为“没有项目”。
- `source` / `also_seen_in`：候选的发现来源。
- `relationships`：与公开 GitHub 画像的关系，例如 `MengEn-Ink:owned` 或 `MengEn-Ink:starred`；仅来自公开接口，不表示项目质量。

### GitHub 公开画像

`config/sources.json` 的 `github_profiles` 可以声明公开用户名，并分别开启：

- `owned_public_repositories`：该用户公开拥有的仓库。
- `starred_public_repositories`：该用户公开 Star 的仓库。

采集器固定使用 `/users/{username}/repos` 与 `/users/{username}/starred` 公共接口，并再次过滤 `private=true` 的记录。不得改用 `/user/repos` 把私有仓库带入公开数据集；公开 Star 仅作为兴趣信号，不能直接视为推荐、采用或安全背书。

## ai-news.json

由 `scripts/collect_public_feeds.py` 采集，在原有 AI 聚合数据契约上合并公开资讯源；旧的 `scripts/collect_ai_news.py` 仍可单独兼容历史任务。

契约要点：

- 数据源：GitHub Releases Atom、Hacker News API、Lobsters RSS、OpenAI / Google Developers / AWS ML / NVIDIA / Cloudflare AI / GitHub Blog / Stack Overflow Blog 官方 RSS，以及 OSV.dev querybatch、CISA KEV 静态 JSON和原有 AI News Aggregator。
- 基础字段继续为 `title/url/published_at/site_name/source`；`source` 在 schema v2 为来源名数组。扩展字段为 `category`、`priority`（`P0 | P1 | P2`）、`tags`、`metadata`、`also_seen_in`。旧的字符串 `source` 与缺失扩展字段仍受页面适配器支持。
- 排序固定为 `P0 > P1 > P2 > 无级`，同级按 `published_at` 倒序。安全公告为 P0、官方发布与工程源通常为 P1、社区及聚合信号为 P2。
- 去重先规范化 canonical URL（移除 fragment、`utm_*` 等跟踪参数），再按 GitHub `repository + release/tag`、OSV/GHSA/CVE aliases 做实体合并；合并后保留最高优先级、全部 `source`、次要来源 `also_seen_in` 及标签。
- OSV 只查询 `config/sources.json` 的小型 ecosystem/package 监控清单；CISA KEV 只输出命中配置关键词或最近新增的条目；HN 先取 top/new ID，再以有限并发读取详情并执行关键词与最低热度过滤。RSS/Atom 使用 stdlib XML，不抓 HTML、不调用 LLM、不引入第三方依赖。
- 每个 source 在 `source_cache` 独立保存条目、真实 `fetched_at`、`checked_at`、配置指纹及可用的 ETag/Last-Modified。24 小时 TTL 内直接复用；配置变化会使旧缓存失效；过期后使用条件请求；429、5xx 和网络瞬断有限指数退避。单源失败仅将对应 `source_status` 标为 `degraded/cached` 并回退该源缓存，不延长成功抓取时间，也不阻断其他源。
- `public_feeds.source_max_items` 为所有来源提供严格全局单源上限，单源 `max_items` 只能进一步收紧，实际值取两者最小值；合并结果再由顶层 `public_feeds.max_items` 截断。当前 OSV/CISA 分别最多保留 30/40 条，避免安全源淹没页面。
- 成功响应若解析为空且该源存在非空旧缓存，默认标记 `degraded/cached` 并保留旧数据，防止上游异常空响应清库；只有来源显式配置 `allow_empty: true` 才接受清空。合法空列表也会记录在逐源缓存中，并可在 TTL 内正常复用。
- `source_cache` 是采集器的逐源降级存储，页面只消费顶层 `items`；采集器合并时会保留现有 `ai-news.json` 中无法归属到逐源缓存的历史聚合条目。

## 页面适配层

PC 与移动端页面在启动后读取发布产物中的 `data/discoveries.json` 与 `data/skill-review-queue.json`，再通过 `data-adapter.js` 转为页面视图模型。

适配规则：

- 仅使用公开 GitHub 元数据，不写入私有工作数据、内部地址、凭证或个人信息。
- `candidates` 为空或请求失败时，页面保留内置种子数据，避免 Pages 白屏。
- Skill 类候选只进入待审队列，页面不得自动安装、执行或推荐绕过安全评测。
- 评分仅用于排序和解释：`fit`、`novelty`、`cost`、`risk` 由公开指标与 freshness 粗算，不能替代许可证、安全和人工审查。
- AI 工作情报页面通过独立 `data-adapter.js` 读取 `data/ai-news.json`，仅使用标题、公开 URL、发布时间和来源；并在页面右上角只读展示 `generated_at`（含 UTC）与 `source_status.cached/degraded` 徽标，用于判断数据新鲜度与降级状态。字段缺失会转为安全占位；空数据、加载失败与浏览器本地存储异常均不得导致白屏。
- 收藏与阅读历史仅保存在浏览器 `localStorage`；写入失败时退化为当前会话状态，不回写公开数据。外链仅接受 HTTP(S)，并使用 `noopener,noreferrer` 新标签打开。

## core-circle.json

公开 GitHub 开源者关系图。`people` 使用 `seed | core | candidate | watch` 分层；`relationships` 仅允许 following、follower、contributor、co_contributor、shared_topic，并必须附证据 URL 与观测时间。follow 类关系只能是弱信号。`projects` 保存分类、收录状态及 README、Topics、语言、SPDX 许可证、更新时间、Release、贡献者等核验证据；缺少声明许可证的项目不得标为推荐。配置与边界见 [core-circle.md](core-circle.md)。

## profile.json

个人工作画像的最小结构。默认不保存原始文档、会议逐字稿、聊天内容或私有代码，只保存经用户允许的主题、权重、反馈和证据引用。

## profile-signals.json

由本地导入器生成的脱敏聚合结果，用于把授权范围内的工作信号折叠成公开可提交的画像摘要。

约束：

- 输入可以是白名单 JSONL，或本地 RSS / 播客 OPML 订阅导出。
- 输出只保留 `record_count`、来源计数、最近时间、粗粒度主题统计和加盐证据哈希。
- OPML 导入时会先去掉订阅 URL 的账号、查询参数和 fragment，再散列保存，避免把私有参数带进仓库。
- `source_type` 当前支持 `meeting | lark_doc | podcast | article | repository | rss`。

## skill-review-queue.json

Skill 候选的安全评测待审队列，由 `scripts/skill_review.py sync` 从 `discoveries.json` 自动入队、由真人通过 `transition` / `check-update` 推进。完整状态机、评测项与命令见 [skill-review.md](skill-review.md)。

契约要点：

- `policy.auto_install` 必须恒为 `false`；自动化只能追加 `candidate` 和刷新公开元数据。
- `queue[].state` 取值：`candidate | screening | needs_changes | trial | adopted | rejected | quarantined`，非法流转由 `validate` 拒绝。
- 页面适配层只能把队列转换为状态计数、阻断项进度和袖珍对比器；不得提供安装、流转、执行脚本或写入用户 Skill 目录的入口。
- 进入 `trial` 前 7 项阻断评测（许可证、凭证、安装脚本、外发声明、写范围声明、注入面审查等）必须全部 `pass`，且必须声明试用 `scope`。
- 进入 `adopted` 必须有完成且 `result=pass` 的试用记录。
- `history` 首条必须是 `worklens-bot` 的 `enqueued`；之后每个事件都必须是真人并附理由，状态回放必须与当前 `state` 一致。
- 队列只保存公开 GitHub 元数据与评测记录，不保存 Skill 源码、原文或任何凭证。

## skill-adoptions.json

正式引入账本，与 `skill-review-queue.json` 一对一关联。由真人直接编辑 JSON、通过 PR 评审入账，由 `scripts/skill_adoptions.py validate` 校验契约与跨文件一致性。完整定义与字段说明见 [skill-adoptions.md](skill-adoptions.md)。

契约要点：

- `policy.auto_install`、`policy.auto_execute` 必须恒为 `false`；`policy.human_decision_required=true`；`policy.public_github_only=true`；`policy.max_automation_stage="candidate"`。
- 每条 adoption 必须含 `decision_reason`、`import_scope`、`rollback_plan`、`revert_command` 四段工程描述，且 `human_accepted=true`。
- `decided_by` 禁止 bot；`history` 首条必须是 `event=adopted` 的真人事件。
- 账本中的 `skill_review_id` 必须指向队列中真实存在且 `state=adopted` 的条目；队列中每一个 `state=adopted` 条目必须在账本中有对应 adoption。
- 账本为空（空数组）是合法最小值；本仓库当前队列无 `adopted` 条目，账本为空。
- 页面适配层只做只读展示，不提供安装、执行、流转或登记入口。

## idea-pipeline.json

Idea → 调研 → 方案 → 脚手架 → 验收的项目化流程记录，由 `scripts/idea_pipeline.py validate`
校验。完整阶段定义与命令见 [idea-pipeline.md](idea-pipeline.md)。

契约要点：

- 阶段按 `idea → research → plan → scaffold → accepted` 单向逐格推进，任何阶段可带理由转 `archived`；`history` 回放必须与当前 `stage` 一致。
- 进入 `research` 需 ≥2 条公开证据与调研笔记；`plan` 需可验收标准；`scaffold` 需仓库内产物路径；`accepted` 需 `result=pass` 的验收记录与证据。
- `worklens-bot` 最多推进到 `research`，之后的流转必须由真人记录。
- 策略常量恒为 `public_only=true`、`auto_scaffold=false`、`require_evidence=true`；证据必须是 HTTPS 公开链接，拒绝内网域名与凭证参数。
- 页面适配层只能只读展示流程状态，不得提供创建、流转、脚手架或安装入口。

## recommendation-reviews.json

「发现 → 推荐 → 复盘 → 画像调整」回路的推荐复盘记录，由 `scripts/recommendation_review.py validate` 校验（只读、不联网、不写数据）。

契约要点：

- 策略常量恒为 `policy.public_only=true`、`auto_adjust_profile=false`、`require_human_policy_ref=true`、`automation_max_conclusion="downgrade"`；结论枚举固定为 `keep | downgrade | remove`。
- 每条复盘必须引用一次真实推荐（`recommendation.id/recommended_at/channel/signal_source/reason`），复盘对象 `subject.full_name + html_url` 必须命中 `discoveries.json` 的公开候选，禁止凭空记录仓库外对象。
- `observation_window` 为 RFC3339 区间且 from ≤ to；`observed_facts` 至少 1 条，每条事实的 `observed_at` 必须落在观察窗口内，`source_url` 必须是 HTTPS 公开链接，拒绝内网域名与凭证查询参数。
- 自动化执行者（`worklens-bot` / `worklens-loop`）只能在既有真人策略（`authority=human-policy` + `policy_ref`）下记录到 `downgrade`；`remove`、画像权重固化与任何自动算法调整必须由真人（`authority=human`）记录。
- 页面适配层只能只读展示复盘记录与调整说明，不得提供修改画像、改写推荐或删除记录的入口。
- `python3 scripts/recommendation_review.py summarize` 可输出只读画像调整待办摘要：仅统计 `keep | downgrade | remove`，并把 `authority=human-policy` 的降权 / 移除记录列为待真人确认事项；该命令不访问网络、不写 `profile.json`、不改变画像权重。

## 喜好反馈

推荐使用以下事件结构：

```json
{
  "subject": "owner/repository",
  "signal": "love | like | dislike | subscribe",
  "weight_delta": 0.1,
  "tags": ["agent", "skill"],
  "created_at": "RFC3339 timestamp",
  "evidence": "页面或来源 URL"
}
```

喜好只能影响排序和推荐解释，不得绕过 Skill 安全审查、许可证检查和人工确认门禁。
