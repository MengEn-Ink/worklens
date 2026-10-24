# Skill 安全评测与待审队列

WorkLens 可以发现 Skill 类开源项目，但**发现不等于信任**。所有 Skill 候选先进入待审队列，经过人工安全评测、小范围试用后才能正式引入；任何阶段都不自动安装、不自动执行第三方脚本。

## 1. 设计取舍：借鉴了哪些成熟方案

| 成熟实践 | 对 WorkLens 的启发 | 是否直接采用 |
| --- | --- | --- |
| Anthropic：Agent Skill 应被当作“需要评审与持续维护的软件”，企业应只保留经过批准、记录在案的 Skill；授权要按工具、数据与环境逐层收敛 | 建立显式的待审队列、批准记录与最小权限评测项；评测未通过不得进入试用 | 采用其治理原则：队列 + 人工门禁 + 权限/数据/环境分层检查::cite[1] |
| Anthropic「可信 Agent」：单一防护不够，需要在每一层、由每一方共同防守，工具与数据授权要谨慎 | 安全不依赖单个分数，阻断项逐项留证据；评测项全部 `pass` 才允许试用 | 采用分层防御思路，不承诺“评测通过即安全”::cite[2] |
| OpenSSF Scorecard：用固定、公开的检查项（许可证、维护状态、依赖固定、令牌权限、危险工作流等）评估项目，消费者可逐项看探针而非只信聚合分 | 评测清单固定、公开、可机读；许可证/维护/供应链分别记录 `pass/fail/warn/unknown`，不做单一“安全分” | 采用“固定检查项 + 证据”的形式；不在本项目跑 Scorecard（候选均为远程仓库，评审时以人工核对上游报告为准）::cite[3] |
| gitleaks + CodeQL + dependency-review 的 CI 门禁组合，以及 GitHub push protection | 密钥/内网信息扫描进入本仓库 CI，待审队列契约也由 CI 强制校验 | 采用高置信密钥正则自扫（无外部 Action 依赖）；深度 SAST/依赖扫描留待真正引入代码时再启用::cite[4] |
| Agent Skill 安全威胁研究社区整理的攻击分类：提示注入、工具投毒、权限提升、数据外泄、后门、跨插件攻击等 | 评测清单覆盖外发数据声明、写范围声明、安装脚本审查、注入面审查四类高危面 | 采用威胁分类作为评测项来源；运行时监控等重防护暂不采用（WorkLens 不执行第三方 Skill）::cite[5] |
| Red Hat 对 Agent Skill 安全威胁与控制的梳理：技能内容、工具权限与运行环境需要分别控制 | 试用阶段强制声明 scope（只读/限目录/限数据），并保留试用结论 | 采用“先限范围试用、再正式引入”的两段式门禁::cite[6] |

明确**不做**的事：

- 不自动下载、安装或执行任何候选 Skill；脚本永远不把候选状态推进到 `trial/adopted`。
- 不做聚合“安全评分”。固定阻断项逐项留证据，任何一项不过即不能试用。
- 不把公开 Star 数、热度或榜单排名当作安全证据。

## 2. 数据契约：`data/skill-review-queue.json`

```json
{
  "schema_version": 1,
  "generated_at": "RFC3339",
  "policy": {
    "auto_install": false,
    "human_gate": "candidate 之后的所有流转必须由真人记录 decided_by、时间与理由",
    "blocking_checks": ["...7 项..."],
    "states": ["candidate", "screening", "needs_changes", "trial", "adopted", "rejected", "quarantined"]
  },
  "queue": [ { "...": "见下" } ]
}
```

队列条目只保存**公开 GitHub 元数据 + 评测过程记录**：

- `id`：稳定编号 `SR-0001`，入队顺序分配，不复用。
- `subject` / `html_url` / `source` / `also_seen_in`：公开仓库与发现来源证据。
- `state`：评测状态机当前状态。
- `checks`：评测项结果，每项含 `status`（`pass/fail/warn/unknown`）、`evidence`、`checked_at`、`by`。
- `risk_flags`：基于公开元数据的自动风险标记（`no_license`、`license_unrecognized`、`archived`、`stale_upstream`），仅提示，不替代人工评测。
- `trial`：试用记录（`started_at`、`scope`、`planned_end_at`、`result`、`finished_at`、`conclusion`）。
- `history`：不可跳过的审计轨迹；首条必须是 bot 的 `enqueued`，之后所有事件必须来自真人。

## 3. 评测状态机

```text
candidate ──► screening ──► trial ──► adopted
   │             │  ▲          │
   │             ▼  │          ├──► needs_changes ──► screening
   │        needs_changes      ├──► rejected（终止）
   │             │             └──► quarantined
   ├──► rejected │
   ▼             ▼
（终止）    quarantined ──► screening（复核通过）/ rejected
adopted ──► quarantined（引入后发现问题，立即隔离）
```

- **candidate**：`scripts/skill_review.py sync` 从 `data/discoveries.json` 自动入队，分类逻辑与页面 `data-adapter.js` 完全一致（UI 类优先，其次才是 Skill）。同步只追加候选、刷新公开元数据，**永不自动流转**。
- **screening**：真人开始评测，逐项更新检查清单。
- **needs_changes**：要求上游整改或本地补充控制措施后复核。
- **trial**：7 项阻断检查全部 `pass`，且真人声明试用 `scope`（只读范围、数据范围、期限）后才能进入。
- **adopted**：试用结束且 `result=pass`、留下结论后，由真人正式引入。
- **rejected**：终止，保留理由。
- **quarantined**：任何阶段发现阻断性问题立即隔离；已正式引入的 Skill 也必须能回到隔离态。

### 阻断性评测项（7 项，任一非 pass 不得试用）

| key | 审查问题 | 初始值 |
| --- | --- | --- |
| `license_declared` | 是否声明了可识别的开源许可证（不能是 NOASSERTION） | bot 按 GitHub API 预填 |
| `license_compatible` | 许可证是否与 WorkLens 的使用与再分发方式兼容 | unknown，人工判定 |
| `secret_clean` | Skill 包与示例数据是否不含密钥、Token、Cookie 或私有地址 | unknown，人工扫描 |
| `install_safe` | 安装脚本/钩子是否透明、无混淆代码、无 curl\|sh 远程执行 | unknown，人工阅读 |
| `network_declared` | 外发主机、用途与数据内容是否已声明且最小化 | unknown，人工核对 |
| `write_scope_declared` | 文件系统写操作的目录范围与副作用是否已声明 | unknown，人工核对 |
| `injection_surface_reviewed` | 外部拉取内容导致的提示注入/工具投放入口是否已审查 | unknown，人工分析 |

另有 `dependencies_pinned`、`maintained` 两个非阻断参考项，允许 `warn`。

## 4. 命令行用法

```bash
# 每日采集后自动执行，也可手动运行（幂等）
python3 scripts/skill_review.py sync

# CI 门禁：校验数据契约与状态机不变量
python3 scripts/skill_review.py validate

# 真人开始评测（--by 禁止使用含 bot 的身份）
python3 scripts/skill_review.py transition \
  --subject owner/repo --to screening --by <你的标识> --note "开始人工评测"

# 记录评测项
python3 scripts/skill_review.py check-update \
  --subject owner/repo --check secret_clean --status pass \
  --by <你的标识> --evidence "本地 gitleaks 无命中，示例数据无凭证"

# 7 项阻断全过后，限定范围试用
python3 scripts/skill_review.py transition \
  --subject owner/repo --to trial --by <你的标识> \
  --trial-scope "只读方式辅助整理周报，禁止访问私有目录" --trial-days 7 \
  --note "阻断项全部通过，限范围试用一周"

# 试用通过，正式引入
python3 scripts/skill_review.py transition \
  --subject owner/repo --to adopted --by <你的标识> \
  --trial-result pass --trial-note "一周内无越权访问，输出稳定" \
  --note "试用通过，正式引入"

# 任何阶段发现问题：隔离或拒绝（必须写清理由）
python3 scripts/skill_review.py transition \
  --subject owner/repo --to quarantined --by <你的标识> --note "发现未声明的外发域名"
```

`transition` 在写入后会立即再跑一遍完整契约校验，任何不变量被破坏都会报错退出，避免产生无法审计的状态。

## 5. CI 与自动化边界

- `.github/workflows/ci.yml`：每次 push / PR 运行单元测试、队列契约校验与敏感信息扫描。
- `.github/workflows/collect.yml`：每日采集后自动 `sync`，仅把**新候选**追加为 `candidate` 并随数据提交；状态推进只能来自真人命令。
- `scripts/security_scan.py`：扫描 git 已跟踪文本文件中的高置信密钥、内网域名与 URL 凭证参数；误报需在 `config/security-scan-allow.json` 按「文件 + 规则 + 行内容片段」精确登记理由。

## 6. 参考来源

1. Anthropic Gives Agent Skills to Neutral Foundation（把每个 Skill 当作需要评审与维护的软件、记录已批准 Skill）：https://techjournal.org/anthropic-donates-agent-skills
2. Anthropic, Trustworthy agents in practice（工具/数据/环境授权与分层防御）：https://www.anthropic.com/research/trustworthy-agents
3. OpenSSF Scorecard（固定公开检查项与基线）：https://scorecard.dev/
4. gitleaks + CodeQL + dependency-review 的 CI 门禁实践：https://github.com/sam-bowman/federated-chat-app/issues/250
5. LLMSecurity/awesome-agent-skills-security（提示注入、工具投毒、权限提升、数据外泄、后门等威胁分类）：https://github.com/LLMSecurity/awesome-agent-skills-security
6. Red Hat Developer, Agent Skills: Explore security threats and controls：https://developers.redhat.com/articles/2026/03/10/agent-skills-explore-security-threats-and-controls
