# WorkLens 数据契约

## discoveries.json

由每日采集工作流生成，仅保存 GitHub 官方 API 返回的事实字段。摘要、推荐和工作匹配判断不应覆盖这些字段。

关键字段：

- `generated_at`：本轮采集时间。
- `candidates`：去重后的仓库候选。
- `source_status`：每个来源是否采集成功；失败不能解释为“没有项目”。
- `source` / `also_seen_in`：候选的发现来源。

## 页面适配层

PC 与移动端页面在启动后读取发布产物中的 `data/discoveries.json`，再通过 `data-adapter.js` 转为页面视图模型。

适配规则：

- 仅使用公开 GitHub 元数据，不写入私有工作数据、内部地址、凭证或个人信息。
- `candidates` 为空或请求失败时，页面保留内置种子数据，避免 Pages 白屏。
- Skill 类候选只进入待审队列，页面不得自动安装、执行或推荐绕过安全评测。
- 评分仅用于排序和解释：`fit`、`novelty`、`cost`、`risk` 由公开指标与 freshness 粗算，不能替代许可证、安全和人工审查。

## profile.json

个人工作画像的最小结构。默认不保存原始文档、会议逐字稿、聊天内容或私有代码，只保存经用户允许的主题、权重、反馈和证据引用。

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
