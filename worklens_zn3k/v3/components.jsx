/* @jsxRuntime classic */
/* global React */
/* ================================================================
   WorkLens v3 · 复用组件（新增 TasteBar / PushDot / SkillCard）
   ---------------------------------------------------------------- */
(function () {
  const { useState, useMemo } = React;

  const I = {
    search: (p) => (
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13.5 13.5l3.5 3.5" strokeLinecap="round" />
      </svg>
    ),
    plus: (p) => (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
        <path d="M8 3v10M3 8h10" strokeLinecap="round" />
      </svg>
    ),
    arrowRight: (p) => (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
        <path d="M4 12h15M14 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    chevron: (p) => (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    external: (p) => (
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
        <path d="M6 3H3v10h10v-3M10 3h3v3M8 8l5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    rss: (p) => (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
        <path d="M3 3a10 10 0 0 1 10 10M3 8a5 5 0 0 1 5 5" strokeLinecap="round" />
        <circle cx="3.5" cy="12.5" r="1" fill="currentColor" />
      </svg>
    ),
    gh: (p) => (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" {...p}>
        <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.07.5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.06-.5.06-.5.8.06 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.07-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.08-.2-.4-1 .08-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0C11 3 11.8 3.2 11.8 3.2c.5 1.1.2 2 .1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.7 4 .3.3.6.8.6 1.6v2.3c0 .2.1.5.5.4A8 8 0 0 0 8 .2z"/>
      </svg>
    ),
    bookmark: (p) => (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
        <path d="M4 2h8v12l-4-3-4 3V2z" strokeLinejoin="round" />
      </svg>
    ),
    dot: (p) => (
      <svg viewBox="0 0 8 8" width="6" height="6" fill="currentColor" {...p}><circle cx="4" cy="4" r="4" /></svg>
    ),
    sparkle: (p) => (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" {...p}>
        <path d="M8 1v4M8 11v4M1 8h4M11 8h4M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" strokeLinecap="round"/>
      </svg>
    ),
    heart: (filled) => (p) => (
      <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" {...p}>
        <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" strokeLinejoin="round"/>
      </svg>
    ),
    xMark: (p) => (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/>
      </svg>
    ),
    bell: (filled) => (p) => (
      <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" {...p}>
        <path d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3zM10 20a2 2 0 0 0 4 0" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    ),
    chip: (p) => (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
        <rect x="5" y="5" width="14" height="14" rx="2"/>
        <path d="M9 5v-2M15 5v-2M9 21v-2M15 21v-2M5 9h-2M5 15h-2M21 9h-2M21 15h-2M9 9h6v6H9z"/>
      </svg>
    ),
  };

  /* ---------- Verdict Pill ---------- */
  function VerdictPill({ v, size = 'sm' }) {
    const map = {
      adopt:    { label: '引入',   cls: 'v-bg-adopt' },
      evaluate: { label: '评估中', cls: 'v-bg-evaluate' },
      shelf:    { label: '上架',   cls: 'v-bg-shelf' },
      drop:     { label: '下架',   cls: 'v-bg-drop' },
    };
    const m = map[v] || map.shelf;
    const pad = size === 'lg' ? 'px-2.5 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
    return (
      <span className={`${m.cls} ${pad} ff-mono tracking-wider inline-flex items-center gap-1`}>
        <I.dot /> {m.label}
      </span>
    );
  }

  /* ---------- Score Bar ---------- */
  function ScoreBar({ label, value, max = 100, invert = false }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="ff-mono text-[10px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>{label}</span>
          <span className="ff-mono text-[11px]" style={{color: invert ? 'var(--cinnabar-ink)' : 'var(--ink)'}}>{value}</span>
        </div>
        <div className="score-bar">
          <div className="score-bar__fill" style={{ width: pct + '%', background: invert ? 'var(--cinnabar)' : 'var(--ink)' }} />
        </div>
      </div>
    );
  }

  /* ---------- Chip Group ---------- */
  function ChipGroup({ options, value, onChange, multi = false }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = multi ? value.includes(o.id) : value === o.id;
          return (
            <button key={o.id} className={`chip ${on ? 'chip--on' : ''}`} onClick={() => onChange(o.id)}>
              {o.label}{o.count != null && <span className="opacity-60 ml-1">{o.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  /* ---------- Taste Bar · 核心新增 ---------- */
  function TasteBar({ entry, onChange }) {
    /* 内部状态委托给外部 taste map；fallback 到 entry.taste */
    const taste = entry._taste !== undefined ? entry._taste : entry.taste;
    const subscribed = !!entry._subscribed;

    const act = (next) => {
      onChange && onChange(entry.id, { taste: taste === next ? null : next });
    };
    const sub = () => onChange && onChange(entry.id, { subscribed: !subscribed });

    return (
      <div className="taste-bar">
        <button
          className={`taste-btn ${taste === 'love' ? 'taste-btn--on taste-btn--love' : ''}`}
          title="非常喜欢（权重更高）"
          onClick={(e) => { e.stopPropagation(); act('love'); }}
        >
          <HeartHeart />
        </button>
        <button
          className={`taste-btn ${taste === 'like' ? 'taste-btn--on taste-btn--like' : ''}`}
          title="喜欢"
          onClick={(e) => { e.stopPropagation(); act('like'); }}
        >
          {React.createElement(I.heart(taste === 'like' || taste === 'love'))}
        </button>
        <button
          className={`taste-btn ${taste === 'dislike' ? 'taste-btn--on taste-btn--dislike' : ''}`}
          title="不感兴趣（降权）"
          onClick={(e) => { e.stopPropagation(); act('dislike'); }}
        >
          <I.xMark />
        </button>
        <span className="taste-sep" />
        <button
          className={`taste-btn ${subscribed ? 'taste-btn--on taste-btn--sub' : ''}`}
          title="订阅主题 · 持续推送同类"
          onClick={(e) => { e.stopPropagation(); sub(); }}
        >
          {React.createElement(I.bell(subscribed))}
        </button>
      </div>
    );
  }
  function HeartHeart() {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" strokeWidth="1.3">
        <path d="M8 3a3 3 0 0 0-3 3c0 3.5 4 6 4 6s4-2.5 4-6a3 3 0 0 0-3-3 2.6 2.6 0 0 0-2 1 2.6 2.6 0 0 0-2-1z" strokeLinejoin="round"/>
        <path d="M16 11a3 3 0 0 0-3 3c0 3.5 4 6 4 6s4-2.5 4-6a3 3 0 0 0-3-3 2.6 2.6 0 0 0-2 1 2.6 2.6 0 0 0-2-1z" strokeLinejoin="round" opacity="0.75"/>
      </svg>
    );
  }

  /* ---------- Library Card ---------- */
  function LibraryCard({ entry, onOpen, active, onTaste }) {
    const taste = entry._taste !== undefined ? entry._taste : entry.taste;
    return (
      <article
        className={`lib-card lib-card--project p-4 relative ${active ? 'lib-card--active' : ''} ${taste ? 'lib-card--tasted lib-card--tasted-' + taste : ''}`}
        onClick={() => onOpen && onOpen(entry.id)}
      >
        <div
          className={`lib-card__project-cover lib-card__project-cover--${entry.brandBand || 'ink'}`}
          style={entry.ogImageUrl ? {backgroundImage: `linear-gradient(90deg, rgba(20,18,16,.82), rgba(20,18,16,.3)), url("${entry.ogImageUrl}")`} : undefined}
          aria-hidden="true"
        />
        <div className="flex items-center justify-between mb-2.5 relative">
          <span className="dewey-chip">{entry.dewey}</span>
          <VerdictPill v={entry.verdict} />
        </div>

        <div className="lib-card__project-identity">
          {entry.avatarUrl ? <img className="lib-card__project-avatar" src={entry.avatarUrl} alt="" loading="lazy" /> : null}
          <div className="min-w-0">
            <h3 className="ff-serif text-[20px] leading-[1.1] font-semibold mb-1" style={{letterSpacing: '-0.015em'}}>
              {entry.title}
            </h3>
            <div className="flex items-center gap-2 ff-mono text-[10.5px]" style={{color: 'var(--ink-mute)'}}>
              <I.gh /> <span>{entry.author}</span>
              <span className="opacity-50">·</span>
              <span>{entry.source}</span>
            </div>
          </div>
        </div>

        <p className="lib-card__project-summary">
          {entry.sub}
        </p>

        <div className="lib-card__project-signals">
          {entry.language && <span className="project-signal project-signal--language"><i />{entry.language}</span>}
          {entry.tags.slice(0, 3).map((t) => <span key={t} className="project-signal">#{t}</span>)}
          <span className="project-signal project-signal--activity">● {entry.activityLabel || '活跃度未知'}</span>
        </div>

        <hr className="hr-thin my-2.5" />

        <div className="grid grid-cols-4 gap-2 mb-2">
          <ScoreBar label="Fit"     value={entry.scores.fit} />
          <ScoreBar label="Novelty" value={entry.scores.novelty} />
          <ScoreBar label="Cost"    value={entry.scores.cost} invert />
          <ScoreBar label="Risk"    value={entry.scores.risk} invert />
        </div>

        <TasteBar entry={entry} onChange={onTaste} />
      </article>
    );
  }

  /* ---------- Pipeline ---------- */
  function Pipeline({ stages, active, onPick }) {
    return (
      <div className="grid gap-3" style={{gridTemplateColumns: 'repeat(6, 1fr)'}}>
        {stages.map((s, i) => (
          <div key={s.stage} className="relative">
            <div
              className={`pipe-node ${active === s.stage ? 'lib-card--active' : ''}`}
              onClick={() => onPick && onPick(s.stage)}
            >
              <div className="flex items-baseline justify-between">
                <span className="ff-mono text-[10px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{s.hint}</span>
              </div>
              <div className="ff-serif pipe-node__count mt-1.5">{s.count}</div>
              <div className="ff-serif text-[14px] font-semibold mt-0.5" style={{letterSpacing: '-0.01em'}}>
                {s.stage}
                {s.en && <span className="ff-mono text-[10px] ml-1.5" style={{color: 'var(--ink-mute)', fontWeight: 400}}>{s.en}</span>}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="pipe-arrow"><I.arrowRight /></div>
            )}
          </div>
        ))}
      </div>
    );
  }

  /* ---------- Field Notes ---------- */
  function FieldNotes({ notes }) {
    return (
      <div className="scroll-area" style={{maxHeight: 'calc(100vh - 220px)'}}>
        {notes.map((n, i) => (
          <div key={i} className="note-row">
            <span className="note-row__t">{n.time}</span>
            <span className={`note-row__from ${n.from === 'You' ? 'note-row__from--you' : ''}`}>
              — {n.from === 'You' ? '你' : n.from}
            </span>
            <span className="note-row__text">
              {n.text}
              <span className="tag-pill ml-2 align-middle" style={{fontSize: '9px'}}>{n.tag}</span>
            </span>
          </div>
        ))}
        <div className="pt-3 mt-2 border-t" style={{borderColor: 'var(--rule)'}}>
          <div className="flex items-center gap-2">
            <I.sparkle style={{color: 'var(--cinnabar)'}} />
            <input
              className="flex-1 bg-transparent border-0 outline-none ff-serif italic text-[13px] placeholder:opacity-60"
              placeholder="写下给 Agent 的策展指令…"
              style={{color: 'var(--ink)'}}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Stat ---------- */
  function Stat({ num, label, sub, accent }) {
    return (
      <div>
        <div className="stat-num" style={accent ? {color: 'var(--cinnabar)'} : null}>
          {typeof num === 'number' ? num.toLocaleString() : num}
        </div>
        <div className="stat-label mt-1">{label}</div>
        {sub && <div className="ff-serif italic text-[12px] mt-1" style={{color: 'var(--ink-mute)'}}>{sub}</div>}
      </div>
    );
  }

  function Ornament({ children }) {
    return <div className="ornament my-2">{children || '§ § §'}</div>;
  }

  /* ---------- Skill Card（AI 工程能力） ---------- */
  function SkillCard({ s, onInspect }) {
    const statusMap = {
      live:    { label: 'live',    tone: 'var(--forest)' },
      preview: { label: 'preview', tone: 'var(--mustard)' },
      draft:   { label: 'draft',   tone: 'var(--ink-mute)' },
    };
    const st = statusMap[s.status] || statusMap.draft;
    return (
      <article className="lib-card p-4" onClick={() => onInspect && onInspect(s)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{background: st.tone}} />
            <span className="ff-mono text-[10px] uppercase tracking-widest" style={{color: st.tone}}>{st.label}</span>
            <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>· {s.family}</span>
          </div>
          <span className="ff-mono text-[10.5px]" style={{color: 'var(--ink-mute)'}}>{s.version}</span>
        </div>
        <h4 className="ff-serif text-[22px] font-semibold leading-tight mb-1" style={{letterSpacing: '-0.02em'}}>
          <span className="ff-mono text-[13px]" style={{color: 'var(--cinnabar)'}}>skill:</span>&nbsp;{s.name}
        </h4>
        <p className="ff-serif italic text-[12.5px] mb-3" style={{color: 'var(--ink-mute)'}}>{s.origin}</p>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="stat-label">近 7 天运行</div>
            <div className="ff-serif text-[20px] font-semibold" style={{letterSpacing: '-0.015em'}}>{s.runs_7d}</div>
          </div>
          <div>
            <div className="stat-label">单次节省</div>
            <div className="ff-serif text-[20px] font-semibold" style={{letterSpacing: '-0.015em'}}>{s.saves_per_run}</div>
          </div>
          <div>
            <div className="stat-label">置信度</div>
            <div className="ff-serif text-[20px] font-semibold" style={{letterSpacing: '-0.015em'}}>{Math.round(s.confidence*100)}%</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {s.skills_vector.map(k => <span key={k} className="tag-pill tag-pill--filled">#{k}</span>)}
        </div>

        <div className="sidenote text-[12.5px]">
          <span className="ff-mono text-[9.5px] uppercase tracking-widest mr-2" style={{color: 'var(--cinnabar)'}}>最近改进</span>
          {s.recent_improvement}
        </div>

        <div className="flex items-center justify-between mt-3 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
          <span>上次运行 · {s.last_run}</span>
          <span className="ulink">查看日志</span>
        </div>
      </article>
    );
  }

  /* ---------- Push Row ---------- */
  function PushRow({ p, onAct }) {
    return (
      <article className={`lib-card p-3.5 ${p.read ? '' : 'lib-card--active'}`}>
        <div className="flex items-center gap-3">
          <span className={`push-dot ${p.read ? '' : 'push-dot--new'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="ff-mono text-[10px]" style={{color: 'var(--cinnabar)'}}>{p.time}</span>
              <span className="tag-pill tag-pill--filled">{p.topic}</span>
              <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>Fit {p.score}</span>
              {p.downgrading && <span className="tag-pill" style={{color: 'var(--cinnabar)'}}>趋势下降</span>}
            </div>
            <h4 className="ff-serif text-[17px] font-semibold mt-1 mb-0.5" style={{letterSpacing: '-0.015em'}}>
              {p.title}
            </h4>
            <div className="flex items-center gap-2 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
              <span>{p.from}</span>
              <span>·</span>
              <span className="ff-serif italic" style={{color: 'var(--ink-soft)'}}>{p.reason}</span>
            </div>
          </div>
          <VerdictPill v={p.verdict} />
          <button className="btn btn--ghost" onClick={() => onAct && onAct(p.id, 'open')}>打开 <I.arrowRight /></button>
        </div>
      </article>
    );
  }

  window.WL_COMP = {
    I, VerdictPill, ScoreBar, ChipGroup, LibraryCard, Pipeline, FieldNotes, Stat, Ornament,
    TasteBar, SkillCard, PushRow,
  };
})();
