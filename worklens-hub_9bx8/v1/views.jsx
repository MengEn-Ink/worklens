/* @jsxRuntime classic */
/* global React, WL_UI, WL_HUB_ADAPTER */
/* WorkLens Hub · 三个视图：本期 / 待审 / 我的（导出到 window.WL_VIEWS） */
(function () {
  const { useMemo, useState } = React;
  const { Icon, Eyebrow, Pill, PriorityMark, Segmented, ScoreRow, TasteButtons, StateBlock, SkeletonRows, Avatar, RepoMetrics, LocalBadge, Explain } = WL_UI;
  const PAGE_SIZE = 30;

  function Meta({ entry }) {
    return (
      <div className="ff-mono flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[color:var(--ink-mute)]">
        <span className="inline-flex items-center gap-1"><Icon name="star" size={12} />{entry.starsCompact}</span>
        {entry.language && <span>{entry.language}</span>}
        <span className={entry.license ? '' : 'text-[color:var(--cinnabar)]'}>{entry.license || '未声明许可证'}</span>
        <span>推送 {entry.pushedAt}</span>
      </div>
    );
  }

  /* ============================== 本期 ============================== */
  function Funnel({ stats, loved }) {
    const steps = [
      { n: stats.scanned, label: '本期收录仓库' },
      { n: stats.readable, label: '许可清晰可读' },
      { n: stats.adopt, label: '建议引入', hot: true },
      { n: loved, label: '你已喜欢' },
    ];
    return (
      <div className="grid grid-cols-4 border-y border-[color:var(--ink)]">
        {steps.map(step => (
          <div key={step.label} className="funnel-step px-3 md:px-5 py-3">
            <div className={`ff-display text-[28px] md:text-[40px] font-bold leading-none tabular-nums ${step.hot ? 'text-[color:var(--cinnabar)]' : ''}`}>{step.n}</div>
            <div className="mt-1.5 text-[11px] md:text-[12px] text-[color:var(--ink-mute)] leading-tight">{step.label}</div>
          </div>
        ))}
      </div>
    );
  }

  /* 「怎么读这一期」：一次讲清优先级、结论、实测 / 示意、本机相关 */
  function ReadingGuide() {
    return (
      <Explain title="怎么读这一期？优先级、结论、指标与「本机相关」说明" className="mt-4">
        <dl>
          <dt>排序逻辑</dt>
          <dd>先按编辑优先级（P0 → P1 → P2 → 其余），同级再按匹配度从高到低。全部由公开指标计算，没有人工置顶。</dd>
          <dt>P0 / P1 / P2</dt>
          <dd>{WL_HUB_ADAPTER.explainPriority('P0')}；{WL_HUB_ADAPTER.explainPriority('P1')}；{WL_HUB_ADAPTER.explainPriority('P2')}。</dd>
          <dt>三种结论</dt>
          <dd><b>建议引入</b>：匹配度 ≥ 78、引入成本 ≤ 45、许可证清晰；<b>值得一读</b>：许可证清晰但未到引入线；<b>先评估风险</b>：无许可证、已归档或风险分 ≥ 70。</dd>
          <dt>实测 vs 示意</dt>
          <dd>卡片里的 Stars / Forks / Issues 数字是采集时从 GitHub API 取到的<b>实测快照</b>；虚线星标曲线与 7 格活跃度是由当前快照推演的<b>示意</b>图形，只有曲线末端的朱砂实心点是真实值。</dd>
          <dt>候选从哪来</dt>
          <dd>六类渠道：GitHub Trending 日榜 / 周榜（按语言）、主题搜索（含「近 30 天新建且已破 300 星」）、你的星标、你的仓库、AI 资讯里被提到的仓库、固定关注。同一仓库被多个源命中只算一条，并记下「多源命中」。<b>不按星数、类型或许可证丢弃任何候选</b>——风险高的照样列出，只是标「先评估风险」并排在后面。</dd>
          <dt>新上榜</dt>
          <dd>近 12 小时才第一次被采集到的仓库，约等于最近三轮采集的新增。按「热榜优先 → 多源命中 → Stars」排序。</dd>
          <dt>本机相关</dt>
          <dd>你在本页点的 ♥ / 跳过只存在这台设备的浏览器里（localStorage）。系统从你喜欢的项目里学习话题、类型、语言和作者，在本机给其它候选打 0–99 的相关分；不上传、不扫描设备文件，清空浏览器数据即重置。</dd>
        </dl>
      </Explain>
    );
  }

  /* 来源构成：一条可点击的分段条，回答「数据源这么多，为什么只推这些」——全部列出，没有丢弃 */
  function IntakeBar({ hub, channel, onPick }) {
    const total = hub.channels.reduce((sum, item) => sum + item.count, 0) || 1;
    return (
      <section className="intake mt-6" aria-labelledby="intake-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="intake-title" className="ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">来源构成 · 点一段只看该来源</h2>
          <p className="ff-mono text-[12px] text-[color:var(--ink-soft)] tabular-nums">
            {hub.intake.feeds} 个采集源 → {hub.intake.hits} 次命中 → 合并重复 {hub.intake.merged} → <b className="text-[color:var(--ink)]">{hub.intake.unique} 个仓库全部列出</b>
          </p>
        </div>
        <div className="intake__bar mt-2" role="tablist" aria-label="按来源筛选">
          {hub.channels.map((item, index) => {
            const active = channel === item.key;
            return (
              <button key={item.key} role="tab" aria-selected={active} data-channel={item.key}
                onClick={() => onPick(active ? 'all' : item.key)}
                title={`${item.label}：${item.count} 个仓库，来自 ${item.feeds} 个采集源`}
                style={{ flexGrow: item.count, flexBasis: 0, animationDelay: `${index * 70}ms` }}
                className={`intake__seg ${active ? 'is-active' : ''} ${channel !== 'all' && !active ? 'is-dim' : ''}`}>
                <span className="intake__label">{item.count / total > 0.07 ? item.short : ''}</span>
              </button>
            );
          })}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[color:var(--ink-mute)]">
          {hub.channels.map(item => (
            <li key={item.key} className="inline-flex items-center gap-1.5">
              <i className="intake__dot" data-channel={item.key} aria-hidden="true" />
              {item.label} <b className="ff-mono text-[color:var(--ink)] tabular-nums">{item.count}</b>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  function FreshCard({ entry, index, openEntry }) {
    return (
      <button onClick={() => openEntry(entry.id)} style={{ animationDelay: `${index * 45}ms` }}
        className="rise fresh-card group text-left flex flex-col justify-start shrink-0 w-[248px] md:w-auto snap-start p-4 bg-[color:var(--paper-raised)] border border-[color:var(--rule)] hover:border-[color:var(--ink)] transition-colors">
        <span className="flex items-center gap-1.5">
          {entry.trending ? <Pill tone="risk">Trending</Pill> : <Pill tone="warn">新</Pill>}
          {entry.hits > 1 && <span className="ff-mono text-[10.5px] text-[color:var(--ink-mute)]">{entry.hits} 源命中</span>}
          <span className="ml-auto ff-mono text-[11px] text-[color:var(--ink-mute)] inline-flex items-center gap-1"><Icon name="star" size={11} />{entry.starsCompact}</span>
        </span>
        <span className="block mt-2 text-[11.5px] text-[color:var(--ink-mute)] truncate">{entry.owner} /</span>
        <span className="block ff-display text-[18px] font-bold leading-tight truncate group-hover:text-[color:var(--cinnabar)]">{entry.title}</span>
        <span className="block mt-1.5 text-[12.5px] leading-[1.55] text-[color:var(--ink-soft)] line-clamp-2 min-h-[39px]">{entry.description || '该仓库没有填写描述。'}</span>
        <span className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--ink-mute)]"><span>{entry.kind}</span>{entry.language && <span className="ff-mono">{entry.language}</span>}</span>
      </button>
    );
  }

  /* 新上榜：近 12 小时首次采集到的仓库，横向一屏扫完 */
  function FreshStrip({ hub, openEntry, onAll }) {
    if (!hub.fresh.length) return null;
    const shown = hub.fresh.slice(0, 12);
    return (
      <section className="py-10 border-b border-[color:var(--ink)]" aria-labelledby="fresh-title">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <Eyebrow>近 12 小时 · 新上榜</Eyebrow>
            <h2 id="fresh-title" className="ff-cn text-[22px] md:text-[26px] font-semibold mt-1">刚被采集到的 <span className="text-[color:var(--cinnabar)] tabular-nums">{hub.stats.fresh}</span> 个仓库</h2>
            <p className="mt-1 text-[13px] text-[color:var(--ink-mute)]">热榜优先，其次看被几个来源同时命中，再看 Stars。这里先放 {shown.length} 个。</p>
          </div>
          {hub.fresh.length > shown.length && (
            <button onClick={onAll} className="h-10 px-4 inline-flex items-center gap-2 border border-[color:var(--ink)] text-[13px] hover:bg-[color:var(--ink)] hover:text-[color:var(--paper-raised)] transition-colors">
              在列表里看全部 {hub.stats.fresh} 个<Icon name="arrow" size={14} />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-5 px-5 md:mx-0 md:px-0 flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-x-auto snap-x snap-mandatory md:overflow-visible">
          {shown.map((entry, index) => <FreshCard key={entry.id} entry={entry} index={index} openEntry={openEntry} />)}
        </div>
      </section>
    );
  }

  function LeadStory({ entry, taste, onTaste, openEntry, rel }) {
    return (
      <article className="rise relative pb-6 lg:pb-0 lg:pr-10 lg:border-r border-[color:var(--rule)]">
        <div className="flex items-center gap-2 mb-4">
          <PriorityMark priority={entry.priority} />
          <Eyebrow>头条 · {entry.kind}</Eyebrow>
          <LocalBadge rel={rel} />
        </div>
        {entry.verdict === 'adopt' && <div className="absolute right-0 lg:right-10 -top-2"><span className="stamp">建议<br />引入</span></div>}
        <button onClick={() => openEntry(entry.id)} className="block text-left group max-w-[85%]">
          <div className="text-[13px] text-[color:var(--ink-mute)]">{entry.owner} /</div>
          <h2 className="ff-display font-extrabold text-[40px] md:text-[60px] leading-[0.95] tracking-[-0.03em] break-words group-hover:text-[color:var(--cinnabar)] transition-colors">{entry.title}</h2>
        </button>
        <p className="mt-4 max-w-xl text-[16px] md:text-[17px] leading-[1.65] text-[color:var(--ink-soft)]">{entry.description || '该仓库没有填写描述。'}</p>
        <div className="mt-4"><Meta entry={entry} /></div>
        <div className="mt-5 max-w-xl"><RepoMetrics metrics={entry.repoMetrics} variant="lead" /></div>
        <div className="mt-5 max-w-xl space-y-2 text-[14px] leading-[1.7] text-[color:var(--ink-soft)]">
          <p><b className="font-semibold text-[color:var(--ink)]">为什么是头条：</b>{WL_HUB_ADAPTER.explainPriority(entry.priority) || '本期按匹配度排第一'}。{WL_HUB_ADAPTER.explainVerdict(entry)}</p>
          <p className="pl-4 border-l-2 border-[color:var(--ink)]"><b className="font-semibold text-[color:var(--ink)]">建议动作：</b>{entry.action}</p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={() => openEntry(entry.id)} className="h-11 px-5 inline-flex items-center gap-2 bg-[color:var(--ink)] text-[color:var(--paper-raised)] text-[14px]">
            30 秒速读<Icon name="arrow" />
          </button>
          <TasteButtons value={taste[entry.id]} onTaste={value => onTaste(entry.id, value)} />
        </div>
      </article>
    );
  }

  function PickRow({ entry, index, openEntry, rel }) {
    return (
      <button onClick={() => openEntry(entry.id)} style={{ animationDelay: `${80 + index * 60}ms` }}
        className="rise w-full text-left grid grid-cols-[28px_1fr] gap-3 py-4 border-b border-[color:var(--rule)] last:border-b-0 group">
        <span className="ff-display text-[22px] font-bold text-[color:var(--ink-mute)] leading-none pt-1">{index + 2}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 mb-1"><PriorityMark priority={entry.priority} /><span className="text-[11px] text-[color:var(--ink-mute)]">{entry.kind}</span><LocalBadge rel={rel} showScore={false} /></span>
          <span className="block ff-display text-[20px] font-bold leading-tight truncate group-hover:text-[color:var(--cinnabar)]">{entry.title}</span>
          <span className="block mt-1 text-[13px] text-[color:var(--ink-mute)] line-clamp-2">{entry.description || entry.fullName}</span>
        </span>
      </button>
    );
  }

  function LedgerRow({ entry, rank, taste, onTaste, openEntry, inQueue, rel }) {
    const skipped = taste === 'skip';
    return (
      <li className={`group grid grid-cols-[32px_40px_1fr] md:grid-cols-[40px_40px_1fr_auto] items-start gap-3 md:gap-4 py-4 border-b border-[color:var(--rule-soft)] ${skipped ? 'opacity-45' : ''}`}>
        <span className="ff-mono text-[11px] text-[color:var(--ink-mute)] pt-3 tabular-nums">{String(rank).padStart(3, '0')}</span>
        <Avatar src={entry.avatarUrl} label={entry.owner} />
        <button onClick={() => openEntry(entry.id)} className="min-w-0 text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className="ff-display text-[18px] font-bold leading-tight group-hover:text-[color:var(--cinnabar)] [overflow-wrap:anywhere]">{entry.title}</span>
            <span className="text-[12px] text-[color:var(--ink-mute)]">{entry.owner}</span>
            <PriorityMark priority={entry.priority} />
            {entry.trending && <Pill tone="risk">Trending</Pill>}
            {entry.fresh && !entry.trending && <Pill tone="warn">新</Pill>}
            {inQueue && <Pill tone="warn">待审中</Pill>}
            <LocalBadge rel={rel} />
          </span>
          <span className="block mt-1 text-[13.5px] text-[color:var(--ink-soft)] line-clamp-2">{entry.description || '该仓库没有填写描述。'}</span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone={entry.verdict === 'adopt' ? 'good' : entry.verdict === 'evaluate' ? 'risk' : 'neutral'}>{entry.verdictLabel}</Pill>
            <span className="text-[11px] text-[color:var(--ink-mute)]">{entry.kind}</span>
            {entry.language && <span className="ff-mono text-[11px] text-[color:var(--ink-mute)]">{entry.language}</span>}
            {!entry.license && <span className="ff-mono text-[11px] text-[color:var(--cinnabar)]">无许可证</span>}
            {entry.hits > 1 && <span className="ff-mono text-[11px] text-[color:var(--ink-mute)]">{entry.hits} 源命中</span>}
          </span>
          <RepoMetrics metrics={entry.repoMetrics} variant="row" />
        </button>
        <div className="col-start-3 md:col-start-auto"><TasteButtons compact value={taste} onTaste={value => onTaste(entry.id, value)} /></div>
      </li>
    );
  }

  /* 本机相关：冷启动时教用户怎么让它工作；有喜好后给出本机挑的 3 条 */
  function LocalStrip({ hub, localProfile, relOf, openEntry, taste, onSort }) {
    if (!localProfile.ready) {
      return (
        <section className="mt-8 grid md:grid-cols-[auto_1fr] gap-4 items-start p-5 border border-dashed border-[color:var(--rule)] bg-[color:var(--paper-raised)]">
          <span className="w-10 h-10 inline-flex items-center justify-center border border-[color:var(--ink)]"><Icon name="device" size={18} /></span>
          <div>
            <Eyebrow>本机相关 · 尚未启用</Eyebrow>
            <p className="mt-1 text-[15px] leading-[1.7]">在下面任意候选上点 <b className="text-[color:var(--cinnabar)]">♥ 喜欢</b>，这台设备就会开始学习你的口味：同话题、同类型、同语言、同作者的项目会被标上「本机 · 相关」并可一键按相关度排序。</p>
            <p className="mt-1 text-[12.5px] text-[color:var(--ink-mute)]">计算只发生在本浏览器，数据不上传；点「跳过」会给同类项目降权。</p>
          </div>
        </section>
      );
    }
    const picks = hub.entries
      .filter(entry => !taste[entry.id])
      .map(entry => ({ entry, rel: relOf(entry) }))
      .filter(item => item.rel.score > 0)
      .sort((a, b) => b.rel.score - a.rel.score)
      .slice(0, 3);
    return (
      <section className="mt-8 rise" aria-labelledby="local-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow className="flex items-center gap-1.5"><Icon name="device" size={12} />本机相关 · 基于你在这台设备上的 {localProfile.loved} 个 ♥{localProfile.skipped ? ` / ${localProfile.skipped} 个跳过` : ''}</Eyebrow>
            <h2 id="local-title" className="ff-cn text-[22px] md:text-[26px] font-semibold mt-1">你可能还会喜欢这 {picks.length} 条</h2>
            {localProfile.topTopics.length > 0 && <p className="mt-1 text-[13px] text-[color:var(--ink-mute)]">你的口味偏向：{localProfile.topTopics.slice(0, 4).map(([t]) => `#${t}`).join('  ')}</p>}
          </div>
          <button onClick={onSort} className="h-9 px-3 border border-[color:var(--ink)] text-[13px] hover:bg-[color:var(--ink)] hover:text-[color:var(--paper-raised)] transition-colors">全部候选按本机相关排序</button>
        </div>
        {picks.length === 0 ? (
          <p className="mt-3 text-[14px] text-[color:var(--ink-mute)]">本期其它候选和你喜欢的项目没有共同话题 / 类型 / 语言 / 作者。多标几个 ♥ 会更准。</p>
        ) : (
          <ol className="mt-4 grid md:grid-cols-3 gap-px bg-[color:var(--rule)] border border-[color:var(--rule)]">
            {picks.map(({ entry, rel }, index) => (
              <li key={entry.id} className="bg-[color:var(--paper-raised)]">
                <button onClick={() => openEntry(entry.id)} style={{ animationDelay: `${index * 70}ms` }} className="rise w-full h-full text-left p-4 group">
                  <span className="flex items-center justify-between gap-2"><LocalBadge rel={rel} /><span className="ff-mono text-[11px] text-[color:var(--ink-mute)]">★ {entry.starsCompact}</span></span>
                  <span className="block mt-2 ff-display text-[19px] font-bold leading-tight [overflow-wrap:anywhere] group-hover:text-[color:var(--cinnabar)]">{entry.title}</span>
                  <span className="block mt-2 text-[12.5px] leading-[1.6] text-[color:var(--ink-soft)]">因为：{rel.reasons.filter(r => r.tone === 'good').slice(0, 2).map(r => r.text).join('；') || '与你的口味有交集'}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  function IssueView({ status, hub, taste, onTaste, openEntry, queueSubjects, onRetry, localProfile, relOf }) {
    const [kind, setKind] = useState('all');
    const [channel, setChannel] = useState('all');
    const [sort, setSort] = useState('editor');
    const [query, setQuery] = useState('');
    const [showSkipped, setShowSkipped] = useState(false);
    const [limit, setLimit] = useState(PAGE_SIZE);

    const lovedCount = Object.values(taste).filter(value => value === 'love').length;
    const skippedCount = Object.values(taste).filter(value => value === 'skip').length;

    const filtered = useMemo(() => {
      if (!hub) return [];
      const q = query.trim().toLowerCase();
      const list = hub.entries.filter(entry => {
        if (kind !== 'all' && entry.kind !== kind) return false;
        if (channel === 'fresh' && !entry.fresh) return false;
        if (channel !== 'all' && channel !== 'fresh' && !entry.channels.includes(channel)) return false;
        if (!showSkipped && taste[entry.id] === 'skip') return false;
        if (!q) return true;
        return [entry.fullName, entry.description, entry.language, ...entry.tags].join(' ').toLowerCase().includes(q);
      });
      if (sort === 'local' && localProfile.ready) return list.slice().sort((a, b) => relOf(b).score - relOf(a).score);
      if (sort === 'stars') return list.slice().sort((a, b) => b.stars - a.stars);
      if (channel === 'fresh') return WL_HUB_ADAPTER.rankFresh(list);
      return list;
    }, [hub, kind, channel, query, showSkipped, taste, sort, localProfile, relOf]);

    if (status === 'loading') return <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-10"><SkeletonRows rows={6} /></div>;
    if (status === 'error' || !hub) {
      return <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-10"><StateBlock tone="risk" title="本期候选没能加载" body="data/discoveries.json 读取失败。可能是网络抖动或采集任务尚未产出，请稍后重试。" action="重新加载" onAction={onRetry} /></div>;
    }
    if (!hub.available) {
      return <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-10"><StateBlock title="本期还没有候选" body="采集任务每四小时运行一次，产出后这里会自动出现新一期。" /></div>;
    }

    const kindOptions = [{ value: 'all', label: '全部', count: hub.entries.length }].concat(hub.kinds.map(item => ({ value: item.kind, label: item.kind, count: item.count })));
    const visible = filtered.slice(0, limit);
    const channelOptions = [{ value: 'all', label: '全部来源', count: hub.entries.length }]
      .concat(hub.stats.fresh ? [{ value: 'fresh', label: '新上榜', count: hub.stats.fresh }] : [])
      .concat(hub.channels.map(item => ({ value: item.key, label: item.label, count: item.count })));
    const jumpToLedger = () => { const node = document.getElementById('ledger-title'); if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const pickChannel = value => { setChannel(value); setLimit(PAGE_SIZE); };
    const channelName = channel === 'all' ? '' : channel === 'fresh' ? '新上榜' : WL_HUB_ADAPTER.channelLabel(channel);

    return (
      <div className="max-w-[1240px] mx-auto px-5 md:px-10 pb-20">
        <header className="pt-8 md:pt-12 pb-6">
          <Eyebrow>WorkLens · {hub.generatedDate} 期 · 数据更新于 {hub.generatedLabel}</Eyebrow>
          <h1 className="ff-cn mt-3 text-[30px] md:text-[46px] font-black leading-[1.15] tracking-[-0.01em]">
            这一期，<span className="text-[color:var(--cinnabar)]">{hub.stats.adopt}</span> 个值得动手。
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-[color:var(--ink-soft)]">
            采集器每四小时扫一遍 GitHub Trending 热榜、{hub.channels.find(item => item.key === 'search') ? `${hub.channels.find(item => item.key === 'search').feeds} 组主题搜索` : '主题搜索'}、你的星标和 AI 资讯里提到的仓库。去重后共收录 {hub.stats.scanned} 条（近 12 小时新上榜 {hub.stats.fresh} 条），其中 {hub.stats.readable} 条许可证清晰可放心读，{hub.stats.adopt} 条达到「建议引入」线，{hub.stats.evaluate} 条需要先评估风险。
          </p>
          <ReadingGuide />
          <IntakeBar hub={hub} channel={channel} onPick={value => { pickChannel(value); jumpToLedger(); }} />
        </header>
        <Funnel stats={hub.stats} loved={lovedCount} />
        <LocalStrip hub={hub} localProfile={localProfile} relOf={relOf} openEntry={openEntry} taste={taste} onSort={() => { setSort('local'); setLimit(PAGE_SIZE); const node = document.getElementById('ledger-title'); if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />

        <section className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] gap-6 lg:gap-10 py-10 border-b border-[color:var(--ink)]">
          <LeadStory entry={hub.lead} taste={taste} onTaste={onTaste} openEntry={openEntry} rel={relOf(hub.lead)} />
          <div>
            <Eyebrow className="mb-1">同样值得看</Eyebrow>
            {hub.picks.map((entry, index) => <PickRow key={entry.id} entry={entry} index={index} openEntry={openEntry} rel={relOf(entry)} />)}
          </div>
        </section>

        <FreshStrip hub={hub} openEntry={openEntry} onAll={() => { pickChannel('fresh'); jumpToLedger(); }} />

        <section className="pt-10" aria-labelledby="ledger-title">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
            <div>
              <Eyebrow>全部候选</Eyebrow>
              <h2 id="ledger-title" className="ff-cn text-[24px] md:text-[28px] font-semibold mt-1 scroll-mt-20">{sort === 'local' && localProfile.ready ? '按本机相关排好' : sort === 'stars' ? '按 Stars 排好' : '按优先级排好'}的 {channelName ? `${channelName} · ${filtered.length}` : hub.entries.length} 条</h2>
            </div>
            <label className="relative flex items-center w-full md:w-[320px]">
              <span className="sr-only">搜索候选</span>
              <Icon name="search" className="absolute left-3 text-[color:var(--ink-mute)]" />
              <input value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} placeholder="搜仓库名、描述、语言、话题"
                className="w-full h-11 pl-10 pr-3 bg-[color:var(--paper-raised)] border border-[color:var(--rule)] text-[15px] placeholder:text-[color:var(--ink-mute)] focus:outline-none focus:border-[color:var(--ink)]" />
            </label>
          </div>
          <div className="mb-3"><Segmented label="按来源筛选" options={channelOptions} value={channel} onChange={pickChannel} /></div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <Segmented label="按类型筛选" options={kindOptions} value={kind} onChange={value => { setKind(value); setLimit(PAGE_SIZE); }} />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[12px] text-[color:var(--ink-mute)]">排序</span>
              <Segmented label="排序方式" options={[{ value: 'editor', label: '编辑优先' }, { value: 'local', label: localProfile.ready ? '本机相关' : '本机相关 · 先点 ♥' }, { value: 'stars', label: 'Stars' }]} value={sort} onChange={value => { setSort(value); setLimit(PAGE_SIZE); }} />
            </div>
            {skippedCount > 0 && (
              <button onClick={() => setShowSkipped(!showSkipped)} className="self-start md:self-auto h-9 text-[13px] text-[color:var(--ink-mute)] underline underline-offset-4 decoration-[color:var(--rule)] hover:text-[color:var(--ink)]">
                {showSkipped ? '隐藏已跳过' : `显示已跳过 · ${skippedCount}`}
              </button>
            )}
          </div>

          {sort === 'local' && !localProfile.ready && (
            <p className="mt-3 px-3 py-2 bg-[color:var(--mustard-wash)] text-[13px]">本机还没有喜好记录，暂按编辑优先展示。给任意候选点 ♥ 后，这里会立刻按与你口味的相关度重排。</p>
          )}
          {filtered.length === 0 ? (
            <div className="mt-6"><StateBlock title="没有匹配的候选" body="换个关键词，或者回到「全部」看看。" action="清空筛选" onAction={() => { setKind('all'); setChannel('all'); setQuery(''); }} /></div>
          ) : (
            <ol className="mt-4 border-t border-[color:var(--ink)]">
              {visible.map((entry, index) => (
                <LedgerRow key={entry.id} entry={entry} rank={index + 1} taste={taste[entry.id]} onTaste={onTaste} openEntry={openEntry} inQueue={queueSubjects.has(entry.fullName)} rel={relOf(entry)} />
              ))}
            </ol>
          )}
          {filtered.length > limit && (
            <div className="pt-6 text-center">
              <button onClick={() => setLimit(limit + PAGE_SIZE)} className="h-11 px-6 border border-[color:var(--ink)] text-[14px] hover:bg-[color:var(--ink)] hover:text-[color:var(--paper-raised)] transition-colors">
                再看 {Math.min(PAGE_SIZE, filtered.length - limit)} 条 · 剩余 {filtered.length - limit}
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  /* ============================== 速读详情 ============================== */
  function LocalSection({ rel, localProfile }) {
    return (
      <section className="mt-7">
        <h3 className="mb-2 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)] flex items-center gap-1.5"><Icon name="device" size={12} />本机相关</h3>
        {!rel.ready ? (
          <p className="text-[14px] leading-[1.7] text-[color:var(--ink-soft)]">这台设备上还没有喜好记录。点下方 ♥ 喜欢后，WorkLens 会在本浏览器里记住它的话题、类型、语言和作者，并据此给其它候选打相关分。数据只在本机，不上传。</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="ff-display text-[34px] font-bold leading-none tabular-nums text-[color:var(--cinnabar)]">{rel.score}</span>
              <span className="text-[13px] text-[color:var(--ink-soft)]"><b className="font-semibold text-[color:var(--ink)]">{rel.label}</b> · 满分 99<br /><span className="text-[color:var(--ink-mute)]">基于本机 {localProfile.loved} 个 ♥{localProfile.skipped ? ` / ${localProfile.skipped} 个跳过` : ''}</span></span>
            </div>
            <div className="mt-2 h-[5px] bg-[color:var(--paper-sunk)]"><div className="h-full bg-[color:var(--cinnabar)] transition-[width] duration-700" style={{ width: `${rel.score}%` }} /></div>
            {rel.reasons.length ? (
              <ul className="mt-3">
                {rel.reasons.map(reason => <li key={reason.text} className="grid grid-cols-[16px_1fr] gap-2 py-1 text-[13.5px]"><span className={reason.tone === 'good' ? 'text-[color:var(--forest)]' : 'text-[color:var(--cinnabar)]'}>{reason.tone === 'good' ? '+' : '−'}</span><span>{reason.text}</span></li>)}
              </ul>
            ) : <p className="mt-3 text-[13.5px] text-[color:var(--ink-mute)]">和你喜欢过的项目没有共同的话题、类型、语言或作者。</p>}
            <Explain title="相关分怎么算？" className="mt-2">
              每个你喜欢的项目会给它的特征加权：同作者 +22、每个共同话题 +18、同类型 +10、同语言 +8；你跳过的项目按 0.6 倍反向扣分。累加后截断到 0–99。分数 ≥ 40 为「高度相关」，15–39 为「有些相关」。
            </Explain>
          </>
        )}
      </section>
    );
  }

  function EntryDetail({ entry, hub, taste, onTaste, onClose, openEntry, queueEntry, rel, localProfile }) {
    const brief = useMemo(() => WL_HUB_ADAPTER.buildRepoBrief(entry), [entry]);
    const scoreNotes = useMemo(() => WL_HUB_ADAPTER.explainScores(entry), [entry]);
    const related = entry.related.map(id => hub.entries.find(item => item.id === id)).filter(Boolean);
    return (
      <>
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[color:var(--ink)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><PriorityMark priority={entry.priority} /><Eyebrow>{entry.kind} · 30 秒速读</Eyebrow><LocalBadge rel={rel} /></div>
            <div className="mt-2 text-[13px] text-[color:var(--ink-mute)]">{entry.owner} /</div>
            <h2 className="ff-display text-[24px] md:text-[30px] font-extrabold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere] [hyphens:auto]">{entry.title}</h2>
          </div>
          <button onClick={onClose} aria-label="关闭速读" className="w-11 h-11 shrink-0 inline-flex items-center justify-center border border-[color:var(--rule)] hover:border-[color:var(--ink)]"><Icon name="close" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex gap-4 items-start">
            <p className="flex-1 text-[15px] leading-[1.75] text-[color:var(--ink-soft)]">{brief.summary}</p>
            {entry.verdict === 'adopt' && <span className="stamp stamp--sm shrink-0 mt-1">建议<br />引入</span>}
          </div>

          <div className="mt-5 px-4 py-3 bg-[color:var(--paper-sunk)] text-[14px] leading-[1.7]">
            <b className="font-semibold">结论：{entry.verdictLabel}。</b>{WL_HUB_ADAPTER.explainVerdict(entry)}
            {entry.priority && <span className="block mt-1 text-[12.5px] text-[color:var(--ink-mute)]">{WL_HUB_ADAPTER.explainPriority(entry.priority)}</span>}
          </div>

          <div className="mt-6"><RepoMetrics metrics={entry.repoMetrics} variant="detail" /></div>

          <dl className="grid grid-cols-3 gap-px mt-5 bg-[color:var(--rule)] border border-[color:var(--rule)]">
            {brief.facts.map(fact => (
              <div key={fact.key} className="bg-[color:var(--paper-raised)] px-3 py-2.5">
                <dt className="text-[11px] text-[color:var(--ink-mute)]">{fact.key}</dt>
                <dd className={`mt-0.5 text-[14px] font-medium ${fact.tone === 'risk' ? 'text-[color:var(--cinnabar)]' : fact.tone === 'good' ? 'text-[color:var(--forest)]' : ''}`}>{fact.value}</dd>
              </div>
            ))}
          </dl>

          {queueEntry && (
            <a href={`#review/${queueEntry.id}`} className="mt-5 flex items-center justify-between gap-3 px-4 py-3 bg-[color:var(--mustard-wash)] text-[14px]">
              <span><b className="font-semibold">已在 Skill 待审</b> · {queueEntry.stateLabel} · 阻断项 {queueEntry.passed}/{queueEntry.total} 通过</span>
              <Icon name="arrow" />
            </a>
          )}

          <LocalSection rel={rel} localProfile={localProfile} />

          <h3 className="mt-7 mb-1 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">判断信号</h3>
          <p className="mb-2 text-[12.5px] text-[color:var(--ink-mute)]">绿色为加分项、黄色需留意、红色为风险。全部来自仓库公开元数据。</p>
          <ul>
            {brief.signals.map(signal => (
              <li key={signal.label} className="grid grid-cols-[72px_1fr] gap-3 py-2 border-b border-dashed border-[color:var(--rule)] text-[14px]">
                <Pill tone={signal.tone}>{signal.label}</Pill><span className="text-[color:var(--ink-soft)]">{signal.text}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-7 mb-1 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">评分 · 由公开指标推算</h3>
          <p className="mb-1 text-[12.5px] text-[color:var(--ink-mute)]">匹配度、新颖度越高越好；引入成本、风险越低越好。每一项的算法如下。</p>
          {scoreNotes.map(note => (
            <div key={note.key} className="py-1 border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0">
              <ScoreRow label={note.label} value={note.value} invert={note.invert} />
              <p className="pl-[76px] pb-1 text-[12.5px] leading-[1.6] text-[color:var(--ink-mute)]">{note.how}</p>
            </div>
          ))}

          <h3 className="mt-7 mb-2 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">下一步怎么做</h3>
          <ol className="space-y-2">
            {brief.checklist.map((item, index) => (
              <li key={item} className="grid grid-cols-[24px_1fr] gap-2 text-[14px]"><span className="ff-mono text-[12px] text-[color:var(--cinnabar)] pt-[2px]">{index + 1}.</span><span>{item}</span></li>
            ))}
          </ol>

          {brief.topics.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">{brief.topics.slice(0, 12).map(topic => <span key={topic} className="ff-mono text-[11px] px-2 py-0.5 border border-[color:var(--rule)] text-[color:var(--ink-mute)]">#{topic}</span>)}</div>
          )}

          {related.length > 0 && (
            <>
              <h3 className="mt-7 mb-1 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">同话题</h3>
              {related.map(item => (
                <button key={item.id} onClick={() => openEntry(item.id)} className="w-full flex items-center justify-between gap-3 py-2.5 border-b border-[color:var(--rule-soft)] text-left hover:text-[color:var(--cinnabar)]">
                  <span className="min-w-0 truncate"><b className="font-semibold">{item.title}</b> <span className="text-[12px] text-[color:var(--ink-mute)]">{item.owner}</span></span>
                  <Icon name="chevron" />
                </button>
              ))}
            </>
          )}
          <p className="mt-6 ff-mono text-[10.5px] leading-relaxed text-[color:var(--ink-mute)]">来源：{brief.sources.join(' ｜ ') || 'GitHub API'} · 收录 {entry.collectedAt}</p>
        </div>
        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[color:var(--rule)] pb-[calc(16px+env(safe-area-inset-bottom))]">
          <TasteButtons value={taste[entry.id]} onTaste={value => onTaste(entry.id, value)} />
          <a href={entry.url} target="_blank" rel="noopener noreferrer" className="h-11 px-4 inline-flex items-center gap-2 bg-[color:var(--ink)] text-[color:var(--paper-raised)] text-[14px]">GitHub<Icon name="external" /></a>
        </footer>
      </>
    );
  }

  /* ============================== 待审 ============================== */
  const STATE_TONE = { trial: 'good', screening: 'warn', needs_changes: 'risk', candidate: 'neutral', adopted: 'good', rejected: 'risk', quarantined: 'risk' };

  function QueueItem({ entry, open, onToggle }) {
    return (
      <li id={`queue-${entry.id}`} className={`border-b border-[color:var(--rule-soft)] ${open ? 'bg-[color:var(--paper-raised)]' : ''}`}>
        <button onClick={onToggle} aria-expanded={open} className="w-full text-left grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_200px_24px] items-center gap-3 md:gap-5 px-2 md:px-3 py-4">
          <span className="order-2 md:order-none justify-self-end md:justify-self-start"><Pill tone={STATE_TONE[entry.state]}>{entry.stateLabel}</Pill></span>
          <span className="min-w-0 order-1 md:order-none">
            <span className="block ff-display text-[18px] font-bold leading-tight break-all">{entry.repo}</span>
            <span className="ff-mono block text-[11px] text-[color:var(--ink-mute)] mt-0.5">{entry.owner} · {entry.license} · ★ {entry.starsCompact}{entry.riskFlags.length ? ` · ${entry.riskFlags.join('、')}` : ''}</span>
          </span>
          <span className="order-3 md:order-none col-span-2 md:col-span-1">
            <span className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.max(entry.total, 1)}, 1fr)` }}>
              {entry.blockingList.map(check => <span key={check.key} className="check-tick" data-status={check.status} title={`${check.label}：${check.statusLabel}`} />)}
            </span>
            <span className="ff-mono block mt-1 text-[11px] text-[color:var(--ink-mute)]">阻断项 {entry.passed}/{entry.total} 通过</span>
          </span>
          <Icon name="chevron" className={`hidden md:block transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {open && (
          <div className="rise px-2 md:px-3 pb-5 md:pl-[140px]">
            {entry.trialScope && <p className="mb-3 text-[14px]"><b className="font-semibold">试用范围：</b>{entry.trialScope}{entry.trialPlannedEnd ? `（计划 ${entry.trialPlannedEnd} 结束）` : ''}</p>}
            <ul className="grid md:grid-cols-2 gap-x-6">
              {entry.blockingList.map(check => (
                <li key={check.key} className="grid grid-cols-[84px_1fr] gap-3 py-2 border-b border-dashed border-[color:var(--rule)] text-[13px]">
                  <span className={check.status === 'pass' ? 'text-[color:var(--forest)]' : check.status === 'fail' ? 'text-[color:var(--cinnabar)]' : 'text-[color:var(--ink-mute)]'}>{check.statusLabel}</span>
                  <span><b className="font-medium">{check.label}</b>{check.evidence && <span className="block text-[12px] text-[color:var(--ink-mute)] break-words">{check.evidence}</span>}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="h-10 px-4 inline-flex items-center gap-2 border border-[color:var(--ink)] text-[13px]">打开仓库<Icon name="external" size={14} /></a>
              <span className="self-center text-[12px] text-[color:var(--ink-mute)]">流转需真人在 data/skill-review-queue.json 记录决定，页面不提供安装入口。</span>
            </div>
          </div>
        )}
      </li>
    );
  }

  function ReviewView({ status, queueBoard, adoptionsBoard, focusId, onFocus, onRetry }) {
    const [state, setState] = useState('all');
    const [query, setQuery] = useState('');
    const entries = queueBoard ? queueBoard.entries : [];
    const order = { trial: 0, screening: 1, needs_changes: 2, candidate: 3 };
    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return entries
        .filter(entry => (state === 'all' || entry.state === state) && (!q || entry.subject.toLowerCase().includes(q)))
        .sort((a, b) => ((order[a.state] ?? 9) - (order[b.state] ?? 9)) || (b.passed - a.passed));
    }, [entries, state, query]);

    if (status === 'loading') return <div className="max-w-[1080px] mx-auto px-5 md:px-10 py-10"><SkeletonRows rows={6} /></div>;
    if (status === 'error' || !queueBoard || !queueBoard.available) {
      return <div className="max-w-[1080px] mx-auto px-5 md:px-10 py-10"><StateBlock tone="risk" title="待审队列没能加载" body="data/skill-review-queue.json 读取失败，请稍后重试。" action="重新加载" onAction={onRetry} /></div>;
    }
    const t = queueBoard.totals;
    const adopted = adoptionsBoard && adoptionsBoard.available ? adoptionsBoard.totals.total : 0;
    const stats = [
      { label: '队列总数', n: t.total },
      { label: '限范围试用', n: t.trial, tone: 'text-[color:var(--forest)]' },
      { label: '评测中', n: t.screening },
      { label: '待整改', n: t.needsChanges },
      { label: '已正式引入', n: adopted, tone: 'text-[color:var(--cinnabar)]' },
    ];
    const options = [
      { value: 'all', label: '全部', count: t.total },
      { value: 'trial', label: '试用中', count: t.trial },
      { value: 'screening', label: '评测中', count: t.screening },
      { value: 'needs_changes', label: '待整改', count: t.needsChanges },
      { value: 'candidate', label: '待审', count: t.candidate },
    ].filter(option => option.value === 'all' || option.count > 0);

    return (
      <div className="max-w-[1080px] mx-auto px-5 md:px-10 pb-20">
        <header className="pt-8 md:pt-12 pb-6">
          <Eyebrow>Skill 待审 · 更新于 {queueBoard.generatedLabel}</Eyebrow>
          <h1 className="ff-cn mt-3 text-[30px] md:text-[46px] font-black leading-[1.15]">七道关，<span className="text-[color:var(--cinnabar)]">一个人</span>拍板。</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[color:var(--ink-soft)]">每个 Skill 候选都要通过 7 项阻断检查，再由真人记录决定，才能进入试用或正式引入。自动化只负责入队。</p>
        </header>
        <div className="grid grid-cols-3 md:grid-cols-5 border-y border-[color:var(--ink)]">
          {stats.map(stat => (
            <div key={stat.label} className="px-3 md:px-5 py-3 border-r last:border-r-0 border-[color:var(--rule-soft)]">
              <div className={`ff-display text-[28px] md:text-[36px] font-bold leading-none tabular-nums ${stat.tone || ''}`}>{stat.n}</div>
              <div className="mt-1.5 text-[11px] md:text-[12px] text-[color:var(--ink-mute)]">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <Segmented label="按状态筛选" options={options} value={state} onChange={setState} />
          <label className="relative flex items-center w-full md:w-[280px]">
            <span className="sr-only">搜索待审仓库</span>
            <Icon name="search" className="absolute left-3 text-[color:var(--ink-mute)]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜 owner/repo"
              className="w-full h-11 pl-10 pr-3 bg-[color:var(--paper-raised)] border border-[color:var(--rule)] text-[15px] focus:outline-none focus:border-[color:var(--ink)]" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-[color:var(--ink-mute)]">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 bg-[color:var(--forest)]" />通过</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 bg-[color:var(--mustard)]" />待观察</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 bg-[color:var(--cinnabar)]" />不通过</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 bg-[color:var(--paper-sunk)] border border-[color:var(--rule)]" />未执行</span>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6"><StateBlock title="没有匹配的候选" body="换个状态或关键词试试。" action="清空筛选" onAction={() => { setState('all'); setQuery(''); }} /></div>
        ) : (
          <ul className="mt-4 border-t border-[color:var(--ink)]">
            {filtered.map(entry => <QueueItem key={entry.id} entry={entry} open={focusId === entry.id} onToggle={() => onFocus(focusId === entry.id ? '' : entry.id)} />)}
          </ul>
        )}

        <section className="mt-14">
          <Eyebrow>正式引入</Eyebrow>
          <h2 className="ff-cn text-[24px] font-semibold mt-1">已引入 {adopted} 个</h2>
          {adopted === 0 ? (
            <p className="mt-3 py-6 border-y border-dashed border-[color:var(--rule)] text-[14px] text-[color:var(--ink-mute)]">还没有 Skill 走完试用。试用结论通过后，由真人写入 data/skill-adoptions.json，这里会列出引入范围与回滚方式。</p>
          ) : (
            <ul className="mt-3 border-t border-[color:var(--ink)]">
              {adoptionsBoard.adoptions.map(item => (
                <li key={item.adoptionId} className="py-4 border-b border-[color:var(--rule-soft)]">
                  <div className="flex flex-wrap items-baseline gap-3"><b className="ff-display text-[18px]">{item.repo}</b><span className="text-[12px] text-[color:var(--ink-mute)]">{item.owner} · {item.decidedAt} · {item.decidedBy}</span></div>
                  <p className="mt-1 text-[14px] text-[color:var(--ink-soft)]">{item.importScope}</p>
                  {item.rollbackPlan && <p className="mt-1 text-[12px] text-[color:var(--ink-mute)]">回滚：{item.rollbackPlan}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  window.WL_VIEWS = { IssueView, EntryDetail, ReviewView };
})();
