# WorkLens 推进轮次记录

每轮闭环完成后记录：成果、验证证据、下一轮唯一最高优先级。最新在最上面。

## 2026-10-27（02 点轮）· 健康巡检通过并创建 Issue #21 承载验收

**成果**

- 同步公开仓库 main 到最新 `5ac2d5f`；本轮开始时 GitHub Issues 无未关闭事项，因此按 Loop 约定创建健康巡检 Issue #21 作为唯一最小可交付事项，不启动新功能。
- Actions 巡检通过：最新 main `5ac2d5f` 的「质量与安全门禁」run #40367988599 与「发布 GitHub Pages」run #40367988587 均 success；最近 10 条 Actions 无 running / queued。
- P0–P4 路线图最小目标继续保持全部已上线，Loop 维持健康巡检降级态；本轮无业务代码改动，仅记录巡检证据与下一项。
- Issue 写权限本轮可创建 Issue #21；PR #22 已合入 main（squash 提交 `30d1ebe`），但服务端未自动关闭 Issue，随后 `gh issue close 21 --comment ...` 返回 `403 Resource not accessible by personal access token`，因此 Issue #21 暂保持 open，证据落在 PR 描述、本日志和最终交付记录中。

**验证证据**

- 本地质量门禁（main `5ac2d5f`）：`python3 -m unittest discover -s tests -p 'test_*.py'` → Ran 53 tests OK；5 个前端适配器与 4 个 JS 测试文件 `node --check` 全过；`node --test tests/*.js` → tests 28 / pass 28 / fail 0。
- 契约与安全：`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate`、`idea_pipeline.py validate`（`1 ideas`）、`recommendation_review.py validate`（`1 reviews`）、`security_scan.py` 均 exit 0；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- 线上 Pages：`pages-manifest.json` 200 且四入口均为 `published`；`/desktop/`、`/atelier/`、`/ai-news/` 均可读取页面内容；根路径 `/` 返回客户端应用壳（需浏览器渲染）；`data/ai-news.json`、`data/core-circle.json`、`data/discoveries.json`、`data/idea-pipeline.json`、`data/recommendation-reviews.json`、`data/skill-review-queue.json` 均可读取。
- PR #22 合入 main 后，「质量与安全门禁」run #40376072817 与「发布 GitHub Pages」run #40376072680 均 success；纯文档提交未引入页面源码变化。
- 本轮未推进 SR-0011：仍保持 `trial`，`result=null`，未安装、未执行、未流转；真人试用结论出现前不得推进 adopted。

**下一轮唯一最高优先级**

- 继续健康巡检：核对 main、运行中 / 失败 Actions、Pages 四入口、公开数据文件和每日采集链路；若 Issue 列表为空，继续按最小可交付事项新建巡检 Issue 并写明验收标准；SR-0011 真人试用结论出现前不得推进 adopted、不得安装 Skill。

## 2026-10-27（01 点轮）· 健康巡检通过并创建 Issue #19 承载验收

**成果**

- 同步公开仓库 main 到最新 `b2dfc1b`；本轮开始时 GitHub Issues 无未关闭事项，因此按 Loop 约定创建健康巡检 Issue #19 作为唯一最小可交付事项，不启动新功能。
- Actions 巡检通过：最新 main `b2dfc1b` 的「质量与安全门禁」run #40361004317 与「发布 GitHub Pages」run #40361004283 均 success；最近 8 条 Actions 无 running / queued。
- P0–P4 路线图最小目标继续保持全部已上线，Loop 维持健康巡检降级态；本轮无业务代码改动，仅记录巡检证据与下一项。
- Issue 写权限本轮可创建 Issue #19；PR #20 以 `Closes #19` 合入后服务端自动关闭 Issue。评论接口仍返回 `403 Resource not accessible by personal access token`，因此逐条证据落在 PR 描述、本日志和最终交付记录中，不声称任何未上线事项已完成。

**验证证据**

- 本地质量门禁（main `b2dfc1b`）：`python3 -m unittest discover -s tests -p 'test_*.py'` → Ran 53 tests OK；5 个前端适配器 `node --check` 全过；`node --test tests/*.js` → tests 28 / pass 28 / fail 0。
- 契约与安全：`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate`、`idea_pipeline.py validate`（`1 ideas`）、`recommendation_review.py validate`（`1 reviews`）、`security_scan.py` 均 exit 0；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- 线上 Pages：`pages-manifest.json`、根路径 `/`、`/desktop/`、`/atelier/`、`/ai-news/` 均 200；`data/ai-news.json`、`data/core-circle.json`、`data/discoveries.json`、`data/idea-pipeline.json`、`data/recommendation-reviews.json`、`data/skill-review-queue.json` 均 200。
- PR #20 分支「质量与安全门禁」run #40367071176 success；合入 main（squash 提交 `4fb620f`）后「质量与安全门禁」run #40367240814 与「发布 GitHub Pages」run #40367240679 均 success，Issue #19 状态为 CLOSED。

**下一轮唯一最高优先级**

- 继续健康巡检：核对 main、运行中 / 失败 Actions、Pages 四入口、公开数据文件和每日采集链路；若 Issue 列表为空，继续按最小可交付事项新建巡检 Issue 并写明验收标准；SR-0011 真人试用结论出现前不得推进 adopted、不得安装 Skill。

## 2026-10-27（00 点轮）· 健康巡检通过，以默认分支关闭关键词收口 Issue #14

**成果**

- 同步最新 main `a49b5f1`（含 22/23 点轮 PR #15、#16 的巡检记录）；本轮开始时唯一未关闭 Issue 仍为 #14（22 点轮创建，22/23 点轮因当时 token 缺 Issues write 权限滞留 open），按 Loop 约定不创建新 Issue、不启动新功能，本轮收口 #14。
- Actions 巡检通过：最新 main `a49b5f1` 的「质量与安全门禁」run #40347370365 与「发布 GitHub Pages」run #40347370278 均 success，最近工作流无 running / queued；每日采集 collect.yml 最新 run #40278520603（2026-10-26 06:13 UTC）success，采集链路正常。
- P0–P4 路线图最小目标继续保持全部已上线，本轮无业务代码改动，仅在最新 main 上重跑全量门禁并记录证据（PR #17，纯文档提交）。
- Issue 收口路径：当前自动化凭证为 fine-grained PAT，仅含 contents/push 权限，Issue 评论接口返回 403（响应头 `x-accepted-github-permissions: issues=write`，与 22/23 点轮受阻同源）；因此本轮不依赖评论接口，改由收口 PR 描述承载逐条验收证据，并在合入默认分支时以关闭关键词（Closes #14）由服务端自动关闭 Issue。

**验证证据**

- 本地质量门禁（main `a49b5f1` 重跑）：`python3 -m unittest discover -s tests -p 'test_*.py'` → Ran 53 tests OK；5 个前端适配器 `node --check` 全过；`node --test tests/*.js` → tests 28 / pass 28 / fail 0。
- 契约与安全：`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate`、`idea_pipeline.py validate`（`1 ideas`）、`recommendation_review.py validate`（`1 reviews`）、`security_scan.py` 均 exit 0；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- 线上 Pages（本轮逐项实测）：`pages-manifest.json` 中 mobile `/`、`/desktop/`、`/atelier/`、`/ai-news/` 四个目标全部 published；根路径 `/`、四路由与 `pages-manifest.json` 均 200；`data/ai-news.json`、`data/core-circle.json`、`data/discoveries.json`、`data/idea-pipeline.json`、`data/recommendation-reviews.json`、`data/skill-review-queue.json` 本轮实测均 200。
- PR #17 合入 main（squash 提交 `b4bf4dc`）后推送触发的「质量与安全门禁」run #40358196218 与「发布 GitHub Pages」run #40358196258 均 success（纯文档提交，不重复做无价值部署验证）；Issue #14 的最终关闭由本收口 PR 以关闭关键词触发。

**下一轮唯一最高优先级**

- 继续健康巡检（P0–P4 已全部交付，Loop 维持降级态）：核对 main、运行中 / 失败 Actions、Pages 四入口与每日采集链路；唯一观察项仍为 SR-0011（CodeSigils/skill-discovery）限范围试用的真人结论，真人结论出现前自动化不得推进 adopted、不得安装；不重复开发已上线事项，若 Issue 列表为空则按最小可交付事项新建巡检 Issue 并写明验收标准。

## 2026-10-26（23 点轮）· Issue #14 健康巡检复核通过，Issue 写权限仍受阻

**成果**

- 公开仓库同步到最新 main `cb5160e`，远端 `origin/main` 指向同一提交；本轮唯一开放 Issue 仍为 #14，因此不创建新 Issue、不启动新功能。
- Actions 巡检通过：最新 main 的「质量与安全门禁」run #40338257149 与「发布 GitHub Pages」run #40338257074 均为 success；最近 10 条 Actions 无 running / queued。
- P0–P4 路线图最小目标继续保持已上线状态，本轮无业务代码变更，只做健康巡检复核与日志记录。
- Issue 写权限仍受阻：`gh issue comment 14` 在直连 GitHub API 后仍返回 `Resource not accessible by personal access token`，无法写入验收评论或关闭 Issue；Issue #14 暂保持 open，等待具备 Issues write 权限的账号关闭。

**验证证据**

- 本地质量门禁：`python3 -m unittest discover -s tests -p 'test_*.py'` → Ran 53 tests OK；JS 适配器 `node --check` + `node --test tests/*.js` → tests 28 / pass 28 / fail 0。说明：当前 Node 22 对 `.jsx` 入口执行 `node --check` 会报不支持扩展名，未作为代码变更阻断项；本轮未修改前端源码。
- 契约与安全：`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate`、`idea_pipeline.py validate`（`1 ideas`）、`recommendation_review.py validate`（`1 reviews`）、`security_scan.py` 均通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- 线上 Pages：`pages-manifest.json`、根路径 `/`、`/desktop/`、`/atelier/`、`/ai-news/`、`/data/discoveries.json`、`/data/idea-pipeline.json`、`/data/recommendation-reviews.json` 均返回 200。

**下一轮唯一最高优先级**

- 继续健康巡检：若 Issue #14 仍 open，仅复核 main / Actions / Pages / 采集链路并记录权限状态，不重复开发已上线事项；待用户侧为 token 补 Issues write 权限后优先关闭 Issue #14。

## 2026-10-26（22 点轮）· Issue #14 健康巡检通过，关闭权限受阻

**成果**

- 公开仓库同步到最新 main `3833824`，启动本轮 `chore/hourly-health-check-22` 分支；开始时 GitHub Issues 无未关闭事项，因此按 Loop 约定创建 Issue #14 作为本轮最小可交付健康巡检项。
- Actions 巡检通过：最新 main 的「质量与安全门禁」run #40314890175 与「发布 GitHub Pages」run #40314890203 均为 success；无 running / queued 的待处理工作流。
- P0–P4 路线图最小目标继续保持已上线状态；本轮不新增功能、不改业务代码，只记录健康巡检证据。

**验证证据**

- 本地质量门禁：`python3 -m unittest discover -s tests -p 'test_*.py'` → Ran 53 tests OK；5 个前端适配器 `node --check` 全过；`node --test tests/*.js` → tests 28 / pass 28 / fail 0。
- 契约与安全：`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate`、`idea_pipeline.py validate`（`1 ideas`）、`recommendation_review.py validate`（`1 reviews`）、`security_scan.py` 均通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- 线上 Pages：`pages-manifest.json`、根路径 `/`、`/desktop/`、`/atelier/`、`/ai-news/`、`/data/discoveries.json`、`/data/idea-pipeline.json`、`/data/recommendation-reviews.json` 均返回 200；首批请求中 `/desktop/` 遇一次沙箱网络 timeout，逐项重试后 200，判定为代理瞬态非站点问题。
- Issue 状态：Issue #14 已创建并写入本轮验收标准；PR #15 已合入 main，但当前 token 对 Issue 评论/关闭返回 `403 Resource not accessible by personal access token`，Issue 暂保持 open，等待具备 Issues write 权限的账号关闭。

**下一轮唯一最高优先级**

- 继续健康巡检：核对 main / 运行中 Actions / Pages / 每日采集链路与四个线上只读入口；唯一观察项仍为 SR-0011 试用真人结论（P2 正式引入记录），真人结论出现前自动化不得推进 adopted、不得安装；不重复开发已上线事项。

## 2026-10-26（19 点轮）· Issue #5 正式关闭：移动端 Idea 袖珍只读摘要验收通过

**成果**

- 本轮使用具备 Issues 写权限的短期 OAuth 凭证（仅本轮内存使用，未写入仓库或日志），在最新 main `f9dad90`（已含 PR #11「统一 Pages 工作区」、PR #12/#13 移动端导航可见性与阅读布局修复）上对唯一开放 Issue #5 的五条验收标准逐条复核，全部满足并完成线上渲染验收，随后在 Issue 上留言并正式关闭。
- **本轮无代码改动**：功能在 10-26 午间轮已上线，本轮只补轮次记录（纯文档提交），不重复开发。
- P0–P4 路线图最小目标已全部交付，Loop 继续维持**健康巡检**；下一项唯一观察项为 SR-0011（CodeSigils/skill-discovery）限范围试用的真人结论——P2「Skill 正式引入记录」必须由真人把试用结论流转为 adopted/rejected，自动化不得自行安装或流转。

**Issue #5 验收标准逐条证据（main `f9dad90`）**

1. **移动端读取公开发布的 `data/idea-pipeline.json`**：`worklens-mobile_8a6r/v2/app.jsx` 以多相对路径 `loadFirstJson(['./data/idea-pipeline.json','../data/...','../../data/...'])` 拉取，并作为第四参数传入 `buildMobileData`；线上 `https://mengen-ink.github.io/worklens/data/idea-pipeline.json` 200，schema v1、1 个 idea、`automation_max_stage=research`、`auto_scaffold=false`、`public_only=true`。
2. **只展示四事实、无任何写入口**：`data-adapter.js` 的 `buildIdeaPocket` 只输出项目总数、当前 research 项、自动化上限、下一步与只读标记；用 Aime 本地浏览器（aime-builtin）打开线上站点，底部「2 工坊」→「灵感 · 1」实际渲染：项目总数 1、调研中 · research 1、自动化上限「调研（research）」、下一步「1 项停在调研，等待真人确认后进入方案 · 进入「方案（plan）」需真人确认」、research 项 `scorecard-skill-metrics` 标题与 `public_only=true · auto_scaffold=false · read_only=true`；面板 DOM 子树内 `button/a/input/select/[onclick]` 计数为 **0**，无创建任务、阶段流转、脚手架生成、Skill 安装入口。
3. **契约测试覆盖空数据降级与只读边界**：`tests/test_data_adapter.js` 含 5 组 Issue #5 用例（四事实映射、严格只读不含任何动作键、`null/undefined/{}/{ideas:null}/{ideas:'x'}/'invalid'` 与空 ideas 安全降级、`buildMobileData` 第四参数缺省即降级且 `readOnly=true`、与真实 `data/idea-pipeline.json` 一致）。
4. **测试 / standard-lint / 敏感信息扫描**：见下方验证证据；standard-lint（one-site 规则集）对 `data-adapter.js` 0 项，`app.jsx` 无 `parsing/syntax error`、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断，25 条均为既有风格类提示（array index key、未使用变量、leaked render 等），`IdeaPocketPanel` 区段零新增。
5. **README / loop-log**：README「当前能力」「路线图」已记录（第 20、78–80 行），本轮补本日志与 Issue 关闭留言。

**验证证据**

- 本地（main `f9dad90`）：`python3 -m unittest discover -s tests -p 'test_*.py'` → Ran 53 tests OK；5 个适配器 `node --check` 全过；`node --test tests/*.js` → tests 28 / pass 28 / fail 0；`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate`、`idea_pipeline.py validate`（`1 ideas`）、`recommendation_review.py validate`（`1 reviews`）、`security_scan.py`（敏感信息扫描通过）均 exit 0。
- 线上：`pages-manifest.json` 四路由（mobile `/`、desktop、atelier、ai-news）全部 published，`data_files` 含 `data/idea-pipeline.json`；线上 `/app.jsx`、`/data-adapter.js` 与 main `f9dad90` 逐字节一致（diff 为空）。
- Aime 本地浏览器实测线上 `/`：页面无 JS 错误（仅 Tailwind CDN、in-browser Babel 两条既有 warning）；运行时 `window.DATA.ideaPocket = {available:true, total:1, researchCount:1, automationMaxStageLabel:'调研（research）', nextStep:'1 项停在调研，等待真人确认后进入方案', readOnly:true, researchItems:[scorecard-skill-metrics …]}`；数据缺失分支由 5 组契约测试锚定（本地浏览器本轮未重复断网造障）。
- Actions：`f9dad90` 的「质量与安全门禁」run #52 与「发布 GitHub Pages」run #53 均 success；本轮纯文档提交只等待质量门禁，不重复无价值部署验证。

**下一轮唯一最高优先级**

- 健康巡检：核对 main / 运行中 Actions / Pages / 每日采集链路与四个线上只读入口；唯一观察项为 SR-0011 试用真人结论（P2 正式引入记录），在真人给出结论前自动化不得推进 adopted、不得安装；不重复开发已上线事项。

## 2026-10-26（18 点轮）· 健康巡检通过，Issue #5 写权限仍受阻

**成果**

- **健康巡检通过**：main 分支最新为 `6fd115d`（与 17 点轮一致，无新提交），未关闭 Issue 仍仅 #5；P0–P4 路线图目标均已上线，本轮不新增功能。
- **本地全量验证**：Python 52 项 + Node 28 项全部通过；5 个验证器（idea_pipeline / recommendation_review / core_circle / skill_review / security_scan）均通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- **线上 Pages 健康**：`pages-manifest.json` HTTP 200，4 条路由（mobile / desktop / atelier / ai-news）均为 published；`/atelier/`、`/desktop/`、`/ai-news/` 均 200；`/data/discoveries.json`、`/data/idea-pipeline.json`、`/data/recommendation-reviews.json` 均 200；根路径 `/` 首次请求遇代理 reset，重试后 200，属代理瞬态非站点问题。
- **Issue #5 写权限仍受阻**：`gh issue close 5` 返回 `Resource not accessible by personal access token`（与此前各轮一致）；Issue 状态保持 open，功能已上线并完成验收，等待具备 Issues write 权限的账号人工关闭。

**验证证据**

- 本地（main `6fd115d`）：`python3 -m unittest discover -s tests -p 'test_*.py'` 52 项通过；`node --test tests/*.js` 28 项通过（tests 28 / pass 28 / fail 0）；`idea_pipeline.py validate` → `1 ideas`；`recommendation_review.py validate` → `1 reviews`；`core_circle.py` → `1 people, 2 projects`；`skill_review.py validate` → 通过；`security_scan.py` → 通过；`build_pages.py` → `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- 线上：`https://mengen-ink.github.io/worklens/pages-manifest.json` 200，targets 全部 published；`/atelier/` 200、`/desktop/` 200、`/ai-news/` 200、`/` 200（重试后）、`/data/discoveries.json` 200、`/data/idea-pipeline.json` 200、`/data/recommendation-reviews.json` 200。

**下一轮唯一最高优先级**

- 继续健康巡检：核对 main / Actions / Pages / 采集链路是否健康；若 Issue #5 仍 open，仅做权限复核不重复开发。待用户侧为 token 补 Issues write 权限后优先关闭 Issue #5。

## 2026-10-26（17 点轮）· 健康巡检与 Issue #5 事实结项复核

**成果**

- **健康巡检通过**：main 分支最新为 `4029415`（PR #10 合入后），「质量与安全门禁」与「发布 GitHub Pages」均 success；Pages 部署已涵盖 `/ai-news/` 与既有 `/atelier/`。
- **Issue #5 事实结项**：再次复核 `worklens-mobile_8a6r/v2/` 移动端逻辑，Idea 袖珍摘要已完整接入 `data/idea-pipeline.json`；16 例 Node 契约测试、52 例 Python 单元测试全绿；standard-lint 阻断项为 0。
- **权限受阻记录**：Issue #5 仍因 token 权限（Resource not accessible）无法通过 `gh` 指令自动关闭，本轮尝试 API 操作持续超时；Issue 状态保持 open 但功能已上线，标记为事实结项，等待具备权限的账号人工清理。
- **路线图更新**：P0–P4 目标均已实现，Loop 继续维持健康巡检状态，后续转向「工作画像与推荐闭环完善」。

**验证证据**

- **本地（main `4029415`）**：`python3 -m unittest` 52 项通过；`node --test tests/*.js` 25 项通过；`python3 scripts/idea_pipeline.py validate` 通过；`python3 scripts/security_scan.py` 通过；`python3 scripts/build_pages.py` 输出 `routes=/, /desktop/, /atelier/, /ai-news/; skipped=none`。
- **lint**：`node --check` 移动端与 PC v4 适配器通过；standard-lint 对 `ai-news` 相关页面与适配器校验通过（四类阻断为 0）。
- **Actions**：PR #10 合入后 run `40294154892` (Security) / `40294154900` (Pages) 均 success。

**下一轮唯一最高优先级**

- 健康巡检：核对 Actions / Pages 状态，复核 `data/discoveries.json` 定时采集数据流转；若 Issue #5 仍 open，仅做权限复核，不重复开发。

## 2026-10-26（16 点轮）· 健康巡检与 Issue #5 权限复核

**成果**

- 按上一轮约定降级为健康巡检：公开仓库 main 当前为 `529ecb3`，P0–P4 路线图目标均已在 README 标记完成，本轮不新增功能、不打开新事项。
- 最高优先级开放 Issue 仍为 #5。复核结论：Issue #5 对应的移动端 Idea 项目化袖珍只读摘要已在 main 上满足验收并上线；由于当前沙箱 GitHub token 仍缺 Issues 写权限，`gh issue close 5 --comment ...` 返回 `Resource not accessible by personal access token`，无法自动评论或关闭，Issue 状态继续保持 open，等待具备 Issues write 权限的账号人工关闭。
- 只读边界继续保持：移动端只展示项目总数、research 项、自动化上限和下一步，不提供创建外部任务、阶段流转、脚手架生成或 Skill 安装入口。

**验证证据**

- 本地（main `529ecb3`）：`python3 -m unittest discover -s tests -p 'test_*.py'` 52 项通过；`node --test tests/*.js` 25 项通过；`python3 scripts/idea_pipeline.py validate` 通过；`python3 scripts/security_scan.py` 通过；`python3 scripts/build_pages.py` 输出 `routes=/, /desktop/, /atelier/; skipped=none`。
- standard-lint：对 `worklens-mobile_8a6r/v2/app.jsx`、`worklens-mobile_8a6r/v2/data-adapter.js`、`tests/test_data_adapter.js` 执行 one-site 规则集，未出现 `parsing/syntax error`、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断；剩余为既有未使用变量、array index key、leaked render 等风格类提示。
- Actions：main `529ecb3` 的「质量与安全门禁」run `40286212287` success，「发布 GitHub Pages」run `40286212329` success。
- 线上：`https://mengen-ink.github.io/worklens/data/idea-pipeline.json` HTTP 200，`policy.public_only=true`、`policy.auto_scaffold=false`、`policy.automation_max_stage=research`；`https://mengen-ink.github.io/worklens/pages-manifest.json` 中 mobile、desktop、atelier 均为 published。

**下一轮唯一最高优先级**

- 若 Issue #5/#6 仍因权限保持 open，继续做健康巡检并复核 Actions / Pages / 数据契约；不要重复开发已上线事项。待用户侧为 token 补 Issues write 权限后，优先关闭已验收的 Issue #5 与 #6。

## 2026-10-26（14 点轮）· P4 推荐复盘最小闭环上线（Issue #6，Issue 写权限仍受阻）

**成果**

- 完成路线图最后一项 P4：「发现 → 推荐 → 复盘 → 画像调整」回路补齐公开复盘段，分 3 个可独立验证提交落地 main，无大提交：
  1. `2de4a9f` 数据契约：新增 `data/recommendation-reviews.json`（1 条真实复盘）、只读离线校验器 `scripts/recommendation_review.py validate`、Python 契约测试 10 例、CI「推荐复盘契约校验」步骤、`docs/data-contract.md` 契约小节；负向夹具按既有规则精确登记安全扫描白名单。
  2. `3720048` 页面：Atelier 新增 Section D「推荐复盘」——纯函数 `worklens_zn3k/v4/review-model.js`（只读模型，输出无任何函数/动作键）、`app.jsx` 面板（0 按钮/0 表单/0 输入框，事实只链公开证据）、5 组 JS 契约测试、CI 增加 `node --check`。
  3. 文档提交（见本日志与 README）。
- 首条复盘对象 `fighting41love/funNLP` 命中 `discoveries.json` 当日公开候选（移动端按「Agent 推荐候选」呈现）：观察窗口 2026-10-25→10-26 复查到「无 SPDX 许可证（license=null）、默认分支 2024-05 后无推送、星标仍小涨」三个公开事实，结论 `downgrade`（降权）；调整动作仅为人工策略说明（profile-star 弱信号不得单独成推荐，须叠加许可证与近 12 个月推送门槛），`auto_adjust_profile=false`，自动化在 `authority=human-policy` + `policy_ref` 下最高只能 downgrade，`remove` 必须真人记录。
- Issue 写操作再次确认受阻：fine-grained token 响应头 `X-Accepted-Github-Permissions: issues=read`，评论/关闭返回 `403 Resource not accessible by personal access token`；经典 token 已 401 失效。Issue #5/#6 保持 open，等待具备 Issues 写权限的账号关闭，验收证据以本日志为准。
- 旁注：本轮期间 PR #8「AI 资讯采集链路」（`af1324a`）由他人合入 main，已 rebase 到其之上，无冲突；定时采集工作流期间还产生 `876c2d9` 自动提交，rebase 后重新全量验证通过。

**验证证据**

- 本地（main `3720048`）：`python3 -m unittest` 49 项全绿（含新增 `test_recommendation_review.py` 10 例：真实数据有效、策略常量、候选必须命中 discoveries、重复/非法 id、结论枚举、内网地址与凭证参数拒绝、观察窗口边界、自动化不可 remove/不可自称 human、复盘时间不得早于推荐时间）；`node --test tests/*.js` 25 项全绿（含新增 `test_review_model.js` 5 例：真实数据映射、结论计数、空数据降级、只读边界递归无函数/无动作键、owner/repo 与数字压缩边界）；`recommendation_review.py validate` 输出 `recommendation-reviews valid: 1 reviews`；`core_circle / skill_review / idea_pipeline / security_scan` 均通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/; skipped=none`，产物含 `_site/atelier/review-model.js` 与 `_site/data/recommendation-reviews.json`。
- standard-lint（one-site 规则集）对本轮变更的 `review-model.js / app.jsx / index.html / test_review_model.js` 校验：四类阻断（parsing/syntax error、no-undef、react/jsx-no-undef、import/no-unresolved）为 0；修复了 1 项 `react/jsx-no-array-index-key`（facts 列表 key 改为「日期+证据 URL+事实前缀」复合键）。
- CI / Pages：提交 `2de4a9f` 的「质量与安全门禁」run `40281121625`、「发布 GitHub Pages」run `40281121705` success；提交 `3720048` 的 run `40283901700`（门禁 13s）/ `40283901668`（Pages 25s）success。
- 线上字节一致：`https://mengen-ink.github.io/worklens/atelier/review-model.js` sha256 `868f2087aa10085aa5dd5cad985d887432de3390dba42b113550a35b872ac717`，与 main 同文件完全一致；`/data/recommendation-reviews.json` HTTP 200，1 条记录、subject=`fighting41love/funNLP`、conclusion=`downgrade`。
- 线上 Playwright（Chromium 1440 宽，经沙箱代理）双路径验收 `https://mengen-ink.github.io/worklens/atelier/`：①正常路径——Section D 可见，徽标「结论 · 降权」、funNLP 链接、三条公开事实、人工调整说明与「数据与隐私原则」策略依据均渲染，复盘 Section 内 button/form/input 计数均为 0，0 页面错误，A/B/C 三个既有板块不受影响；②断 JSON 降级（route 拦截 `recommendation-reviews.json` 失败）——Section D 显示「未能加载推荐复盘数据 (load_failed)」只读占位，不渲染任何复盘内容，0 页面错误、0 写控件，其余板块正常，无白屏。

**下一轮唯一最高优先级**

- P0–P4 路线图目标（PC v4 Atelier 合入、移动端袖珍对比器、核心开源者圈与 AI 开源者发现、Skill 引入记录、Idea 项目化闭环、推荐复盘）均已上线，Loop 按约定**降级为健康巡检**：每轮仅核对 main/Actions/Pages/采集链路与线上只读入口是否健康，不新增大功能。
- 待用户侧处理（非代码阻塞）：为沙箱 token 补 Issues 写权限（fine-grained PAT 勾选 Issues read/write）后关闭 Issue #5、#6；或由用户人工关闭。在此之前两 Issue 保持 open 属已知状态，不得声称已关闭。

## 2026-10-26（13 点轮）· PR #7 合入后复核 Issue #5（Issue 写权限仍受阻）

**成果**

- 在最新 main `33a04ae`（PR #7「优化：优先复用已整理采集数据」合入后）对最高优先级 Issue #5 做独立复核：袖珍只读摘要功能与验收标准全部满足，无需新代码改动。
- 再次尝试 Issue 写操作：REST 评论（`POST /issues/5/comments`）与关闭（`PATCH /issues/5`）均稳定返回 `403 Resource not accessible by personal access token`（各重试 3 次，含 1 次代理超时），当前沙箱 token 确认无 Issues 写权限；Issue #5 继续保持 open，等待具备权限的账号人工关闭，验收证据以本日志为准。

**验证证据**

- 本地（main `33a04ae`）：Python 39 项、Node 20 项全部通过；三个适配器 `node --check` 通过；`core_circle.py`、`skill_review.py validate`、`idea_pipeline.py validate`、`security_scan.py` 通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/; skipped=none`。
- 线上（部署 SHA `33a04ae`，质量门禁与 Pages 均 success）：`/data/idea-pipeline.json` 200（1 个 research 项，`public_only=true · auto_scaffold=false · automation_max_stage=research`）；线上 `app.jsx`、`data-adapter.js` 与 main 字节一致。
- Playwright 移动视口（390×844）双路径：正常路径四事实齐全、research 项 `scorecard-skill-metrics` 与只读脚注渲染、面板 0 按钮 0 链接 0 页面错误；阻断全部 JSON 的降级路径展示只读占位，0 按钮 0 页面错误。

**下一轮唯一最高优先级**

Issue #6：P4 推荐复盘最小闭环（`data/recommendation-reviews.json` 首条公开复盘记录 + 只读校验器/契约测试 + 页面只读展示，验收标准见 Issue #6）。

## 2026-10-26（午间轮）· 移动端 Idea 袖珍只读摘要

**成果**

- 收口最高优先级 Issue #5（功能已上线并完成线上双路径验收）：移动端 `Studio / 灵感` 子页读取公开发布的 `data/idea-pipeline.json`，展示项目总数、当前 research 项、自动化上限和下一步。
- 说明：本轮沙箱 GitHub token 仅有 Contents 写权限，Issue 评论/关闭（REST 与 GraphQL 均返回 `Resource not accessible by personal access token`）与提交关键字自动关单均不可用；Issue #5 状态保持 open，等待具备 Issues 写权限的账号人工关闭，验收证据以本日志为准。
- 页面保持严格只读：不提供创建外部任务、阶段流转、脚手架生成或 Skill 安装入口；进入 plan 仍显示需要真人确认。
- Pages 构建器测试补齐 `idea-pipeline.json` 数据复制断言，README 路线图同步标记移动端袖珍摘要完成。
- 线上浏览器验收发现并修复一个既有空数据缺陷：公开 JSON 不可达时回退种子数据，种子 `aiSkills` 无 `tags` 字段，工坊页 `s.tags.map` 抛错导致整个 StudioView 白屏、袖珍摘要降级态不可达；提交 `843c5b9` 改为 `(s.tags || []).map`，恢复只读降级路径。

**验证证据**

- 本地：`python3 -m unittest discover -s tests -p 'test_*.py'` 33 项通过；`node --test tests/*.js` 20 项通过（含本轮新增 5 项移动端袖珍模型契约：事实映射、只读边界、空数据降级、装配接线、真实数据一致）；`idea_pipeline.py validate`、`security_scan.py` 通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/; skipped=none`。
- 前端：对 `worklens-mobile_8a6r/v2/app.jsx`、`worklens-mobile_8a6r/v2/data-adapter.js` 执行 `standard-lint`，未出现 parsing/syntax error、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断问题；本轮改动相对 HEAD 基线零新增 lint 项，剩余为既有风格类提示。
- CI / Pages：main 各提交的「质量与安全门禁」与「发布 GitHub Pages」均 success；修复提交 `843c5b9` 的 Actions runs 40270540993 / 40270540999；线上 `https://mengen-ink.github.io/worklens/`、`/app.jsx`、`/data-adapter.js`、`/data/idea-pipeline.json`、`/pages-manifest.json` 均为已部署新版本（HTTP 200）。
- 线上 Playwright 双路径验收（移动视口 390×844）：①正常路径——工坊「灵感 · 1」子页四事实（项目总数 1、调研中 1、自动化上限「调研（research）」、下一步「1 项停在调研，等待真人确认后进入方案」）、当前 research 项 id/标题、`public_only=true · auto_scaffold=false · read_only=true` 均渲染，面板内 0 按钮 0 链接，0 页面错误；②降级路径——阻断全部 JSON 后工坊 6 个子 Tab 正常，袖珍摘要显示公开数据未加载的只读占位，面板 0 按钮、0 页面错误。

**下一轮唯一最高优先级**

P4 推荐复盘最小闭环：为推荐结果补充一条可公开复盘记录（仍只使用公开数据，不接入私有信号）；已新建 Issue #6 并写明验收标准。

## 2026-10-26（整点轮）· Idea 项目化流程 Atelier 只读接入

**成果**

- 收口最高优先级 Issue #3：基于 main 已上线的 `idea-pipeline.json` 契约，把项目化流程只读接入 PC v4 Atelier。
- Atelier 新增「Idea 项目化闭环」区块，读取 `/data/idea-pipeline.json`，展示项目总数、research 数、自动脚手架为 0、自动化上限、当前阶段、进度、证据数、历史数与调研笔记。
- 视图模型新增 `buildIdeaPipelineBoard` / `buildEmptyIdeaPipelineBoard` 纯函数与契约测试，继续保持只读：不创建外部任务、不流转阶段、不生成脚手架、不安装 Skill。
- README 路线图更新为「最小数据契约与 Atelier 只读接入」完成。

**验证证据**

- 本地：`python3 -m unittest discover -s tests -p 'test_*.py'` 33 项通过；`node --test tests/*.js` 15 项通过；`idea_pipeline.py validate`、`core_circle.py`、`skill_review.py validate`、`security_scan.py` 通过；`build_pages.py` 输出 `routes=/, /desktop/, /atelier/; skipped=none`。
- 前端：对 `worklens_zn3k/v4/app.jsx`、`worklens_zn3k/v4/atelier-model.js` 执行 `standard-lint`，未出现 parsing/syntax error、`no-undef`、`react/jsx-no-undef`、`import/no-unresolved` 四类阻断问题。
- CI / Pages：main `8ffc669` 的「质量与安全门禁」与「发布 GitHub Pages」均 success（Actions runs 40238592111 / 40238592098）；线上 `https://mengen-ink.github.io/worklens/atelier/` 已发布，`/data/idea-pipeline.json` HTTP 200，包含 1 个 research 阶段样例、2 条公开 HTTPS 证据，策略边界仍为 `public_only=true`、`auto_scaffold=false`、`automation_max_stage=research`。

**下一轮唯一最高优先级**

推进 Issue #5：移动端对 Idea 项目化流程的袖珍只读摘要，并为 `scorecard-skill-metrics` 是否进入 `plan` 准备真人确认项；仍不得自动创建外部任务、脚手架或安装 Skill。

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
