# WorkLens 推进轮次记录

每轮闭环完成后记录：成果、验证证据、下一轮唯一最高优先级。最新在最上面。

## 2026-10-26（凌晨轮）· Idea 项目化流程最小数据契约与首个真实样例

**成果**

- 收口最高优先级 Issue #1：分两个独立提交上线 Idea → research → plan → scaffold → accepted 的最小机器可读契约。
- `d9c46fa`：`data/idea-pipeline.json`（schema、策略常量、五阶段定义）、`scripts/idea_pipeline.py validate`（阶段逐格推进、history 回放一致、research 需 ≥2 条 HTTPS 公开证据与调研笔记、plan/scaffold/accepted 准入材料、`worklens-bot` 最多推进到 research、拒绝内网域名与凭证参数）、`tests/test_idea_pipeline.py` 负向用例、CI 门禁步骤、`docs/idea-pipeline.md` 与 `docs/data-contract.md` 契约章节。
- `e0f893b`：登记首个真实 Idea 样例 `scorecard-skill-metrics`，证据来自仓库外部公开来源（ossf/scorecard 官方仓库与 GitHub 公开元数据接口，均实测 200，Apache-2.0、活跃维护），停在 research，只作弱信号调研，不安装、不执行第三方内容。
- 本轮不改任何前端页面；只读页面接入另立 Issue，并行 WIP 已保留在远端分支 `wip/idea-readonly-view`（需基于当前契约重整后才能合入）。

**验证证据**

- 本地：`python3 -m unittest discover -s tests -p 'test_*.py'` 33 个测试全部通过；`idea_pipeline.py validate` 通过；`security_scan.py` 通过；`build_pages.py` 产物含 `data/idea-pipeline.json`；node 适配器语法检查与 `node --test tests/*.js` 14 项通过。
- CI：`质量与安全门禁`、`发布 GitHub Pages` 在 `e0f893b` 均 success。
- 线上：`https://mengen-ink.github.io/worklens/data/idea-pipeline.json` HTTP 200，内容与 main 一致（1 个 research 阶段样例、2 条公开证据、策略常量不变）；Issue #1 由本轮收口提交关闭，下一轮继续处理只读页面接入。

**下一轮唯一最高优先级**

把 `idea-pipeline.json` 的阶段、证据计数与下一步以只读方式接入 Atelier（及移动端）页面，展示自动化边界（`auto_scaffold=false`、bot 最多到 research），不得提供创建、流转、脚手架或安装入口；可复用 `wip/idea-readonly-view` 分支上的前端实现，但必须基于 main 当前契约重整并补齐契约测试。

## 2026-10-25（晚轮）· PC v4 Atelier 只读工坊上线

**成果**

- 收口上一轮最高优先级：新增 `worklens_zn3k/v4/`（index.html / atelier-model.js / app.jsx / styles.css），严格延续 v3 田野杂志设计语言（同款字体、纸墨配色与刊物质感），Pages 发布到 `/atelier/`，manifest 由 skipped 变为 published。
- 页面三块只读内容：刊头与安全边界（auto_install=false、不安装/不执行/不流转）、Skill 待审队列看板（按状态分组、试用候选置顶、7 项阻断检查矩阵、待补证标签、试用范围）、核心开源者圈层（alchaincyf 公开证据、followers 弱信号标注、无许可证不推荐规则、项目证据台）。
- `atelier-model.js` 为纯函数视图模型（window/module.exports 双守卫），新增零依赖 `tests/test_atelier_model.js` 3 个契约测试；CI 增加 v4 模型 `node --check`，前端契约测试步骤改为 `node --test tests/*.js`，Python 门禁不变。
- README 更新 Atelier 入口与路线图勾选；清理已合入的远端临时验证分支。

**验证证据**

- 本地：Python `unittest discover` 25 个测试通过；`node --test tests/*.js` 14 个通过；`node --check` v3/v4/移动端模型通过；`core_circle.py`、`skill_review.py validate`、`security_scan.py` 通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/; skipped=none`。
- 渲染：对 Pages 产物结构（`_site/atelier/`）做 Playwright 无头冒烟，标题、安全边界、队列分组、试用置顶、圈层、弱信号、skill-discovery、alchaincyf、许可证规则 9 项内容断言全过，无应用层 console error；standard-lint 无 parsing/no-undef/jsx-no-undef/import-no-unresolved 四类阻断，剩余 curly 等风格 warning。
- CI：提交 `96d9067` 上「质量与安全门禁」「发布 GitHub Pages」均 success。
- 线上：`https://mengen-ink.github.io/worklens/atelier/` 及其 app.jsx/atelier-model.js/styles.css 均 200；`pages-manifest.json` 中 atelier 为 published、entry=atelier/index.html；`/`、`/desktop/` 与数据接口保持 200。

**下一轮唯一最高优先级**

启动 Idea → 调研 → 方案 → 脚手架 → 验收的项目化流程：先落最小数据契约与一个真实 Idea 样例（只使用公开来源），再把流程状态只读接入现有页面。

## 2026-10-25（整点轮）· Pages Atelier 发布契约工程化

**成果**

- 将 GitHub Pages 组装逻辑从 workflow 中的散落 `cp/mv` 收敛到 `scripts/build_pages.py`，统一发布移动端 `/`、PC 端 `/desktop/`，并为未来 `worklens_zn3k/v4/` 自动映射 `/atelier/`。
- 新增 `pages-manifest.json` 发布清单：当 PC v4 Atelier 源目录不存在时显式标记 `skipped`，避免误发布陈旧页面；源目录出现后自动纳入 Pages artifact。
- 补齐构建器单测 `tests/test_build_pages.py`，覆盖移动/桌面入口重命名、数据 JSON 复制、`.nojekyll`、Atelier 缺源跳过与有源发布。
- 顺手清理待审队列记录中的占位作者字段为公开中性身份，并移除移动端一个未使用变量，避免继续携带个人占位信息。

**验证证据**

- 本地：`python3 -m unittest discover -s tests -p 'test_*.py'` 通过（25 个测试）。
- Pages 构建：`python3 scripts/build_pages.py` 通过，输出 `routes=/, /desktop/; skipped=atelier`。
- 门禁：`python3 scripts/core_circle.py`、`python3 scripts/skill_review.py validate`、`python3 scripts/security_scan.py` 通过。
- 前端：对 `worklens-mobile_8a6r/v2/app.jsx` 执行 `standard-lint`，未出现 parsing/syntax error、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断问题；剩余为既有风格类提示。

**下一轮唯一最高优先级**

把真实 PC v4（Pages Atelier）源目录接入 `worklens_zn3k/v4/`，让 `/atelier/` 从 manifest skipped 变为 published；完成后推进 Idea → 调研 → 方案 → 脚手架 → 验收流程。


## 2026-10-24（晚轮）· 移动端 Skill 待审袖珍对比器

**成果**

- 按上一轮最高优先级中可闭环的最小事项推进：补齐移动端技能工坊的「待审」Tab，将 Skill 待审队列浓缩为袖珍对比器。
- 移动端顶部回礼横幅改为展示待审总量、评测/试用中数量和待补证数量，避免继续把未评测候选表现为可直接锻造的 Skill。
- 袖珍对比器按阻断项通过率列出候选，展示状态、许可证、星标、通过项/总项和待补证标签；仍为只读展示，不安装、不执行、不写入用户级 Skill 目录。

**验证证据**

- 本地：`python3 -m unittest discover -s tests -p 'test_*.py'` 通过；`python3 scripts/skill_review.py validate` 通过；`python3 scripts/security_scan.py` 通过。
- 前端：对本轮变更文件 `worklens-mobile_8a6r/v2/app.jsx` 执行 `standard-lint`，未出现 parsing/syntax error、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断问题。
- 数据：继续读取 `data/skill-review-queue.json`，`auto_install=false` 安全边界不变。

**下一轮唯一最高优先级**

将 WorkLens PC v4（Pages Atelier）工程化接入当前 main；完成后再推进 Idea → 调研 → 方案 → 脚手架 → 验收流程。

## 2026-10-25 · Skill 真实候选评测、页面只读接入与核心开源者圈层收口

**成果**

- 按上一轮最高优先级收口：选择公开、低风险候选 `CodeSigils/skill-discovery` 做首轮真实评测，完成 7 项阻断检查，进入 7 天只读限范围试用；仍未安装、未执行第三方脚本、未访问私有数据。
- PC 与移动端页面读取 `data/skill-review-queue.json`，在技能工坊中展示队列状态计数、阻断项缺口、试用范围和 `auto_install=false` 安全边界。
- 新增核心开源者圈层数据契约：`config/core-circle.json`、`data/core-circle.json`、`scripts/core_circle.py`、`docs/core-circle.md` 与单测，限定只使用公开 GitHub 事实、follow 仅弱信号、无许可证项目不得推荐。
- 保留成熟方案取舍：继续沿用 Anthropic 分层授权、OpenSSF 固定检查项、gitleaks/密钥扫描和 Agent Skill 威胁分类，不把热度当作安全证据。
- README 路线图更新：Skill 实跑与限范围试用已完成；当前最高优先级切到 WorkLens PC v4（Pages Atelier）工程化接入与移动端袖珍对比器。

**验证证据**

- 本地：23 个单元测试全部通过；`python3 scripts/core_circle.py`、`python3 scripts/skill_review.py validate`、`python3 scripts/security_scan.py` 通过。
- 前端：对本轮变更的 PC / 移动端 `app.jsx`、`views.jsx`、`data-adapter.js` 执行 `standard-lint`，未出现 parsing/syntax error、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断问题；剩余为既有风格类提示。
- 数据：队列当前含 1 个 `trial` 候选与其余 `candidate` 候选，`auto_install=false` 保持不变，页面只读展示。

**下一轮唯一最高优先级**

将 WorkLens PC v4（Pages Atelier）工程化接入当前 main，并补齐移动端袖珍对比器；完成后再推进 Idea → 调研 → 方案 → 脚手架 → 验收流程。

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
