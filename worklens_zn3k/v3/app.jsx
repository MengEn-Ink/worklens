/* @jsxRuntime classic */
/* global React, ReactDOM, fetch */
/* ================================================================
   WorkLens v3 · 入口
   新增：喜好态管理 · §08 技能工坊 · §09 推送中心 · 点击 ❤ 的落点动画
   ---------------------------------------------------------------- */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

function App() {
  const V = window.WL_VIEWS;
  const C = window.WL_COMP;
  const D = window.WL_DATA;

  const [route, setRoute] = useState({ view: 'hero', entryId: null });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);

  /* ---- Taste 全局态：{ [entryId]: { taste, subscribed } } ---- */
  const initialTaste = useMemo(() => {
    const m = {};
    D.ENTRIES.forEach(e => {
      if (e.taste) m[e.id] = { taste: e.taste, subscribed: false };
    });
    return m;
  }, [D.ENTRIES]);
  const [taste, setTaste] = useState(initialTaste);

  /* ---- 订阅主题（可本地切换 muted） ---- */
  const [subscriptions, setSubscriptions] = useState(D.TASTE_SUBSCRIPTIONS);
  const [acceptedProposals, setAcceptedProposals] = useState([]);

  useEffect(() => {
    let alive = true;
    const candidateUrls = ['../data/discoveries.json', './data/discoveries.json', '../../data/discoveries.json'];
    const skillQueueUrls = ['../data/skill-review-queue.json', './data/skill-review-queue.json', '../../data/skill-review-queue.json'];

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
      if (!alive) return;
      const nextData = window.WL_DISCOVERY_ADAPTER.buildPcData(D, discoveries, skillQueue);
      Object.assign(D, nextData);
      const nextTaste = {};
      D.ENTRIES.forEach(entry => {
        if (entry.taste) nextTaste[entry.id] = { taste: entry.taste, subscribed: false };
      });
      setTaste(nextTaste);
      setSubscriptions(D.TASTE_SUBSCRIPTIONS || []);
      setAcceptedProposals([]);
      setDataRevision(revision => revision + 1);
    }

    loadDiscoveries();
    return () => { alive = false; };
  }, [D]);

  /* ---- Toast 浮层：显示 "+Δweight" ---- */
  const [toasts, setToasts] = useState([]);  // {id, x, y, text}
  const toastId = useRef(0);

  const onTaste = useCallback((entryId, patch) => {
    setTaste(prev => {
      const cur = prev[entryId] || { taste: null, subscribed: false };
      const next = Object.assign({}, cur, patch);
      /* 触发 toast */
      let text = null;
      if ('taste' in patch) {
        if (patch.taste === 'love') text = '+0.10  love';
        else if (patch.taste === 'like') text = '+0.05  like';
        else if (patch.taste === 'dislike') text = '−0.08  skip';
        else if (patch.taste === null) text = '− reset';
      }
      if ('subscribed' in patch) {
        text = patch.subscribed ? '＋ 订阅主题' : '－ 取消订阅';
      }
      if (text) {
        const e = window.event;
        const x = e && e.clientX ? e.clientX : window.innerWidth / 2;
        const y = e && e.clientY ? e.clientY : window.innerHeight / 2;
        const id = ++toastId.current;
        setToasts(ts => [...ts, { id, x, y, text }]);
        setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 1100);
      }
      return Object.assign({}, prev, { [entryId]: next });
    });
  }, []);

  const onToggleSub = useCallback((id) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? Object.assign({}, s, { muted: !s.muted }) : s));
  }, []);
  const onAcceptProposal = useCallback((id) => {
    setAcceptedProposals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const nav = [
    { id: 'hero',     no: '01', label: '本期策展',  sub: '本期精选' },
    { id: 'pipeline', no: '02', label: '发现管道',  sub: '筛选过程' },
    { id: 'shelf',    no: '03', label: '藏书架',    sub: '项目资料库' },
    { id: 'reader',   no: '04', label: '深度阅读',  sub: '项目详解' },
    { id: 'routes',   no: '05', label: '学习路径',  sub: '行动路线' },
    { id: 'loop',     no: '06', label: '引入复盘',  sub: '使用复盘' },
    { id: 'profile',  no: '07', label: '工作画像',  sub: '偏好画像' },
    { id: 'studio',   no: '08', label: '技能工坊',  sub: '技能工坊 · 新', badge: D.SKILL_PROPOSALS.length },
    { id: 'push',     no: '09', label: '推送中心',  sub: '主动推荐 · 新', badge: D.PUSHES.filter(p => !p.read).length },
  ];

  const goto = useCallback((view, entryId) => {
    setRoute({ view, entryId: entryId || null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const openEntry = useCallback((entryId) => {
    setRoute({ view: 'reader', entryId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v); }
      if (e.key === 'Escape') { setCmdOpen(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* 下次合刊：每周三 09:00（本地时区），每 30 秒刷新倒计时文本。 */
  const computeNextIssue = useCallback(() => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 0, 0, 0);
    const delta = (3 - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + delta);
    if (target <= now) target.setDate(target.getDate() + 7);
    const totalMin = Math.max(0, Math.floor((target - now) / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return d > 0 ? `${d} 天 ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}`;
  }, []);
  const [nextIssueCountdown, setNextIssueCountdown] = useState(computeNextIssue);
  useEffect(() => {
    const timer = setInterval(() => setNextIssueCountdown(computeNextIssue()), 30000);
    return () => clearInterval(timer);
  }, [computeNextIssue]);

  const Current = useMemo(() => {
    void dataRevision;
    switch (route.view) {
      case 'hero':     return <V.HeroView     goto={goto} openEntry={openEntry} taste={taste} onTaste={onTaste} />;
      case 'pipeline': return <V.PipelineView taste={taste} onTaste={onTaste} />;
      case 'shelf':    return <V.ShelfView    openEntry={openEntry} taste={taste} onTaste={onTaste} />;
      case 'reader':   return <V.ReaderView   entryId={route.entryId || (D.ENTRIES[0] && D.ENTRIES[0].id)} openEntry={openEntry} goto={goto} taste={taste} onTaste={onTaste} />;
      case 'routes':   return <V.RoutesView   openEntry={openEntry} />;
      case 'loop':     return <V.LoopView />;
      case 'profile':  return <V.ProfileView />;
      case 'studio':   return <V.StudioView   subscriptions={subscriptions} onToggleSub={onToggleSub}
                                              onAcceptProposal={onAcceptProposal} acceptedProposals={acceptedProposals} />;
      case 'push':     return <V.PushView     goto={goto} openEntry={openEntry} />;
      default:         return <V.HeroView     goto={goto} openEntry={openEntry} taste={taste} onTaste={onTaste} />;
    }
  }, [route, V, goto, openEntry, taste, onTaste, subscriptions, acceptedProposals, onToggleSub, onAcceptProposal, dataRevision, D.ENTRIES]);

  return (
    <div className="w-full min-h-screen flex wl-desktop-shell" data-data-revision={dataRevision} style={{background: 'var(--paper)'}}>

      {/* 左侧目录 */}
      <aside className="flex-shrink-0 flex flex-col wl-side"
             style={{width: '248px', background: 'var(--paper-warm)',
                     borderRight: '1px solid var(--rule)',
                     position: 'sticky', top: 0, height: '100vh'}}>

        <div className="px-5 pt-6 pb-4 border-b" style={{borderColor: 'var(--rule)'}}>
          <div className="flex items-baseline gap-2">
            <div className="ff-serif font-bold text-[26px]" style={{letterSpacing: '-0.03em'}}>WorkLens</div>
            <span className="ff-mono text-[9px] uppercase tracking-[0.3em] pb-0.5" style={{color: 'var(--cinnabar)'}}>β·v3</span>
          </div>
          <div className="ff-serif italic text-[12px] mt-0.5" style={{color: 'var(--ink-mute)'}}>
            写给 Agent 时代工作者的田野杂志
          </div>
          <div className="ff-mono text-[9.5px] uppercase tracking-widest mt-3" style={{color: 'var(--ink-mute)'}}>
            {D.ISSUE.volume} · {D.ISSUE.issue}
          </div>
        </div>

        <div className="px-5 py-3 border-b" style={{borderColor: 'var(--rule)'}}>
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center justify-between gap-2 py-1.5 px-2 border transition-colors"
            style={{borderColor: 'var(--rule)', background: 'var(--parchment)'}}
          >
            <span className="flex items-center gap-2 ff-mono text-[11px]" style={{color: 'var(--ink-mute)'}}>
              <C.I.search /> 搜索藏书架…
            </span>
            <span className="ff-mono text-[9.5px] px-1 border rounded-sm" style={{borderColor: 'var(--rule)', color: 'var(--ink-mute)'}}>
              ⌘K
            </span>
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto scroll-area">
          <div className="px-5 pb-1 pt-2 ff-mono text-[9.5px] uppercase tracking-[0.25em]" style={{color: 'var(--ink-mute)'}}>
            目次
          </div>
          {nav.map(n => (
            <div
              key={n.id}
              onClick={() => goto(n.id)}
              className={`nav-item ${route.view === n.id ? 'nav-item--active' : ''}`}
            >
              <span className="nav-item__no">{n.no}</span>
              <div className="flex-1">
                <div className="nav-item__label">{n.label}</div>
                <div className="ff-mono text-[10px] mt-0.5" style={{color: 'var(--ink-mute)'}}>{n.sub}</div>
              </div>
              {n.badge > 0 && <span className="ff-mono text-[9px] px-1.5 py-0.5"
                                    style={{background: 'var(--cinnabar)', color: 'var(--parchment)', borderRadius: 1}}>
                {n.badge}
              </span>}
              {route.view === n.id && <C.I.chevron />}
            </div>
          ))}

          <hr className="hr-thin mx-5 my-4" />

          <div className="px-5 pb-1 ff-mono text-[9.5px] uppercase tracking-[0.25em]" style={{color: 'var(--ink-mute)'}}>
            书架
          </div>
          <div className="px-5 py-2 space-y-1.5">
            {D.SHELVES.map(sh => (
              <div key={`${sh.code}-${sh.name}`} className="flex items-baseline gap-2 cursor-pointer group" onClick={() => goto('shelf')}>
                <span className="ff-mono text-[10px]" style={{color: 'var(--cinnabar)'}}>{sh.code}</span>
                <span className="ff-serif text-[13px] flex-1 group-hover:text-[var(--cinnabar)]" style={{letterSpacing: '-0.01em'}}>
                  {sh.name}
                </span>
                <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{sh.count}</span>
              </div>
            ))}
          </div>
        </nav>

        <div className="px-5 py-3 border-t" style={{borderColor: 'var(--rule)'}}>
          <div className="flex items-center gap-2 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
            <span className="w-1.5 h-1.5 rounded-full" style={{background: 'var(--forest)'}} />
            Agent 在线 · Taste 账本 {Object.values(taste).filter(t => t.taste === 'love' || t.taste === 'like').length} 条
          </div>
          <div className="ff-serif italic text-[11.5px] mt-0.5" style={{color: 'var(--ink-mute)'}}>
            下次合刊 {nextIssueCountdown}
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 min-w-0 relative wl-main">
        <div className="max-w-[1240px] mx-auto px-10 pb-16">
          {Current}

          <footer className="mt-16 pt-8 border-t" style={{borderColor: 'var(--rule-strong)'}}>
            <div className="ornament">—— 版权页 ——</div>
            <div className="grid grid-cols-3 gap-10 mt-6 ff-serif text-[12.5px]" style={{color: 'var(--ink-mute)'}}>
              <div>
                <div className="ff-mono text-[9.5px] uppercase tracking-widest mb-1" style={{color: 'var(--ink)'}}>编辑部</div>
                WorkLens 是为单一读者私人出版的周刊；由其研究 Agent 策展编辑。
                字体选用 Fraunces、Inter、JetBrains Mono。印在没有纸的地方。
              </div>
              <div>
                <div className="ff-mono text-[9.5px] uppercase tracking-widest mb-1" style={{color: 'var(--ink)'}}>信息源</div>
                本期从 `data/discoveries.json` 读取 {D.ISSUE.stats.scanned.toLocaleString()} 条公开 GitHub 候选，
                当前展示 {D.ISSUE.stats.curated} 条；来源成功与失败都会保留为状态证据。
              </div>
              <div>
                <div className="ff-mono text-[9.5px] uppercase tracking-widest mb-1" style={{color: 'var(--ink)'}}>节奏</div>
                每周三 09:00 新一期合刊；重大发现以号外推送；所有引入物在 D+30 复盘。
                喜好信号实时注入画像。
              </div>
            </div>
          </footer>
        </div>
      </main>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} openEntry={openEntry} goto={goto} />}

      {/* Taste Toast */}
      {toasts.map(t => (
        <div key={t.id} className="taste-toast" style={{left: t.x, top: t.y}}>{t.text}</div>
      ))}
    </div>
  );
}

function CommandPalette({ onClose, openEntry, goto }) {
  const D = window.WL_DATA;
  const C = window.WL_COMP;
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const matches = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) {
      return D.ENTRIES.slice(0, 5);
    }
    return D.ENTRIES.filter(e =>
      (e.title + ' ' + e.sub + ' ' + e.tags.join(' ') + ' ' + e.dewey).toLowerCase().includes(k)
    ).slice(0, 8);
  }, [q]);

  const quickNav = [
    { id: 'hero',     label: '跳转 · 本期策展' },
    { id: 'studio',   label: '跳转 · 技能工坊（Agent 建议 ' + D.SKILL_PROPOSALS.length + '）' },
    { id: 'push',     label: '跳转 · 推送中心' },
    { id: 'shelf',    label: '跳转 · 藏书架' },
    { id: 'profile',  label: '跳转 · 工作画像' },
    { id: 'routes',   label: '跳转 · 学习路径' },
    { id: 'loop',     label: '跳转 · 引入复盘' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
         style={{background: 'rgba(20,18,16,0.35)'}}
         onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] lib-card anim-in" onClick={e => e.stopPropagation()}
           style={{background: 'var(--parchment)', boxShadow: 'var(--sh-lg)'}}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{borderColor: 'var(--rule)'}}>
          <C.I.search style={{color: 'var(--ink-mute)'}} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索条目 · 编号 · 标签 · 作者…"
            className="flex-1 bg-transparent border-0 outline-none ff-serif text-[16px]"
            style={{color: 'var(--ink)'}}
          />
          <span className="ff-mono text-[9.5px] px-1 border rounded-sm" style={{borderColor: 'var(--rule)', color: 'var(--ink-mute)'}}>ESC</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto scroll-area">
          {!q && (
            <div className="px-4 pt-3 pb-1 ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
              快捷跳转
            </div>
          )}
          {!q && quickNav.map(n => (
            <div
              key={n.id}
              onClick={() => { goto(n.id); onClose(); }}
              className="px-4 py-2 cursor-pointer flex items-center justify-between hover:bg-[var(--paper-warm)]"
            >
              <span className="ff-serif text-[14px]">{n.label}</span>
              <C.I.arrowRight style={{color: 'var(--ink-mute)'}} />
            </div>
          ))}

          <div className="px-4 pt-3 pb-1 ff-mono text-[9.5px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
            条目 · {matches.length}
          </div>
          {matches.map(e => (
            <div
              key={e.id}
              onClick={() => { openEntry(e.id); onClose(); }}
              className="px-4 py-2.5 cursor-pointer hover:bg-[var(--paper-warm)] border-b"
              style={{borderColor: 'var(--rule)'}}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="dewey-chip">{e.dewey}</span>
                <span className="ff-serif text-[15px] font-semibold" style={{letterSpacing: '-0.01em'}}>{e.title}</span>
                <span className="ml-auto"><C.VerdictPill v={e.verdict} /></span>
              </div>
              <div className="ff-serif italic text-[12px]" style={{color: 'var(--ink-mute)'}}>{e.sub}</div>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="px-4 py-6 text-center ff-serif italic text-[14px]" style={{color: 'var(--ink-mute)'}}>
              没有命中 ——  要不要让 Agent 去外部信息源抓一轮？
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
