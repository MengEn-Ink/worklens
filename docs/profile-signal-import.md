# 工作信号脱敏导入

WorkLens 可以吸收会议、飞书文档、播客、文章和代码仓库的主题信号，但公开仓库**永远不接收原文**。本地导入器使用“拒绝式白名单”：输入出现标题、URL、正文或逐字稿字段时直接失败。

## 本地 JSONL 契约

每行只允许以下字段：

```json
{"source_type":"meeting","occurred_at":"2026-10-24T08:00:00+08:00","topics":["agent","测试"],"evidence":"仅本地可见的记录 ID","duration_minutes":30}
```

- `source_type`：`meeting | lark_doc | podcast | article | repository`
- `occurred_at`：ISO 8601 时间
- `topics`：至少一个脱敏主题，不得放姓名、项目密钥或原文片段
- `evidence`：本地记录标识；输出只保留加盐哈希
- `duration_minutes`：可选的非负数

明确禁止：`title`、`content`、`url`、`transcript` 以及任何未在白名单中的字段。

## 使用方法

```bash
mkdir -p private-inputs
python3 scripts/import_profile_signals.py \
  private-inputs/work.signals.jsonl \
  --salt "仅保存在本机的随机盐"
```

生成的 `data/profile-signals.json` 只包含：

- 各类来源数量、总时长与最近时间
- 最多 50 个主题及频次
- 无法反推出原 ID 的本地加盐证据哈希

原始输入、散列盐及任何导出中间文件均已加入 `.gitignore`。提交前仍应执行敏感信息扫描。

## 后续连接器边界

飞书、会议和阅读服务连接器只负责在本地或受信环境中将数据转换为上述 JSONL；不得在 GitHub Actions 中配置飞书 Cookie、个人 Token 或私有文档权限，也不得把原文上传到 Pages。
