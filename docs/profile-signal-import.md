# 工作信号脱敏导入

WorkLens 可以吸收会议、飞书文档、播客、文章和代码仓库的主题信号，但公开仓库**永远不接收原文**。本地导入器使用“拒绝式白名单”：输入出现标题、URL、正文或逐字稿字段时直接失败。

## 本地 JSONL 契约

每行只允许以下字段：

```json
{"source_type":"meeting","occurred_at":"2026-10-24T08:00:00+08:00","topics":["agent","测试"],"evidence":"仅本地可见的记录 ID","duration_minutes":30}
```

- `source_type`：`meeting | lark_doc | podcast | article | repository | rss`
- `occurred_at`：ISO 8601 时间
- `topics`：至少一个脱敏主题，不得放姓名、项目密钥或原文片段
- `evidence`：本地记录标识；输出只保留加盐哈希
- `duration_minutes`：可选的非负数

明确禁止：`title`、`content`、`url`、`transcript` 以及任何未在白名单中的字段。

## 通用 RSS / 播客 OPML 导入

`import_profile_signals.py` 现在也支持直接读取本地 OPML 导出文件，适配通用 RSS 阅读器和播客 App 的订阅迁移场景。

```bash
mkdir -p private-inputs
python3 scripts/import_profile_signals.py \
  private-inputs/subscriptions.opml \
  --input-format opml \
  --source-type auto \
  --salt "仅保存在本机的随机盐"
```

导入边界：

- 只在本地读取 OPML，不访问网络，不请求私有 API。
- 订阅地址在散列前会去掉账号、查询参数和 fragment，避免把 Token 或个性化订阅参数写入仓库。
- OPML 中的 `text`、`title`、`xmlUrl`、`htmlUrl` 只用于本地提取粗粒度主题，最终输出不会保留这些原始值。
- `--source-type auto` 会按标题、分类和常见播客域名粗分为 `rss` 或 `podcast`；需要强制归类时可传 `--source-type rss|podcast`。

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
- 无法反推出原 ID 或完整订阅 URL 的本地加盐证据哈希

原始输入、散列盐及任何导出中间文件均已加入 `.gitignore`。提交前仍应执行敏感信息扫描。

## 成熟方案调研与取舍

- 采用 [OPML 2.0 订阅列表约定](https://listparser.readthedocs.io/en/latest/specifications/opml-2.0.html)：订阅节点本质上是 `outline[type=rss][xmlUrl]` 的树结构，适合直接做本地静态解析。
- 参考 [AntennaPod 的备份文档](https://antennapod.org/documentation/general/backup)：播客应用普遍把 OPML 作为订阅迁移格式，因此本轮优先支持 OPML，而不是先接私有播客平台 API。
- 未采用 [listparser](https://listparser.readthedocs.io/)：它是成熟的 OPML 解析库，但当前任务只需要读取本地 OPML 并马上脱敏聚合，引入额外依赖会扩大供应链和维护面。
- 未采用 [feedparser](https://feedparser.readthedocs.io/en/stable/introduction.html)：它擅长解析 RSS/Atom 正文与远端 Feed 内容，而 WorkLens 本轮不抓取远端内容，只导入订阅关系，所以收益不足以覆盖依赖成本。

## 后续连接器边界

飞书、会议和阅读服务连接器只负责在本地或受信环境中将数据转换为上述 JSONL/OPML 输入；不得在 GitHub Actions 中配置飞书 Cookie、个人 Token 或私有文档权限，也不得把原文上传到 Pages。
