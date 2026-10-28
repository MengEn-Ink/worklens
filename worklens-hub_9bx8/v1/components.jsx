/* @jsxRuntime classic */
/* global React, WL_HUB_ADAPTER */
/* WorkLens Hub · 共用组件（导出到 window.WL_UI） */
(function () {
  const { useEffect, useRef } = React;

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
    return (
      <div className="fixed inset-0 z-[2147483100]">
        <div className="scrim absolute inset-0 bg-[rgba(24,21,18,0.42)]" onClick={onClose} />
        <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
          className="sheet absolute bg-[color:var(--paper-raised)] flex flex-col outline-none
            right-0 top-0 bottom-0 w-[min(520px,100%)] border-l border-[color:var(--ink)]
            max-[720px]:top-auto max-[720px]:w-full max-[720px]:max-h-[88vh] max-[720px]:border-l-0 max-[720px]:border-t">
          {children}
        </aside>
      </div>
    );
  }

  window.WL_UI = { Icon, Eyebrow, Pill, PriorityMark, Segmented, ScoreRow, TasteButtons, StateBlock, SkeletonRows, Avatar, Sheet, TONE };
})();
