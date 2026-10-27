/* @jsxRuntime classic */
/* global React, ReactDOM, fetch */
/* ================================================================
   WorkLens Mobile · 入口（H5 · 9:19.5）
   —— 口袋里的工作智库月刊
   ---------------------------------------------------------------- */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

/* ================================================================
   极简种子数据（手机端自带，无外部依赖）
   ---------------------------------------------------------------- */
const DATA = {
  issue: {
    volume: '第 04 卷', issue: '总第 17 期', date: '2026 · 10 · 第 4 周',
    note: '本期以「Agent 作为图书管理员」为题，收录 24 件可直接改造日常工作流的新制品。',
    stats: { scanned: 1427, curated: 24, adopted: 3, saved: 86 },
  },
  entries: [
    {
      id: 'WL-240-017', dewey: '240.017', shelf: '发现 · 信息源',
      title: 'AISafetyHot-Hub', sub: '把安全类热点聚合成日历视图的清单项目',
      author: 'wuyoscar', source: 'GitHub', url: 'github.com/wuyoscar/AISafetyHot-Hub',
      kind: '信息源', tags: ['safety', 'daily-digest'],
      scores: { fit: 92, novelty: 71, cost: 18, risk: 22 },
      verdict: 'adopt',
      why: '它示范了"日历 + 卡片 + 标签过滤"的策展结构，正是 WorkLens 想要的信息呈现范式。可直接 fork 其 scraper 作为我们的第 8 个信息源。',
      action: '引入为信息源 #008，并借鉴其日历视图做月度回顾',
      added: '2026-10-23',
    },
    {
      id: 'WL-310-021', dewey: '310.021', shelf: 'UI · 组件',
      title: 'shadcn/ui × tweakcn', sub: '可视化调主题 + 一键导出 Tailwind token',
      author: 'jnsahaj', source: 'GitHub', url: 'tweakcn.com',
      kind: 'UI 组件', tags: ['design-tokens', 'tailwind'],
      scores: { fit: 88, novelty: 64, cost: 10, risk: 15 },
      verdict: 'adopt',
      why: '把它变成一个 WorkLens Skill：输入品牌色 → 输出完整 shadcn 主题 JSON。',
      action: '封装为 Skill「brand-to-shadcn」，预计工期 1.5 天',
      added: '2026-10-22',
    },
    {
      id: 'WL-240-012', dewey: '240.012', shelf: '发现 · 信息源',
      title: 'Simon Willison · 每日 LLM 笔记', sub: '每天一条高信噪 LLM 实践笔记',
      author: 'simonw', source: 'RSS', url: 'simonwillison.net/tags/llms/',
      kind: '信息源', tags: ['rss', 'daily'],
      scores: { fit: 95, novelty: 58, cost: 5, risk: 8 },
      verdict: 'adopt',
      why: '个人工程师博客里信噪比最高的一位，适合作为"外部总编辑"的参照系。',
      action: '已加入 RSS 源清单，每日摘要进入 Hero 候选',
      added: '2026-10-21',
    },
    {
      id: 'WL-410-005', dewey: '410.005', shelf: '理论 · 智能体',
      title: 'The Prompt Report v2', sub: '58 页综述 · 1500+ 篇 prompt 工程文献',
      author: 'Sander 等', source: 'arXiv', url: 'arxiv.org/abs/2406.06608',
      kind: '读物', tags: ['survey', 'prompt'],
      scores: { fit: 74, novelty: 82, cost: 45, risk: 5 },
      verdict: 'shelf',
      why: '不是工具，但建立了 Agent Skill 命名的共同词汇表，值得作为团队术语基准。',
      action: '摘出 12 个核心术语，加入 WorkLens 词典',
      added: '2026-10-20',
    },
    {
      id: 'WL-310-003', dewey: '310.003', shelf: 'UI · 组件',
      title: 'Aceternity UI', sub: '动效密集的 React 组件群',
      author: 'aceternity', source: 'GitHub', url: 'ui.aceternity.com',
      kind: 'UI 组件', tags: ['motion', 'react'],
      scores: { fit: 70, novelty: 76, cost: 22, risk: 28 },
      verdict: 'evaluate',
      why: 'Landing 页面的 wow factor 组件，适合做 Demo，但生产环境需要裁剪动效预算。',
      action: '挑 6 个最克制的做二次封装',
      added: '2026-10-20',
    },
    {
      id: 'WL-520-007', dewey: '520.007', shelf: '工作流',
      title: 'Readwise Reader API', sub: '把精读高亮同步进 WorkLens 的边注系统',
      author: 'Readwise', source: '文档', url: 'readwise.io/reader_api',
      kind: '集成', tags: ['api', 'reading'],
      scores: { fit: 86, novelty: 42, cost: 30, risk: 18 },
      verdict: 'evaluate',
      why: '闭环的最后一公里：阅读→高亮→进入 WorkLens 的边注。',
      action: '原型化双向同步，先只读',
      added: '2026-10-19',
    },
  ],
  pipeline: [
    { stage: '扫描', count: 38, hint: '原始候选' },
    { stage: '去重', count: 24, hint: '合并同类' },
    { stage: '评估', count: 11, hint: 'Agent 评估' },
    { stage: '上架', count: 7,  hint: '入库待读' },
    { stage: '引入', count: 3,  hint: '工作流' },
    { stage: '复盘', count: 1,  hint: 'D+30' },
  ],
  fieldNotes: [
    { time: '00:08', from: 'Agent', text: '发现 AISafetyHot-Hub 的日历范式，与本周策展栏同构，建议上架。', tag: '建议' },
    { time: '00:14', from: 'Agent', text: 'Simon Willison 近两日被 3 个源同时推送，合并为 1 条候选。', tag: '去重' },
    { time: '00:21', from: '你',    text: 'UI 组件 Novelty 门槛提到 60，避免又一个"动画组件库"。', tag: '规则' },
    { time: '00:26', from: 'Agent', text: '已按新门槛过滤。UI 组件从 11 条收敛到 4 条。', tag: '确认' },
    { time: '00:33', from: 'Agent', text: '建议为「阅读→高亮→边注」建立新路径 R-03。', tag: '建议' },
  ],
  shelves: [
    { code: '240', name: '发现 · 信息源', count: 11 },
    { code: '310', name: 'UI · 组件',     count: 18 },
    { code: '410', name: '理论',          count: 7  },
    { code: '520', name: '工作流',        count: 5  },
    { code: '610', name: '基础设施',      count: 3  },
  ],
  profileSources: [
    { id: 'ps-code',    icon: 'gh',   kind: '代码仓库',   name: 'GitLab / GitHub',   scope: '32 个仓库',  weight: 0.28, status: 'live',   last: '12 分钟前', hint: '最活跃信号' },
    { id: 'ps-meeting', icon: 'cal',  kind: '会议日程',   name: '飞书日历',           scope: '172 场',    weight: 0.17, status: 'live',   last: '1 小时前',  hint: '占 38% 时间' },
    { id: 'ps-doc',     icon: 'doc',  kind: '飞书文档',   name: '知识库 + 云文档',    scope: '218 篇',    weight: 0.19, status: 'live',   last: '38 分钟前', hint: '产出密集' },
    { id: 'ps-im',      icon: 'chat', kind: '飞书 IM',    name: '群聊 @ 关键词',      scope: '46 个群',   weight: 0.08, status: 'live',   last: '5 分钟前',  hint: '只采标题与标签' },
    { id: 'ps-pod',     icon: 'pod',  kind: '播客',       name: 'Overcast / 小宇宙',  scope: '19 档',     weight: 0.09, status: 'live',   last: '昨日',     hint: '通勤场景' },
    { id: 'ps-art',     icon: 'rss',  kind: '长文阅读',   name: 'Readwise',          scope: '87 篇',     weight: 0.11, status: 'live',   last: '3 小时前',  hint: '深读信号' },
    { id: 'ps-br',      icon: 'glb',  kind: '浏览历史',   name: 'Arc Pin / Raindrop', scope: '~2,400 次', weight: 0.04, status: 'paused', last: '已暂停',   hint: '仅本地' },
    { id: 'ps-wiki',    icon: 'book', kind: '内部 Wiki',  name: '飞书 Wiki 收藏夹',  scope: '63 篇',     weight: 0.04, status: 'live',   last: '2 天前',   hint: '长期沉淀' },
  ],
  radar: [
    { axis: '设计系统', score: 86, delta: +4 },
    { axis: 'Agent',   score: 92, delta: +11 },
    { axis: '前端工程', score: 74, delta: +2 },
    { axis: '产品策略', score: 61, delta: -3 },
    { axis: '基础设施', score: 42, delta: 0 },
    { axis: '数据评估', score: 58, delta: +6 },
  ],
  keywords: [
    { w: 'agent', n: 148, trend: 'up' },
    { w: 'skill', n: 124, trend: 'up' },
    { w: '编辑型设计', n: 96, trend: 'up' },
    { w: 'OKLCH', n: 72, trend: 'up' },
    { w: 'eval', n: 61, trend: 'up' },
    { w: '飞书 Wiki', n: 54, trend: 'flat' },
    { w: 'React 19', n: 49, trend: 'up' },
    { w: '多模态', n: 41, trend: 'flat' },
    { w: '组件库', n: 38, trend: 'flat' },
    { w: 'Readwise', n: 29, trend: 'up' },
    { w: '观测', n: 26, trend: 'down' },
  ],
  evidence: [
    { claim: '你本周的核心战场是「Agent × 编辑型设计」的交叉地带',
      evidence: ['代码仓库 worklens / aime-skills 占 61% commit',
                 '飞书文档 7 篇新增均含关键词 editorial / agent',
                 '播客《无人之境》第 48 期 2 次完播、1 次分享',
                 'Readwise 高亮 23 条，80% 聚焦 token / curation'],
      confidence: 0.86 },
    { claim: '你的会议密度在周三下午异常升高，建议为周三保留两段「深度时段」',
      evidence: ['近 4 周周三 14:00–18:00 平均 5.2 场',
                 '周三下午文档产出为均值的 0.3 倍'],
      confidence: 0.74 },
    { claim: '对「基础设施」类条目兴趣连续三周低于阈值，Agent 已把该书架权重降至 0.6',
      evidence: ['最近 21 天 610 书架 0 次点击',
                 '相关候选条目全部进入 Shelf 层未被激活'],
      confidence: 0.68 },
  ],
  privacy: [
    { on: true,  text: '抓取仅存元数据与关键词，不保留原文' },
    { on: true,  text: '飞书 IM 不索引聊天内容' },
    { on: true,  text: '浏览历史走本地化模型，不出设备' },
    { on: true,  text: '喜好信号仅用于本地画像演化，不出设备' },
    { on: false, text: '允许匿名画像同步团队池' },
  ],
  /* v2 新增：喜好信号总览 */
  tasteSummary: {
    week_likes: 11, week_loves: 4, week_skips: 6, week_saves: 7, week_subs: 3,
    total_likes: 142,
    trend_7d: [1, 2, 1, 3, 2, 4, 2],
    top_topics: [
      { topic: '编辑型 UI',     count: 9, trend: 'up',   weight: 0.86 },
      { topic: 'Agent Skill 工程', count: 7, trend: 'up',   weight: 0.78 },
      { topic: '信息策展',     count: 6, trend: 'up',   weight: 0.74 },
      { topic: 'OKLCH / Token', count: 4, trend: 'up',   weight: 0.62 },
      { topic: 'Readwise 集成', count: 3, trend: 'up',   weight: 0.58 },
      { topic: '动效组件',     count: 2, trend: 'down', weight: 0.31 },
    ],
  },
  subscriptions: [
    { id: 's-01', topic: '编辑型 UI', since: '2026-10-05', pushes: 14, muted: false, cover: 6 },
    { id: 's-02', topic: 'Agent Skill 工程', since: '2026-09-28', pushes: 23, muted: false, cover: 11 },
    { id: 's-03', topic: 'OKLCH / 设计 Token', since: '2026-10-12', pushes: 7, muted: false, cover: 4 },
    { id: 's-04', topic: '信息策展与知识库', since: '2026-10-20', pushes: 3, muted: false, cover: 2 },
    { id: 's-05', topic: '移动端 Drawer / Sheet', since: '2026-10-17', pushes: 2, muted: true, cover: 1 },
  ],
  aiSkills: [
    { id: 'sk-01', name: 'brand-to-shadcn', family: 'UI 工程', status: 'live', version: 'v0.3',
      runs_7d: 18, saves: '8 min', confidence: 0.82,
      origin: '源自 WL-310-021 的引入 + 你 ❤ OKLCH 主题 4 次',
      recent: '新增 WCAG 2.1 对比度校验' },
    { id: 'sk-02', name: 'editorial-rewrite', family: '策展', status: 'live', version: 'v0.5',
      runs_7d: 42, saves: '4 min', confidence: 0.88,
      origin: '源自你对「编辑型 UI」主题的 9 次 ❤',
      recent: 'drop-cap 建议：段落 > 180 字自动触发' },
    { id: 'sk-03', name: 'readwise-sync', family: '集成', status: 'preview', version: 'v0.1',
      runs_7d: 3, saves: '12 min', confidence: 0.54,
      origin: '源自 WL-520-007 的引入评估',
      recent: '首个双向同步 PoC；待 ❤ 后转正式版' },
    { id: 'sk-04', name: 'daily-field-note', family: '策展', status: 'live', version: 'v0.2',
      runs_7d: 7, saves: '15 min', confidence: 0.79,
      origin: '源自你 ❤ Simon Willison 的 Daily LLM Log',
      recent: '口吻从「报告」调为「田野笔记」' },
  ],
  proposals: [
    { id: 'pr-01', name: 'calendar-aggregator', family: '策展', cost: '约 2.5 天', confidence: 0.78,
      why: '连续 3 次 ❤ 日历式信息源，且本周订阅了「信息策展」',
      evidence: ['WL-240-017 ❤ · 2026-10-23', 's-04 订阅', '周二 10:00 偏好'],
      dsl: 'skill: wl.curate.calendar\ninputs: {sources:["gh","rss"], window:7d}\nhooks:  { on_like → +0.05 weight }' },
    { id: 'pr-02', name: 'podcast-highlight-to-doc', family: '集成', cost: '约 1.5 天', confidence: 0.69,
      why: '完播《无人之境》48 期并分享；长文高亮同向上升',
      evidence: ['Overcast 完播 2 次', 'Readwise 高亮 23 条'],
      dsl: 'skill: wl.sync.pod-to-doc\nlistens: {app:"Overcast", on:"share"}\nemits:   {lark.doc: {title, timestamp}}' },
    { id: 'pr-03', name: 'meeting-depth-blocker', family: '工作流', cost: '约 0.5 天', confidence: 0.66,
      why: '周三下午会议密度连续 4 周超阈值，产出下降',
      evidence: ['周三 14-18 均 5.2 场', '周三文档产出 ×0.3'],
      dsl: 'skill: wl.cal.depth-block\nscan:   {weekday: Wed, slot:14-18}\naction: {propose: 2*90min, label:"Deep Work"}' },
  ],
  skillQueue: {
    total: 0,
    byState: {},
    entries: [],
    blockingTotal: 0,
    autoInstall: false,
    humanGate: 'Skill 候选必须人工评测后才允许试用。',
  },
  pushes: [
    { id: 'pu-01', time: '00:52', topic: '编辑型 UI', title: 'Rauno 新发布 editorial-grid 组件',
      from: 'rauno.me', reason: '因你 ❤ shadcn/tweakcn 两次', score: 84, read: false },
    { id: 'pu-02', time: '00:48', topic: 'Agent Skill', title: 'Anthropic 更新 Claude Skills 协议',
      from: 'anthropic.com', reason: '订阅主题 s-02', score: 72, read: false },
    { id: 'pu-03', time: '00:21', topic: 'OKLCH', title: 'Culori v4 支持 Oklab Delta E',
      from: 'github.com', reason: '因你 ❤ OKLCH 相关 3 次', score: 68, read: true },
    { id: 'pu-04', time: '昨日', topic: '信息策展', title: 'Readwise Reader 新增 collections API',
      from: 'readwise.io', reason: '匹配订阅 s-04', score: 76, read: true },
  ],
};

/* ================================================================
   极简 Icon 集
   ---------------------------------------------------------------- */
const Icon = {
  home: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round"/></svg>,
  compass: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5.5-5.5 2 2-5.5z" strokeLinejoin="round"/></svg>,
  user: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="12" cy="8" r="3.5"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round"/></svg>,
  route: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M18 8v4a4 4 0 0 1-4 4h-4a4 4 0 0 0-4 4"/></svg>,
  search: (p) => <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><circle cx="9" cy="9" r="5.5"/><path d="M13.5 13.5l3.5 3.5" strokeLinecap="round"/></svg>,
  bell: (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3zM10 20a2 2 0 0 0 4 0" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  chev: (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrR: (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M4 12h15M14 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/></svg>,
  bookmark: (p) => <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M4 2h8v12l-4-3-4 3V2z" strokeLinejoin="round"/></svg>,
  xMark: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M7 7l10 10M17 7L7 17" strokeLinecap="round"/></svg>,
  heart: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" strokeLinejoin="round"/></svg>,
  plus: (p) => <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>,
  spark: (p) => <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><path d="M8 1v4M8 11v4M1 8h4M11 8h4M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" strokeLinecap="round"/></svg>,
  gh: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" {...p}><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.07.5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.06-.5.06-.5.8.06 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.07-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.08-.2-.4-1 .08-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0C11 3 11.8 3.2 11.8 3.2c.5 1.1.2 2 .1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.7 4 .3.3.6.8.6 1.6v2.3c0 .2.1.5.5.4A8 8 0 0 0 8 .2z"/></svg>,
  cal: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><rect x="2" y="3" width="12" height="11"/><path d="M2 6h12M5 1v3M11 1v3" strokeLinecap="round"/></svg>,
  doc: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><path d="M3 1h7l3 3v11H3z"/><path d="M10 1v3h3M6 7h5M6 10h5M6 13h3" strokeLinecap="round"/></svg>,
  chat: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><path d="M2 3h12v8H6l-3 3V3z" strokeLinejoin="round"/></svg>,
  pod: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><rect x="6" y="2" width="4" height="7" rx="2"/><path d="M3 7a5 5 0 0 0 10 0M8 12v2" strokeLinecap="round"/></svg>,
  rss: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><path d="M3 3a10 10 0 0 1 10 10M3 8a5 5 0 0 1 5 5" strokeLinecap="round"/><circle cx="3.5" cy="12.5" r="1" fill="currentColor"/></svg>,
  glb: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12"/></svg>,
  book: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}><path d="M2 3h5a2 2 0 0 1 2 2v9a1 1 0 0 0-1-1H2zM14 3H9a2 2 0 0 0-2 2v9a1 1 0 0 1 1-1h6z" strokeLinejoin="round"/></svg>,
  wifi: (p) => <svg viewBox="0 0 16 10" width="16" height="10" fill="currentColor" {...p}><path d="M2.5 5.5a7 7 0 0 1 11 0"/><circle cx="8" cy="8" r="1"/></svg>,
  bat: (p) => <svg viewBox="0 0 24 12" width="24" height="12" fill="none" stroke="currentColor" strokeWidth="1" {...p}><rect x="1" y="1" width="20" height="10" rx="2.5"/><rect x="3" y="3" width="14" height="6" fill="currentColor" stroke="none"/><rect x="22" y="4" width="1.5" height="4" fill="currentColor" stroke="none"/></svg>,
  /* v2 新增 */
  studio: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}><path d="M4 20V9l8-5 8 5v11H4z" strokeLinejoin="round"/><path d="M9 20v-6h6v6M12 4v2" strokeLinecap="round"/></svg>,
  heartFill: (p) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>,
  heartHeart: (p) => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M8 3a3 3 0 0 0-3 3c0 3.5 4 6 4 6s4-2.5 4-6a3 3 0 0 0-3-3 2.6 2.6 0 0 0-2 1 2.6 2.6 0 0 0-2-1z"/><path d="M16 11a3 3 0 0 0-3 3c0 3.5 4 6 4 6s4-2.5 4-6a3 3 0 0 0-3-3 2.6 2.6 0 0 0-2 1 2.6 2.6 0 0 0-2-1z" opacity="0.75"/></svg>,
  bellFill: (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3zM10 20a2 2 0 0 0 4 0"/></svg>,
};

/* ================================================================
   v2 新增：Taste Context —— 全局喜好/订阅状态
   ---------------------------------------------------------------- */
const TasteCtx = React.createContext(null);
function useTaste() { return React.useContext(TasteCtx); }

function TasteBar({ entryId, size = 'sm' }) {
  const ctx = useTaste();
  if (!ctx) return null;
  const t = ctx.taste[entryId] || {};
  const act = (next) => (e) => {
    e && e.stopPropagation();
    ctx.setTaste(entryId, { taste: t.taste === next ? null : next }, e);
  };
  const sub = (e) => {
    e && e.stopPropagation();
    ctx.setTaste(entryId, { subscribed: !t.subscribed }, e);
  };
  const btnSize = size === 'lg' ? 'tbar-btn tbar-btn--lg' : 'tbar-btn';
  return (
    <div className={`tbar ${size === 'lg' ? 'tbar--lg' : ''}`}>
      <button className={`${btnSize} ${t.taste === 'love' ? 'tbar-btn--on tbar-btn--love' : ''}`}
              aria-label="极喜欢" onClick={act('love')}>
        <Icon.heartHeart />
      </button>
      <button className={`${btnSize} ${t.taste === 'like' ? 'tbar-btn--on tbar-btn--like' : ''}`}
              aria-label="喜欢" onClick={act('like')}>
        {t.taste === 'like' || t.taste === 'love' ? <Icon.heartFill /> : <Icon.heart />}
      </button>
      <button className={`${btnSize} ${t.taste === 'dislike' ? 'tbar-btn--on tbar-btn--dislike' : ''}`}
              aria-label="不感兴趣" onClick={act('dislike')}>
        <Icon.xMark />
      </button>
      <span className="tbar-sep" />
      <button className={`${btnSize} ${t.subscribed ? 'tbar-btn--on tbar-btn--sub' : ''}`}
              aria-label="订阅主题" onClick={sub}>
        {t.subscribed ? <Icon.bellFill /> : <Icon.bell />}
      </button>
    </div>
  );
}

/* ================================================================
   公共：Status Bar + Masthead
   ---------------------------------------------------------------- */
function StatusBar() {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    }, 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="status-bar">
      <span>{time}</span>
      <div className="status-bar__right">
        <span className="ff-mono text-[10px]" style={{letterSpacing: '0.1em'}}>5G</span>
        <Icon.wifi />
        <Icon.bat />
      </div>
    </div>
  );
}

function MastHead({ title = 'WorkLens', right }) {
  return (
    <div className="m-masthead">
      <div>
        <div className="m-mast-title">{title}</div>
        <div className="ff-serif italic text-[12px] mt-0.5" style={{color: 'var(--ink-mute)'}}>
          写给 Agent 时代工作者的田野杂志
        </div>
      </div>
      <div className="text-right">
        <div className="m-mast-meta">{DATA.issue.volume}</div>
        <div className="m-mast-meta mt-0.5">{DATA.issue.issue}</div>
      </div>
    </div>
  );
}

/* ================================================================
   公共：卡片 / Chip / Verdict
   ---------------------------------------------------------------- */
function VerdictPill({ v }) {
  const map = { adopt: ['v-bg-adopt', '引入'], evaluate: ['v-bg-evaluate', '评估中'], shelf: ['v-bg-shelf', '上架'], drop: ['v-bg-drop', '下架'] };
  const [cls, label] = map[v] || map.shelf;
  return <span className={`verdict-pill ${cls}`}><span className="w-1 h-1 rounded-full inline-block" style={{background:'currentColor'}} />{label}</span>;
}

function MiniCard({ e, onOpen }) {
  const ctx = useTaste();
  const t = ctx && ctx.taste[e.id] || {};
  const tasteClass = t.taste ? ` lib-card--tasted-${t.taste}` : '';
  return (
    <div className={`lib-card${tasteClass}`} onClick={() => onOpen && onOpen(e)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="dewey-chip">{e.dewey}</span>
        <VerdictPill v={e.verdict} />
      </div>
      <div className="card-title">{e.title}</div>
      <div className="card-sub mb-2">{e.sub}</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {e.tags.map(t => <span key={t} className="tag-pill">#{t}</span>)}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between items-baseline mb-0.5">
            <span className="ff-mono text-[9px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>FIT</span>
            <span className="ff-mono text-[10px]">{e.scores.fit}</span>
          </div>
          <div className="score-bar"><div className="score-bar__fill" style={{width: e.scores.fit + '%'}}/></div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-baseline mb-0.5">
            <span className="ff-mono text-[9px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>NEW</span>
            <span className="ff-mono text-[10px]">{e.scores.novelty}</span>
          </div>
          <div className="score-bar"><div className="score-bar__fill" style={{width: e.scores.novelty + '%'}}/></div>
        </div>
      </div>
      <TasteBar entryId={e.id} />
    </div>
  );
}

/* ================================================================
   01 · 本期策展
   ---------------------------------------------------------------- */
function HomeView({ openEntry, goto }) {
  const headline = DATA.entries[0];
  const others = DATA.entries.slice(1, 4);
  const proposals = DATA.proposals.length;
  const unread = DATA.pushes.filter(p => !p.read).length;
  return (
    <div className="scroll-y">
      <MastHead />

      {/* 装饰尺 */}
      <div className="ruler" />

      {/* v2 新增：工坊横幅 —— 把 "你的喜好" 转为显性能力入口 */}
      <div className="px-5 pt-3">
        <button onClick={() => goto('studio')} className="studio-banner">
          <div className="studio-banner__spark"><Icon.spark /></div>
          <div className="flex-1 text-left">
            <div className="ff-mono text-[9px] uppercase tracking-[0.25em]" style={{color: 'var(--cinnabar)'}}>
              因你本周的 ❤ · Agent 的回礼
            </div>
            <div className="ff-serif text-[14px] mt-0.5" style={{letterSpacing: '-0.01em', color: 'var(--ink)'}}>
              新孕育 <em className="not-italic font-semibold" style={{color: 'var(--cinnabar)'}}>{proposals}</em> 条 Skill 建议 · 推送 <em className="not-italic font-semibold" style={{color: 'var(--cinnabar)'}}>{unread}</em> 条匹配你口味
            </div>
          </div>
          <Icon.arrR style={{color: 'var(--ink-mute)'}} />
        </button>
      </div>

      {/* 本期数字 */}
      <div className="hero-stack anim-in">
        <div className="hero-section-label">§ 本期速览</div>
        <div className="grid grid-cols-4 gap-2 mt-3 pb-3 border-b" style={{borderColor: 'var(--rule)'}}>
          <div><div className="stat-num">{DATA.issue.stats.scanned.toLocaleString()}</div><div className="stat-label">扫描源</div></div>
          <div><div className="stat-num">{DATA.issue.stats.curated}</div><div className="stat-label">本期</div></div>
          <div><div className="stat-num" style={{color: 'var(--cinnabar)'}}>{DATA.tasteSummary.week_likes}</div><div className="stat-label">本周 ❤</div></div>
          <div><div className="stat-num">{DATA.issue.stats.saved}<span className="ff-mono text-[10px] ml-0.5" style={{color: 'var(--ink-mute)'}}>min</span></div><div className="stat-label">节省</div></div>
        </div>
      </div>

      {/* 头条 */}
      <div className="hero-stack anim-in anim-in-d1">
        <div className="hero-section-label">本周头条</div>
        <div className="hero-title">{headline.title}</div>
        <div className="hero-sub">{headline.sub}</div>
        <div className="flex items-center gap-2 mt-3 ff-mono text-[10.5px]" style={{color: 'var(--ink-mute)'}}>
          <Icon.gh/> {headline.author} · {headline.source} · <span className="ulink">{headline.url}</span>
        </div>

        <div className="lib-card mt-4 anim-in anim-in-d2" style={{background: 'var(--paper-warm)'}}>
          <div className="ff-mono text-[9px] uppercase tracking-[0.25em] mb-1.5" style={{color: 'var(--cinnabar)'}}>§ 策展人手记</div>
          <p className="ff-serif text-[14px] leading-[1.65] drop-cap" style={{color: 'var(--ink-soft)'}}>
            {DATA.issue.note}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn btn--primary flex-1" onClick={() => openEntry(headline)}>打开藏书卡片 <Icon.arrR /></button>
          <button className="btn btn--ghost"><Icon.bookmark /></button>
        </div>
      </div>

      {/* 实时策展日志 */}
      <div className="ornament">—— 实时策展日志 ——</div>
      <div className="hero-stack">
        {DATA.fieldNotes.map((n, i) => (
          <div key={i} className="note-row">
            <span className="note-row__t">{n.time}</span>
            <div>
              <span className={`note-row__from ${n.from === '你' ? 'note-row__from--you' : ''}`}>— {n.from}</span>
              {n.text}
              <span className="tag-pill ml-1.5 align-middle" style={{fontSize: '9px'}}>{n.tag}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 本期其他 */}
      <div className="section-head">
        <span className="section-head__title">本期其他收录</span>
        <span className="section-head__link" onClick={() => goto('discover')}>进入发现 →</span>
      </div>
      <div className="hero-stack space-y-3">
        {others.map(e => <MiniCard key={e.id} e={e} onOpen={openEntry} />)}
      </div>

      {/* 版权页 */}
      <div className="ornament">—— 版权页 ——</div>
      <div className="px-5 pb-5 ff-serif italic text-[12px] text-center" style={{color: 'var(--ink-mute)'}}>
        每周三 09:00 自动合刊。<br />重大发现以号外推送。
      </div>
    </div>
  );
}

/* ================================================================
   02 · 发现：Swipe Deck（Tinder 式决策流）+ Pipeline
   ---------------------------------------------------------------- */
function DiscoverView({ openEntry }) {
  const [deck, setDeck] = useState(() => DATA.entries.slice(0, 5));
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [exitDir, setExitDir] = useState(null);          // 'left'|'right'|'up'
  const [log, setLog] = useState([]);                     // 决策日志
  const startRef = useRef({ x: 0, y: 0, t: 0 });

  const topCard = deck[0];

  const performAction = useCallback((dir) => {
    if (!topCard) return;
    setExitDir(dir);
    const actionLabel = { right: '引入', left: '略过', up: '稍后' }[dir];
    setTimeout(() => {
      setLog(l => [{ id: topCard.id, title: topCard.title, action: actionLabel }, ...l].slice(0, 6));
      setDeck(d => d.slice(1));
      setExitDir(null);
      setDragX(0); setDragY(0);
    }, 280);
  }, [topCard]);

  const onPointerDown = (e) => {
    const p = 'touches' in e ? e.touches[0] : e;
    startRef.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  };
  const onPointerMove = (e) => {
    if (!startRef.current.t) return;
    const p = 'touches' in e ? e.touches[0] : e;
    setDragX(p.clientX - startRef.current.x);
    setDragY(p.clientY - startRef.current.y);
  };
  const onPointerUp = () => {
    const absX = Math.abs(dragX), absY = Math.abs(dragY);
    const TH = 90;
    if (absX > TH && absX > absY) {
      performAction(dragX > 0 ? 'right' : 'left');
    } else if (-dragY > TH && absY > absX) {
      performAction('up');
    } else {
      setDragX(0); setDragY(0);
    }
    startRef.current = { x: 0, y: 0, t: 0 };
  };

  const tilt = Math.max(-18, Math.min(18, dragX / 10));
  const hintTone = Math.abs(dragX) > 30 || -dragY > 30;

  return (
    <div className="scroll-y">
      {/* 顶部标题 */}
      <div className="hero-stack pb-2">
        <div className="hero-section-label">§ 第 02 章</div>
        <div className="hero-title" style={{fontSize: '26px'}}>发现管道</div>
        <div className="hero-sub" style={{fontSize: '13px'}}>
          Agent 本周为你准备了 {DATA.entries.length} 张卡 —— 向右引入、向左略过、向上稍后读。
        </div>
      </div>

      {/* Pipeline mini 横滚 */}
      <div className="hscroll">
        {DATA.pipeline.map((s, i) => (
          <div key={s.stage} className="pipe-mini">
            <div className="flex items-baseline justify-between">
              <span className="ff-mono text-[9px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>{String(i+1).padStart(2,'0')}</span>
              <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>{s.hint}</span>
            </div>
            <div className="pipe-mini__count">{s.count}</div>
            <div className="ff-serif text-[13px] font-semibold" style={{letterSpacing: '-0.01em'}}>{s.stage}</div>
          </div>
        ))}
      </div>

      {/* Deck */}
      <div className="deck">
        {deck.length === 0 && (
          <div className="deck-card" style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
            <div className="ff-serif text-[20px] font-semibold mb-2" style={{letterSpacing: '-0.015em'}}>本周决策完毕</div>
            <div className="ff-serif italic text-[13px] mb-4" style={{color: 'var(--ink-mute)'}}>
              共处理 {log.length} 张卡片。Agent 会把结果喂回评估模型。
            </div>
            <button className="btn btn--primary" onClick={() => setDeck(DATA.entries.slice(0, 5))}>重新发牌</button>
          </div>
        )}
        {deck.map((e, i) => {
          const isTop = i === 0;
          const extraClass = isTop
            ? (exitDir === 'right' ? 'deck-card--out-right' : exitDir === 'left' ? 'deck-card--out-left' : exitDir === 'up' ? 'deck-card--out-up' : 'deck-card--top')
            : i === 1 ? 'deck-card--back-1' : 'deck-card--back-2';
          const style = isTop && !exitDir
            ? { transform: `translate(${dragX}px, ${Math.min(0, dragY)}px) rotate(${tilt}deg)`, transition: hintTone ? 'none' : 'transform 220ms ease' }
            : {};
          const hintClass = isTop && !exitDir
            ? (dragX > 30 ? 'deck-card--to-right' : dragX < -30 ? 'deck-card--to-left' : -dragY > 30 ? 'deck-card--to-up' : '')
            : '';
          return (
            <div key={e.id}
                 className={`deck-card ${extraClass} ${hintClass}`}
                 style={style}
                 onMouseDown={isTop ? onPointerDown : undefined}
                 onMouseMove={isTop ? onPointerMove : undefined}
                 onMouseUp={isTop ? onPointerUp : undefined}
                 onMouseLeave={isTop ? onPointerUp : undefined}
                 onTouchStart={isTop ? onPointerDown : undefined}
                 onTouchMove={isTop ? onPointerMove : undefined}
                 onTouchEnd={isTop ? onPointerUp : undefined}
            >
              <div className="deck-stamp deck-stamp--adopt">引入</div>
              <div className="deck-stamp deck-stamp--skip">略过</div>
              <div className="deck-stamp deck-stamp--save">稍后</div>

              <div className="flex items-center justify-between mb-2">
                <span className="dewey-chip">{e.dewey}</span>
                <VerdictPill v={e.verdict} />
              </div>
              <div className="ff-serif font-bold leading-[1]"
                   style={{fontSize: '26px', letterSpacing: '-0.025em', marginBottom: '4px'}}>
                {e.title}
              </div>
              <div className="ff-serif italic text-[14.5px]" style={{color: 'var(--ink-mute)', marginBottom: '12px'}}>
                {e.sub}
              </div>
              <div className="flex items-center gap-2 ff-mono text-[11px] mb-3" style={{color: 'var(--ink-mute)'}}>
                <Icon.gh /> {e.author} · {e.source}
              </div>

              <hr className="hr-thin mb-3" />

              <div className="ff-mono text-[9px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>§ Agent 为什么推荐</div>
              <p className="ff-serif text-[14px] leading-[1.6] flex-1" style={{color: 'var(--ink)'}}>{e.why}</p>

              <div className="grid grid-cols-4 gap-3 pt-4">
                {['fit','novelty','cost','risk'].map(k => (
                  <div key={k}>
                    <div className="ff-mono text-[9px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>{k}</div>
                    <div className="ff-serif font-semibold text-[18px]"
                         style={{letterSpacing: '-0.015em', color: (k==='cost'||k==='risk') ? 'var(--cinnabar-ink)' : 'var(--ink)'}}>
                      {e.scores[k]}
                    </div>
                  </div>
                ))}
              </div>

              {/* v2：卡内也支持细粒度打点 */}
              <div className="mt-3">
                <TasteBar entryId={e.id} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 决策按钮 */}
      {deck.length > 0 && (
        <div className="deck-actions">
          <button className="deck-btn deck-btn--skip" onClick={() => performAction('left')}><Icon.xMark /></button>
          <button className="deck-btn deck-btn--save" onClick={() => performAction('up')}><Icon.bookmark /></button>
          <button className="deck-btn deck-btn--adopt" onClick={() => performAction('right')}><Icon.heart /></button>
        </div>
      )}

      {/* 决策日志 */}
      {log.length > 0 && (
        <>
          <div className="ornament">—— 本次决策 ——</div>
          <div className="hero-stack">
            {log.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between py-2 border-b" style={{borderColor: 'var(--rule)'}}>
                <div className="min-w-0 flex-1">
                  <div className="ff-serif text-[14px] truncate" style={{letterSpacing: '-0.01em'}}>{l.title}</div>
                  <div className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{l.id}</div>
                </div>
                <span className={`verdict-pill ${l.action === '引入' ? 'v-bg-adopt' : l.action === '略过' ? 'v-bg-drop' : 'v-bg-evaluate'}`}>
                  {l.action}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 书架速览 */}
      <div className="section-head">
        <span className="section-head__title">书架速览</span>
        <span className="section-head__link">共 {DATA.shelves.reduce((sum, sh) => sum + (sh.count || 0), 0)} 条</span>
      </div>
      {DATA.shelves.map(sh => (
        <div key={`${sh.code}-${sh.name}`} className="shelf-row">
          <span className="shelf-row__code">{sh.code}</span>
          <span className="shelf-row__name">{sh.name}</span>
          <span className="shelf-row__count">{sh.count}</span>
          <Icon.chev />
        </div>
      ))}
      <div className="h-6" />
    </div>
  );
}

/* ================================================================
   03 · 工作画像 Profile
   ---------------------------------------------------------------- */
function ProfileView() {
  const [tab, setTab] = useState('radar');
  return (
    <div className="scroll-y">
      <div className="hero-stack pb-2">
        <div className="hero-section-label">§ 第 07 章 · 新</div>
        <div className="hero-title" style={{fontSize: '26px'}}>工作画像</div>
        <div className="hero-sub" style={{fontSize: '13px'}}>
          把 8 条日常信号编织成一面镜子，Agent 据此决定「本期为你收录什么」。
        </div>
      </div>

      {/* Tab */}
      <div className="hscroll" style={{padding: '4px 20px 10px'}}>
        {[['radar','能力雷达'], ['taste','喜好信号 · 新'], ['sources','信号源 · 9'], ['words','你的词汇表'], ['time','时间地图'], ['evidence','Agent 判断'], ['privacy','隐私契约']].map(([id,label]) => (
          <button key={id}
                  onClick={() => setTab(id)}
                  className="chip"
                  style={{
                    padding: '4px 12px',
                    background: tab === id ? 'var(--ink)' : 'transparent',
                    color: tab === id ? 'var(--paper)' : 'var(--ink-mute)',
                    border: '1px solid ' + (tab === id ? 'var(--ink)' : 'var(--rule)'),
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px',
                    letterSpacing: '0.03em', borderRadius: '999px',
                  }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'radar' && <ProfileRadar />}
      {tab === 'taste' && <ProfileTaste />}
      {tab === 'sources' && <ProfileSources />}
      {tab === 'words' && <ProfileWords />}
      {tab === 'time' && <ProfileTime />}
      {tab === 'evidence' && <ProfileEvidence />}
      {tab === 'privacy' && <ProfilePrivacy />}

      <div className="ornament">—— 下次重算 03:47:12 ——</div>
      <div className="hero-stack pb-6">
        <button className="btn btn--primary btn--block">立即重算画像</button>
        <button className="btn btn--ghost btn--block mt-2">导出画像快照 JSON</button>
      </div>
    </div>
  );
}

function RadarSvg({ data, size = 300 }) {
  const cx = size/2, cy = size/2, R = size * 0.36, n = data.length;
  const pts = data.map((d, i) => {
    const a = (Math.PI * 2 * i)/n - Math.PI/2;
    const r = (d.score/100) * R;
    return [cx + Math.cos(a)*r, cy + Math.sin(a)*r];
  });
  const axes = data.map((d, i) => {
    const a = (Math.PI * 2 * i)/n - Math.PI/2;
    return [cx + Math.cos(a)*R, cy + Math.sin(a)*R, a];
  });
  const labels = data.map((d, i) => {
    const a = (Math.PI * 2 * i)/n - Math.PI/2;
    return [cx + Math.cos(a)*(R+18), cy + Math.sin(a)*(R+18), a];
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25,0.5,0.75,1].map((k,i) => (
        <circle key={i} cx={cx} cy={cy} r={R*k} fill="none" stroke="var(--rule)" strokeWidth={i===3?1.2:0.7} />
      ))}
      {axes.map(([x,y],i) => <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--rule)" strokeWidth="0.7"/>)}
      <polygon points={pts.map(p => p.join(',')).join(' ')}
               fill="var(--cinnabar)" fillOpacity="0.15" stroke="var(--cinnabar)" strokeWidth="1.4"/>
      {pts.map(([x,y],i) => <circle key={i} cx={x} cy={y} r={3} fill="var(--cinnabar)" stroke="var(--parchment)" strokeWidth="1.5"/>)}
      {labels.map(([x,y,a],i) => (
        <text key={i} x={x} y={y}
              textAnchor={Math.abs(Math.cos(a))<0.1?'middle':Math.cos(a)>0?'start':'end'}
              dominantBaseline={Math.abs(Math.sin(a))<0.1?'middle':Math.sin(a)>0?'hanging':'auto'}
              fontFamily="Fraunces, serif" fontSize="11" fontWeight="600" fill="var(--ink)">
          {data[i].axis}
        </text>
      ))}
    </svg>
  );
}

function ProfileRadar() {
  return (
    <div className="hero-stack anim-in">
      <div className="lib-card">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="ff-serif text-[17px] font-semibold" style={{letterSpacing: '-0.015em'}}>六维关注分布</h3>
          <span className="ff-mono text-[9.5px]" style={{color: 'var(--ink-mute)'}}>近 90 天</span>
        </div>
        <div className="radar-wrap"><RadarSvg data={DATA.radar} size={280} /></div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {DATA.radar.map(r => (
            <div key={r.axis} className="text-center">
              <div className="ff-serif text-[12px]" style={{letterSpacing: '-0.01em', color: 'var(--ink-mute)'}}>{r.axis}</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="ff-serif text-[17px] font-semibold">{r.score}</span>
                <span className="ff-mono text-[9.5px]" style={{color: r.delta>0?'var(--forest)':r.delta<0?'var(--cinnabar)':'var(--ink-mute)'}}>
                  {r.delta>0?'↑':r.delta<0?'↓':'·'}{Math.abs(r.delta)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sidenote mt-3">
        Agent 结合这六维决定本期策展的「口味」。基础设施近期走低已经被识别，相关候选自动降权。
      </div>
    </div>
  );
}

function ProfileSources() {
  const iconMap = { gh:<Icon.gh/>, cal:<Icon.cal/>, doc:<Icon.doc/>, chat:<Icon.chat/>, pod:<Icon.pod/>, rss:<Icon.rss/>, glb:<Icon.glb/>, book:<Icon.book/>, heart:<Icon.heartFill/> };
  const extended = [
    ...DATA.profileSources,
    { id: 'ps-taste', icon: 'heart', kind: '你的喜好', name: 'WorkLens · Taste 账本',
      scope: '142 次 ❤', weight: 0.18, status: 'live', last: '刚刚', hint: '权重增长最快', isTaste: true },
  ];
  return (
    <div className="hero-stack anim-in">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="ff-serif text-[17px] font-semibold" style={{letterSpacing: '-0.015em'}}>{extended.length} 条信号 · 权重分布</h3>
        <button className="ff-mono text-[10px] flex items-center gap-1" style={{color: 'var(--cinnabar)'}}>
          <Icon.plus /> 添加
        </button>
      </div>
      <div>
        {extended.map(s => (
          <div key={s.id} className={`src-row ${s.isTaste ? 'src-row--new' : ''}`}>
            <div className="src-icon" style={s.isTaste ? {background: 'var(--cinnabar)', color: 'var(--parchment)', borderColor: 'var(--cinnabar)'} : null}>
              {iconMap[s.icon]}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="ff-serif text-[14.5px] font-semibold" style={{letterSpacing: '-0.01em'}}>{s.kind}</span>
                {s.isTaste && <span className="src-badge-new">NEW</span>}
                <span className={s.status === 'live' ? 'pulse pulse--live' : 'pulse pulse--paused'} />
              </div>
              <div className="src-row__meta truncate">{s.name} · {s.scope}</div>
              <div className="src-row__meta mt-0.5" style={{color: 'var(--ink-mute)'}}>
                上次 · {s.last} · {s.hint}
              </div>
            </div>
            <div className="text-right">
              <div className="src-row__weight" style={s.isTaste ? {color: 'var(--cinnabar)'} : null}>
                {(s.weight*100).toFixed(0)}<span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>%</span>
              </div>
              <div className="w-14 score-bar mt-1 ml-auto">
                <div className="score-bar__fill" style={{width: Math.min(100, s.weight*300) + '%', background: s.isTaste ? 'var(--cinnabar)' : 'var(--ink)'}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="sidenote mt-3">
        权重由 Agent 根据你的实际使用频率自动调整；点击任一行可编辑采样频率与关键词白名单。
      </div>
    </div>
  );
}

/* v2 新增：ProfileTaste —— 本周喜好总览 */
function ProfileTaste() {
  const ctx = useTaste();
  const liveCount = ctx ? Object.values(ctx.taste).filter(t => t.taste === 'love' || t.taste === 'like').length : 0;
  const s = DATA.tasteSummary;
  return (
    <div className="hero-stack anim-in">
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[
          ['❤', s.week_likes, 'cinnabar'],
          ['❤❤', s.week_loves, 'cinnabar'],
          ['✕', s.week_skips, 'ink'],
          ['稍后', s.week_saves, 'ink'],
          ['订阅', s.week_subs, 'forest'],
        ].map(([lab, n, tone], i) => (
          <div key={i} className="lib-card" style={{padding: '10px 8px', textAlign: 'center'}}>
            <div className="ff-mono text-[9px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>{lab}</div>
            <div className="ff-serif font-semibold text-[22px] mt-0.5"
                 style={{letterSpacing: '-0.015em', color: tone === 'cinnabar' ? 'var(--cinnabar)' : tone === 'forest' ? 'var(--forest)' : 'var(--ink)'}}>
              {n}
            </div>
          </div>
        ))}
      </div>

      {/* 7 日趋势 */}
      <div className="lib-card">
        <div className="flex items-baseline justify-between mb-1.5">
          <h4 className="ff-serif text-[14.5px] font-semibold" style={{letterSpacing: '-0.01em'}}>最近 7 天 ❤ 节律</h4>
          <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>累计 {s.total_likes}</span>
        </div>
        <div className="spark" style={{height: 42, alignItems: 'flex-end', display: 'flex', gap: 6}}>
          {s.trend_7d.map((v, i) => (
            <div key={i} className="flex-1" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3}}>
              <span style={{display: 'block', width: '100%', height: (10 + v * 6) + 'px', background: 'var(--ink)'}} />
              <span className="ff-mono text-[8.5px]" style={{color: 'var(--ink-mute)'}}>{['一','二','三','四','五','六','日'][i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* top topics */}
      <h4 className="ff-serif text-[14.5px] font-semibold mt-4 mb-1" style={{letterSpacing: '-0.01em'}}>本周 ❤ 最多的主题</h4>
      <div className="lib-card" style={{padding: 0}}>
        {s.top_topics.map((t, i) => (
          <div key={i} className="flex items-center gap-2 py-2 px-3 border-b" style={{borderColor: 'var(--rule)'}}>
            <span className="ff-mono text-[9px] w-5 text-right" style={{color: 'var(--ink-mute)'}}>{String(i+1).padStart(2,'0')}</span>
            <span className="ff-serif text-[14px] font-semibold flex-1 min-w-0 truncate" style={{letterSpacing: '-0.01em'}}>{t.topic}</span>
            <span className="ff-mono text-[10px]" style={{color: t.trend==='up'?'var(--cinnabar)':'var(--ink-mute)'}}>
              {t.trend === 'up' ? '↑' : '↓'} ❤{t.count}
            </span>
            <div className="w-14 score-bar"><div className="score-bar__fill" style={{width: Math.round(t.weight*100)+'%', background: 'var(--cinnabar)'}}/></div>
          </div>
        ))}
      </div>

      <div className="sidenote mt-3">
        你本次会话主动标记了 <em className="not-italic" style={{color: 'var(--cinnabar)'}}>{liveCount}</em> 条新喜好——
        它们会在 15 秒内合并进画像并作用于下期策展。
      </div>
    </div>
  );
}

function ProfileWords() {
  return (
    <div className="hero-stack anim-in">
      <h3 className="ff-serif text-[17px] font-semibold mb-2" style={{letterSpacing: '-0.015em'}}>你的词汇表</h3>
      <div className="lib-card" style={{padding: '12px 10px'}}>
        {DATA.keywords.map(k => (
          <span key={k.w}
                className={`kw-chip ${k.trend === 'up' ? 'kw-chip--up' : k.trend === 'down' ? 'kw-chip--down' : ''}`}
                style={{fontSize: Math.min(22, 12 + k.n/10) + 'px', fontWeight: k.trend === 'up' ? 600 : 500}}>
            {k.w} <span className="kw-chip__n">{k.n}</span>
          </span>
        ))}
      </div>
      <div className="sidenote mt-3">
        标红的词正在上升，Agent 会优先用它们去匹配本周候选条目；下降词三周后自动降权。
      </div>
    </div>
  );
}

function ProfileTime() {
  const days = ['一','二','三','四','五','六','日'];
  const grid = Array.from({length: 7}, (_, d) => Array.from({length: 24}, (_, h) => {
    if (h < 7 || h > 22) return 0;
    if (d >= 5) return h > 9 && h < 19 ? Math.floor(Math.random() * 2) : 0;
    const peak = h === 10 || h === 11 || h === 14 || h === 15 || h === 16;
    return peak ? 3 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
  }));
  return (
    <div className="hero-stack anim-in">
      <h3 className="ff-serif text-[17px] font-semibold mb-2" style={{letterSpacing: '-0.015em'}}>工作时间地图</h3>
      <div className="lib-card" style={{padding: '12px'}}>
        <div className="grid gap-[2px] items-center" style={{gridTemplateColumns: '20px repeat(24, 1fr)'}}>
          <span />
          {Array.from({length: 24}, (_, h) => (
            <span key={h} className="ff-mono text-[7.5px] text-center" style={{color: 'var(--ink-mute)'}}>{h % 6 === 0 ? h : ''}</span>
          ))}
        </div>
        {grid.map((row, i) => (
          <div key={i} className="grid gap-[2px] items-center mt-[2px]" style={{gridTemplateColumns: '20px repeat(24, 1fr)'}}>
            <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>周{days[i]}</span>
            {row.map((v, j) => (
              <span key={j} className="tm-cell" data-l={v} />
            ))}
          </div>
        ))}
        <div className="flex items-center justify-between mt-3 ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>
          <span>少</span>
          <div className="flex gap-1">
            {[0,1,2,3,4,5].map(l => <span key={l} className="w-2.5 h-2.5 inline-block tm-cell" data-l={l} />)}
          </div>
          <span>多</span>
        </div>
      </div>
      <div className="sidenote mt-3">
        时间地图仍为本地演示占位；真实页面当前不接入会议、日历或飞书原文，避免把私有工作信号写入公开仓库。
      </div>
    </div>
  );
}

function ProfileEvidence() {
  return (
    <div className="hero-stack anim-in">
      <h3 className="ff-serif text-[17px] font-semibold mb-2" style={{letterSpacing: '-0.015em'}}>Agent 对你的三条判断</h3>
      {DATA.evidence.map((ev, i) => (
        <div key={i} className="evidence-card">
          <div className="flex items-start gap-2 mb-2">
            <span className="circ-num">{i+1}</span>
            <div className="evidence-claim flex-1">{ev.claim}</div>
          </div>
          <ul className="space-y-1.5 ml-8">
            {ev.evidence.map((e, j) => (
              <li key={j} className="ff-serif text-[12.5px] leading-[1.5] flex gap-1.5" style={{color: 'var(--ink-soft)'}}>
                <span className="ff-mono text-[9px] mt-1" style={{color: 'var(--cinnabar)'}}>§</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
          <div className="evidence-conf">
            <span>置信度</span>
            <span className="evidence-conf__bar"><span className="evidence-conf__fill" style={{width: Math.round(ev.confidence*100)+'%'}}/></span>
            <span>{Math.round(ev.confidence*100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfilePrivacy() {
  const [rules, setRules] = useState(DATA.privacy);
  const toggle = (i) => setRules(rs => rs.map((r, j) => j === i ? { ...r, on: !r.on } : r));
  return (
    <div className="hero-stack anim-in">
      <h3 className="ff-serif text-[17px] font-semibold mb-2" style={{letterSpacing: '-0.015em'}}>你决定哪些信号被看见</h3>
      {rules.map((p, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b" style={{borderColor: 'var(--rule)'}}>
          <span className="ff-serif text-[13.5px] pr-3" style={{color: p.on ? 'var(--ink)' : 'var(--ink-mute)'}}>{p.text}</span>
          <span className={`toggle ${p.on ? 'toggle--on' : ''}`} onClick={() => toggle(i)} />
        </div>
      ))}
      <div className="sidenote mt-3">
        画像只用于本期策展决策，默认不离开你的设备。可在"设置"中打开团队共享。
      </div>
    </div>
  );
}

/* ================================================================
   04 · 学习路径
   ---------------------------------------------------------------- */
function RoutesView() {
  const routes = [
    { id: 'R-01', title: '从「追踪」到「策展」', sub: '一周搭起编辑型信息中台', duration: '7 天 · 11h', progress: 0.57,
      stages: [
        { day: 'Day 1', topic: '确立选题哲学', deliverable: '《编辑手册》v1' },
        { day: 'Day 2–3', topic: '接入 3 个信息源', deliverable: '3 个 cron 跑通' },
        { day: 'Day 4', topic: '设计评分模型', deliverable: '四维评分' },
        { day: 'Day 5', topic: '搭阅读视图', deliverable: 'Reader 原型' },
        { day: 'Day 6', topic: '引入闭环', deliverable: 'Adopt 流程' },
        { day: 'Day 7', topic: '首期策展上线', deliverable: '发布 Vol.04' },
      ] },
    { id: 'R-02', title: 'UI 组件系统化', sub: '把散落片段织成 Skill 层', duration: '14 天 · 24h', progress: 0.21,
      stages: [
        { day: 'Week 1', topic: 'Token 层', deliverable: 'OKLCH token 规范' },
        { day: 'Week 1', topic: '组件选型', deliverable: '6 个编辑型组件' },
        { day: 'Week 2', topic: '封装为 Skill', deliverable: 'UI-Kit v0.1' },
      ] },
    { id: 'R-03', title: '从「代码」到「画像」', sub: '把 8 条信号接入画像引擎', duration: '10 天 · 18h', progress: 0.08,
      stages: [
        { day: '准备', topic: '梳理 8 条信号的授权链路', deliverable: '隐私契约 v1' },
        { day: '核心', topic: '搭画像引擎', deliverable: '画像快照 JSON' },
        { day: '闭环', topic: '把画像喂回评估模型', deliverable: 'Fit 模型 v2' },
      ] },
  ];
  const [activeId, setActive] = useState('R-01');
  const active = routes.find(r => r.id === activeId);
  const now = Math.round(active.progress * active.stages.length);

  return (
    <div className="scroll-y">
      <div className="hero-stack pb-2">
        <div className="hero-section-label">§ 第 05 章</div>
        <div className="hero-title" style={{fontSize: '26px'}}>学习路径</div>
        <div className="hero-sub" style={{fontSize: '13px'}}>把条目串成一条可执行的学习/构建路径。</div>
      </div>

      <div className="hscroll">
        {routes.map(r => (
          <div key={r.id}
               onClick={() => setActive(r.id)}
               className={`lib-card ${r.id === activeId ? 'lib-card--active' : ''}`}
               style={{width: '220px', padding: '12px 14px'}}>
            <div className="flex items-center justify-between mb-1">
              <span className="ff-mono text-[9.5px]" style={{color: 'var(--cinnabar)'}}>{r.id}</span>
              <span className="ff-mono text-[9.5px]" style={{color: 'var(--ink-mute)'}}>{Math.round(r.progress*100)}%</span>
            </div>
            <div className="ff-serif text-[15px] font-semibold leading-tight mb-1" style={{letterSpacing: '-0.01em'}}>
              {r.title}
            </div>
            <div className="ff-serif italic text-[11.5px] mb-2" style={{color: 'var(--ink-mute)'}}>{r.sub}</div>
            <div className="score-bar">
              <div className="score-bar__fill" style={{width: (r.progress*100)+'%', background: 'var(--cinnabar)'}}/>
            </div>
            <div className="ff-mono text-[9.5px] mt-1" style={{color: 'var(--ink-mute)'}}>{r.duration}</div>
          </div>
        ))}
      </div>

      <div className="hero-stack">
        <div className="flex items-center gap-2 mb-2">
          <span className="dewey-chip">{active.id}</span>
          <span className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>{active.duration}</span>
        </div>
        <h2 className="ff-serif font-bold leading-tight mb-1"
            style={{fontSize: '24px', letterSpacing: '-0.025em'}}>{active.title}</h2>
        <p className="ff-serif italic text-[14px] mb-4" style={{color: 'var(--ink-mute)'}}>{active.sub}</p>

        <div className="route-timeline pl-0 relative">
          {active.stages.map((st, i) => {
            const done = i < now;
            const current = i === now;
            return (
              <div key={i} className="flex items-start mb-4">
                <div className="relative mr-3 mt-1">
                  <div className={`route-dot ${done ? 'route-dot--done' : current ? 'route-dot--now' : ''}`}
                       style={{width:'12px', height:'12px', borderWidth:'2px', borderStyle:'solid',
                               borderColor: current ? 'var(--cinnabar)' : 'var(--ink)',
                               background: done ? 'var(--ink)' : current ? 'var(--cinnabar)' : 'var(--parchment)',
                               borderRadius:'50%'}} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="ff-mono text-[10px]" style={{color: 'var(--cinnabar)'}}>{st.day}</span>
                    <h4 className="ff-serif text-[15.5px] font-semibold" style={{letterSpacing: '-0.01em'}}>{st.topic}</h4>
                  </div>
                  <div className="ff-serif text-[12.5px] mt-1" style={{color: 'var(--ink-soft)'}}>
                    交付 ⟶ <em>{st.deliverable}</em>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button className="btn btn--primary btn--block mt-4">继续这条路径</button>
      </div>
      <div className="h-6" />
    </div>
  );
}

/* ================================================================
   v2 新增：IdeaPocketPanel —— Idea 项目化流程袖珍只读摘要（Issue #5）
   只展示四个事实：项目总数 / 当前 research 项 / 自动化上限 / 下一步。
   只读：不创建外部任务、不流转阶段、不生成脚手架、不安装 Skill。
   ---------------------------------------------------------------- */
function IdeaPocketPanel() {
  const emptyPocket = {
    available: false, total: 0, researchCount: 0, researchItems: [],
    automationMaxStageLabel: '', nextStageLabel: '', nextStep: '',
    publicOnly: false, autoScaffold: false, updatedAt: '未加载',
  };
  const pocket = DATA.ideaPocket
    || (window.WL_DISCOVERY_ADAPTER && window.WL_DISCOVERY_ADAPTER.buildEmptyIdeaPocket && window.WL_DISCOVERY_ADAPTER.buildEmptyIdeaPocket())
    || emptyPocket;

  if (!pocket.available) {
    return (
      <div className="hero-stack anim-in">
        <div className="lib-card">
          <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--cinnabar)'}}>
            POCKET IDEA PIPELINE · READ-ONLY
          </div>
          <h3 className="ff-serif font-semibold text-[17px] mt-1" style={{letterSpacing: '-0.015em'}}>灵感流水线 · 袖珍摘要</h3>
          <p className="ff-serif text-[13px] mt-2 leading-[1.6]" style={{color: 'var(--ink-mute)'}}>
            公开数据 <span className="ulink">data/idea-pipeline.json</span> 尚未加载（本地预览或文件缺失时会出现）。
            这里始终是只读占位，不提供创建任务、阶段流转、脚手架生成或 Skill 安装入口。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-stack anim-in">
      <div className="lib-card">
        <div className="flex items-baseline justify-between">
          <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--cinnabar)'}}>
            POCKET IDEA PIPELINE · READ-ONLY
          </div>
          <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>{pocket.updatedAt}</span>
        </div>
        <h3 className="ff-serif font-semibold text-[17px] mt-1" style={{letterSpacing: '-0.015em'}}>灵感流水线 · 袖珍摘要</h3>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="banner-stat">
            <div className="banner-stat__num">{pocket.total}</div>
            <div className="banner-stat__lab">项目总数</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat__num">{pocket.researchCount}</div>
            <div className="banner-stat__lab">调研中 · research</div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>自动化上限</span>
            <span className="ff-serif text-[13px] font-semibold">{pocket.automationMaxStageLabel || '—'}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="ff-mono text-[9.5px] uppercase tracking-widest mt-0.5" style={{color: 'var(--ink-mute)'}}>下一步</span>
            <span className="ff-serif text-[13px] leading-[1.5] text-right" style={{color: pocket.nextStep ? 'var(--ink)' : 'var(--ink-mute)'}}>
              {pocket.nextStep || '暂无在途项'}
              {pocket.nextStageLabel
                ? <em className="not-italic" style={{color: 'var(--cinnabar)'}}> · 进入「{pocket.nextStageLabel}（plan）」需真人确认</em>
                : null}
            </span>
          </div>
        </div>

        {pocket.researchItems.length > 0 && (
          <div className="mt-3">
            <div className="ff-mono text-[9px] uppercase tracking-[0.25em] mb-1" style={{color: 'var(--cinnabar)'}}>§ 当前 research 项</div>
            {pocket.researchItems.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-baseline gap-2 py-1.5 border-b" style={{borderColor: 'var(--rule)'}}>
                <span className="ff-mono text-[9px] flex-shrink-0" style={{color: 'var(--ink-mute)'}}>{item.id}</span>
                <span className="ff-serif text-[13px] flex-1" style={{letterSpacing: '-0.01em'}}>{item.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className="ff-mono text-[9px] mt-3" style={{color: 'var(--ink-mute)'}}>
          public_only={String(pocket.publicOnly)} · auto_scaffold={String(pocket.autoScaffold)} · read_only=true
        </div>
      </div>
      <div className="sidenote">
        只读面板：只展示公开的 data/idea-pipeline.json 四个事实，不创建外部任务、不流转阶段、不生成脚手架、不安装 Skill；进入方案阶段必须由真人确认。
      </div>
    </div>
  );
}

/* ================================================================
   v2 新增：StudioView —— 技能工坊 / 推送中心
   把喜好 → Agent 的回礼：已服役能力、建议、订阅、推送
   ---------------------------------------------------------------- */
function StudioView() {
  const [sub, setSub] = useState('skills'); // skills | proposals | queue | idea | subs | push
  const subs = DATA.subscriptions;
  const skillQueue = DATA.skillQueue || { total: 0, byState: {}, entries: [], blockingTotal: 0, autoInstall: false };
  const activeReviews = (skillQueue.byState.screening || 0) + (skillQueue.byState.trial || 0);
  const openBlockingCount = (skillQueue.entries || []).reduce((sum, entry) => sum + (entry.pendingLabels || []).length, 0);
  const compareEntries = (skillQueue.entries || [])
    .slice()
    .sort((a, b) => (b.passed / Math.max(b.total, 1)) - (a.passed / Math.max(a.total, 1)))
    .slice(0, 3);

  const tabs = [
    { id: 'skills',    label: '已服役 · ' + DATA.aiSkills.length },
    { id: 'proposals', label: 'Agent 建议 · ' + DATA.proposals.length },
    { id: 'idea',      label: '灵感 · ' + (DATA.ideaPocket ? DATA.ideaPocket.total : 0) },
    { id: 'queue',     label: '待审 · ' + (skillQueue.total || 0) },
    { id: 'subs',      label: '订阅主题 · ' + subs.length },
    { id: 'push',      label: '推送 · ' + DATA.pushes.filter(p=>!p.read).length },
  ];

  return (
    <div className="view-scroll px-5 pt-4 pb-24">
      <header className="mb-3">
        <div className="masthead-rule" />
        <div className="flex items-baseline justify-between mt-2">
          <h1 className="ff-serif text-[26px] font-bold" style={{letterSpacing: '-0.02em'}}>技能工坊</h1>
          <span className="ff-mono text-[9.5px]" style={{color: 'var(--ink-mute)'}}>§08 · STUDIO</span>
        </div>
        <p className="ff-serif italic text-[13px] mt-1" style={{color: 'var(--ink-mute)'}}>
          每一次 ❤ 都在订单上签字——Agent 在这里把你的喜好锻造成能用的 Skill。
        </p>
      </header>

      {/* 顶部横幅：本周喜好 → 回礼 */}
      <div className="studio-banner mb-4">
        <div className="flex items-baseline justify-between">
          <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--cinnabar)'}}>
            FROM YOUR TASTE · 本周回礼
          </div>
          <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>W47</span>
        </div>
        <div className="ff-serif font-semibold text-[17px] mt-1" style={{letterSpacing: '-0.015em'}}>
          因为你本周 ❤ 了 <em className="not-italic" style={{color: 'var(--cinnabar)'}}>{DATA.tasteSummary.week_likes + DATA.tasteSummary.week_loves}</em> 件事
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="banner-stat">
            <div className="banner-stat__num">{skillQueue.total || DATA.proposals.length}</div>
            <div className="banner-stat__lab">待审队列</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat__num">{activeReviews}</div>
            <div className="banner-stat__lab">评测/试用</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat__num">{openBlockingCount}</div>
            <div className="banner-stat__lab">待补证</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs mb-3" style={{overflowX: 'auto', whiteSpace: 'nowrap'}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`profile-tab ${sub === t.id ? 'profile-tab--active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'skills' && (
        <div className="hero-stack anim-in">
          {DATA.aiSkills.map(s => (
            <div key={s.id} className="skill-card">
              <div className="flex items-baseline justify-between">
                <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--cinnabar)'}}>
                  SKILL · {s.id}
                </div>
                <span className="skill-ribbon">{s.status}</span>
              </div>
              <h3 className="ff-serif font-semibold text-[18px] mt-1" style={{letterSpacing: '-0.015em'}}>{s.name}</h3>
              <p className="ff-serif text-[13.5px] mt-1" style={{color: 'var(--ink-mute)'}}>{s.oneLine}</p>
              <div className="flex items-center gap-3 mt-2 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
                <span>调用 {s.runs}</span>
                <span>·</span>
                <span>成功率 {s.success}%</span>
                <span>·</span>
                <span>源 · {s.sourcedFrom}</span>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {(s.tags || []).map(t => <span key={t} className="chip">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === 'proposals' && (
        <div className="hero-stack anim-in">
          {DATA.proposals.map(p => (
            <div key={p.id} className="proposal-card">
              <div className="flex items-baseline justify-between">
                <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--forest)'}}>
                  PROPOSAL · {p.confidence}% 置信
                </div>
                <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>{p.id}</span>
              </div>
              <h3 className="ff-serif font-semibold text-[18px] mt-1" style={{letterSpacing: '-0.015em'}}>{p.name}</h3>
              <p className="ff-serif italic text-[13px] mt-1" style={{color: 'var(--ink-mute)'}}>
                触发：{p.why || p.because}
              </p>
              <p className="ff-serif text-[13.5px] mt-1.5">{p.evidence || p.oneLine}</p>
              <div className="flex gap-2 mt-2">
                <button className="btn btn--ghost text-[11px]">拒绝</button>
                <button className="btn btn--cinnabar text-[11px] flex-1 justify-center">锻造为 Skill</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === 'queue' && (
        <div className="hero-stack anim-in">
          <div className="proposal-card">
            <div className="flex items-baseline justify-between">
              <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--cinnabar)'}}>
                POCKET COMPARATOR
              </div>
              <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>auto_install={String(skillQueue.autoInstall)}</span>
            </div>
            <h3 className="ff-serif font-semibold text-[18px] mt-1" style={{letterSpacing: '-0.015em'}}>袖珍对比器 · 谁可以进入试用？</h3>
            <p className="ff-serif italic text-[12.5px] mt-1" style={{color: 'var(--ink-mute)'}}>
              只读展示状态与证据，不安装、不执行、不写入用户级 Skill 目录。
            </p>
          </div>
          {compareEntries.length === 0 && (
            <div className="proposal-card proposal-card--quiet">
              <h3 className="ff-serif font-semibold text-[18px]" style={{letterSpacing: '-0.015em'}}>暂无待审候选</h3>
              <p className="ff-serif italic text-[12.5px] mt-1" style={{color: 'var(--ink-mute)'}}>
                采集器会先把公开 Skill 候选放入队列；这里仅展示只读评测进度。
              </p>
            </div>
          )}
          {compareEntries.map(entry => {
            const ratio = Math.round((entry.passed / Math.max(entry.total, 1)) * 100);
            const labels = entry.pendingLabels.length ? entry.pendingLabels.slice(0, 3) : ['阻断项已通过'];
            return (
              <div key={entry.id} className="proposal-card proposal-card--review">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: entry.pendingLabels.length ? 'var(--mustard)' : 'var(--forest)'}}>
                      {entry.id} · {entry.stateLabel}
                    </div>
                    <h3 className="ff-serif font-semibold text-[18px] mt-1 truncate" style={{letterSpacing: '-0.015em'}}>{entry.repo}</h3>
                    <p className="ff-mono text-[9px] mt-0.5 truncate" style={{color: 'var(--ink-mute)'}}>{entry.owner} · {entry.license} · ★ {entry.stars}</p>
                  </div>
                  <div className="ff-serif font-semibold text-[22px] flex-shrink-0" style={{color: entry.pendingLabels.length ? 'var(--mustard)' : 'var(--forest)'}}>{entry.passed}/{entry.total}</div>
                </div>
                <div className="mini-progress mt-2" aria-label={`阻断项通过率 ${ratio}%`}><span style={{width: `${ratio}%`}} /></div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {labels.map(label => (
                    <span key={label} className="chip" style={{color: entry.pendingLabels.length ? 'var(--cinnabar)' : 'var(--forest)'}}>{label}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sub === 'idea' && (
        <IdeaPocketPanel />
      )}

      {sub === 'subs' && (
        <div className="hero-stack anim-in">
          {subs.map(s => (
            <div key={s.id} className="lib-card">
              <div className="flex items-baseline justify-between">
                <h3 className="ff-serif font-semibold text-[15.5px]" style={{letterSpacing: '-0.015em'}}>{s.topic}</h3>
                <span className="ff-mono text-[9.5px]" style={{color: 'var(--cinnabar)'}}>❤ {s.strength}</span>
              </div>
              <div className="ff-serif italic text-[12.5px] mt-0.5" style={{color: 'var(--ink-mute)'}}>
                起源 · {s.origin}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="ff-mono text-[9.5px]" style={{color: 'var(--ink-mute)'}}>
                  本周 {s.cadence} · {s.lastHit}
                </span>
                <button className="btn btn--ghost text-[10.5px]">调整</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === 'push' && (
        <div className="hero-stack anim-in">
          {DATA.pushes.map(p => (
            <div key={p.id} className={`push-row ${!p.read ? 'push-row--new' : ''}`}>
              <div className="flex items-baseline justify-between">
                <span className="ff-mono text-[9.5px] uppercase tracking-widest" style={{color: p.kind==='skill'?'var(--cinnabar)':p.kind==='entry'?'var(--ink)':'var(--forest)'}}>
                  {p.kind === 'skill' ? '新 Skill 可用' : p.kind === 'entry' ? '新条目入藏' : '订阅更新'}
                </span>
                <span className="ff-mono text-[9px]" style={{color: 'var(--ink-mute)'}}>{p.when}</span>
              </div>
              <div className="ff-serif font-semibold text-[14.5px] mt-0.5" style={{letterSpacing: '-0.01em'}}>{p.title}</div>
              <div className="ff-serif italic text-[12px] mt-0.5" style={{color: 'var(--ink-mute)'}}>{p.because}</div>
            </div>
          ))}
          <div className="sidenote mt-2">
            推送节律：工作日 09:30 / 14:00 / 19:00，周末沉默；每条附带「为何给你」的回执。
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Reader Sheet（从任何页点开卡片的详情抽屉）
   ---------------------------------------------------------------- */
function ReaderSheet({ entry, onClose }) {
  if (!entry) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet__handle" />
        <div className="scroll-y" style={{paddingBottom: 0}}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="dewey-chip">{entry.dewey}</span>
              <VerdictPill v={entry.verdict} />
            </div>
            <button onClick={onClose} className="deck-btn" style={{width: 36, height: 36}}><Icon.close /></button>
          </div>
          <h2 className="ff-serif font-bold leading-[1]"
              style={{fontSize: '26px', letterSpacing: '-0.025em', marginBottom: 6}}>
            {entry.title}
          </h2>
          <div className="ff-serif italic text-[14px]" style={{color: 'var(--ink-mute)'}}>
            {entry.sub}
          </div>
          <div className="flex items-center gap-2 mt-3 ff-mono text-[10.5px]" style={{color: 'var(--ink-mute)'}}>
            <Icon.gh /> {entry.author} · {entry.source} · <span className="ulink">{entry.url}</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-4 py-3 border-y" style={{borderColor: 'var(--rule)'}}>
            {['fit','novelty','cost','risk'].map(k => (
              <div key={k} className="text-center">
                <div className="ff-mono text-[9px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>{k}</div>
                <div className="ff-serif font-semibold text-[18px]"
                     style={{letterSpacing: '-0.01em', color: (k==='cost'||k==='risk') ? 'var(--cinnabar-ink)' : 'var(--ink)'}}>
                  {entry.scores[k]}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="ff-mono text-[9px] uppercase tracking-[0.25em] mb-1.5" style={{color: 'var(--cinnabar)'}}>§ 理由</div>
            <p className="ff-serif text-[14.5px] leading-[1.65]" style={{color: 'var(--ink)'}}>{entry.why}</p>
          </div>

          <div className="mt-4">
            <div className="ff-mono text-[9px] uppercase tracking-[0.25em] mb-1.5" style={{color: 'var(--cinnabar)'}}>§ 引入方案</div>
            <p className="ff-serif text-[14.5px] leading-[1.65]" style={{color: 'var(--ink)'}}>{entry.action}</p>
            <div className="lib-card mt-3" style={{background: 'var(--paper-warm)', padding: '12px'}}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon.spark style={{color: 'var(--cinnabar)'}} />
                <span className="ff-mono text-[9.5px] uppercase tracking-widest">Agent 建议的 Skill 定义</span>
              </div>
              <pre className="ff-mono text-[10.5px] leading-[1.65] whitespace-pre-wrap" style={{color: 'var(--ink)'}}>
{`skill: wl.src.${entry.id.toLowerCase()}
trigger: cron "0 */4 * * *"
score:  fit=${(entry.scores.fit/100).toFixed(2)}
         novelty=${(entry.scores.novelty/100).toFixed(2)}`}
              </pre>
            </div>
          </div>

          <div className="h-16" />
        </div>

        {/* v2：Sheet 底部的 taste 快捷栏 */}
        <div className="pt-2">
          <TasteBar entryId={entry.id} size="lg" />
          <div className="ff-serif italic text-[11.5px] mt-1.5 text-center" style={{color: 'var(--ink-mute)'}}>
            每一次 ❤ 都写入你的 Taste 账本，Agent 据此刷新画像与推送。
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t" style={{borderColor: 'var(--rule)'}}>
          <button className="btn btn--ghost"><Icon.bookmark /></button>
          <button className="btn flex-1 justify-center">加入路径</button>
          <button className="btn btn--cinnabar flex-1 justify-center">引入工作流</button>
        </div>
      </div>
    </>
  );
}

/* ================================================================
   主 App
   ---------------------------------------------------------------- */
function App() {
  const [tab, setTab] = useState('home');
  const [opened, setOpened] = useState(null);
  const [taste, setTasteState] = useState({});
  const [toast, setToast] = useState(null);
  const [dataRevision, setDataRevision] = useState(0);
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    const candidateUrls = ['./data/discoveries.json', '../data/discoveries.json', '../../data/discoveries.json'];
    const skillQueueUrls = ['./data/skill-review-queue.json', '../data/skill-review-queue.json', '../../data/skill-review-queue.json'];
    const ideaPipelineUrls = ['./data/idea-pipeline.json', '../data/idea-pipeline.json', '../../data/idea-pipeline.json'];

    async function loadFirstJson(urls, isValid) {
      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (!response.ok) continue;
          const payload = await response.json();
          if (isValid(payload)) return payload;
        } catch {
          // 本地 file:// 预览或相对路径缺失时继续尝试下一个路径。
        }
      }
      return null;
    }

    async function loadDiscoveries() {
      if (!window.WL_DISCOVERY_ADAPTER) return;
      const discoveries = await loadFirstJson(candidateUrls, payload => payload && Array.isArray(payload.candidates));
      if (!alive || !discoveries) return;
      const skillQueue = await loadFirstJson(skillQueueUrls, payload => payload && Array.isArray(payload.queue));
      const ideaPipeline = await loadFirstJson(ideaPipelineUrls, payload => payload && Array.isArray(payload.ideas));
      if (!alive) return;
      Object.assign(DATA, window.WL_DISCOVERY_ADAPTER.buildMobileData(DATA, discoveries, skillQueue, ideaPipeline));
      setTasteState({});
      setDataRevision(revision => revision + 1);
    }

    loadDiscoveries();
    return () => { alive = false; };
  }, []);

  const openEntry = useCallback((e) => setOpened(e), []);
  const goto = useCallback((id) => setTab(id), []);

  const setTaste = useCallback((entryId, patch, entry) => {
    setTasteState(prev => {
      const cur = prev[entryId] || { taste: null, subscribed: false, savedAt: null };
      const next = { ...cur, ...patch };
      // toast 文案
      let label = null, tone = 'ink';
      if ('taste' in patch) {
        if (patch.taste === 'love')     { label = '+0.10 · ❤❤ 记入画像'; tone = 'cinnabar'; }
        else if (patch.taste === 'like'){ label = '+0.05 · ❤ 记入画像';  tone = 'cinnabar'; }
        else if (patch.taste === 'dislike') { label = '−0.08 · 从推送中淡出'; tone = 'ink'; }
        else                             { label = '已取消标记';          tone = 'ink'; }
      } else if ('subscribed' in patch) {
        label = patch.subscribed ? '已订阅主题 · 每周 1-2 条' : '已退订';
        tone = patch.subscribed ? 'forest' : 'ink';
      }
      if (label) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ label, tone, meta: entry ? entry.title : '' });
        toastTimer.current = setTimeout(() => setToast(null), 1800);
      }
      return { ...prev, [entryId]: next };
    });
  }, []);

  const unreadPush = DATA.pushes.filter(p => !p.read).length;

  const tabs = [
    { id: 'home',     label: '本期',   Icon: Icon.home },
    { id: 'discover', label: '发现',   Icon: Icon.compass },
    { id: 'studio',   label: '工坊',   Icon: Icon.studio, badge: unreadPush },
    { id: 'profile',  label: '画像',   Icon: Icon.user },
    { id: 'routes',   label: '路径',   Icon: Icon.route },
  ];

  return (
    <TasteCtx.Provider value={{ taste, setTaste }}>
      <div className="phone-frame flex flex-col" data-data-revision={dataRevision}>
        {!document.body.classList.contains('wl-shell-mounted') && <StatusBar />}
        {tab === 'home'     && <HomeView openEntry={openEntry} goto={goto} />}
        {tab === 'discover' && <DiscoverView openEntry={openEntry} />}
        {tab === 'studio'   && <StudioView />}
        {tab === 'profile'  && <ProfileView />}
        {tab === 'routes'   && <RoutesView />}

        <nav className="tabbar tabbar--5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`tab-btn ${tab === t.id ? 'tab-btn--active' : ''}`}>
              <span className="tab-btn__icon-wrap">
                <t.Icon />
                {t.badge > 0 && <span className="tab-btn__badge">{t.badge}</span>}
              </span>
              <span className="tab-btn__label">{t.label}</span>
            </button>
          ))}
        </nav>

        {opened && <ReaderSheet entry={opened} onClose={() => setOpened(null)} />}

        {toast && (
          <div className={`taste-toast taste-toast--${toast.tone}`}>
            <span className="taste-toast__badge">{toast.label}</span>
            {toast.meta && <span className="taste-toast__meta">· {toast.meta}</span>}
          </div>
        )}
      </div>
    </TasteCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
