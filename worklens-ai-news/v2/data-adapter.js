/* global window */
(function () {
  const KIND_RULES = [
    ['risk', /合规|版权|封号|安全|风险|监管|诉讼|攻击|隐私/i],
    ['research', /论文|研究|NeurIPS|模型|训练|推理|实验|科学|数学/i],
    ['tool', /发布|上线|产品|工具|桌面|开源|代码|应用|Agent/i],
    ['signal', /工作|团队|员工|效率|职业|招聘|组织|开发者/i],
  ];
  const KIND_LABELS = { signal: '工作信号', trend: '产业趋势', tool: '工具 & 产品', research: '学术 & 研究', risk: '风险 & 合规' };

  function list(value) { return Array.isArray(value) ? value : []; }
  function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function text(value, fallback) { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
  function decode(value) {
    const map = { '&#8217;': '’', '&#8220;': '“', '&#8221;': '”', '&#038;': '&', '&amp;': '&', '&quot;': '"' };
    return text(value, '').replace(/&#8217;|&#8220;|&#8221;|&#038;|&amp;|&quot;/g, token => map[token]);
  }
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }
  function classify(title) {
    const found = KIND_RULES.find(([, rule]) => rule.test(title));
    return found ? found[0] : 'trend';
  }
  function relativeTime(value, now) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '时间未知';
    const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
    if (minutes < 60) return `${Math.max(1, minutes)} 分钟前`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  }
  function lensFor(item) {
    const title = item.title;
    if (item.kind === 'risk') return `这条风险信号提醒你检查相关流程的合规边界、外部依赖和可追溯证据，再决定是否采用。`;
    if (item.kind === 'research') return `把这项研究当作方法线索而非直接结论：先核对原文证据，再评估它能否缩短你的验证与交付路径。`;
    if (item.kind === 'tool') return `这项工具或产品变化可能影响现有工作流。建议对照当前瓶颈做一次小范围试用，并记录节省时间与新增成本。`;
    if (item.kind === 'signal') return `这条资讯与工作方式变化直接相关。可将“${title.slice(0, 18)}”转成一个本周可验证的小动作。`;
    return `这是一条值得持续观察的产业信号。先关注它是否在多个可靠来源重复出现，再调整工作优先级。`;
  }
  function signalsFor(item) {
    const base = item.kind === 'signal' ? 86 : item.kind === 'risk' ? 78 : item.kind === 'tool' ? 72 : 62;
    return [
      { name: KIND_LABELS[item.kind], value: base },
      { name: '工作方式关联', value: Math.max(38, base - 17) },
      { name: '近期行动价值', value: Math.max(30, base - 28) },
    ];
  }
  const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };
  const CATEGORY_KIND = { security: 'risk', release: 'tool', engineering: 'tool', community: 'trend' };

  function normalizeSources(raw) {
    const configured = raw && raw.source;
    const values = Array.isArray(configured) && configured.length ? configured : [raw && (raw.site_name || configured)];
    return Array.from(new Set(values.map(value => text(value, '')).filter(Boolean)));
  }
  function priority(value) { return Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, value) ? value : ''; }
  function sortItems(items) {
    return items.sort((left, right) => {
      const priorityDelta = (PRIORITY_ORDER[left.priority] ?? 3) - (PRIORITY_ORDER[right.priority] ?? 3);
      if (priorityDelta) return priorityDelta;
      const leftTime = new Date(left.publishedAt).getTime();
      const rightTime = new Date(right.publishedAt).getTime();
      return (Number.isNaN(rightTime) ? -Infinity : rightTime) - (Number.isNaN(leftTime) ? -Infinity : leftTime);
    });
  }
  function normalize(payload, options) {
    const now = options && options.now ? new Date(options.now).getTime() : Date.now();
    const rawItems = list(payload && payload.items);
    const items = sortItems(rawItems.map((raw, index) => {
      const title = decode(raw && raw.title) || '未命名资讯';
      const sourceList = normalizeSources(raw);
      const source = sourceList[0] || '未知来源';
      const publishedAt = text(raw && raw.published_at, '');
      const category = text(raw && raw.category, '');
      const kind = CATEGORY_KIND[category] || classify(title);
      const item = {
        id: `ai-${index + 1}-${publishedAt.slice(0, 10) || 'unknown'}`,
        title, source, sourceList, publishedAt, kind, category,
        priority: priority(raw && raw.priority),
        tags: list(raw && raw.tags).filter(tag => typeof tag === 'string'),
        url: safeUrl(raw && raw.url),
        timeLabel: relativeTime(publishedAt, now),
      };
      item.lens = lensFor(item);
      item.signals = signalsFor(item);
      return item;
    }));
    const sourceNames = Array.from(new Set(items.flatMap(item => item.sourceList.length ? item.sourceList : [item.source])));
    const sources = sourceNames.map(name => ({ name, count: items.filter(item => item.sourceList.includes(name) || item.source === name).length }));
    const categories = Object.entries(KIND_LABELS).map(([id, name]) => ({ id, name, count: items.filter(item => item.kind === id).length }));

    const generated = new Date(payload && payload.generated_at);
    const generatedAt = Number.isNaN(generated.getTime()) ? '' : generated.toISOString();

    const rawStatus = safeObject(payload && payload.source_status);
    const statusSources = Object.entries(rawStatus).map(([name, info]) => {
      const obj = safeObject(info);
      const ok = obj.ok !== false;
      const cached = obj.cached === true;
      const degraded = obj.degraded === true || obj.ok === false;
      return {
        name: text(name, '未知源'),
        ok,
        cached,
        degraded,
        count: Number(obj.count || 0),
        fetchedAt: text(obj.fetched_at, ''),
        checkedAt: text(obj.checked_at, ''),
        error: text(obj.error, ''),
      };
    });

    const sourceStatus = {
      ok: statusSources.length ? statusSources.every((s) => s.ok) : true,
      cached: statusSources.some((s) => s.cached),
      degraded: statusSources.some((s) => s.degraded),
      sources: statusSources,
    };

    return {
      items,
      sources,
      categories,
      generatedAt,
      sourceStatus,
      status: items.length ? 'ready' : 'empty',
    };
  }
  function withinRange(item, range, nowValue) {
    if (range === 'all') return true;
    const stamp = new Date(item.publishedAt).getTime();
    if (Number.isNaN(stamp)) return false;
    const hours = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 }[range] || 24;
    return (nowValue || Date.now()) - stamp <= hours * 3600000;
  }

  const api = { normalize, withinRange, safeUrl, classify };
  window.WL_AI_NEWS_ADAPTER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
