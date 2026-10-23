# WorkLens 数据契约

## discoveries.json

由每日采集工作流生成，仅保存 GitHub 官方 API 返回的事实字段。摘要、推荐和工作匹配判断不应覆盖这些字段。

关键字段：

- `generated_at`：本轮采集时间。
- `candidates`：去重后的仓库候选。
- `source_status`：每个来源是否采集成功；失败不能解释为“没有项目”。
- `source` / `also_seen_in`：候选的发现来源。

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
