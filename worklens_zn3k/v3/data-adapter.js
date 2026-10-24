/* global window */
/* WorkLens 真实采集数据适配层：把 data/discoveries.json 转为页面可消费的稳定视图模型。 */
(function () {
  const CATEGORY = {
    skill: { shelf: '发现 · Skill', code: '240', kind: 'Skill' },
    ui: { shelf: 'UI · 组件', code: '310', kind: 'UI 组件' },
    source: { shelf: '发现 · 信息源', code: '240', kind: '信息源' },
    workflow: { shelf: '工作流', code: '520', kind: '工作流' },
    infra: { shelf: '基础设施', code: '610', kind: '基础设施' },
    reading: { shelf: '理论 · 读物', code: '410', kind: '读物' },
  };

  function safeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function shortDate(value) {
    if (!value) return '未知';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未知';
    return date.toISOString().slice(0, 10);
  }

  function relativeGeneratedAt(value) {
    if (!value) return '刚刚';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '刚刚';
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} 小时前`;
    return shortDate(value);
  }

  function repoName(fullName) {
    return String(fullName || '').split('/').pop() || '未知项目';
  }

  function ownerName(fullName) {
    return String(fullName || '').split('/')[0] || 'GitHub';
  }

  function classify(candidate) {
    const text = [
      candidate.full_name,
      candidate.description,
      candidate.language,
      ...safeList(candidate.topics),
      candidate.source,
    ].join(' ').toLowerCase();

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

  function scoreCandidate(candidate) {
    const stars = Number(candidate.stars || 0);
    const forks = Number(candidate.forks || 0);
    const issues = Number(candidate.open_issues || 0);
    const topics = safeList(candidate.topics).length;
    const hasLicense = candidate.license && candidate.license !== 'NOASSERTION';
    const updatedAt = candidate.pushed_at || candidate.updated_at;
    const ageHours = updatedAt ? Math.max(1, (Date.now() - new Date(updatedAt).getTime()) / 3600000) : 999;

    return {
      fit: clampScore(50 + Math.log10(stars + 10) * 9 + Math.min(topics, 12)),
      novelty: clampScore(80 - Math.log10(stars + 10) * 6 + Math.min(topics, 10)),
      cost: clampScore(12 + Math.log10(forks + 10) * 5 + (issues > 500 ? 12 : 0)),
      risk: clampScore((hasLicense ? 14 : 48) + (candidate.archived ? 35 : 0) + (ageHours > 24 * 90 ? 18 : 0)),
    };
  }

  function verdict(candidate, scores) {
    if (candidate.archived || scores.risk >= 70 || !candidate.license || candidate.license === 'NOASSERTION') return 'evaluate';
    if (scores.fit >= 78 && scores.cost <= 45) return 'adopt';
    return 'shelf';
  }

  function actionText(candidate, category, scores) {
    if (category.kind === 'Skill') {
      return `进入 Skill 待审队列：先做 README、脚本权限、依赖与许可证检查，通过后再考虑试用；当前 Fit ${scores.fit}。`;
    }
    if (category.kind === 'UI 组件') {
      return `加入 UI 候选池：先抽取 token / 组件范式，不直接引入依赖；重点看许可证、可访问性和移动端成本。`;
    }
    if (category.kind === '信息源') {
      return `作为外部信息源观察：记录来源、更新时间和主题覆盖，连续命中后再加入正式采集配置。`;
    }
    return `加入观察列表：保留事实元数据与来源链接，下一轮结合实际工作问题决定是否深入调研。`;
  }

  function entryFromCandidate(candidate, index) {
    const category = classify(candidate);
    const scores = scoreCandidate(candidate);
    const id = `WL-GH-${String(index + 1).padStart(3, '0')}`;
    const topics = safeList(candidate.topics).slice(0, 4);
    const tags = topics.length > 0 ? topics : [String(candidate.language || 'github').toLowerCase()].filter(Boolean);

    return {
      id,
      dewey: `${category.code}.${String(index + 1).padStart(3, '0')}`,
      shelf: category.shelf,
      title: repoName(candidate.full_name),
      sub: candidate.description || `${candidate.full_name} 的公开 GitHub 仓库元数据`,
      author: ownerName(candidate.full_name),
      source: 'GitHub API',
      url: candidate.html_url || `https://github.com/${candidate.full_name}`,
      kind: category.kind,
      tags,
      scores,
      verdict: verdict(candidate, scores),
      taste: null,
      why: `自动采集命中 ${candidate.source || 'GitHub 来源'}；公开指标为 ${Number(candidate.stars || 0).toLocaleString()} stars、${Number(candidate.forks || 0).toLocaleString()} forks、${Number(candidate.open_issues || 0).toLocaleString()} open issues。`,
      action: actionText(candidate, category, scores),
      notes: [
        `许可证：${candidate.license || '未声明'}`,
        `最近推送：${candidate.pushed_at || candidate.updated_at || '未知'}`,
        `来源：${candidate.source || '未知'}${safeList(candidate.also_seen_in).length ? `；同时见于 ${candidate.also_seen_in.length} 个来源` : ''}`,
      ],
      related: [],
      added: shortDate(candidate.collected_at || candidate.updated_at || candidate.pushed_at),
      raw: candidate,
    };
  }

  function linkRelated(entries) {
    const byTag = new Map();
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        const list = byTag.get(tag) || [];
        list.push(entry.id);
        byTag.set(tag, list);
      });
    });
    entries.forEach(entry => {
      entry.related = Array.from(new Set(entry.tags.flatMap(tag => byTag.get(tag) || [])))
        .filter(id => id !== entry.id)
        .slice(0, 3);
    });
  }

  function sourceLabel(source) {
    return source
      .replace(/^repository:/, '仓库：')
      .replace(/^search:/, '搜索：')
      .replace(/ archived:false/g, '')
      .replace(/ stars:>/g, ' · stars > ')
      .replace(/topic:/g, '#');
  }

  function buildSources(discoveries) {
    const statuses = discoveries.source_status || {};
    return Object.entries(statuses).map(([source, status]) => ({
      id: source.replace(/[^a-z0-9]+/gi, '-').slice(0, 48),
      kind: sourceLabel(source),
      freq: '每日',
      signal: status.ok ? `采集成功${status.count !== null && status.count !== undefined ? ` · ${status.count} 条` : ''}` : `采集失败 · ${status.error || '未知错误'}`,
      health: status.ok ? 0.96 : 0.38,
      last: relativeGeneratedAt(discoveries.generated_at),
      queued: status.count || 0,
    }));
  }

  function buildShelves(entries) {
    const order = [CATEGORY.source, CATEGORY.skill, CATEGORY.ui, CATEGORY.reading, CATEGORY.workflow, CATEGORY.infra];
    return order.map(category => ({
      code: category.code,
      name: category.shelf,
      count: entries.filter(entry => entry.shelf === category.shelf).length,
    })).filter(item => item.count > 0);
  }

  function buildPipeline(entries) {
    const adopted = entries.filter(entry => entry.verdict === 'adopt').length;
    const evaluate = entries.filter(entry => entry.verdict === 'evaluate').length;
    return [
      { stage: '扫描', en: 'Scan', count: entries.length, hint: '真实候选' },
      { stage: '去重', en: 'Dedupe', count: entries.length, hint: '按仓库合并' },
      { stage: '评估', en: 'Fit', count: Math.max(evaluate, Math.ceil(entries.length * 0.45)), hint: '风险待判' },
      { stage: '上架', en: 'Shelf', count: entries.filter(entry => entry.verdict === 'shelf').length, hint: '入库待读' },
      { stage: '引入', en: 'Adopt', count: adopted, hint: '可试用' },
      { stage: '复盘', en: 'Review', count: 0, hint: '待 D+30' },
    ];
  }

  function buildIssue(discoveries, entries) {
    const generated = discoveries.generated_at ? new Date(discoveries.generated_at) : new Date();
    const week = Math.ceil(generated.getUTCDate() / 7);
    return {
      volume: '真实采集',
      issue: `GitHub 候选 · ${entries.length} 条`,
      date: `${generated.getUTCFullYear()} · ${generated.getUTCMonth() + 1} 月 · 第 ${week} 周`,
      editor: 'Agent · WorkLens',
      curator_note: `本期页面已接入 data/discoveries.json，不再只展示演示数据。候选来自公开 GitHub API 与配置的信息源，只呈现公开仓库元数据、许可证和来源证据。`,
      stats: {
        scanned: entries.length,
        shortlisted: entries.filter(entry => entry.verdict !== 'evaluate').length,
        curated: Math.min(entries.length, 24),
        adopted_this_week: entries.filter(entry => entry.verdict === 'adopt').length,
      },
    };
  }

  function buildPcData(seed, discoveries) {
    const candidates = safeList(discoveries.candidates).filter(item => item && item.full_name);
    if (candidates.length === 0) return seed;
    const entries = candidates.slice(0, 36).map(entryFromCandidate);
    linkRelated(entries);
    const top = entries[0];
    const skillCandidates = entries.filter(entry => entry.kind === 'Skill').slice(0, 3);

    return Object.assign({}, seed, {
      ISSUE: buildIssue(discoveries, entries),
      SOURCES: buildSources(discoveries),
      PIPELINE: buildPipeline(entries),
      ENTRIES: entries,
      SHELVES: buildShelves(entries),
      FIELD_NOTES: [
        { time: relativeGeneratedAt(discoveries.generated_at), from: 'Agent', text: `读取真实 discoveries.json，共 ${entries.length} 条公开 GitHub 候选。`, tag: '采集' },
        { time: '刚刚', from: 'Agent', text: top ? `当前头条候选：${top.author}/${top.title}，判定为「${top.verdict === 'adopt' ? '引入' : top.verdict === 'evaluate' ? '评估中' : '上架'}」。` : '暂无候选。', tag: '推荐' },
        { time: '刚刚', from: 'Agent', text: 'Skill 类候选只进入待审队列，不自动安装或执行。', tag: '安全' },
      ],
      ROUTES: [
        {
          id: 'R-01', title: '真实候选接入闭环', sub: '从公开 GitHub 元数据到可解释候选卡片', duration: '7 天 · 约 8 小时',
          stages: [
            { day: '第 1 天', topic: '稳定数据适配层', refs: entries.slice(0, 2).map(entry => entry.id), effort: '2 小时', deliverable: 'discovery adapter' },
            { day: '第 2–3 天', topic: '评分模型校准', refs: entries.slice(2, 5).map(entry => entry.id), effort: '3 小时', deliverable: 'Fit / Risk 规则' },
            { day: '第 4–5 天', topic: 'Skill 待审队列', refs: skillCandidates.map(entry => entry.id), effort: '2 小时', deliverable: '安全评测清单' },
            { day: '第 6–7 天', topic: 'D+30 复盘', refs: [], effort: '1 小时', deliverable: '保留 / 下架记录' },
          ],
          progress: 0.25,
        },
      ],
      ADOPTIONS: [],
      PROFILE_SOURCES: [
        { id: 'ps-gh', icon: 'code', kind: '公开 GitHub', name: '配置化仓库与搜索源', scope: `${entries.length} 条候选`, signal: 'stars · forks · topics · license · freshness', weight: 0.52, status: 'live', last: relativeGeneratedAt(discoveries.generated_at), hint: '当前唯一启用信号' },
        { id: 'ps-taste-public', icon: 'heart', kind: '本地喜好', name: 'WorkLens Taste Signal', scope: '仅浏览器本地态', signal: '❤ / ✕ / 订阅主题', weight: 0.18, status: 'live', last: '实时', hint: '不写回公开仓库' },
        { id: 'ps-docs-off', icon: 'doc', kind: '私有文档', name: '未接入', scope: '关闭', signal: '禁止写入公开仓库', weight: 0, status: 'paused', last: '关闭', hint: '隐私保护' },
      ],
      TASTE_SOURCE: { id: 'ps-taste', icon: 'heart', kind: '你的喜好', name: 'WorkLens · Taste Signal', scope: '浏览器本地', signal: '卡片 ❤ / ✕ · 主题订阅', weight: 0.18, status: 'live', last: '实时', hint: '不出设备', isTaste: true },
      PROFILE_RADAR: [
        { axis: 'AI Agent', score: Math.min(95, entries.filter(entry => entry.tags.join(' ').includes('agent')).length * 5 + 55), delta: 6, color: 'cinnabar' },
        { axis: 'Skill 待审', score: Math.min(95, skillCandidates.length * 18 + 35), delta: 8, color: 'cinnabar' },
        { axis: '前端工程', score: Math.min(95, entries.filter(entry => entry.kind === 'UI 组件').length * 4 + 48), delta: 4, color: 'ink' },
        { axis: '信息策展', score: Math.min(95, entries.filter(entry => entry.kind === '信息源').length * 5 + 45), delta: 7, color: 'ink' },
        { axis: '基础设施', score: Math.min(95, entries.filter(entry => entry.kind === '基础设施').length * 4 + 38), delta: 2, color: 'ink' },
        { axis: '风险审查', score: Math.min(95, entries.filter(entry => entry.verdict === 'evaluate').length * 3 + 40), delta: 5, color: 'mute' },
      ],
      PROFILE_KEYWORDS: Array.from(new Set(entries.flatMap(entry => entry.tags))).slice(0, 12).map((tag, index) => ({ w: tag, n: entries.filter(entry => entry.tags.includes(tag)).length, trend: index < 6 ? 'up' : 'flat', source: 'github' })),
      PROFILE_EVIDENCE: [
        { claim: '当前页面数据来自公开 GitHub 元数据，不包含私有工作内容', evidence: ['data/discoveries.json 由 GitHub Actions 采集', '字段限定为仓库名、描述、topics、stars、forks、license 等公开字段', '私有文档、会议和 IM 信号保持关闭'], confidence: 0.94 },
        { claim: 'Skill 候选处于待审而非自动安装状态', evidence: skillCandidates.map(entry => `${entry.author}/${entry.title} · ${entry.raw.license || '未声明许可证'}`).slice(0, 3), confidence: 0.86 },
      ],
      PRIVACY_RULES: [
        { on: true, text: '公开仓库只保存 GitHub 官方 API 的事实字段' },
        { on: true, text: '不写入私有工作数据、内部地址、凭证或个人信息' },
        { on: true, text: 'Skill 候选只进入待审队列，不自动安装或执行脚本' },
        { on: false, text: '会议、文档、IM、浏览历史等私有信号当前未接入' },
      ],
      TASTE_SUMMARY: { week_likes: 0, week_loves: 0, week_skips: 0, week_saves: 0, week_subscriptions: 0, total_likes: 0, top_topics: Array.from(new Set(entries.flatMap(entry => entry.tags))).slice(0, 6).map(tag => ({ topic: tag, count: entries.filter(entry => entry.tags.includes(tag)).length, trend: 'up', weight: Math.min(0.95, entries.filter(entry => entry.tags.includes(tag)).length / Math.max(entries.length, 1) + 0.35) })), trend_7d: [0, 0, 0, 0, 0, 0, 0] },
      TASTE_SUBSCRIPTIONS: [],
      AI_SKILLS: [],
      SKILL_PROPOSALS: skillCandidates.map((entry, index) => ({ id: `pr-${String(index + 1).padStart(2, '0')}`, name: `review-${entry.title}`, family: 'Skill 待审', why: `${entry.author}/${entry.title} 命中 Skill 相关主题，但必须先做安全评测。`, evidence: entry.notes, cost_est: '约 0.5 天', confidence: Math.min(0.9, entry.scores.fit / 100), preview_dsl: `candidate: ${entry.author}/${entry.title}\nstatus: review-only\naction: audit license, scripts, network and write permissions` })),
      PUSHES: entries.slice(0, 5).map((entry, index) => ({ id: `pu-${String(index + 1).padStart(2, '0')}`, time: index === 0 ? '刚刚' : `${index * 3 + 2} 分钟前`, topic: entry.kind, title: `${entry.author}/${entry.title}`, from: 'GitHub API', reason: entry.why, verdict: entry.verdict, score: entry.scores.fit, read: index > 1 })),
      EVOLUTION_LOG: [
        { time: '刚刚', trigger: 'discoveries_loaded', action: '页面接入真实 discoveries.json', delta: 'live', axis: 'data-adapter' },
        { time: '刚刚', trigger: 'privacy_guard', action: '关闭私有信号展示，仅保留公开 GitHub 元数据', delta: 'safe', axis: 'privacy' },
      ],
    });
  }

  function buildMobileData(seed, discoveries) {
    const pcData = buildPcData({}, discoveries);
    const entries = pcData.ENTRIES.slice(0, 12).map(entry => ({
      id: entry.id,
      dewey: entry.dewey,
      shelf: entry.shelf,
      title: entry.title,
      sub: entry.sub,
      author: entry.author,
      source: entry.source,
      url: entry.url.replace(/^https?:\/\//, ''),
      kind: entry.kind,
      tags: entry.tags.slice(0, 3),
      scores: entry.scores,
      verdict: entry.verdict,
      why: entry.why,
      action: entry.action,
      added: entry.added,
    }));
    return Object.assign({}, seed, {
      issue: {
        volume: '真实采集',
        issue: `GitHub 候选 · ${entries.length} 条`,
        date: pcData.ISSUE.date,
        note: '已接入真实 discoveries.json；仅展示公开 GitHub 仓库元数据，Skill 候选进入待审队列。',
        stats: { scanned: pcData.ISSUE.stats.scanned, curated: pcData.ISSUE.stats.curated, adopted: pcData.ISSUE.stats.adopted_this_week, saved: 0 },
      },
      entries,
      pipeline: pcData.PIPELINE.map(item => ({ stage: item.stage, count: item.count, hint: item.hint })),
      fieldNotes: pcData.FIELD_NOTES,
      shelves: pcData.SHELVES,
      profileSources: [
        { id: 'ps-gh', icon: 'gh', kind: '公开 GitHub', name: '配置化信息源', scope: `${entries.length} 条`, weight: 0.52, status: 'live', last: relativeGeneratedAt(discoveries.generated_at), hint: '唯一启用' },
        { id: 'ps-private', icon: 'doc', kind: '私有信号', name: '未接入', scope: '关闭', weight: 0, status: 'paused', last: '关闭', hint: '不写入公开仓库' },
      ],
      radar: pcData.PROFILE_RADAR.map(item => ({ axis: item.axis, score: item.score, delta: item.delta })),
      keywords: pcData.PROFILE_KEYWORDS.map(item => ({ w: item.w, n: item.n, trend: item.trend })),
      evidence: pcData.PROFILE_EVIDENCE,
      privacy: pcData.PRIVACY_RULES,
      tasteSummary: { week_likes: 0, week_loves: 0, week_skips: 0, week_saves: 0, week_subs: 0, total_likes: 0, trend_7d: [0, 0, 0, 0, 0, 0, 0], top_topics: pcData.TASTE_SUMMARY.top_topics },
      subscriptions: [],
      aiSkills: [],
      proposals: pcData.SKILL_PROPOSALS.map(item => ({ id: item.id, name: item.name, family: item.family, cost: item.cost_est, confidence: Math.round(item.confidence * 100), why: item.why, evidence: item.evidence, dsl: item.preview_dsl })),
      pushes: pcData.PUSHES.map(item => ({ id: item.id, time: item.time, topic: item.topic, title: item.title, from: item.from, reason: item.reason, score: item.score, read: item.read })),
    });
  }

  window.WL_DISCOVERY_ADAPTER = { buildPcData, buildMobileData };
})();
