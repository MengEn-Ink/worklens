# alchaincyf 公开事实与游戏项目核验

## 调研口径

本轮只读取 GitHub 官方公开 REST API 与公开仓库页面；不凭仓库名判断项目性质，不保存邮箱、Token、Cookie、私有仓库或内部地址。`seed` 仅表示用户指定优先研究，不构成质量认证。Followers 只记录为公开流行度事实，不能解释为质量、信任或背书。

项目逐项核对仓库描述、目录内容、README、Topics、语言、SPDX 许可证、更新时间、Release 与公开贡献者。缺少声明许可证或源码证据时不得标为推荐，只能进入观察项。

## 核验结果（2026-10-25）

- `alchaincyf/nes-arcade`：仓库描述及 `src/`、`public/`、`package.json`、`vite.config.ts` 确认其为可运行的“121 款红白机经典游戏在线模拟器”，并非仅凭名称判断。24 Stars、11 Forks；主要语言为 TypeScript，另有 CSS/HTML；无 README、Topics、声明许可证和 Release。结论：`watch`。许可证门槛失败，ROM/游戏资产来源仍需另行审查。
- `alchaincyf/mistgarden-support`：描述及 `index.html`、`support.html`、`privacy.html`、`style.css` 确认其只是“雾庭飞行”Mac 游戏的支持与隐私站，不包含游戏源码。2 Stars、0 Fork；语言为 HTML；无 README、Topics、声明许可证和 Release。结论：`watch`，不可作为开源游戏项目推荐。

除以上两个经内容核验的游戏相关仓库外，本轮没有把名称或描述中的模糊命中自动认定为游戏项目。

## 公开证据入口

- [用户公开 API](https://api.github.com/users/alchaincyf)
- [公开仓库 API](https://api.github.com/users/alchaincyf/repos?per_page=100&type=owner)
- [nes-arcade 仓库](https://github.com/alchaincyf/nes-arcade)
- [nes-arcade Releases API](https://api.github.com/repos/alchaincyf/nes-arcade/releases?per_page=1)
- [mistgarden-support 仓库](https://github.com/alchaincyf/mistgarden-support)
- [mistgarden-support Releases API](https://api.github.com/repos/alchaincyf/mistgarden-support/releases?per_page=1)

机器可读快照见 `data/core-circle.json`。快照中的 `source_status` 区分成功、零结果与失败；事实可能随 GitHub 状态变化，使用时应结合观测时间。
