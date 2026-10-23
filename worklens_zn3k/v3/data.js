/* WorkLens 种子数据 —— 2026 Vol.4 · v3
   新增：喜好信号 / 订阅主题 / AI 工程能力 / 推送中心 / 演化日志
*/
window.WL_DATA = (function () {
  const ISSUE = {
    volume: '第 04 卷',
    issue: '总第 17 期',
    date: '2026 · 10 月 · 第 4 周',
    editor: 'Agent · WorkLens',
    curator_note:
      '本期以「Agent 作为图书管理员」为题，收录 24 件可直接改造日常工作流的新制品：7 件 Skill、9 件 UI Kit、5 件信息源、3 件理论读物。所有条目均完成一次 Agent 自检：有可复用的接口、有活跃的维护者、有可被引入的理由。',
    stats: { scanned: 1427, shortlisted: 86, curated: 24, adopted_this_week: 3 },
  };

  const SOURCES = [
    { id: 'gh-trending',  kind: 'GitHub Trending',        freq: '每 4 小时', signal: 'Stars 增速 · README 质量 · Issue 响应', health: 0.92, last: '14 分钟前', queued: 38 },
    { id: 'awesome-ai',   kind: 'Awesome-AI-Safety-Hub',  freq: '每日',     signal: 'wuyoscar/AISafetyHot-Hub · 日历式热榜', health: 0.88, last: '2 小时前', queued: 12 },
    { id: 'hn-top',       kind: 'Hacker News · AI 标签',   freq: '每小时',   signal: '首页停留时长 ≥ 2 小时',               health: 0.81, last: '27 分钟前', queued: 9 },
    { id: 'rss-engineer', kind: 'RSS · 25 位工程作者',    freq: '每日',     signal: 'Simon Willison / Latent Space / Phil Schmid', health: 0.95, last: '41 分钟前', queued: 6 },
    { id: 'arxiv-cs',     kind: 'arXiv · cs.HC+cs.AI',    freq: '每日',     signal: '关键词 agent/skill/UI 过滤 + 引用增速', health: 0.74, last: '昨日 23:40', queued: 17 },
    { id: 'twitter-list', kind: 'X List · Design-Eng',    freq: '每 2 小时', signal: '46 位已验证作者 · 转评比 > 3',          health: 0.69, last: '1 小时前', queued: 4 },
    { id: 'lark-wiki',    kind: '飞书知识库 · 内部',       freq: '手动',     signal: '同事收藏夹 · 周会提及',                 health: 1.0,  last: '手动',    queued: 0 },
  ];

  const PIPELINE = [
    { stage: '扫描',   en: 'Scan',    count: 38, hint: '原始候选' },
    { stage: '去重',   en: 'Dedupe',  count: 24, hint: '合并同类' },
    { stage: '评估',   en: 'Fit',     count: 11, hint: 'Agent 评估' },
    { stage: '上架',   en: 'Shelf',   count: 7,  hint: '入库待读' },
    { stage: '引入',   en: 'Adopt',   count: 3,  hint: '进入工作流' },
    { stage: '复盘',   en: 'Review',  count: 1,  hint: '30 天回头看' },
  ];

  /* 为每条 ENTRY 预埋 taste：liked / disliked / subscribed_topics */
  const ENTRIES = [
    {
      id: 'WL-240-017', dewey: '240.017', shelf: '发现 · 信息源',
      title: 'AISafetyHot-Hub',
      sub: '一个把安全类热点聚合成日历视图的清单项目',
      author: 'wuyoscar', source: 'GitHub', url: 'github.com/wuyoscar/AISafetyHot-Hub',
      kind: '信息源', tags: ['safety', 'daily-digest', 'aggregator'],
      scores: { fit: 92, novelty: 71, cost: 18, risk: 22 },
      verdict: 'adopt',
      taste: 'like', liked_at: '2026-10-23 09:12',
      why: '它示范了"日历 + 卡片 + 标签过滤"的策展结构，正是 WorkLens 想要的信息呈现范式。可直接 fork 其 scraper 作为我们的第 8 个信息源。',
      action: '引入为信息源 #008，并借鉴其日历视图做月度回顾',
      notes: ['抓取脚本是 Python + GitHub Actions，可直接套用', '日历组件使用 FullCalendar，考虑替换为编辑型风格的日历', '作者维护活跃度：近 30 天 42 次提交'],
      related: ['WL-240-012', 'WL-310-003'], added: '2026-10-23',
    },
    {
      id: 'WL-310-021', dewey: '310.021', shelf: 'UI · 组件',
      title: 'shadcn/ui × tweakcn',
      sub: '可视化调主题 + 一键导出 Tailwind token',
      author: 'jnsahaj', source: 'GitHub', url: 'tweakcn.com',
      kind: 'UI 组件', tags: ['design-tokens', 'tailwind', 'theme'],
      scores: { fit: 88, novelty: 64, cost: 10, risk: 15 },
      verdict: 'adopt', taste: 'like', liked_at: '2026-10-22 14:20',
      why: '把它变成一个 WorkLens Skill：输入品牌色 → 输出完整 shadcn 主题 JSON。',
      action: '封装为 Skill「brand-to-shadcn」，预计工期 1.5 天',
      notes: ['已验证 OKLCH 兼容', '需要加一层色觉可访问性过滤'],
      related: ['WL-310-003'], added: '2026-10-22',
    },
    {
      id: 'WL-240-012', dewey: '240.012', shelf: '发现 · 信息源',
      title: 'Simon Willison · 每日 LLM 笔记',
      sub: '每天一条高信噪 LLM 实践笔记',
      author: 'simonw', source: 'RSS', url: 'simonwillison.net/tags/llms/',
      kind: '信息源', tags: ['rss', 'daily', 'practitioner'],
      scores: { fit: 95, novelty: 58, cost: 5, risk: 8 },
      verdict: 'adopt', taste: 'love', liked_at: '2026-10-21 23:40',
      why: '个人工程师博客里信噪比最高的一位，适合作为"外部总编辑"的参照系。',
      action: '已加入 RSS 源清单，每日摘要进入 Hero 候选',
      notes: ['使用其 llm CLI 做批量摘要', '标签系统值得学习：62 个 tag 层级清晰'],
      related: ['WL-240-017'], added: '2026-10-21',
    },
    {
      id: 'WL-410-005', dewey: '410.005', shelf: '理论 · 智能体',
      title: 'The Prompt Report v2', sub: '58 页综述 · 1500+ 篇 prompt 工程文献',
      author: 'Sander Schulhoff 等', source: 'arXiv', url: 'arxiv.org/abs/2406.06608',
      kind: '读物', tags: ['survey', 'prompt', 'reference'],
      scores: { fit: 74, novelty: 82, cost: 45, risk: 5 },
      verdict: 'shelf', taste: null,
      why: '不是工具，但建立了 Agent Skill 命名的共同词汇表，值得作为团队术语基准。',
      action: '摘出 12 个核心术语，加入 WorkLens 词典',
      notes: ['已标注 2026 Q4 必读'], related: [], added: '2026-10-20',
    },
    {
      id: 'WL-310-003', dewey: '310.003', shelf: 'UI · 组件',
      title: 'Aceternity UI × Magic UI',
      sub: '动效密集的 React 组件群',
      author: 'aceternity', source: 'GitHub', url: 'ui.aceternity.com',
      kind: 'UI 组件', tags: ['motion', 'react', 'landing'],
      scores: { fit: 70, novelty: 76, cost: 22, risk: 28 },
      verdict: 'evaluate', taste: 'dislike', liked_at: '2026-10-20 11:03',
      why: 'Landing 页面的 wow factor 组件，适合做 Demo，但生产环境需要裁剪动效预算。',
      action: '挑 6 个最克制的做二次封装 → UI Skill「editorial-motion」',
      notes: ['部分组件依赖 Framer Motion 11+', '需要替换默认紫色主题'],
      related: ['WL-310-021'], added: '2026-10-20',
    },
    {
      id: 'WL-520-007', dewey: '520.007', shelf: '工作流',
      title: 'Readwise Reader API', sub: '把精读高亮同步进 WorkLens 的边注系统',
      author: 'Readwise', source: '文档', url: 'readwise.io/reader_api',
      kind: '集成', tags: ['api', 'reading', 'sync'],
      scores: { fit: 86, novelty: 42, cost: 30, risk: 18 },
      verdict: 'evaluate', taste: 'like', liked_at: '2026-10-19 20:11',
      why: '闭环的最后一公里：阅读→高亮→进入 WorkLens 的边注，形成个人注释层。',
      action: '原型化双向同步，先只读', notes: [], related: [], added: '2026-10-19',
    },
    {
      id: 'WL-240-004', dewey: '240.004', shelf: '发现 · 信息源',
      title: 'Trending-GitHub-Agent',
      sub: '把 GitHub Trending 按主题归档为日报',
      author: 'xxx-labs', source: 'GitHub', url: 'github.com/xxx/trending-agent',
      kind: 'Skill', tags: ['agent', 'daily', 'github'],
      scores: { fit: 81, novelty: 62, cost: 14, risk: 20 },
      verdict: 'adopt', taste: 'love',
      why: '可直接作为 WorkLens 的第 1 个 cron 任务。',
      action: '已跑通，接管 Scan 阶段',
      notes: ['修改默认 prompt 以匹配编辑型口吻'],
      related: ['WL-240-017'], added: '2026-10-18',
    },
    {
      id: 'WL-410-011', dewey: '410.011', shelf: '理论 · 设计',
      title: 'Refactoring UI（第二版）', sub: '仍是最好的"从程序员到设计师"手册',
      author: 'Adam Wathan, Steve Schoger', source: '图书', url: 'refactoringui.com',
      kind: '读物', tags: ['design', 'typography', 'spacing'],
      scores: { fit: 90, novelty: 32, cost: 120, risk: 2 },
      verdict: 'shelf', taste: 'like',
      why: '新版加了 Oklch 一章，值得整本重读。',
      action: '组织 3 次读书会，每次 1 章',
      notes: ['第 4 章「typography」被引用最多'],
      related: [], added: '2026-10-17',
    },
    {
      id: 'WL-310-033', dewey: '310.033', shelf: 'UI · 组件',
      title: 'Vaul — React Drawer', sub: '一个克制到极致的 drawer 组件',
      author: 'emilkowalski', source: 'GitHub', url: 'vaul.emilkowal.ski',
      kind: 'UI 组件', tags: ['drawer', 'mobile', 'gesture'],
      scores: { fit: 72, novelty: 68, cost: 8, risk: 10 },
      verdict: 'shelf', taste: null,
      why: '移动端场景极简实现，可直接作为 H5 原型的 bottom sheet 标配。',
      action: '收录到 UI Kit 子集', notes: [], related: ['WL-310-003'], added: '2026-10-17',
    },
  ];

  const ROUTES = [
    {
      id: 'R-01', title: '从「追踪」到「策展」',
      sub: '用一周时间搭起一个编辑型风格的信息中台',
      duration: '7 天 · 约 11 小时',
      stages: [
        { day: '第 1 天', topic: '确立选题哲学', refs: ['WL-410-011'], effort: '1.5 小时', deliverable: '一份《编辑手册》v1' },
        { day: '第 2–3 天', topic: '接入 3 个信息源', refs: ['WL-240-017', 'WL-240-012', 'WL-240-004'], effort: '4 小时', deliverable: '3 个 cron 任务跑通' },
        { day: '第 4 天', topic: '设计评分模型', refs: ['WL-410-005'], effort: '2 小时', deliverable: 'Fit/Novelty/Cost/Risk 四维评分' },
        { day: '第 5 天', topic: '搭阅读视图', refs: ['WL-310-021', 'WL-520-007'], effort: '2 小时', deliverable: 'Reader 原型' },
        { day: '第 6 天', topic: '引入闭环', refs: ['WL-310-033'], effort: '1 小时', deliverable: 'Adopt 流程文档' },
        { day: '第 7 天', topic: '首期策展上线', refs: [], effort: '0.5 小时', deliverable: '第 04 卷 第 17 期发布' },
      ],
      progress: 0.57,
    },
    {
      id: 'R-02', title: 'UI 组件系统化',
      sub: '把散落的 UI 片段编织成可声明调用的 Skill 层',
      duration: '14 天 · 约 24 小时',
      stages: [
        { day: '第 1 周', topic: 'Token 层', refs: ['WL-310-021'], effort: '8 小时', deliverable: '一套 OKLCH token 规范' },
        { day: '第 1 周', topic: '组件选型', refs: ['WL-310-003', 'WL-310-033'], effort: '8 小时', deliverable: '6 个编辑型组件' },
        { day: '第 2 周', topic: '封装为 Skill', refs: [], effort: '8 小时', deliverable: '发布 UI-Kit-Editorial v0.1' },
      ],
      progress: 0.21,
    },
  ];

  const ADOPTIONS = [
    { id: 'A-07', entry: 'WL-240-004', title: 'Trending-GitHub-Agent', adoptedAt: '2026-10-18', daysLive: 6, metric: { usage: 142, saved_min: 86, kept: true }, note: '每天节省约 15 分钟手动翻 Trending，命中率 72%，决定长期保留。' },
    { id: 'A-06', entry: 'WL-240-012', title: 'Simon Willison RSS', adoptedAt: '2026-10-14', daysLive: 10, metric: { usage: 72, saved_min: 54, kept: true }, note: 'Hero 候选命中率最高的单一来源。' },
    { id: 'A-05', entry: 'WL-310-021', title: 'tweakcn（试运行）', adoptedAt: '2026-10-10', daysLive: 14, metric: { usage: 11, saved_min: 180, kept: null }, note: '节省了一次完整的 token 梳理，但使用频次低，待观察第二次使用。' },
    { id: 'A-04', entry: 'WL-X-002', title: '某 Prompt-Chain-UI（已下架）', adoptedAt: '2026-09-29', daysLive: 25, metric: { usage: 3, saved_min: 10, kept: false }, note: '上手成本高、与现有 Skill 定位重复，30 天复盘决定下架。' },
  ];

  const FIELD_NOTES = [
    { time: '00:08', from: 'Agent', text: '发现 wuyoscar/AISafetyHot-Hub 的日历视图范式，与 WorkLens 的本周策展栏结构同构，建议上架。', tag: '建议' },
    { time: '00:14', from: 'Agent', text: '去重：Simon Willison 近两日被 3 个源同时推送，合并为 1 条 Hero 候选。', tag: '去重' },
    { time: '00:21', from: 'You',   text: '把 UI 组件的 Novelty 门槛提到 60，避免又一个"动画组件库"刷屏。', tag: '规则' },
    { time: '00:26', from: 'Agent', text: '已按新门槛过滤。本期 UI 组件从 11 条收敛到 4 条。', tag: '确认' },
    { time: '00:33', from: 'Agent', text: '建议为「阅读→高亮→边注」建立一条新的 Workflow 路径，命名 R-03。', tag: '建议' },
    { time: '00:48', from: 'Agent', text: '你最近 7 天点❤ 4 次给"编辑型 UI / 日历式信息源"类，正在把 Fit 权重 +0.08。', tag: '演化' },
  ];

  const SHELVES = [
    { code: '240', name: '发现 · 信息源', count: 11 },
    { code: '310', name: 'UI · 组件',     count: 18 },
    { code: '410', name: '理论',          count: 7  },
    { code: '520', name: '工作流',        count: 5  },
    { code: '610', name: '基础设施',      count: 3  },
  ];

  /* 工作画像 */
  const PROFILE_SOURCES = [
    { id: 'ps-code',   icon: 'code',   kind: '代码仓库',   name: 'GitLab / GitHub',       scope: '32 个仓库 · 近 90 天',  signal: 'commit · PR · review 评论 · 语言栈', weight: 0.28, status: 'live',    last: '12 分钟前', hint: '最活跃信号' },
    { id: 'ps-meeting',icon: 'calendar',kind: '会议日程',  name: '飞书日历',               scope: '172 场 · 近 90 天',    signal: '标题 / 参与人 / 时长 / 关键词',       weight: 0.17, status: 'live',    last: '1 小时前',   hint: '占你 38% 工作时间' },
    { id: 'ps-doc',    icon: 'doc',    kind: '飞书文档',   name: '飞书知识库 + 云文档',    scope: '218 篇 · 近 90 天',    signal: '创建 / 编辑 / 评论 / 收藏',           weight: 0.19, status: 'live',    last: '38 分钟前',   hint: '产出密集度 ×1.8' },
    { id: 'ps-im',     icon: 'chat',   kind: '飞书 IM',    name: '群聊与私聊',             scope: '46 个群 · 近 30 天',   signal: '@你 · 关键词 · 响应时长',             weight: 0.08, status: 'live',    last: '5 分钟前',    hint: '只采样标题与关键词' },
    { id: 'ps-podcast',icon: 'pod',    kind: '播客',        name: 'Overcast / 小宇宙',      scope: '19 档 · 近 30 天',     signal: '完播 · 收藏片段 · 分享',              weight: 0.09, status: 'live',    last: '昨日',       hint: '通勤场景' },
    { id: 'ps-article',icon: 'rss',    kind: '长文阅读',    name: 'Readwise / 稍后读',      scope: '87 篇 · 近 30 天',     signal: '高亮 · 停留时长 · 标签',              weight: 0.11, status: 'live',    last: '3 小时前',   hint: '深读信号' },
    { id: 'ps-browser',icon: 'globe',  kind: '浏览历史',    name: 'Arc Pin / Raindrop',     scope: '~2,400 次 · 近 30 天', signal: '域名频次 · 停留 · 书签',              weight: 0.04, status: 'paused', last: '已暂停',     hint: '隐私模式·仅本地' },
    { id: 'ps-wiki',   icon: 'book',   kind: '内部 Wiki',   name: '飞书 Wiki · 收藏夹',     scope: '63 篇 · 全部',         signal: '收藏 · 引用 · 置顶',                  weight: 0.04, status: 'live',    last: '2 天前',     hint: '长期沉淀' },
  ];

  /* 新增一条 "你的喜好信号" 作为第 9 条信号源 */
  const TASTE_SOURCE = {
    id: 'ps-taste', icon: 'heart', kind: '你的喜好', name: 'WorkLens · Taste Signal',
    scope: '142 次 ❤ · 近 30 天', signal: '卡片 ❤ / ✕ · 主题订阅 · 推送反馈',
    weight: 0.18, status: 'live', last: '刚刚', hint: '权重最快增长的信号', isTaste: true,
  };

  const PROFILE_RADAR = [
    { axis: '设计系统',  score: 86, delta: +4,  color: 'cinnabar' },
    { axis: 'AI Agent', score: 92, delta: +11, color: 'cinnabar' },
    { axis: '前端工程',  score: 74, delta: +2,  color: 'ink' },
    { axis: '产品策略',  score: 61, delta: -3,  color: 'ink' },
    { axis: '基础设施',  score: 42, delta: 0,   color: 'mute' },
    { axis: '数据与评估', score: 58, delta: +6,  color: 'ink' },
  ];

  const PROFILE_KEYWORDS = [
    { w: 'agent', n: 148, trend: 'up', source: 'code+doc+podcast' },
    { w: 'skill', n: 124, trend: 'up', source: 'code+doc' },
    { w: '编辑型设计', n: 96, trend: 'up', source: 'article+doc' },
    { w: 'OKLCH', n: 72, trend: 'up', source: 'article+code' },
    { w: 'eval', n: 61, trend: 'up', source: 'meeting+code' },
    { w: '飞书 Wiki', n: 54, trend: 'flat', source: 'doc' },
    { w: 'React 19', n: 49, trend: 'up', source: 'code+article' },
    { w: '多模态', n: 41, trend: 'flat', source: 'podcast+article' },
    { w: '组件库',  n: 38, trend: 'flat', source: 'code+doc' },
    { w: 'Readwise', n: 29, trend: 'up', source: 'article' },
    { w: '观测', n: 26, trend: 'down', source: 'meeting' },
    { w: 'onboarding', n: 22, trend: 'flat', source: 'doc' },
  ];

  const PROFILE_TIMEMAP = (() => {
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const seed = [0,0,0,0,0,0,0,1,2,3,3,3,2,1,3,3,4,3,2,1,2,2,1,0];
    const noise = [[0,.1,.1,0,.1,.2,0,.2,.1,.3,.4,.1,.4,.3,.2,.1,.0,.3,.5,.2,.4,.3,.2,.1],
                   [.1,0,0,.1,.1,.1,.1,.1,.2,.3,.4,.3,.2,.4,.3,.5,.3,.2,.1,.3,.1,.2,.1,0],
                   [0,0,0,0,.1,.1,.1,.3,.2,.4,.5,.3,.3,.4,.4,.5,.3,.2,.3,.2,.1,.1,0,.1],
                   [.1,0,0,.1,0,.1,.1,.2,.3,.4,.3,.4,.5,.4,.5,.3,.4,.3,.2,.3,.2,.1,.1,.1],
                   [0,0,.1,0,0,.1,.2,.3,.4,.5,.4,.5,.4,.5,.4,.3,.5,.3,.4,.3,.2,.2,.3,.1],
                   [0,0,0,0,0,0,.1,.1,.1,.2,.2,.3,.3,.2,.1,.1,.1,.2,.1,.3,.2,.3,.1,.1],
                   [0,0,0,0,0,0,0,.1,.1,.1,.2,.3,.2,.3,.2,.2,.1,.1,.2,.4,.3,.2,.2,.1]];
    return days.map((d, i) => ({
      day: '周' + d,
      hours: seed.map((s, h) => Math.min(5, Math.max(0, Math.round((s + noise[i][h] * 2) * (i<5?1:0.5)))))
    }));
  })();

  const PROFILE_EVIDENCE = [
    { claim: '你本周的核心战场是 "Agent × 编辑型设计" 的交叉地带',
      evidence: ['代码仓库：worklens / aime-skills 两个项目贡献占 61% 的 commit',
                 '飞书文档：7 篇新增均含 "editorial" 或 "agent" 关键词',
                 '播客：《无人之境》第 48 期 2 次完播、1 次分享',
                 '阅读：Readwise 高亮 23 条，80% 聚焦 token / curation',
                 '喜好：近 7 天点❤ 4 次给"编辑型 UI"主题'],
      confidence: 0.86 },
    { claim: '你的会议密度在周三下午异常升高，建议 Agent 为周三保留两段"深度时段"',
      evidence: ['近 4 周周三 14:00–18:00 平均 5.2 场会议',
                 '周三下午产出文档数为其他时段均值的 0.3',
                 '相同模式在 X list 上被 3 位同类角色反馈'],
      confidence: 0.74 },
    { claim: '你对"基础设施"类条目兴趣连续三周低于阈值，Agent 已把该书架权重降至 0.6',
      evidence: ['最近 21 天 "610 · 基础设施" 书架 0 次点击',
                 '连续 3 次推送被你点 ✕',
                 '对冲：adjacent "可观测性" 关键词仍有点击，保留其子集'],
      confidence: 0.68 },
  ];

  const PRIVACY_RULES = [
    { on: true,  text: '所有抓取仅存储元数据与关键词，不保留原文正文' },
    { on: true,  text: '飞书 IM 不索引聊天内容，只统计 @你的频次与话题标签' },
    { on: true,  text: '浏览历史走本地化模型，不出设备' },
    { on: true,  text: '喜好信号仅用于本地画像演化，不出设备' },
    { on: false, text: '允许将匿名画像同步到团队画像池（当前关闭）' },
  ];

  /* ============================================================
     v3 新增：喜好信号 · 订阅主题 · AI 工程能力 · 推送中心 · 演化日志
     ============================================================ */

  /* 本周喜好快照 —— 由 taste action 聚合 */
  const TASTE_SUMMARY = {
    week_likes: 11,         // ❤ 次数
    week_loves: 4,          // ❤❤
    week_skips: 6,          // ✕
    week_saves: 7,          // 稍后读
    week_subscriptions: 3,  // 本周新订阅主题
    total_likes: 142,
    top_topics: [
      { topic: '编辑型 UI',     count: 9, trend: 'up',   weight: 0.86 },
      { topic: '信息策展',     count: 7, trend: 'up',   weight: 0.78 },
      { topic: 'Agent Skill',  count: 6, trend: 'up',   weight: 0.74 },
      { topic: 'OKLCH / Token', count: 4, trend: 'up',   weight: 0.62 },
      { topic: 'Readwise 集成', count: 3, trend: 'up',   weight: 0.58 },
      { topic: '动效组件',     count: 2, trend: 'down', weight: 0.31 },
    ],
    trend_7d: [1, 2, 1, 3, 2, 4, 2],  // 每日 ❤ 次数
  };

  /* 订阅主题 —— 你明确声明"持续关注"的 */
  const TASTE_SUBSCRIPTIONS = [
    { id: 's-01', topic: '编辑型 UI', since: '2026-10-05', pushes: 14, from_likes: true, muted: false, cover_entries: 6 },
    { id: 's-02', topic: 'Agent Skill 工程', since: '2026-09-28', pushes: 23, from_likes: true, muted: false, cover_entries: 11 },
    { id: 's-03', topic: 'OKLCH / 设计 Token', since: '2026-10-12', pushes: 7, from_likes: false, muted: false, cover_entries: 4 },
    { id: 's-04', topic: '信息策展与知识库', since: '2026-10-20', pushes: 3, from_likes: true, muted: false, cover_entries: 2 },
    { id: 's-05', topic: '移动端 Drawer / Sheet', since: '2026-10-17', pushes: 2, from_likes: false, muted: true, cover_entries: 1 },
  ];

  /* AI 工程能力 —— 本质是"由你的喜好与引入物共同训练出的 Skill 层" */
  const AI_SKILLS = [
    {
      id: 'sk-01', name: 'brand-to-shadcn', family: 'UI 工程',
      origin: '源自 WL-310-021 的引入 + 你 ❤ OKLCH 主题 4 次',
      status: 'live', version: 'v0.3', last_run: '2 小时前', runs_7d: 18,
      saves_per_run: '8 min', confidence: 0.82,
      skills_vector: ['tokens', 'oklch', 'tailwind', 'theme'],
      recent_improvement: '上周你 ❤ 了「色觉可访问性」，本版新增 WCAG 2.1 对比度校验',
    },
    {
      id: 'sk-02', name: 'editorial-rewrite', family: '策展',
      origin: '源自你对 "编辑型 UI" 主题的 9 次 ❤',
      status: 'live', version: 'v0.5', last_run: '38 分钟前', runs_7d: 42,
      saves_per_run: '4 min', confidence: 0.88,
      skills_vector: ['copy', 'tone', 'typography'],
      recent_improvement: '新增 drop-cap 建议：当 § 段落长度 > 180 字时自动触发',
    },
    {
      id: 'sk-03', name: 'readwise-sync', family: '集成',
      origin: '源自 WL-520-007 的引入评估',
      status: 'preview', version: 'v0.1', last_run: '昨日', runs_7d: 3,
      saves_per_run: '12 min', confidence: 0.54,
      skills_vector: ['api', 'reading', 'highlight'],
      recent_improvement: '首个双向同步 PoC；待你 ❤ 后进入正式版',
    },
    {
      id: 'sk-04', name: 'daily-field-note', family: '策展',
      origin: '源自你 ❤ Simon Willison 的 Daily LLM Log',
      status: 'live', version: 'v0.2', last_run: '刚刚', runs_7d: 7,
      saves_per_run: '15 min', confidence: 0.79,
      skills_vector: ['digest', 'rss', 'editorial'],
      recent_improvement: '把输出口吻从 "报告" 调为 "田野笔记"',
    },
  ];

  /* Agent 根据近期喜好自动生成的 Skill 建议 —— 待你接受/驳回 */
  const SKILL_PROPOSALS = [
    {
      id: 'pr-01', name: 'calendar-aggregator', family: '策展',
      why: '连续 3 次 ❤ 日历式信息源（AISafetyHot-Hub 等），且你本周订阅了"信息策展与知识库"主题',
      evidence: ['WL-240-017 ❤ · 2026-10-23', '主题订阅 s-04 · 2026-10-20', '时间地图偏好周二 10:00 阅读'],
      cost_est: '约 2.5 天', confidence: 0.78,
      preview_dsl: `skill: wl.curate.calendar-aggregator
inputs:  { sources: ["gh","rss","wiki"], window: 7d }
output:  { calendar: {day,topic,count,top3}[] }
hooks:   { on_like: raise_weight(topic, +0.05) }`,
    },
    {
      id: 'pr-02', name: 'podcast-highlight-to-doc', family: '集成',
      why: '你完播《无人之境》48 期并分享；长文阅读信号同向增长',
      evidence: ['Overcast 完播 2 次', 'Readwise 高亮 23 条命中 "agent"'],
      cost_est: '约 1.5 天', confidence: 0.69,
      preview_dsl: `skill: wl.sync.pod-to-doc
listens: { app: "Overcast", on: "share" }
emits:   { lark.doc: { title, timestamp, transcript_snippet } }`,
    },
    {
      id: 'pr-03', name: 'meeting-depth-blocker', family: '工作流',
      why: '你周三下午会议密度连续 4 周超阈值，产出显著下降',
      evidence: ['周三 14-18 均 5.2 场', '周三文档产出 ×0.3', 'Agent 判断置信度 0.74'],
      cost_est: '约 0.5 天', confidence: 0.66,
      preview_dsl: `skill: wl.calendar.depth-block
scan:    { weekday: Wed, slot: 14-18 }
action:  { propose_block: 2 * 90min, label: "Deep Work" }`,
    },
  ];

  /* 推送中心 —— Agent 根据喜好主动推给你的东西 */
  const PUSHES = [
    { id: 'pu-01', time: '00:52', topic: '编辑型 UI', title: 'Rauno 新发布 editorial-grid 组件', from: 'rauno.me', reason: '因为你 ❤ shadcn/tweakcn 两次', verdict: 'adopt', score: 84, read: false },
    { id: 'pu-02', time: '00:48', topic: 'Agent Skill 工程', title: 'Anthropic 更新 Claude Skills 协议', from: 'anthropic.com', reason: '你订阅了「Agent Skill 工程」', verdict: 'shelf', score: 72, read: false },
    { id: 'pu-03', time: '00:21', topic: 'OKLCH / Token', title: 'Culori v4 支持 Oklab Delta E', from: 'github.com', reason: '因为你 ❤ OKLCH 相关 3 次', verdict: 'evaluate', score: 68, read: true },
    { id: 'pu-04', time: '昨日', topic: '信息策展', title: 'Readwise Reader 新增 "collections" API', from: 'readwise.io', reason: '匹配你本周订阅 s-04', verdict: 'adopt', score: 76, read: true },
    { id: 'pu-05', time: '昨日', topic: '动效组件', title: 'Magic UI 发布 20 个新组件', from: 'magicui.design', reason: '你曾 ❤ 此类，但近期趋势下降', verdict: 'evaluate', score: 51, read: true, downgrading: true },
  ];

  /* 画像演化日志 —— 展示 "你的操作 → Agent 的调整" 对应关系 */
  const EVOLUTION_LOG = [
    { time: '00:48', trigger: 'you_like',       action: '把「编辑型 UI」Fit 权重 +0.08', delta: '+0.08', axis: 'editorial-ui' },
    { time: '00:33', trigger: 'proposal_new',   action: '新建 Skill 建议 pr-01 calendar-aggregator', delta: 'new',   axis: 'skill-studio' },
    { time: '00:21', trigger: 'you_dislike',    action: 'Aceternity UI 相关候选未来一周降权 ×0.6',   delta: '-0.4',  axis: 'motion-ui' },
    { time: '昨日',   trigger: 'you_subscribe',  action: '订阅主题 s-04 "信息策展与知识库"',           delta: '+topic', axis: 'curation' },
    { time: '昨日',   trigger: 'adopt_success',  action: 'Trending-GitHub-Agent D+6 命中率 72%，升级 Fit 模型 v1.4', delta: '+0.12', axis: 'fit-model' },
    { time: '2 天前', trigger: 'proposal_accepted', action: '接受 Skill 建议：editorial-rewrite v0.5', delta: '+skill', axis: 'skill-studio' },
    { time: '3 天前', trigger: 'you_dislike',    action: '降低「基础设施」书架权重至 0.6',             delta: '-0.4',   axis: 'infra' },
    { time: '3 天前', trigger: 'agent_insight',  action: '发现周三下午深度时段缺失，生成 pr-03',       delta: 'new',    axis: 'calendar' },
  ];

  return {
    ISSUE, SOURCES, PIPELINE, ENTRIES, ROUTES, ADOPTIONS, FIELD_NOTES, SHELVES,
    PROFILE_SOURCES, TASTE_SOURCE, PROFILE_RADAR, PROFILE_KEYWORDS, PROFILE_TIMEMAP, PROFILE_EVIDENCE, PRIVACY_RULES,
    TASTE_SUMMARY, TASTE_SUBSCRIPTIONS, AI_SKILLS, SKILL_PROPOSALS, PUSHES, EVOLUTION_LOG,
  };
})();
