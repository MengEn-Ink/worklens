/* global window */
/*
 * WorkLens Hub 数据适配层（收敛版，PC / H5 共用一套）
 * ------------------------------------------------------------
 * 只把 data/discoveries.json 的公开元数据转为页面模型：
 * - 不生成演示推送 / 演示路线；
 * - 仓库卡片的 Stars / Forks / Issues 为采集快照实测值；12 点星标曲线与 7 格活跃度
 *   是由当前快照确定性推演的「示意」图形，模型里显式带 illustrative 标记，界面必须标注「示意」；
 * - 「本机相关」只读浏览器 localStorage 里的喜好账本，在本机计算，不上传、不扫描设备；
 * - 不访问 DOM、不 fetch、不写外部状态，可在 Node 中直接测试。
 */
(function () {
  const CATEGORY = {
    skill: { key: 'skill', kind: 'Skill' },
    ui: { key: 'ui', kind: 'UI 组件' },
    source: { key: 'source', kind: '信息源' },
    workflow: { key: 'workflow', kind: '工作流' },
    infra: { key: 'infra', kind: '基础设施' },
    reading: { key: 'reading', kind: '读物' },
  };
  const KIND_ORDER = ['Skill', 'UI 组件', '信息源', '工作流', '基础设施', '读物'];
  const DAY_MS = 86400000;

  function safeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function shortDate(value) {
    if (!value) return '未知';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未知';
    return date.toISOString().slice(0, 10);
  }

  function relativeTime(value, nowValue) {
    if (!value) return '未知';
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return '未知';
    const now = typeof nowValue === 'number' ? nowValue : Date.now();
    const minutes = Math.max(1, Math.round((now - time) / 60000));
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} 小时前`;
    return shortDate(value);
  }

  function formatCompact(value) {
    const n = Number(value || 0);
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
    return String(n);
  }

  function classify(candidate) {
    const text = [candidate.full_name, candidate.description, candidate.language, ...safeList(candidate.topics), candidate.source]
      .join(' ').toLowerCase();
    if (/design-system|ui|component|tailwind|token|css|react|svelte/.test(text)) return CATEGORY.ui;
    if (/agent-skill|skill|claude-skill|codex-skill/.test(text)) return CATEGORY.skill;
    if (/rss|feed|github-pages|static-site|awesome|discovery|hub|curat|catalog/.test(text)) return CATEGORY.source;
    if (/workflow|automation|orchestration|project-management|runner|pipeline/.test(text)) return CATEGORY.workflow;
    if (/cli|developer-tool|devtool|gateway|proxy|sandbox|terminal|observability|infra/.test(text)) return CATEGORY.infra;
    return CATEGORY.reading;
  }

  function clampScore(value) {
    return Math.max(1, Math.min(99, Math.round(value)));
  }

  function scoreCandidate(candidate, nowValue) {
    const now = typeof nowValue === 'number' ? nowValue : Date.now();
    const stars = Number(candidate.stars || 0);
    const forks = Number(candidate.forks || 0);
    const issues = Number(candidate.open_issues || 0);
    const topics = safeList(candidate.topics).length;
    const hasLicense = candidate.license && candidate.license !== 'NOASSERTION';
    const updatedAt = candidate.pushed_at || candidate.updated_at;
    const ageHours = updatedAt ? Math.max(1, (now - new Date(updatedAt).getTime()) / 3600000) : 999 * 24;
    return {
      fit: clampScore(50 + Math.log10(stars + 10) * 9 + Math.min(topics, 12)),
      novelty: clampScore(80 - Math.log10(stars + 10) * 6 + Math.min(topics, 10)),
      cost: clampScore(12 + Math.log10(forks + 10) * 5 + (issues > 500 ? 12 : 0)),
      risk: clampScore((hasLicense ? 14 : 48) + (candidate.archived ? 35 : 0) + (ageHours > 24 * 90 ? 18 : 0)),
    };
  }

  function verdictOf(candidate, scores) {
    if (candidate.archived || scores.risk >= 70 || !candidate.license || candidate.license === 'NOASSERTION') return 'evaluate';
    if (scores.fit >= 78 && scores.cost <= 45) return 'adopt';
    return 'shelf';
  }

  const VERDICT_LABELS = { adopt: '建议引入', shelf: '值得一读', evaluate: '先评估风险' };

  function editorialPriority(entry) {
    const scores = entry && entry.scores ? entry.scores : {};
    const fit = Number(scores.fit || 0);
    const novelty = Number(scores.novelty || 0);
    if (entry && entry.verdict === 'adopt' && fit >= 98) return 'P0';
    if (entry && entry.verdict === 'adopt') return 'P1';
    if (entry && entry.verdict === 'evaluate' && (fit >= 75 || novelty >= 80)) return 'P2';
    return null;
  }

  function actionText(kind) {
    if (kind === 'Skill') return '进入 Skill 待审队列：先做许可证、脚本权限、外发网络与写入范围检查，通过后再限范围试用。';
    if (kind === 'UI 组件') return '先抽取 token 与组件范式，不直接整包引入；重点看许可证、可访问性和移动端成本。';
    if (kind === '信息源') return '作为外部信息源观察：连续两轮命中有效内容后，再加入正式采集配置。';
    return '保留来源链接，结合手头的实际工作问题决定是否深入调研。';
  }

  /* 采集渠道：把 source 键归并成用户看得懂的 6 类，用于「来源构成」与筛选 */
  const CHANNELS = [
    { key: 'trending', label: 'Trending 热榜', short: 'Trending', test: /^trending:/ },
    { key: 'search', label: '主题搜索', short: '搜索', test: /^search:/ },
    { key: 'starred', label: '我的星标', short: '星标', test: /^profile:[^:]+:starred$/ },
    { key: 'owned', label: '我的仓库', short: '我的', test: /^profile:[^:]+:owned$/ },
    { key: 'mention', label: '资讯提及', short: '提及', test: /^mention:/ },
    { key: 'pinned', label: '固定关注', short: '关注', test: /^(repository|curated):/ },
  ];
  const CHANNEL_KEYS = CHANNELS.map(channel => channel.key);

  function channelOf(source) {
    const hit = CHANNELS.find(channel => channel.test.test(String(source || '')));
    return hit ? hit.key : 'pinned';
  }

  function channelsOf(candidate) {
    const keys = new Set([candidate.source, ...safeList(candidate.also_seen_in)].filter(Boolean).map(channelOf));
    return CHANNEL_KEYS.filter(key => keys.has(key));
  }

  function channelLabel(key) {
    const hit = CHANNELS.find(channel => channel.key === key);
    return hit ? hit.label : key;
  }

  /* 新上榜：近 12 小时才第一次被采集到（first_seen_at 距本期生成 ≤ 12 小时，约等于最近三轮采集） */
  const FRESH_WINDOW_MS = 12 * 3600000;
  function isFreshCandidate(candidate, generatedAt) {
    const first = new Date(candidate.first_seen_at || '').getTime();
    const generated = new Date(generatedAt || '').getTime();
    if (Number.isNaN(first) || Number.isNaN(generated)) return false;
    return generated - first <= FRESH_WINDOW_MS;
  }

  function sourceLabel(source) {
    return String(source || '')
      .replace(/^trending:daily\//, 'Trending 日榜 · ')
      .replace(/^trending:weekly\//, 'Trending 周榜 · ')
      .replace(/^mention:/, '资讯提及 · ')
      .replace(/^profile:([^:]+):starred$/, '$1 的星标')
      .replace(/^profile:([^:]+):owned$/, '$1 的仓库')
      .replace(/\{days_ago:(\d+)\}/g, '近 $1 天')
      .replace(/^repository:/, '仓库 ')
      .replace(/^search:/, '搜索 ')
      .replace(/ archived:false/g, '')
      .replace(/ stars:>/g, ' · stars>')
      .replace(/topic:/g, '#');
  }

  /* ---------------- 仓库卡片指标：实测值 + 示意图形 ----------------
   * GitHub 只给出「此刻」的 stars，没有历史序列。曲线的 12 个点里只有最后一个是真实值，
   * 前 11 个由 forks / issues 推演出一条确定性的上升弧线，仅用于让卡片可扫读，非真实历史。 */
  function buildStarTrend(candidate) {
    const stars = Math.max(0, Number(candidate.stars || 0));
    if (stars === 0) return Array(12).fill(0);
    const forks = Math.max(0, Number(candidate.forks || 0));
    const issues = Math.max(0, Number(candidate.open_issues || 0));
    const activity = Math.min(0.32, 0.08 + Math.log10(forks + issues + 10) / 24);
    const trend = Array.from({ length: 12 }, (_, index) => {
      const progress = index / 11;
      const curve = 1 - activity * (1 - progress) * (0.9 + Math.sin((index + 1) * 1.7) * 0.08);
      return Math.max(0, Math.round(stars * curve));
    });
    trend[11] = stars;
    return trend;
  }

  /* 7 格活跃度：按 forks / open_issues 确定性派生 1–5 级，非真实事件统计。 */
  function buildActivityHeat(candidate) {
    const seed = Number(candidate.forks || 0) + Number(candidate.open_issues || 0) * 3;
    return Array.from({ length: 7 }, (_, index) => Math.min(5, Math.max(1, (seed + index * 7 + index * index) % 6)));
  }

  function buildRepoMetrics(candidate) {
    return {
      stars: Math.max(0, Number(candidate.stars || 0)),
      forks: Math.max(0, Number(candidate.forks || 0)),
      issues: Math.max(0, Number(candidate.open_issues || 0)),
      starTrend: buildStarTrend(candidate),
      activityHeat: buildActivityHeat(candidate),
      starTrendIllustrative: true,
      activityHeatIllustrative: true,
    };
  }

  /* ---------------- 本机相关：只用本浏览器的喜好账本 ----------------
   * taste: { [entryId]: 'love' | 'skip' }，来自 localStorage。
   * 从「喜欢」里学习话题 / 类型 / 语言 / 作者的正向权重，从「跳过」里学习负向权重，
   * 再给每个候选打 0–99 分并给出可读理由。没有任何喜好时返回 ready=false（冷启动）。 */
  const LOCAL_WEIGHTS = { topic: 18, kind: 10, language: 8, owner: 22 };

  function buildLocalProfile(entries, taste) {
    const map = taste && typeof taste === 'object' ? taste : {};
    const byId = new Map(safeList(entries).map(entry => [entry.id, entry]));
    const profile = { loved: 0, skipped: 0, topic: {}, kind: {}, language: {}, owner: {} };
    Object.keys(map).forEach(id => {
      const entry = byId.get(id);
      const value = map[id];
      if (!entry || (value !== 'love' && value !== 'skip')) return;
      const sign = value === 'love' ? 1 : -0.6;
      if (value === 'love') profile.loved += 1; else profile.skipped += 1;
      entry.tags.forEach(tag => { profile.topic[tag] = (profile.topic[tag] || 0) + sign; });
      profile.kind[entry.kind] = (profile.kind[entry.kind] || 0) + sign;
      if (entry.language) profile.language[entry.language] = (profile.language[entry.language] || 0) + sign;
      profile.owner[entry.owner] = (profile.owner[entry.owner] || 0) + sign;
    });
    profile.ready = profile.loved > 0;
    profile.topTopics = Object.entries(profile.topic).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return profile;
  }

  function localRelevance(entry, profile, taste) {
    if (!entry || !profile || !profile.ready) return { ready: false, score: 0, level: 'none', reasons: [] };
    const own = taste && taste[entry.id];
    const reasons = [];
    let raw = 0;
    const add = (type, key, label) => {
      const n = profile[type][key] || 0;
      if (!n) return;
      raw += n * LOCAL_WEIGHTS[type];
      reasons.push({ tone: n > 0 ? 'good' : 'risk', type, text: n > 0 ? `${label}（你喜欢过 ${Math.round(n)} 个同类）` : `${label}（你跳过过同类）` });
    };
    entry.tags.forEach(tag => add('topic', tag, `话题 #${tag}`));
    add('kind', entry.kind, `类型「${entry.kind}」`);
    if (entry.language) add('language', entry.language, `语言 ${entry.language}`);
    add('owner', entry.owner, `作者 ${entry.owner}`);
    const score = own === 'love' ? 99 : own === 'skip' ? 1 : Math.max(0, Math.min(99, Math.round(raw)));
    const level = own === 'love' ? 'loved' : own === 'skip' ? 'skipped' : score >= 40 ? 'high' : score >= 15 ? 'mid' : score > 0 ? 'low' : 'none';
    reasons.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'good' ? -1 : 1));
    if (own === 'love') reasons.unshift({ tone: 'good', type: 'self', text: '你已在本机标记喜欢' });
    if (own === 'skip') reasons.unshift({ tone: 'risk', type: 'self', text: '你已在本机标记跳过' });
    return { ready: true, score, level, label: LOCAL_LEVEL_LABELS[level], reasons: reasons.slice(0, 4) };
  }

  /* ---------------- 解释说明：把每个分数 / 结论翻译成人话 ---------------- */
  function explainScores(entry) {
    const raw = (entry && entry.raw) || {};
    const s = (entry && entry.scores) || {};
    const stars = formatCompact(raw.stars);
    const topics = safeList(raw.topics).length;
    return [
      { key: 'fit', label: '匹配度', value: s.fit, how: `看社区认可（${stars} stars，取对数避免头部项目碾压）+ 话题标注完整度（${topics} 个话题）。越高越像「已被验证、能直接拿来用」。` },
      { key: 'novelty', label: '新颖度', value: s.novelty, how: 'Star 越少、话题越多，分越高。高新颖度意味着「早期、可能有新思路」，但也更不成熟。' },
      { key: 'cost', label: '引入成本', value: s.cost, invert: true, how: `由 Fork 规模与未结议题估算改造与跟进成本${Number(raw.open_issues || 0) > 500 ? '；未结议题超过 500，额外加分' : ''}。越低越省事。` },
      { key: 'risk', label: '风险', value: s.risk, invert: true, how: `${raw.license && raw.license !== 'NOASSERTION' ? `已声明 ${raw.license}` : '未声明许可证（+34）'}${raw.archived ? '、已归档（+35）' : ''}；超过 90 天没推送再 +18。越低越安全。` },
    ];
  }

  function explainVerdict(entry) {
    if (!entry) return '';
    const s = entry.scores || {};
    if (entry.verdict === 'adopt') return `匹配度 ${s.fit} ≥ 78 且引入成本 ${s.cost} ≤ 45，许可证清晰、未归档——可以直接安排试用。`;
    if (entry.verdict === 'evaluate') {
      const why = [];
      if (!entry.license) why.push('没有声明许可证');
      if (entry.archived) why.push('仓库已归档');
      if (s.risk >= 70) why.push(`风险分 ${s.risk} ≥ 70`);
      return `${why.join('、') || '存在风险信号'}，先确认能否合法、安全使用，再决定是否深入。`;
    }
    return `许可证清晰但还没达到「建议引入」线（匹配度 ≥ 78 且成本 ≤ 45），适合先读 README 了解思路。`;
  }

  function explainPriority(priority) {
    if (priority === 'P0') return 'P0 · 建议引入且匹配度 ≥ 98，本期最该先看的一条';
    if (priority === 'P1') return 'P1 · 建议引入，本周内值得安排时间';
    if (priority === 'P2') return 'P2 · 需评估风险，但匹配度或新颖度足够高，值得留意';
    return '';
  }

  const LOCAL_LEVEL_LABELS = { loved: '已喜欢', skipped: '已跳过', high: '高度相关', mid: '有些相关', low: '略相关', none: '暂无关联' };

  function entryFromCandidate(candidate, index, now, generatedAt) {
    const category = classify(candidate);
    const scores = scoreCandidate(candidate, now);
    const verdict = verdictOf(candidate, scores);
    const topics = safeList(candidate.topics);
    const tags = (topics.length ? topics : [String(candidate.language || '').toLowerCase()]).filter(Boolean).slice(0, 4);
    const owner = String(candidate.full_name || '').split('/')[0] || 'GitHub';
    const repo = String(candidate.full_name || '').split('/').pop() || '未知项目';
    const entry = {
      id: `WL-${String(index + 1).padStart(3, '0')}`,
      fullName: candidate.full_name,
      owner,
      title: repo,
      description: candidate.description || '',
      url: candidate.html_url || `https://github.com/${candidate.full_name}`,
      avatarUrl: `https://github.com/${owner}.png?size=96`,
      kind: category.kind,
      kindKey: category.key,
      language: candidate.language || '',
      tags,
      scores,
      verdict,
      verdictLabel: VERDICT_LABELS[verdict],
      action: actionText(category.kind),
      stars: Number(candidate.stars || 0),
      starsCompact: formatCompact(candidate.stars),
      repoMetrics: buildRepoMetrics(candidate),
      license: candidate.license && candidate.license !== 'NOASSERTION' ? candidate.license : '',
      archived: candidate.archived === true,
      pushedAt: shortDate(candidate.pushed_at || candidate.updated_at),
      collectedAt: shortDate(candidate.collected_at || candidate.updated_at),
      related: [],
      channels: channelsOf(candidate),
      hits: new Set([candidate.source, ...safeList(candidate.also_seen_in)].filter(Boolean)).size,
      fresh: isFreshCandidate(candidate, generatedAt),
      raw: candidate,
    };
    entry.trending = entry.channels.includes('trending');
    entry.priority = editorialPriority(entry);
    return entry;
  }

  function linkRelated(entries) {
    const byTag = new Map();
    entries.forEach(entry => entry.tags.forEach(tag => byTag.set(tag, (byTag.get(tag) || []).concat(entry.id))));
    entries.forEach(entry => {
      entry.related = Array.from(new Set(entry.tags.flatMap(tag => byTag.get(tag) || [])))
        .filter(id => id !== entry.id)
        .slice(0, 3);
    });
  }

  const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2 };

  function rankEntries(entries) {
    return entries.slice().sort((a, b) => {
      const pa = a.priority ? PRIORITY_RANK[a.priority] : 3;
      const pb = b.priority ? PRIORITY_RANK[b.priority] : 3;
      if (pa !== pb) return pa - pb;
      return b.scores.fit - a.scores.fit;
    });
  }

  /* 新上榜排序：热榜优先 → 多源交叉命中 → Stars */
  function rankFresh(entries) {
    return entries.slice().sort((a, b) => (Number(b.trending) - Number(a.trending)) || (b.hits - a.hits) || (b.stars - a.stars));
  }

  function buildSourceHealth(discoveries, now) {
    const statuses = discoveries && discoveries.source_status && typeof discoveries.source_status === 'object' ? discoveries.source_status : {};
    const rows = Object.entries(statuses).map(([key, status]) => ({
      key,
      label: sourceLabel(key),
      ok: Boolean(status && status.ok),
      cached: Boolean(status && status.cached),
      count: status && typeof status.count === 'number' ? status.count : 0,
      error: (status && status.error) || '',
      fetchedLabel: relativeTime(status && status.fetched_at, now),
    }));
    return {
      total: rows.length,
      ok: rows.filter(row => row.ok).length,
      cached: rows.filter(row => row.cached).length,
      failed: rows.filter(row => !row.ok),
      rows,
    };
  }

  /* 主模型：本期 = 全部真实候选按编辑优先级排序；筛选统计只是一行事实，不再单独成页。 */
  function buildHubData(discoveries, nowValue) {
    const now = typeof nowValue === 'number' ? nowValue : Date.now();
    const candidates = safeList(discoveries && discoveries.candidates).filter(item => item && item.full_name);
    const generatedAt = discoveries && discoveries.generated_at;
    const entries = rankEntries(candidates.map((candidate, index) => entryFromCandidate(candidate, index, now, generatedAt)));
    linkRelated(entries);
    const counts = entries.reduce((acc, entry) => {
      acc[entry.kind] = (acc[entry.kind] || 0) + 1;
      return acc;
    }, {});
    const channelCounts = entries.reduce((acc, entry) => {
      entry.channels.forEach(key => { acc[key] = (acc[key] || 0) + 1; });
      return acc;
    }, {});
    const statuses = (discoveries && discoveries.source_status) || {};
    const sourceKeys = Object.keys(statuses);
    const totalHits = sourceKeys.reduce((sum, key) => sum + Number((statuses[key] && statuses[key].count) || 0), 0);
    const fresh = rankFresh(entries.filter(entry => entry.fresh));
    return {
      available: entries.length > 0,
      generatedAt: (discoveries && discoveries.generated_at) || null,
      generatedLabel: relativeTime(discoveries && discoveries.generated_at, now),
      generatedDate: shortDate(discoveries && discoveries.generated_at),
      entries,
      lead: entries[0] || null,
      picks: entries.slice(1, 5),
      fresh,
      channels: CHANNELS.filter(channel => channelCounts[channel.key]).map(channel => ({
        key: channel.key,
        label: channel.label,
        short: channel.short,
        count: channelCounts[channel.key],
        feeds: sourceKeys.filter(key => channelOf(key) === channel.key).length,
      })),
      intake: { feeds: sourceKeys.length, hits: totalHits, unique: entries.length, merged: Math.max(0, totalHits - entries.length) },
      kinds: KIND_ORDER.filter(kind => counts[kind]).map(kind => ({ kind, count: counts[kind] })),
      stats: {
        scanned: entries.length,
        readable: entries.filter(entry => entry.verdict !== 'evaluate').length,
        adopt: entries.filter(entry => entry.verdict === 'adopt').length,
        evaluate: entries.filter(entry => entry.verdict === 'evaluate').length,
        fresh: fresh.length,
      },
      sources: buildSourceHealth(discoveries, now),
    };
  }

  /* ---------------- 仓库速读：只从公开元数据推导，不编造 ---------------- */
  const PERMISSIVE_LICENSES = /^(mit|apache-2\.0|bsd-2-clause|bsd-3-clause|isc|0bsd|unlicense|mpl-2\.0|cc0-1\.0|zlib)$/i;
  const COPYLEFT_LICENSES = /gpl|agpl|lgpl|eupl|sspl|cc-by-sa/i;

  function licenseInfo(license) {
    if (!license || license === 'NOASSERTION') return { label: '未声明', tone: 'risk', note: '未声明许可证，默认保留所有权利，暂不可直接引入' };
    if (PERMISSIVE_LICENSES.test(license)) return { label: license, tone: 'good', note: `${license} 属宽松许可，可商用与二次分发` };
    if (COPYLEFT_LICENSES.test(license)) return { label: license, tone: 'warn', note: `${license} 带传染性条款，引入前需法务评估` };
    return { label: license, tone: 'warn', note: `${license} 需逐条核对使用范围` };
  }

  function freshnessInfo(pushedAt, now) {
    const time = pushedAt ? new Date(pushedAt).getTime() : NaN;
    if (Number.isNaN(time)) return { days: null, label: '推送时间未知', tone: 'warn' };
    const days = Math.max(0, Math.floor((now - time) / DAY_MS));
    const when = days === 0 ? '今天' : `${days} 天前`;
    if (days <= 14) return { days, label: `${when}仍在推送 · 活跃`, tone: 'good' };
    if (days <= 90) return { days, label: `${when}推送 · 稳定维护`, tone: 'good' };
    if (days <= 365) return { days, label: `${when}推送 · 节奏放缓`, tone: 'warn' };
    return { days, label: `${when}推送 · 可能已沉寂`, tone: 'risk' };
  }

  function heatInfo(stars) {
    if (stars >= 50000) return { label: '头部热门', note: `${formatCompact(stars)} stars，属社区头部项目` };
    if (stars >= 5000) return { label: '广受关注', note: `${formatCompact(stars)} stars，已有稳定用户群` };
    if (stars >= 500) return { label: '成长中', note: `${formatCompact(stars)} stars，正在被更多人发现` };
    return { label: '早期', note: `${formatCompact(stars)} stars，尚处早期，适合先观察` };
  }

  const KIND_CHECKLIST = {
    Skill: ['通读 README 与 SKILL.md，确认触发条件与产出', '审查脚本权限、外发网络与写入范围', '核对依赖与许可证，进入待审队列', '在沙箱里小范围试用并记录效果'],
    'UI 组件': ['浏览示例，判断视觉语言是否契合', '抽取 token 与组件范式，避免整包引入', '检查可访问性（对比度、键盘、读屏）', '评估移动端体积与样式隔离成本'],
    信息源: ['确认更新频率与主题覆盖面', '抽样 10 条内容判断信噪比', '连续两轮命中后再加入正式采集'],
    工作流: ['画出它替代的现有步骤', '确认运行环境、凭证与失败回滚方式', '挑一个低风险场景做一周试点'],
    基础设施: ['核对部署形态与运维成本', '检查安全边界、凭证管理与日志', '对比现有方案的关键指标'],
    读物: ['先读摘要与目录，标记与当前问题相关的章节', '摘录 3 条可落地观点到工作笔记'],
  };

  function buildRepoBrief(entry, nowValue) {
    const now = typeof nowValue === 'number' ? nowValue : Date.now();
    const raw = (entry && entry.raw) || {};
    const stars = Number(raw.stars || 0);
    const forks = Number(raw.forks || 0);
    const issues = Number(raw.open_issues || 0);
    const topics = safeList(raw.topics).length ? safeList(raw.topics) : safeList(entry && entry.tags);
    const language = raw.language || '未标注语言';
    const kind = (entry && entry.kind) || '项目';
    const license = licenseInfo(raw.license);
    const fresh = freshnessInfo(raw.pushed_at || raw.updated_at, now);
    const heat = heatInfo(stars);
    const forkRatio = stars > 0 ? forks / stars : 0;
    const issuePer1k = stars > 0 ? issues / (stars / 1000) : 0;
    const sources = [raw.source, ...safeList(raw.also_seen_in)].filter(Boolean).map(sourceLabel);

    const signals = [
      { tone: license.tone, label: '许可证', text: license.note },
      { tone: fresh.tone, label: '维护', text: fresh.label },
    ];
    if (raw.archived) signals.push({ tone: 'risk', label: '状态', text: '仓库已归档，不再接受更新' });
    signals.push({
      tone: forkRatio >= 0.15 ? 'good' : 'neutral',
      label: '参与度',
      text: forkRatio >= 0.15 ? `Fork/Star ${(forkRatio * 100).toFixed(0)}%，大量用户在动手改造` : `Fork/Star ${(forkRatio * 100).toFixed(0)}%，以收藏围观为主`,
    });
    signals.push({
      tone: issuePer1k > 20 ? 'warn' : 'neutral',
      label: '议题压力',
      text: issuePer1k > 20 ? `每千 Star 约 ${issuePer1k.toFixed(0)} 个未结议题，维护压力偏高` : `每千 Star 约 ${issuePer1k.toFixed(1)} 个未结议题，处于可控区间`,
    });
    if (sources.length > 1) signals.push({ tone: 'good', label: '交叉命中', text: `同时出现在 ${sources.length} 个采集来源中` });

    const desc = String((entry && (entry.description || entry.sub)) || '').replace(/[。.\s]+$/, '');
    const summary = `${entry ? entry.title : '该项目'} 是一个以 ${language} 为主的 ${kind} 项目${desc ? `：${desc}` : ''}。${heat.note}；${fresh.label}；${license.note}。`;

    return {
      summary,
      facts: [
        { key: '语言', value: language },
        { key: '许可证', value: license.label, tone: license.tone },
        { key: '最近推送', value: fresh.days == null ? '未知' : (fresh.days === 0 ? '今天' : `${fresh.days} 天前`), tone: fresh.tone },
        { key: '热度', value: heat.label },
        { key: '状态', value: raw.archived ? '已归档' : '维护中', tone: raw.archived ? 'risk' : 'good' },
        { key: '来源命中', value: `${Math.max(1, sources.length)} 处` },
      ],
      topics,
      signals,
      sources,
      checklist: KIND_CHECKLIST[kind] || KIND_CHECKLIST['读物'],
      compact: { stars: formatCompact(stars), forks: formatCompact(forks), issues: formatCompact(issues) },
    };
  }

  /* 画像信号源：只读 profile.json 的开关与权重，私有信号默认关闭。 */
  const SIGNAL_LABELS = {
    repositories: { name: '公开 GitHub 仓库与 Star', scope: '公开 API' },
    taste_ledger: { name: '喜好账本（❤ / ✕）', scope: '仅浏览器本地' },
    meetings: { name: '会议', scope: '私有 · 未接入' },
    lark_docs: { name: '飞书文档', scope: '私有 · 未接入' },
    podcasts_articles: { name: '播客与文章', scope: '本地脱敏导入' },
  };

  function buildProfileSignals(profile, profileSignals) {
    const signals = profile && profile.signals && typeof profile.signals === 'object' ? profile.signals : {};
    const imported = profileSignals && profileSignals.summary ? Number(profileSignals.summary.record_count || 0) : 0;
    return Object.entries(signals).map(([key, value]) => ({
      key,
      name: (SIGNAL_LABELS[key] || { name: key }).name,
      scope: (SIGNAL_LABELS[key] || { scope: '' }).scope,
      enabled: Boolean(value && value.enabled),
      weight: Number((value && value.weight) || 0),
      note: key === 'podcasts_articles' ? `已导入 ${imported} 条脱敏记录` : '',
    }));
  }

  const api = {
    KIND_ORDER,
    VERDICT_LABELS,
    buildHubData,
    buildRepoBrief,
    buildSourceHealth,
    buildProfileSignals,
    CHANNELS,
    channelOf,
    channelLabel,
    rankFresh,
    buildRepoMetrics,
    buildLocalProfile,
    localRelevance,
    explainScores,
    explainVerdict,
    explainPriority,
    LOCAL_LEVEL_LABELS,
    editorialPriority,
    formatCompact,
    relativeTime,
    shortDate,
  };

  if (typeof window !== 'undefined') window.WL_HUB_ADAPTER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
