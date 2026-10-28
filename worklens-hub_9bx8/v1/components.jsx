/* @jsxRuntime classic */
/* global React, ReactDOM, WL_HUB_ADAPTER */
/* WorkLens Hub · 共用组件（导出到 window.WL_UI） */
(function () {
  const { useEffect, useRef, useState } = React;

  const ICONS = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M20 14v6H4V4h6" /></>,
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    skip: <><circle cx="12" cy="12" r="8" /><path d="m8.5 15.5 7-7" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    star: <path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2 8 13.7 4 9.8 9.5 9z" />,
    shield: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    fork: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="12" cy="19" r="2" /><path d="M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5" /></>,
    issue: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
    device: <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></>,
  };

  function Icon({ name, size = 16, filled = false, className = '' }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}
        fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name]}
      </svg>
    );
  }

  function Eyebrow({ children, className = '' }) {
    return <div className={`ff-mono text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-mute)] ${className}`}>{children}</div>;
  }

  const TONE = {
    good: 'text-[color:var(--forest)] bg-[color:var(--forest-wash)]',
    warn: 'text-[color:var(--mustard)] bg-[color:var(--mustard-wash)]',
    risk: 'text-[color:var(--cinnabar)] bg-[color:var(--cinnabar-wash)]',
    neutral: 'text-[color:var(--ink-soft)] bg-[color:var(--paper-sunk)]',
  };

  function Pill({ tone = 'neutral', children, className = '' }) {
    return <span className={`inline-flex items-center gap-1 px-2 py-[1px] text-[11px] font-medium whitespace-nowrap ${TONE[tone] || TONE.neutral} ${className}`}>{children}</span>;
  }

  function PriorityMark({ priority }) {
    if (!priority) return null;
    const cls = priority === 'P0'
      ? 'border-[color:var(--cinnabar)] text-[color:var(--cinnabar)]'
      : priority === 'P1' ? 'border-[color:var(--forest)] text-[color:var(--forest)]' : 'border-[color:var(--rule)] text-[color:var(--ink-mute)]';
    return <span className={`ff-mono text-[10px] font-semibold tracking-[0.08em] border px-1.5 leading-[18px] ${cls}`}>{priority}</span>;
  }

  /* 分段筛选：功能性 segmented control，横向可滚动 */
  function Segmented({ options, value, onChange, label }) {
    return (
      <div role="tablist" aria-label={label} className="no-scrollbar flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {options.map(option => {
          const active = option.value === value;
          return (
            <button key={option.value} role="tab" aria-selected={active} onClick={() => onChange(option.value)}
              className={`min-h-[36px] shrink-0 px-3 text-[13px] border transition-colors ${active
                ? 'bg-[color:var(--ink)] text-[color:var(--paper-raised)] border-[color:var(--ink)]'
                : 'border-[color:var(--rule)] text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-sunk)]'}`}>
              {option.label}
              {option.count != null && <span className={`ff-mono ml-1.5 text-[10.5px] ${active ? 'opacity-70' : 'text-[color:var(--ink-mute)]'}`}>{option.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  function ScoreRow({ label, value, invert }) {
    const width = Math.max(4, Math.min(100, value));
    const strong = invert ? value >= 50 : value >= 75;
    return (
      <div className="grid grid-cols-[64px_1fr_28px] items-center gap-3 py-1.5">
        <span className="text-[12px] text-[color:var(--ink-mute)]">{label}</span>
        <span className="h-[5px] bg-[color:var(--paper-sunk)] overflow-hidden">
          <span className={`block h-full ${strong ? (invert ? 'bg-[color:var(--cinnabar)]' : 'bg-[color:var(--forest)]') : 'bg-[color:var(--ink-mute)]'}`} style={{ width: `${width}%` }} />
        </span>
        <span className="ff-mono text-[11px] text-right">{value}</span>
      </div>
    );
  }

  function TasteButtons({ value, onTaste, compact = false }) {
    const size = compact ? 'w-10 h-10' : 'h-11 px-4';
    return (
      <div className="flex gap-2">
        <button type="button" aria-pressed={value === 'love'} aria-label={value === 'love' ? '取消喜欢' : '喜欢'}
          onClick={event => { event.stopPropagation(); onTaste(value === 'love' ? null : 'love'); }}
          className={`${size} inline-flex items-center justify-center gap-2 border transition-colors ${value === 'love'
            ? 'bg-[color:var(--cinnabar)] border-[color:var(--cinnabar)] text-[color:var(--paper-raised)]'
            : 'border-[color:var(--rule)] text-[color:var(--ink-soft)] hover:border-[color:var(--cinnabar)] hover:text-[color:var(--cinnabar)]'}`}>
          <Icon name="heart" filled={value === 'love'} />{!compact && <span className="text-[13px]">喜欢</span>}
        </button>
        <button type="button" aria-pressed={value === 'skip'} aria-label={value === 'skip' ? '撤销跳过' : '跳过'}
          onClick={event => { event.stopPropagation(); onTaste(value === 'skip' ? null : 'skip'); }}
          className={`${size} inline-flex items-center justify-center gap-2 border transition-colors ${value === 'skip'
            ? 'bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--paper-raised)]'
            : 'border-[color:var(--rule)] text-[color:var(--ink-soft)] hover:border-[color:var(--ink)]'}`}>
          <Icon name="skip" />{!compact && <span className="text-[13px]">{value === 'skip' ? '已跳过' : '跳过'}</span>}
        </button>
      </div>
    );
  }

  function StateBlock({ title, body, action, onAction, tone = 'neutral' }) {
    return (
      <div className="py-16 px-6 text-center border-y border-dashed border-[color:var(--rule)]">
        <div className={`ff-cn text-[22px] font-semibold ${tone === 'risk' ? 'text-[color:var(--cinnabar)]' : ''}`}>{title}</div>
        {body && <p className="mt-2 mx-auto max-w-md text-[14px] text-[color:var(--ink-mute)]">{body}</p>}
        {action && (
          <button onClick={onAction} className="mt-5 inline-flex items-center gap-2 h-11 px-5 bg-[color:var(--ink)] text-[color:var(--paper-raised)] text-[14px]">
            <Icon name="refresh" />{action}
          </button>
        )}
      </div>
    );
  }

  function SkeletonRows({ rows = 5 }) {
    return (
      <div aria-busy="true" aria-label="加载中" className="space-y-4 py-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid grid-cols-[40px_1fr] gap-4">
            <div className="skeleton w-10 h-10" />
            <div className="space-y-2"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-3 w-4/5" /></div>
          </div>
        ))}
      </div>
    );
  }

  function Avatar({ src, label, size = 40 }) {
    return (
      <img src={src} alt="" width={size} height={size} loading="lazy"
        className="shrink-0 bg-[color:var(--paper-sunk)] border border-[color:var(--rule-soft)] object-cover grayscale-[35%]"
        style={{ width: size, height: size }}
        onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
        title={label} />
    );
  }

  /* 侧边详情：PC 右侧抽屉，手机底部 sheet。Esc 关闭并还原焦点。 */
  function Sheet({ open, onClose, label, children }) {
    const panel = useRef(null);
    useEffect(() => {
      if (!open) return undefined;
      const previous = document.activeElement;
      const onKey = event => { if (event.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      if (panel.current) panel.current.focus();
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
        if (previous && previous.focus) previous.focus();
      };
    }, [open, onClose]);
    if (!open) return null;
    // 挂到 body：#root 自带层叠上下文（z-index:1），否则抽屉会被顶部导航压住。
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[2147483100]">
        <div className="scrim absolute inset-0 bg-[rgba(24,21,18,0.42)]" onClick={onClose} />
        <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
          className="sheet absolute bg-[color:var(--paper-raised)] flex flex-col outline-none
            right-0 top-0 bottom-0 w-[min(520px,100%)] border-l border-[color:var(--ink)]
            max-[720px]:top-auto max-[720px]:w-full max-[720px]:max-h-[88vh] max-[720px]:border-l-0 max-[720px]:border-t">
          {children}
        </aside>
      </div>,
      document.body
    );
  }

  /* ================= 仓库卡片指标（实测数字 + 示意图形） ================= */
  const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 进入视口才开始动画：长列表滚动时逐条「画」出来，而不是首屏一次播完。 */
  function useInView() {
    const ref = useRef(null);
    const [seen, setSeen] = useState(false);
    useEffect(() => {
      const node = ref.current;
      if (!node || seen) return undefined;
      if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
      const io = new IntersectionObserver(items => {
        if (items.some(item => item.isIntersecting)) { setSeen(true); io.disconnect(); }
      }, { rootMargin: '0px 0px -8% 0px' });
      io.observe(node);
      return () => io.disconnect();
    }, [seen]);
    return [ref, seen];
  }

  function CountUp({ value, run = true, format }) {
    const [display, setDisplay] = useState(run && !reduceMotion() ? 0 : value);
    useEffect(() => {
      if (!run) return undefined;
      if (reduceMotion()) { setDisplay(value); return undefined; }
      const startedAt = performance.now();
      let frame;
      const tick = now => {
        const progress = Math.min(1, (now - startedAt) / 800);
        setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, [value, run]);
    return <>{format ? format(display) : display.toLocaleString()}</>;
  }

  /* 签名细节：推演段画成虚线（灰），只有末点是实测值（朱砂实心点 + 呼吸光圈）。
     一眼就能看出「只有这一点是真的」。 */
  function RepoSparkline({ data, width = 132, height = 30, run = true }) {
    const series = Array.isArray(data) && data.length ? data : [0];
    const min = Math.min(...series);
    const range = Math.max(1, Math.max(...series) - min);
    const pts = series.map((value, index) => [
      (index * (width - 4)) / Math.max(1, series.length - 1) + 2,
      height - 3 - ((value - min) / range) * (height - 8),
    ]);
    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const [ex, ey] = pts[pts.length - 1];
    const area = `2,${height} ${line} ${ex.toFixed(1)},${height}`;
    return (
      <svg className={`spark ${run ? 'is-run' : ''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`}
        role="img" aria-label="Stars 趋势示意：仅末点为真实星标，前 11 个点由当前值推演，非真实历史数据">
        <polygon className="spark__area" points={area} />
        <polyline className="spark__line" points={line} fill="none" />
        <circle className="spark__halo" cx={ex} cy={ey} r="5" />
        <circle className="spark__dot" cx={ex} cy={ey} r="2.4" />
      </svg>
    );
  }

  function RepoHeat({ levels, run = true }) {
    return (
      <span className={`heat ${run ? 'is-run' : ''}`} role="img" aria-label="活跃度示意：由当前 forks 与 open issues 派生，非真实事件统计">
        {levels.map((level, index) => <i key={index} data-l={level} style={{ animationDelay: `${120 + index * 60}ms` }} />)}
      </span>
    );
  }

  const fmt = n => WL_HUB_ADAPTER.formatCompact(n);

  /* variant: 'row'（台账紧凑）| 'lead'（头条）| 'detail'（速读，带逐项解释） */
  function RepoMetrics({ metrics, variant = 'row' }) {
    const [ref, seen] = useInView();
    if (!metrics) return null;
    const nums = [
      { key: 'stars', label: 'Stars', value: metrics.stars, icon: 'star', hot: true, help: '收藏数：有多少人觉得值得留着看。代表关注度，不代表质量。' },
      { key: 'forks', label: 'Forks', value: metrics.forks, icon: 'fork', help: '分叉数：有多少人复制一份去改。越高说明越多人在「动手用」。' },
      { key: 'issues', label: 'Issues', value: metrics.issues, icon: 'issue', help: '未关闭议题：待处理的问题与需求。相对 Stars 过高时说明维护吃紧。' },
    ];
    if (variant === 'row') {
      return (
        <span ref={ref} className="repo-row">
          <span className="repo-row__spark" title="示意曲线：仅末点为当前真实 Stars，前 11 点由当前值推演，非真实历史"><RepoSparkline data={metrics.starTrend} width={96} height={22} run={seen} /></span>
          {nums.map(n => (
            <span key={n.key} className={`repo-row__num ${n.hot ? 'is-hot' : ''}`} title={`${n.label}（实测）· ${n.help}`}>
              <Icon name={n.icon} size={12} /><b className="tabular-nums"><CountUp value={n.value} run={seen} format={fmt} /></b>
            </span>
          ))}
          <span className="repo-row__heat" title="活跃度示意：由 forks 与 open issues 派生，非真实事件统计"><RepoHeat levels={metrics.activityHeat} run={seen} /></span>
        </span>
      );
    }
    const detail = variant === 'detail';
    return (
      <div ref={ref} className={`repo-board ${detail ? 'repo-board--detail' : ''}`}>
        <div className="repo-board__trend">
          <div className="repo-board__head"><span>STARS 走势</span><span className="tag-ill">示意 · 12 点</span></div>
          <RepoSparkline data={metrics.starTrend} width={detail ? 440 : 180} height={detail ? 64 : 38} run={seen} />
          <div className="repo-board__legend"><span><i className="lg-dash" />推演</span><span><i className="lg-dot" />实测 {fmt(metrics.stars)}</span></div>
        </div>
        <div className="repo-board__nums">
          {nums.map(n => (
            <div key={n.key} className={`repo-num ${n.hot ? 'is-hot' : ''}`}>
              <span className="repo-num__label"><Icon name={n.icon} size={12} />{n.label}<span className="tag-real">实测</span></span>
              <b className="repo-num__value tabular-nums"><CountUp value={n.value} run={seen} /></b>
              {detail && <span className="repo-num__help">{n.help}</span>}
            </div>
          ))}
        </div>
        <div className="repo-board__heat">
          <span className="repo-board__head"><span>活跃度</span><span className="tag-ill">示意 · 7 格</span></span>
          <RepoHeat levels={metrics.activityHeat} run={seen} />
        </div>
        {detail && (
          <p className="repo-board__note">
            <b>怎么读：</b>三个数字是采集那一刻从 GitHub API 拿到的<b>实测快照</b>。GitHub 不提供星标历史，所以曲线只有<b>最右端的实心点</b>是真的，左边虚线是按当前 Forks / Issues 推演出的示意弧线；活跃度 7 格同样由 Forks 与 Issues 派生，只用来帮你扫读「冷 / 热」，不要当作真实的周活跃统计。
          </p>
        )}
      </div>
    );
  }

  /* 本机相关徽标：只在本浏览器有喜好后出现 */
  function LocalBadge({ rel, showScore = true }) {
    if (!rel || !rel.ready || rel.level === 'none' || rel.level === 'skipped') return null;
    const tone = rel.level === 'loved' || rel.level === 'high' ? 'is-high' : rel.level === 'mid' ? 'is-mid' : 'is-low';
    return (
      <span className={`local-badge ${tone}`} title={`本机相关：根据你在本浏览器里的 ♥ / 跳过计算。${rel.reasons.map(r => r.text).join('；')}`}>
        <Icon name="device" size={12} />本机 · {rel.label}{showScore && rel.level !== 'loved' ? <b className="ff-mono">{rel.score}</b> : null}
      </span>
    );
  }

  /* 可展开的解释：小 ⓘ 按钮，点开出现一段说明（键盘可达，不依赖 hover） */
  function Explain({ title = '这是什么？', children, className = '' }) {
    return (
      <details className={`explain ${className}`}>
        <summary className="explain__btn"><Icon name="info" size={13} /><span>{title}</span></summary>
        <div className="explain__body">{children}</div>
      </details>
    );
  }

  window.WL_UI = { Icon, Eyebrow, Pill, PriorityMark, Segmented, ScoreRow, TasteButtons, StateBlock, SkeletonRows, Avatar, Sheet, TONE, CountUp, RepoSparkline, RepoMetrics, LocalBadge, Explain };
})();
