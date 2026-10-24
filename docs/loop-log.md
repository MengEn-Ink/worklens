# WorkLens 推进轮次记录

每轮闭环完成后记录：成果、验证证据、下一轮唯一最高优先级。最新在最上面。

## 2026-10-25 · Skill 真实候选评测与页面只读接入

**成果**

- 按上一轮最高优先级收口：选择公开、低风险候选 `CodeSigils/skill-discovery` 做首轮真实评测，完成 7 项阻断检查，进入 7 天只读限范围试用；仍未安装、未执行第三方脚本、未访问私有数据。
- PC 与移动端页面读取 `data/skill-review-queue.json`，在技能工坊中展示队列状态计数、阻断项缺口、试用范围和 `auto_install=false` 安全边界。
- 保留成熟方案取舍：继续沿用 Anthropic 分层授权、OpenSSF 固定检查项、gitleaks/密钥扫描和 Agent Skill 威胁分类，不把热度当作安全证据。
- README 路线图更新：Skill 实跑与限范围试用已完成；下一轮切到 Idea → 调研 → 方案 → 脚手架 → 验收流程。

**验证证据**

- 本地：23 个单元测试全部通过；`python3 scripts/skill_review.py validate` 通过；`python3 scripts/security_scan.py` 通过。
- 前端：对本轮变更的 PC / 移动端 `app.jsx`、`views.jsx`、`data-adapter.js` 执行 `standard-lint`，未出现 parsing/syntax error、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断问题；剩余为既有风格类提示。
- 数据：队列当前含 1 个 `trial` 候选与其余 `candidate` 候选，`auto_install=false` 保持不变，页面只读展示。

**下一轮唯一最高优先级**

建立 Idea → 调研 → 方案 → 脚手架 → 验收的项目化流程：从一个公开候选生成可追踪 idea 卡、调研证据、方案草稿、脚手架任务与验收清单，仍不得自动安装未经评测的 Skill。

## 2026-10-24 · Skill 待审队列契约与评测状态机

**成果**

- 新增 `scripts/skill_review.py`：`sync` 只把 Skill 候选自动入队并刷新公开元数据（幂等、无变化不写文件），`validate` 强制数据契约与状态机不变量，`transition` / `check-update` 只接受真人身份。
- 评测状态机：`candidate → screening → needs_changes/trial → adopted/rejected/quarantined`；试用前 7 项阻断检查（许可证、凭证、安装脚本、外发声明、写范围、注入面等）必须全部 `pass`；正式引入必须有 `result=pass` 的限范围试用记录；历史回放必须与当前状态一致。
- 新增 `scripts/security_scan.py`（密钥/内网域名/URL 凭证扫描，白名单精确登记）与 CI 工作流 `.github/workflows/ci.yml`（单测 + 队列契约 + 敏感扫描）；每日采集联动自动入队。
- 初始队列 11 条真实候选，全部 `candidate`、`auto_install=false`。
- 文档：`docs/skill-review.md`（含成熟方案取舍：Anthropic 分层授权、OpenSSF Scorecard 固定检查项、gitleaks CI 门禁、Agent Skill 威胁分类），更新 `docs/data-contract.md` 与 README 路线图。

**验证证据**

- 本地：20 个单元测试全部通过；`skill_review validate`、`security_scan` 通过；sync 重复运行字节不变。
- CI：`质量与安全门禁` 与 `发布 GitHub Pages` 两个工作流在提交 `b4eeee9` 上均 success（首轮扫描器未覆盖未跟踪文件导致 CI 失败，已修复并收拢为单提交）。
- 线上：`https://mengen-ink.github.io/worklens/data/skill-review-queue.json` 200（11 条、auto_install=false）；移动端 `/`、PC 端 `/desktop/`、`/data/discoveries.json` 及页面静态资源均 200。

**下一轮唯一最高优先级**

对真实候选执行首轮人工评测：用 `check-update` 把 1 个低风险候选推进到 `screening` 并记录评测证据，再把待审队列状态（各状态计数、阻断项缺失提示）以只读方式接入 PC/移动端页面；仍然禁止自动安装。

## 2026-10-24（早轮）· RSS/播客 OPML 本地连接器

本地 OPML/JSONL 脱敏导入器 `scripts/import_profile_signals.py`：订阅 URL 去账号/查询参数/fragment 后加盐散列，只输出主题与来源聚合；提交 `dc04ac2`，Pages 发布成功。
