# 核心开源者圈层

## 模型

`data/core-circle.json` 是只含 GitHub 公开事实的可追溯图谱：

- `people.tier`：`seed`（明确优先研究）、`core`（通过多证据人工复核）、`candidate`、`watch`。seed 不自动升级为 core。
- `relationships.type`：`following`、`follower`、`contributor`、`co_contributor`、`shared_topic`。
- 每条关系必须带 `evidence_url`、`observed_at` 和来源状态。following/follower 固定为 `weak`，不能解释为质量、信任或背书。
- 项目必须记录 README、Topics、语言、SPDX 许可证、更新时间、Release 与贡献者证据；无许可证不可推荐，只能观察。

## AI 开源者发现策略

从人工 seed 出发，仅读 GitHub 官方 REST API：

1. 取 seed 的公开仓库，筛选非归档、命中 AI Topics 且达到最低 Star 的仓库。
2. 从这些仓库的公开 contributors 扩展候选；项目协作是强于 follower 的证据，但仍不自动代表质量。
3. 以共同贡献仓库和共同 Topics 形成 `co_contributor` / `shared_topic` 边。
4. following/follower 仅用于发现，权重为弱；不自动 follow、不发消息。
5. 对候选按“许可证已声明、非归档、近期维护、Release、协作证据、主题相关性”生成可解释分项；人工复核后才可进 core。

边界由 `config/core-circle.json` 固定：seed、每 seed 仓库、每仓库贡献者、follow 关系和最终候选均有限额；登录名大小写去重；失败来源与零结果分开；不保存邮箱、Token、Cookie、私有仓库、内部地址或 README 原文。

## alchaincyf 游戏项目核验（2026-10-24）

- `alchaincyf/nes-arcade`：仓库描述及 `src/`、`public/`、Vite/TypeScript 工程文件确认其为“121 款红白机经典游戏在线模拟器”，并非仅凭名称判断。24 Stars、11 Forks、7 次公开贡献；TypeScript/CSS/HTML；无 README、Topics、许可证、Release。结论：`watch`，许可证门槛失败，且 ROM/游戏资产来源仍需审查。
- `alchaincyf/mistgarden-support`：描述、页面文件和单次提交确认其只是“雾庭飞行”Mac 游戏的支持与隐私站，不包含游戏源码。2 Stars、0 Fork、1 位贡献者；HTML；无 README、Topics、许可证、Release。结论：`watch`，不可作为开源游戏推荐。

证据入口：[用户公开 API](https://api.github.com/users/alchaincyf)、[公开仓库 API](https://api.github.com/users/alchaincyf/repos?per_page=100&type=owner)、[nes-arcade](https://github.com/alchaincyf/nes-arcade)、[mistgarden-support](https://github.com/alchaincyf/mistgarden-support)。机器可读快照见 `data/core-circle.json`。

## 校验

```bash
python3 scripts/core_circle.py
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/security_scan.py
```

采集工作流当前为每日一次。核心圈未新建定时任务，避免与现有 collector 并发覆盖；下一步应把只读 API 扩展接入原 collector 的同一互斥组，并采用临时文件校验后原子写入。
