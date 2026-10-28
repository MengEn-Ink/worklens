/* @jsxRuntime classic */
/* global React, WL_UI, WL_HUB_ADAPTER */
/* WorkLens Hub · 三个视图：本期 / 待审 / 我的（导出到 window.WL_VIEWS） */
(function () {
  const { useMemo, useState } = React;
  const { Icon, Eyebrow, Pill, PriorityMark, Segmented, ScoreRow, TasteButtons, StateBlock, SkeletonRows, Avatar } = WL_UI;
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
      { n: stats.scanned, label: '今日扫描' },
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

  function LeadStory({ entry, taste, onTaste, openEntry }) {
    return (
      <article className="rise relative pb-6 lg:pb-0 lg:pr-10 lg:border-r border-[color:var(--rule)]">
        <div className="flex items-center gap-2 mb-4">
          <PriorityMark priority={entry.priority} />
          <Eyebrow>头条 · {entry.kind}</Eyebrow>
        </div>
        {entry.verdict === 'adopt' && <div className="absolute right-0 lg:right-10 -top-2"><span className="stamp">建议<br />引入</span></div>}
        <button onClick={() => openEntry(entry.id)} className="block text-left group max-w-[85%]">
          <div className="text-[13px] text-[color:var(--ink-mute)]">{entry.owner} /</div>
          <h2 className="ff-display font-extrabold text-[40px] md:text-[60px] leading-[0.95] tracking-[-0.03em] break-words group-hover:text-[color:var(--cinnabar)] transition-colors">{entry.title}</h2>
        </button>
        <p className="mt-4 max-w-xl text-[16px] md:text-[17px] leading-[1.65] text-[color:var(--ink-soft)]">{entry.description || '该仓库没有填写描述。'}</p>
        <div className="mt-4"><Meta entry={entry} /></div>
        <p className="mt-5 max-w-xl pl-4 border-l-2 border-[color:var(--ink)] text-[14px] text-[color:var(--ink-soft)]">{entry.action}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={() => openEntry(entry.id)} className="h-11 px-5 inline-flex items-center gap-2 bg-[color:var(--ink)] text-[color:var(--paper-raised)] text-[14px]">
            30 秒速读<Icon name="arrow" />
          </button>
          <TasteButtons value={taste[entry.id]} onTaste={value => onTaste(entry.id, value)} />
        </div>
      </article>
    );
  }

  function PickRow({ entry, index, openEntry }) {
    return (
      <button onClick={() => openEntry(entry.id)} style={{ animationDelay: `${80 + index * 60}ms` }}
        className="rise w-full text-left grid grid-cols-[28px_1fr] gap-3 py-4 border-b border-[color:var(--rule)] last:border-b-0 group">
        <span className="ff-display text-[22px] font-bold text-[color:var(--ink-mute)] leading-none pt-1">{index + 2}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 mb-1"><PriorityMark priority={entry.priority} /><span className="text-[11px] text-[color:var(--ink-mute)]">{entry.kind}</span></span>
          <span className="block ff-display text-[20px] font-bold leading-tight truncate group-hover:text-[color:var(--cinnabar)]">{entry.title}</span>
          <span className="block mt-1 text-[13px] text-[color:var(--ink-mute)] line-clamp-2">{entry.description || entry.fullName}</span>
        </span>
      </button>
    );
  }

  function LedgerRow({ entry, rank, taste, onTaste, openEntry, inQueue }) {
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
            {inQueue && <Pill tone="warn">待审中</Pill>}
          </span>
          <span className="block mt-1 text-[13.5px] text-[color:var(--ink-soft)] line-clamp-2">{entry.description || '该仓库没有填写描述。'}</span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone={entry.verdict === 'adopt' ? 'good' : entry.verdict === 'evaluate' ? 'risk' : 'neutral'}>{entry.verdictLabel}</Pill>
            <span className="text-[11px] text-[color:var(--ink-mute)]">{entry.kind}</span>
            <span className="ff-mono text-[11px] text-[color:var(--ink-mute)]">★ {entry.starsCompact}</span>
            {!entry.license && <span className="ff-mono text-[11px] text-[color:var(--cinnabar)]">无许可证</span>}
          </span>
        </button>
        <div className="col-start-3 md:col-start-auto"><TasteButtons compact value={taste} onTaste={value => onTaste(entry.id, value)} /></div>
      </li>
    );
  }

  function IssueView({ status, hub, taste, onTaste, openEntry, queueSubjects, onRetry }) {
    const [kind, setKind] = useState('all');
    const [query, setQuery] = useState('');
    const [showSkipped, setShowSkipped] = useState(false);
    const [limit, setLimit] = useState(PAGE_SIZE);

    const lovedCount = Object.values(taste).filter(value => value === 'love').length;
    const skippedCount = Object.values(taste).filter(value => value === 'skip').length;

    const filtered = useMemo(() => {
      if (!hub) return [];
      const q = query.trim().toLowerCase();
      return hub.entries.filter(entry => {
        if (kind !== 'all' && entry.kind !== kind) return false;
        if (!showSkipped && taste[entry.id] === 'skip') return false;
        if (!q) return true;
        return [entry.fullName, entry.description, entry.language, ...entry.tags].join(' ').toLowerCase().includes(q);
      });
    }, [hub, kind, query, showSkipped, taste]);

    if (status === 'loading') return <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-10"><SkeletonRows rows={6} /></div>;
    if (status === 'error' || !hub) {
      return <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-10"><StateBlock tone="risk" title="本期候选没能加载" body="data/discoveries.json 读取失败。可能是网络抖动或采集任务尚未产出，请稍后重试。" action="重新加载" onAction={onRetry} /></div>;
    }
    if (!hub.available) {
      return <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-10"><StateBlock title="本期还没有候选" body="采集任务每四小时运行一次，产出后这里会自动出现新一期。" /></div>;
    }

    const kindOptions = [{ value: 'all', label: '全部', count: hub.entries.length }].concat(hub.kinds.map(item => ({ value: item.kind, label: item.kind, count: item.count })));
    const visible = filtered.slice(0, limit);

    return (
      <div className="max-w-[1240px] mx-auto px-5 md:px-10 pb-20">
        <header className="pt-8 md:pt-12 pb-6">
          <Eyebrow>WorkLens · {hub.generatedDate} 期 · 数据更新于 {hub.generatedLabel}</Eyebrow>
          <h1 className="ff-cn mt-3 text-[30px] md:text-[46px] font-black leading-[1.15] tracking-[-0.01em]">
            这一期，<span className="text-[color:var(--cinnabar)]">{hub.stats.adopt}</span> 个值得动手。
          </h1>
        </header>
        <Funnel stats={hub.stats} loved={lovedCount} />

        <section className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] gap-6 lg:gap-10 py-10 border-b border-[color:var(--ink)]">
          <LeadStory entry={hub.lead} taste={taste} onTaste={onTaste} openEntry={openEntry} />
          <div>
            <Eyebrow className="mb-1">同样值得看</Eyebrow>
            {hub.picks.map((entry, index) => <PickRow key={entry.id} entry={entry} index={index} openEntry={openEntry} />)}
          </div>
        </section>

        <section className="pt-10" aria-labelledby="ledger-title">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
            <div>
              <Eyebrow>全部候选</Eyebrow>
              <h2 id="ledger-title" className="ff-cn text-[24px] md:text-[28px] font-semibold mt-1">按优先级排好的 {hub.entries.length} 条</h2>
            </div>
            <label className="relative flex items-center w-full md:w-[320px]">
              <span className="sr-only">搜索候选</span>
              <Icon name="search" className="absolute left-3 text-[color:var(--ink-mute)]" />
              <input value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} placeholder="搜仓库名、描述、语言、话题"
                className="w-full h-11 pl-10 pr-3 bg-[color:var(--paper-raised)] border border-[color:var(--rule)] text-[15px] placeholder:text-[color:var(--ink-mute)] focus:outline-none focus:border-[color:var(--ink)]" />
            </label>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <Segmented label="按类型筛选" options={kindOptions} value={kind} onChange={value => { setKind(value); setLimit(PAGE_SIZE); }} />
            {skippedCount > 0 && (
              <button onClick={() => setShowSkipped(!showSkipped)} className="self-start md:self-auto h-9 text-[13px] text-[color:var(--ink-mute)] underline underline-offset-4 decoration-[color:var(--rule)] hover:text-[color:var(--ink)]">
                {showSkipped ? '隐藏已跳过' : `显示已跳过 · ${skippedCount}`}
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6"><StateBlock title="没有匹配的候选" body="换个关键词，或者回到「全部」看看。" action="清空筛选" onAction={() => { setKind('all'); setQuery(''); }} /></div>
          ) : (
            <ol className="mt-4 border-t border-[color:var(--ink)]">
              {visible.map((entry, index) => (
                <LedgerRow key={entry.id} entry={entry} rank={index + 1} taste={taste[entry.id]} onTaste={onTaste} openEntry={openEntry} inQueue={queueSubjects.has(entry.fullName)} />
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
  function EntryDetail({ entry, hub, taste, onTaste, onClose, openEntry, queueEntry }) {
    const brief = useMemo(() => WL_HUB_ADAPTER.buildRepoBrief(entry), [entry]);
    const related = entry.related.map(id => hub.entries.find(item => item.id === id)).filter(Boolean);
    return (
      <>
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[color:var(--ink)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><PriorityMark priority={entry.priority} /><Eyebrow>{entry.kind} · 30 秒速读</Eyebrow></div>
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

          <h3 className="mt-7 mb-2 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">判断信号</h3>
          <ul>
            {brief.signals.map(signal => (
              <li key={signal.label} className="grid grid-cols-[72px_1fr] gap-3 py-2 border-b border-dashed border-[color:var(--rule)] text-[14px]">
                <Pill tone={signal.tone}>{signal.label}</Pill><span className="text-[color:var(--ink-soft)]">{signal.text}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-7 mb-1 ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)]">评分 · 由公开指标推算</h3>
          <ScoreRow label="匹配度" value={entry.scores.fit} />
          <ScoreRow label="新颖度" value={entry.scores.novelty} />
          <ScoreRow label="引入成本" value={entry.scores.cost} invert />
          <ScoreRow label="风险" value={entry.scores.risk} invert />

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
