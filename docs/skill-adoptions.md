# Skill 正式引入账本（Adoptions Ledger）

正式引入 Skill 是一个**人工决定**，不是一次自动化动作。WorkLens 用一本独立于待审队列的账本登记这个决定：谁、何时、因何、以何范围、如何回滚。本账本永远不触发安装或执行。

## 1. 为什么要单独记录

- 待审队列（`data/skill-review-queue.json`）记录「队列状态与评测证据」—— 状态机、7 项阻断、试用结论；
- 正式引入账本（`data/skill-adoptions.json`）记录「这个 adopted 决定的工程细节」—— 决定人、理由、引入范围、回滚指令。

二者在 CI 中交叉校验：**队列里每一个 state=adopted 的条目，账本里必须有对应 adoption；账本里每一条 adoption 的 skill_review_id 都必须指向队列里真实存在且 state=adopted 的条目**。本轮 WorkLens 的队列中没有 adopted 条目，账本的 `adoptions` 为空数组属于合法最小值。

## 2. 数据契约：`data/skill-adoptions.json`

```json
{
  "schema_version": 1,
  "generated_at": "RFC3339",
  "source": "WorkLens 人工决定的正式引入账本；关联 data/skill-review-queue.json 中 state=adopted 的条目",
  "policy": {
    "auto_install": false,
    "auto_execute": false,
    "human_decision_required": true,
    "public_github_only": true,
    "max_automation_stage": "candidate"
  },
  "adoptions": [
    {
      "adoption_id": "ADOPT-0001",
      "skill_review_id": "SR-0011",
      "subject": "owner/repo",
      "html_url": "https://github.com/owner/repo",
      "decided_by": "<真人标识>",
      "decided_at": "RFC3339",
      "decision_reason": "试用通过且结论稳定，仅在文档中引用",
      "trial_report_url": "https://... 或 data/... 仓库内链接",
      "import_scope": "仅文档引用，不随 Pages 分发脚本",
      "rollback_plan": "删除本条记录即可，无运行时副作用",
      "revert_command": "git revert <adoption-commit>",
      "human_accepted": true,
      "history": [
        { "at": "RFC3339", "event": "adopted", "by": "<真人>", "note": "试用通过，正式登记引入" }
      ]
    }
  ]
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `adoption_id` | 是 | 形如 `ADOPT-0001`，稳定不复用 |
| `skill_review_id` | 是 | 必须对应 `skill-review-queue.json` 中 state=adopted 的 id |
| `subject` | 是 | `owner/repo`，必须与队列条目一致 |
| `html_url` | 是 | 公开仓库 URL，必须以 `https://` 开头 |
| `decided_by` | 是 | 真人标识，禁止 `bot` / `github-actions` / `worklens-bot` |
| `decided_at` | 是 | RFC3339 决定时间 |
| `decision_reason` | 是 | 不少于 4 字的书面理由 |
| `trial_report_url` | 是 | 试用报告链接，必须是 `https://` 或仓库内 `data/` 路径 |
| `import_scope` | 是 | 使用范围（仅文档引用 / 本地只读执行 / 构建期静态产物 等） |
| `rollback_plan` | 是 | 逆向操作描述 |
| `revert_command` | 是 | 可执行的回滚指令 |
| `human_accepted` | 是 | 必须为 `true` |
| `history` | 是 | 首条必须是 `event=adopted` 的真人事件；后续允许 `scope_tightened` / `rolled_back` / `quarantined` |

## 3. 政策不变量（CI 强制）

- `policy.auto_install` 必须为 `false`
- `policy.auto_execute` 必须为 `false`
- `policy.human_decision_required` 必须为 `true`
- `policy.public_github_only` 必须为 `true`
- `policy.max_automation_stage` 必须为 `"candidate"`（自动化不得越过候选状态）

## 4. 命令行

```bash
# CI 门禁：校验契约与跨文件一致性
python3 scripts/skill_adoptions.py validate

# 列出当前所有正式引入记录
python3 scripts/skill_adoptions.py list
```

账本的新增与修改**不设 CLI 自动化入口**：由真人直接编辑 JSON、在 commit message 中记录动机，并通过 PR 评审。

## 5. 页面展示

Atelier（`/atelier/`）在 Section A `Skill 待审队列看板` 下方新增只读副卡「正式引入记录 · Adoptions Ledger」：

- 顶部回显五枚政策 pill
- 当账本为空时，显式提示"空账本是合法最小值 —— 没有 Skill 被安装或执行"
- 每条 adoption 展示 `adoption_id ← skill_review_id`、仓库、决定人、决定时间、决定理由、使用范围、回滚方案、回滚指令、试用报告链接

页面不提供安装、执行、流转或登记入口。
