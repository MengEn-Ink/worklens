# Idea 项目化流程契约

WorkLens 把灵感沉淀为可验收事项，而不是让想法停留在聊天记录里。每个 Idea 沿
`idea → research → plan → scaffold → accepted` 单向推进，任何阶段都可以带理由归档为
`archived`。全部事实只来自公开来源，机器可读记录在 `data/idea-pipeline.json`，由
`scripts/idea_pipeline.py validate` 强制契约。

## 阶段与准入材料

| 阶段 | 含义 | 进入条件 |
| --- | --- | --- |
| `idea` | 登记灵感与一句话价值 | `title`、`summary` |
| `research` | 用公开证据核验价值与边界 | ≥2 条公开证据（含标题与观测时间）与 `research_notes` |
| `plan` | 明确最小方案 | `plan.acceptance_criteria` 至少 1 条可验收标准 |
| `scaffold` | 在仓库内产出最小可运行骨架 | `scaffold.repo_path` 指向仓库内相对路径 |
| `accepted` | 真实复测通过 | `acceptance.result=pass`、`verified_at` 与验收证据 |
| `archived` | 终止 | `archive_reason`；归档后不得再流转 |

阶段只能逐格前进，不允许跳跃或回退；`history` 的状态回放必须与当前 `stage` 一致。

## 自动化边界

- `worklens-bot` 最多把 Idea 推进到 `research`：可以登记灵感、补充公开证据和调研笔记。
- 进入 `plan`、`scaffold`、`accepted` 的事件必须由真人记录（`actor != worklens-bot`）并附理由。
- 策略常量恒为 `public_only=true`、`auto_scaffold=false`、`require_evidence=true`：
  自动化不创建脚手架、不安装或执行第三方内容。

## 证据与隐私

- 每条证据必须是 HTTPS 公开链接，附 `title` 与 RFC3339 `observed_at`。
- 拒绝内网域名、私有地址和带 `token/secret/key/password/signature` 等凭证查询参数的链接。
- 不保存私有工作数据、邮箱、Token、Cookie、会议或文档原文。

## 命令

```bash
python3 scripts/idea_pipeline.py validate   # 契约与状态机校验（CI 必跑）
python3 -m unittest discover -s tests -p 'test_*.py'
```

数据文件随 Pages 产物公开发布在 `/data/idea-pipeline.json`；页面只读接入在契约之后单独推进，
页面不得提供创建、流转、脚手架或安装入口。
