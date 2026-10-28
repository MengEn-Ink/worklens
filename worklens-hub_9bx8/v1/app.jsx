/* @jsxRuntime classic */
/* global React, ReactDOM, WL_UI, WL_VIEWS, WL_HUB_ADAPTER, WL_ATELIER_MODEL, WL_REVIEW_MODEL */
/* WorkLens Hub 入口：本期 / 待审 / 我的 三个视图共用一次数据加载与一个详情抽屉。 */
const { useCallback, useEffect, useMemo, useState } = React;
const { Icon, Eyebrow, Pill, StateBlock, Sheet } = WL_UI;
const { IssueView, EntryDetail, ReviewView } = WL_VIEWS;

const VIEWS = ['issue', 'review', 'me'];
const TASTE_KEY = 'worklens.taste.v1';
const DATA_FILES = {
  discoveries: 'discoveries.json',
  queue: 'skill-review-queue.json',
  adoptions: 'skill-adoptions.json',
  profile: 'profile.json',
  profileSignals: 'profile-signals.json',
  circle: 'core-circle.json',
  candidates: 'core-circle-candidates.json',
  ideas: 'idea-pipeline.json',
  reviews: 'recommendation-reviews.json',
  health: 'health-checks.json',
};
// Pages 发布在站点根（./data/）；源码目录直接预览时数据在仓库根（../../data/）。
const DATA_BASES = ['./data/', '../../data/'];

async function loadJson(file) {
  for (const base of DATA_BASES) {
    try {
      const response = await fetch(base + file, { cache: 'no-cache' });
      if (response.ok) return await response.json();
    } catch (error) { /* 尝试下一个路径 */ }
  }
  return null;
}

function parseHash() {
  const [view, id] = (window.location.hash || '').replace(/^#\/?/, '').split('/');
  return { view: VIEWS.includes(view) ? view : 'issue', id: id ? decodeURIComponent(id) : '' };
}

function readTaste() {
  try { return JSON.parse(window.localStorage.getItem(TASTE_KEY) || '{}') || {}; } catch (error) { return {}; }
}

/* ============================== 我的 ============================== */
/* 本机口味画像：把 buildLocalProfile 学到的权重摊开给用户看 */
function LocalPortrait({ profile }) {
  const top = (map, n) => Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  const rows = [
    ['话题', top(profile.topic, 6).map(([k, v]) => [`#${k}`, v])],
    ['类型', top(profile.kind, 3)],
    ['语言', top(profile.language, 3)],
    ['作者', top(profile.owner, 3)],
  ].filter(([, items]) => items.length);
  return (
    <div className="mt-4 p-4 border border-[color:var(--rule)] bg-[color:var(--paper-raised)]">
      <div className="flex items-center gap-2 text-[13px] font-medium"><Icon name="device" size={14} />本机口味画像{profile.ready ? '' : ' · 尚未启用'}</div>
      {profile.ready ? (
        <dl className="mt-2 grid grid-cols-[44px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {rows.map(([label, items]) => (
            <React.Fragment key={label}>
              <dt className="text-[color:var(--ink-mute)]">{label}</dt>
              <dd className="flex flex-wrap gap-1.5">{items.map(([k, v]) => <span key={k} className={`ff-mono text-[11.5px] px-1.5 ${v > 0 ? 'bg-[color:var(--cinnabar-wash)] text-[color:var(--cinnabar)]' : 'bg-[color:var(--paper-sunk)] text-[color:var(--ink-mute)] line-through'}`}>{k} {v > 0 ? `+${Math.round(v * 10) / 10}` : Math.round(v * 10) / 10}</span>)}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-[13px] text-[color:var(--ink-mute)]">在「本期」点 ♥ 后，这里会显示从你喜欢的项目里学到的话题、类型、语言与作者权重。</p>
      )}
      <p className="mt-3 text-[12px] leading-[1.6] text-[color:var(--ink-mute)]">「本机相关」= 用这份画像给本期每个候选在本机打分。只读写本浏览器的 localStorage（键名 worklens.taste.v1），不上传服务器、不读取设备文件；换设备或清空浏览器数据后从零开始。</p>
    </div>
  );
}

function TasteLedger({ hub, taste, onTaste, openEntry, onClear, localProfile }) {
  const [tab, setTab] = useState('love');
  const ids = Object.keys(taste).filter(id => taste[id] === tab);
  const entries = hub ? ids.map(id => hub.entries.find(entry => entry.id === id)).filter(Boolean) : [];
  const loved = Object.values(taste).filter(value => value === 'love').length;
  const skipped = Object.values(taste).filter(value => value === 'skip').length;
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div><Eyebrow>喜好账本 · 仅存于本浏览器</Eyebrow><h2 className="ff-cn text-[24px] font-semibold mt-1">你的口味</h2></div>
        {loved + skipped > 0 && <button onClick={onClear} className="h-9 text-[13px] text-[color:var(--ink-mute)] underline underline-offset-4 hover:text-[color:var(--cinnabar)]">清空本地喜好</button>}
      </div>
      {localProfile && <LocalPortrait profile={localProfile} />}
      <div role="tablist" aria-label="喜好分类" className="mt-5 flex gap-6 border-b border-[color:var(--rule)]">
        {[['love', `喜欢 ${loved}`], ['skip', `跳过 ${skipped}`]].map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
            className={`h-11 -mb-px border-b-2 text-[14px] ${tab === value ? 'border-[color:var(--cinnabar)] font-semibold' : 'border-transparent text-[color:var(--ink-mute)]'}`}>{label}</button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="py-8 text-[14px] text-[color:var(--ink-mute)]">
          {tab === 'love' ? '还没有喜欢的项目。在「本期」里点 ♥，这里会记下来，并汇总你偏好的话题。' : '还没有跳过的项目。跳过的候选会从本期列表里隐藏，可随时撤销。'}
        </p>
      ) : (
        <ul>
          {entries.map(entry => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-3 border-b border-[color:var(--rule-soft)]">
              <button onClick={() => openEntry(entry.id)} className="min-w-0 text-left">
                <b className="ff-display text-[17px] hover:text-[color:var(--cinnabar)]">{entry.title}</b>
                <span className="ml-2 text-[12px] text-[color:var(--ink-mute)]">{entry.owner} · {entry.kind}</span>
              </button>
              <button onClick={() => onTaste(entry.id, null)} className="h-9 px-3 shrink-0 border border-[color:var(--rule)] text-[12px] hover:border-[color:var(--ink)]">撤销</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SignalSources({ signals, sources }) {
  return (
    <section>
      <Eyebrow>信号源与隐私</Eyebrow>
      <h2 className="ff-cn text-[24px] font-semibold mt-1">推荐依据从哪里来</h2>
      <ul className="mt-4 border-t border-[color:var(--ink)]">
        {signals.map(signal => (
          <li key={signal.key} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_160px_72px] items-center gap-3 py-3 border-b border-[color:var(--rule-soft)]">
            <span className="min-w-0">
              <span className={`block text-[15px] ${signal.enabled ? 'font-medium' : 'text-[color:var(--ink-mute)]'}`}>{signal.name}</span>
              <span className="block text-[12px] text-[color:var(--ink-mute)]">{signal.scope}{signal.note ? ` · ${signal.note}` : ''}</span>
            </span>
            <span className="hidden md:block h-[5px] bg-[color:var(--paper-sunk)]"><span className={`block h-full ${signal.enabled ? 'bg-[color:var(--forest)]' : 'bg-[color:var(--rule)]'}`} style={{ width: `${Math.round(signal.weight * 300)}%`, maxWidth: '100%' }} /></span>
            <Pill tone={signal.enabled ? 'good' : 'neutral'} className="justify-self-end">{signal.enabled ? `开 · ${signal.weight}` : '关闭'}</Pill>
          </li>
        ))}
      </ul>
      {sources && (
        <details className="mt-4 group">
          <summary className="flex items-center justify-between gap-3 py-3 text-[14px]">
            <span>采集源 <b className="ff-mono">{sources.ok}/{sources.total}</b> 正常{sources.cached ? ` · ${sources.cached} 个复用缓存` : ''}{sources.failed.length ? <span className="text-[color:var(--cinnabar)]"> · {sources.failed.length} 个失败</span> : ''}</span>
            <Icon name="chevron" className="chev transition-transform" />
          </summary>
          <ul className="pb-2">
            {sources.rows.map(row => (
              <li key={row.key} className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-[color:var(--rule)] text-[13px]">
                <span className="ff-mono min-w-0 truncate text-[12px]">{row.label}</span>
                <span className={`shrink-0 text-[12px] ${row.ok ? 'text-[color:var(--forest)]' : 'text-[color:var(--cinnabar)]'}`}>{row.ok ? `${row.count} 条${row.cached ? ' · 缓存' : ''}` : (row.error || '失败')}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function LabPanel({ title, meta, children }) {
  return (
    <details className="border-b border-[color:var(--rule)]">
      <summary className="flex items-center justify-between gap-3 py-4">
        <span className="min-w-0"><span className="block text-[16px] font-medium">{title}</span><span className="block text-[12px] text-[color:var(--ink-mute)]">{meta}</span></span>
        <Icon name="chevron" className="chev transition-transform" />
      </summary>
      <div className="pb-5 text-[14px]">{children}</div>
    </details>
  );
}

function Lab({ circle, candidates, ideas, reviews, health }) {
  const lastCheck = health && Array.isArray(health.checks) && health.checks.length ? health.checks[health.checks.length - 1] : null;
  return (
    <section>
      <Eyebrow>实验室 · 数据还少，先收起来</Eyebrow>
      <h2 className="ff-cn text-[24px] font-semibold mt-1">在养的几条线</h2>
      <div className="mt-4 border-t border-[color:var(--ink)]">
        <LabPanel title="核心开源者圈层" meta={circle.available ? `${circle.people.length} 人 · ${circle.projects.length} 个项目 · ${candidates.candidateCount} 个待晋级` : '未加载'}>
          {circle.people.map(person => (
            <p key={person.login} className="py-1"><a className="font-medium underline underline-offset-4" href={person.profileUrl} target="_blank" rel="noopener noreferrer">{person.login}</a><span className="text-[color:var(--ink-mute)]"> · {person.tierReason || person.tier} · {person.followersCompact} followers（弱信号）</span></p>
          ))}
          <ul className="mt-2">
            {circle.projects.map(project => (
              <li key={project.fullName} className="flex justify-between gap-3 py-1.5 border-b border-dashed border-[color:var(--rule)]">
                <a href={project.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate">{project.fullName}</a>
                <Pill tone={project.recommendation ? 'good' : 'neutral'}>{project.recommendation ? '推荐研读' : project.licenseLabel === '未声明' ? '无许可证' : '观察'}</Pill>
              </li>
            ))}
          </ul>
        </LabPanel>
        <LabPanel title="Idea 项目化" meta={ideas.available ? `${ideas.totals.total} 项 · 自动化止于「${ideas.automationMaxStage || 'research'}」` : '未加载'}>
          {ideas.ideas.map(idea => (
            <div key={idea.id} className="py-2">
              <div className="flex items-center gap-2"><Pill tone="warn">{idea.stageLabel}</Pill><b className="font-medium">{idea.title}</b></div>
              <p className="mt-1 text-[color:var(--ink-soft)]">{idea.summary}</p>
              <div className="mt-2 h-[5px] bg-[color:var(--paper-sunk)]"><div className="h-full bg-[color:var(--mustard)]" style={{ width: `${idea.progress}%` }} /></div>
            </div>
          ))}
        </LabPanel>
        <LabPanel title="推荐复盘" meta={reviews.available ? `${reviews.totals.total} 条 · 保留 ${reviews.totals.keep} · 降权 ${reviews.totals.downgrade}` : '未加载'}>
          {reviews.reviews.map(review => (
            <div key={review.id} className="py-2">
              <div className="flex items-center gap-2"><Pill tone={review.conclusion === 'keep' ? 'good' : 'risk'}>{review.conclusionLabel}</Pill><a href={review.subject.url} target="_blank" rel="noopener noreferrer" className="font-medium">{review.subject.fullName}</a></div>
              {review.facts.slice(0, 2).map(fact => <p key={fact.text} className="mt-1 text-[color:var(--ink-soft)]">{fact.text}</p>)}
            </div>
          ))}
        </LabPanel>
        <LabPanel title="四小时健康巡检" meta={lastCheck ? `最近 ${WL_HUB_ADAPTER.relativeTime(lastCheck.checked_at)} · ${lastCheck.result === 'pass' ? '通过' : '有问题'}` : '暂无记录'}>
          {lastCheck && (
            <>
              <ul>{(lastCheck.actions || []).map(action => <li key={action.name} className="flex justify-between gap-3 py-1.5 border-b border-dashed border-[color:var(--rule)]"><span>{action.name}</span><Pill tone={action.result === 'pass' ? 'good' : 'risk'}>{action.result === 'pass' ? '通过' : '失败'}</Pill></li>)}</ul>
              <p className="mt-2 text-[color:var(--ink-mute)]">下一步：{lastCheck.next_action}</p>
            </>
          )}
        </LabPanel>
      </div>
    </section>
  );
}

function MeView({ status, data, hub, taste, onTaste, openEntry, onClear, localProfile }) {
  if (status === 'loading') return <div className="max-w-[1080px] mx-auto px-5 md:px-10 py-10"><WL_UI.SkeletonRows rows={5} /></div>;
  const M = WL_ATELIER_MODEL;
  const circle = data.circle ? M.buildCircleBoard(data.circle) : M.buildEmptyCircleBoard();
  const candidates = data.candidates ? M.buildCircleCandidatesBoard(data.candidates) : M.buildEmptyCircleCandidatesBoard();
  const ideas = data.ideas ? M.buildIdeaPipelineBoard(data.ideas) : M.buildEmptyIdeaPipelineBoard();
  const reviews = data.reviews ? WL_REVIEW_MODEL.buildReviewBoard(data.reviews) : WL_REVIEW_MODEL.buildEmptyReviewBoard();
  const signals = WL_HUB_ADAPTER.buildProfileSignals(data.profile, data.profileSignals);
  return (
    <div className="max-w-[1080px] mx-auto px-5 md:px-10 pb-20">
      <header className="pt-8 md:pt-12 pb-8 border-b border-[color:var(--ink)]">
        <Eyebrow>我的</Eyebrow>
        <h1 className="ff-cn mt-3 text-[30px] md:text-[46px] font-black leading-[1.15]">推荐只听<span className="text-[color:var(--cinnabar)]">你</span>和公开数据的。</h1>
      </header>
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 pt-10">
        <TasteLedger hub={hub} taste={taste} onTaste={onTaste} openEntry={openEntry} onClear={onClear} localProfile={localProfile} />
        <SignalSources signals={signals} sources={hub ? hub.sources : null} />
      </div>
      <div className="pt-14"><Lab circle={circle} candidates={candidates} ideas={ideas} reviews={reviews} health={data.health} /></div>
    </div>
  );
}

/* ============================== App ============================== */
function App() {
  const [route, setRoute] = useState(parseHash);
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState({});
  const [taste, setTaste] = useState(readTaste);
  const [entryId, setEntryId] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    const keys = Object.keys(DATA_FILES);
    const values = await Promise.all(keys.map(key => loadJson(DATA_FILES[key])));
    const next = {};
    keys.forEach((key, index) => { next[key] = values[index]; });
    setData(next);
    setStatus(next.discoveries || next.queue ? 'ready' : 'error');
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.view]);
  useEffect(() => {
    try { window.localStorage.setItem(TASTE_KEY, JSON.stringify(taste)); } catch (error) { /* 本地存储不可用时仅保留当前会话 */ }
  }, [taste]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const hub = useMemo(() => (data.discoveries ? WL_HUB_ADAPTER.buildHubData(data.discoveries) : null), [data.discoveries]);
  // 本机相关：只用本浏览器 localStorage 里的喜好账本，在本机计算
  const localProfile = useMemo(() => WL_HUB_ADAPTER.buildLocalProfile(hub ? hub.entries : [], taste), [hub, taste]);
  const relCache = useMemo(() => new Map(), [localProfile]);
  const relOf = useCallback(item => {
    if (!item) return { ready: false, score: 0, level: 'none', reasons: [] };
    if (!relCache.has(item.id)) relCache.set(item.id, WL_HUB_ADAPTER.localRelevance(item, localProfile, taste));
    return relCache.get(item.id);
  }, [relCache, localProfile, taste]);
  const queueBoard = useMemo(() => (data.queue ? WL_ATELIER_MODEL.buildQueueBoard(data.queue) : WL_ATELIER_MODEL.buildEmptyQueueBoard()), [data.queue]);
  const adoptionsBoard = useMemo(() => (data.adoptions ? WL_ATELIER_MODEL.buildAdoptionsBoard(data.adoptions) : WL_ATELIER_MODEL.buildEmptyAdoptionsBoard()), [data.adoptions]);
  const queueBySubject = useMemo(() => new Map(queueBoard.entries.map(entry => [entry.subject, entry])), [queueBoard]);
  const queueSubjects = useMemo(() => new Set(queueBySubject.keys()), [queueBySubject]);

  const onTaste = useCallback((id, value) => {
    setTaste(prev => {
      const next = Object.assign({}, prev);
      if (value) next[id] = value; else delete next[id];
      return next;
    });
    setToast(value === 'love' ? '已记入喜欢 · 可在「我的」查看' : value === 'skip' ? '已跳过 · 本期列表中隐藏' : '已撤销');
  }, []);
  const onClear = useCallback(() => {
    if (window.confirm('清空本浏览器里的全部喜好记录？')) { setTaste({}); setToast('本地喜好已清空'); }
  }, []);
  const openEntry = useCallback(id => setEntryId(id), []);
  const closeEntry = useCallback(() => setEntryId(''), []);
  const onFocusQueue = useCallback(id => {
    window.history.replaceState(null, '', id ? `#review/${encodeURIComponent(id)}` : '#review');
    setRoute({ view: 'review', id });
  }, []);

  useEffect(() => {
    if (route.view !== 'review' || !route.id) return;
    setEntryId('');
    const timer = setTimeout(() => {
      const node = document.getElementById(`queue-${route.id}`);
      if (node) node.scrollIntoView({ block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [route, status]);

  const entry = hub && entryId ? hub.entries.find(item => item.id === entryId) : null;

  return (
    <main className="min-h-[calc(100vh-58px)]">
      {route.view === 'issue' && <IssueView status={status === 'ready' && !hub ? 'error' : status} hub={hub} taste={taste} onTaste={onTaste} openEntry={openEntry} queueSubjects={queueSubjects} onRetry={load} localProfile={localProfile} relOf={relOf} />}
      {route.view === 'review' && <ReviewView status={status} queueBoard={queueBoard} adoptionsBoard={adoptionsBoard} focusId={route.id} onFocus={onFocusQueue} onRetry={load} />}
      {route.view === 'me' && (status === 'error'
        ? <div className="max-w-[1080px] mx-auto px-5 md:px-10 py-10"><StateBlock tone="risk" title="数据没能加载" body="公开数据文件读取失败，请稍后重试。" action="重新加载" onAction={load} /></div>
        : <MeView status={status} data={data} hub={hub} taste={taste} onTaste={onTaste} openEntry={openEntry} onClear={onClear} localProfile={localProfile} />)}

      <footer className="max-w-[1240px] mx-auto px-5 md:px-10 py-8 border-t border-[color:var(--rule)] text-[12px] leading-relaxed text-[color:var(--ink-mute)]">
        <span className="inline-flex items-center gap-1.5 mr-2 text-[color:var(--ink-soft)]"><Icon name="shield" size={14} />只读</span>
        页面只展示公开数据（data/*.json，由 GitHub Actions 每四小时刷新），不安装、不执行任何 Skill，不含私有工作内容或凭证；喜好只存于你的浏览器。
      </footer>

      <Sheet open={Boolean(entry)} onClose={closeEntry} label={entry ? `${entry.title} 速读` : '速读'}>
        {entry && <EntryDetail entry={entry} hub={hub} taste={taste} onTaste={onTaste} onClose={closeEntry} openEntry={openEntry} queueEntry={queueBySubject.get(entry.fullName)} rel={relOf(entry)} localProfile={localProfile} />}
      </Sheet>

      <div aria-live="polite" className={`fixed left-1/2 -translate-x-1/2 bottom-6 max-[720px]:bottom-[calc(80px+env(safe-area-inset-bottom))] z-[2147483200] px-4 py-2.5 bg-[color:var(--ink)] text-[color:var(--paper-raised)] text-[13px] transition-all duration-200 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        {toast}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
