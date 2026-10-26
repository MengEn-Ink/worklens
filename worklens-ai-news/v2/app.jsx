/* @jsxRuntime classic */
/* global React, ReactDOM, WL_AI_NEWS_ADAPTER */
const { useEffect, useMemo, useState } = React;
const STORAGE = { favs: 'worklens.aiNews.favorites.v1', reads: 'worklens.aiNews.history.v1' };
const RANGE_LABELS = { '1h': '1 小时', '24h': '24 小时', '7d': '7 天', '30d': '30 天', all: '全部' };
const KIND_LABELS = { signal: '工作信号', trend: '产业趋势', tool: '工具 & 产品', research: '学术 & 研究', risk: '风险 & 合规' };

function readStored(key) {
  try { return new Set(JSON.parse(window.localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function writeStored(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(Array.from(value))); } catch { /* 本地存储不可用时仍可继续浏览 */ }
}
function Icon({ name, filled }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    lens: <><circle cx="11" cy="11" r="6"/><circle cx="11" cy="11" r="2.2" fill="currentColor"/><path d="m20 20-4-4"/></>,
    bookmark: <path fill={filled ? 'currentColor' : 'none'} d="M6 3h12v18l-6-4-6 4z"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M20 14v6H4V4h6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function safeOpen(item) {
  if (!item.url) return false;
  const opened = window.open(item.url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
  return true;
}
function App() {
  const [model, setModel] = useState({ items: [], sources: [], categories: [], status: 'loading', generatedAt: '' });
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [kind, setKind] = useState('all');
  const [range, setRange] = useState('24h');
  const [favs, setFavs] = useState(() => readStored(STORAGE.favs));
  const [reads, setReads] = useState(() => readStored(STORAGE.reads));
  const [panel, setPanel] = useState(null);
  const [lens, setLens] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    let active = true;
    fetch('../data/ai-news.json', { cache: 'no-cache' })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(payload => { if (active) setModel(WL_AI_NEWS_ADAPTER.normalize(payload)); })
      .catch(() => { if (active) { setLoadError('资讯暂时未能加载，请稍后重试。'); setModel({ items: [], sources: [], categories: [], status: 'error', generatedAt: '' }); } });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('zh-CN');
    return model.items.filter(item => {
      if (source !== 'all' && item.source !== source) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (!WL_AI_NEWS_ADAPTER.withinRange(item, range)) return false;
      return !q || `${item.title} ${item.source} ${item.lens}`.toLocaleLowerCase('zh-CN').includes(q);
    });
  }, [model, query, source, kind, range]);

  const toggleFav = id => setFavs(previous => {
    const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); writeStored(STORAGE.favs, next); return next;
  });
  const markRead = id => setReads(previous => {
    const next = new Set(previous).add(id); writeStored(STORAGE.reads, next); return next;
  });
  const openLens = item => { markRead(item.id); setLens(item); };
  const openOriginal = item => { markRead(item.id); safeOpen(item); };
  const toggleExpanded = id => setExpanded(previous => {
    const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const generated = model.generatedAt ? new Date(model.generatedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '等待更新';
  const hero = filtered[0];
  const rest = filtered.slice(1);
  const panelItems = panel === 'favs' ? model.items.filter(item => favs.has(item.id)) : model.items.filter(item => reads.has(item.id));

  return <div className="app-shell">
    <header className="masthead">
      <a className="brand" href="../" aria-label="返回 WorkLens 首页"><b>W</b><span>AI 工作情报</span><small>· WorkLens Dispatch</small></a>
      <nav className="top-nav" aria-label="WorkLens 导航"><a href="../">首页</a><a href="../desktop/">知识雷达</a><a href="../atelier/">Atelier</a><strong>AI 情报</strong></nav>
      <div className="updated">更新于 {generated}</div>
    </header>

    <div className="toolbar">
      <label className="search"><Icon name="search"/><span className="sr-only">搜索资讯</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="检索标题、来源或工作信号…" /></label>
      <select aria-label="时间范围" value={range} onChange={event => setRange(event.target.value)}>{Object.entries(RANGE_LABELS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      <button className="mobile-filter" onClick={() => setPanel('filters')}>筛选</button>
    </div>

    <main className="layout">
      <aside className="rail">
        <FilterBlock title="分类"><FilterButton active={kind === 'all'} label="全部情报" count={model.items.length} onClick={() => setKind('all')}/>{model.categories.map(item => <FilterButton key={item.id} active={kind === item.id} label={item.name} count={item.count} onClick={() => setKind(item.id)}/>)}</FilterBlock>
        <FilterBlock title="来源"><FilterButton active={source === 'all'} label="全部来源" count={model.items.length} onClick={() => setSource('all')}/>{model.sources.map(item => <FilterButton key={item.name} active={source === item.name} label={item.name} count={item.count} onClick={() => setSource(item.name)}/>)}</FilterBlock>
        <div className="quick"><button onClick={() => setPanel('history')}><Icon name="clock"/>阅读历史 <b>{reads.size}</b></button><button onClick={() => setPanel('favs')}><Icon name="bookmark"/>本地收藏 <b>{favs.size}</b></button></div>
      </aside>

      <section className="feed">
        <div className="feed-heading"><div><p>WORK SIGNAL × TIME</p><h1>今日 <em>{filtered.length}</em> 条 AI 工作情报</h1></div><span>{source === 'all' ? '全部来源' : source} · {RANGE_LABELS[range]}</span></div>
        {model.status === 'loading' && <State title="正在整理今日情报" body="读取公开资讯并提取工作信号…"/>}
        {(model.status === 'error' || model.status === 'empty') && <State title={loadError ? '暂时无法读取资讯' : '今天还没有新情报'} body={loadError || '数据源当前为空，稍后刷新即可。页面其他区域仍可正常使用。'} action={loadError ? () => window.location.reload() : null}/>} 
        {model.status === 'ready' && !hero && <State title="没有符合条件的情报" body="调整关键词、来源或时间范围再看看。"/>}
        {hero ? <article className="hero"><p>头条 · {hero.source} · {hero.timeLabel}</p><h2>{hero.title}</h2><div className="hero-actions"><button onClick={() => openLens(hero)}><Icon name="lens"/>读 WorkLens 透镜</button><button className={favs.has(hero.id) ? 'active' : ''} onClick={() => toggleFav(hero.id)}><Icon name="bookmark" filled={favs.has(hero.id)}/>{favs.has(hero.id) ? '已收藏' : '收藏'}</button></div></article> : null}
        {rest.length > 0 ? <div className="section-label">更多情报 · {rest.length} 条</div> : null}
        <div className="news-list">{rest.map((item, index) => <NewsCard key={item.id} item={item} index={index} read={reads.has(item.id)} fav={favs.has(item.id)} expanded={expanded.has(item.id)} onLens={() => openLens(item)} onOriginal={() => openOriginal(item)} onFav={() => toggleFav(item.id)} onExpand={() => toggleExpanded(item.id)}/>)}</div>
      </section>
    </main>

    <nav className="tabbar" aria-label="AI 情报快捷导航"><button className="active" onClick={() => setPanel(null)}>晨报</button><button onClick={() => setPanel('favs')}>收藏 <b>{favs.size || ''}</b></button><button onClick={() => setPanel('history')}>历史</button><button onClick={() => setPanel('filters')}>来源</button></nav>
    {lens ? <LensPanel item={lens} fav={favs.has(lens.id)} onClose={() => setLens(null)} onFav={() => toggleFav(lens.id)} onOriginal={() => openOriginal(lens)}/> : null} 
    {panel ? <SidePanel type={panel} items={panelItems} model={model} source={source} onSource={setSource} onClose={() => setPanel(null)} onItem={item => { setPanel(null); openLens(item); }}/> : null} 
  </div>;
}
function FilterBlock({ title, children }) { return <section className="filter-block"><h2>{title}</h2>{children}</section>; }
function FilterButton({ active, label, count, onClick }) { return <button className={active ? 'selected' : ''} onClick={onClick}><span>{label}</span><b>{count}</b></button>; }
function State({ title, body, action }) { return <div className="state"><Icon name="lens"/><h2>{title}</h2><p>{body}</p>{action ? <button onClick={action}>重新加载</button> : null}</div>; }
function NewsCard({ item, index, read, fav, expanded, onLens, onOriginal, onFav, onExpand }) {
  return <article className={`news-card ${read ? 'read' : ''}`} style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}><div className="news-main"><p className="meta"><span>{KIND_LABELS[item.kind]}</span>{item.source} · {item.timeLabel}</p><h2 onClick={onLens}>{item.title}</h2><div className={`inline-lens ${expanded ? 'open' : ''}`}><p><b>WorkLens 透镜</b>{item.lens}</p></div><button className="expand" onClick={onExpand}>{expanded ? '收起透镜' : '查看透镜解读'} →</button></div><div className="card-actions"><button aria-label={fav ? '取消收藏' : '收藏'} className={fav ? 'active' : ''} onClick={onFav}><Icon name="bookmark" filled={fav}/></button><button aria-label="打开原文" disabled={!item.url} onClick={onOriginal}><Icon name="external"/></button><button aria-label="打开 WorkLens 透镜" onClick={onLens}><Icon name="lens"/></button></div></article>;
}
function LensPanel({ item, fav, onClose, onFav, onOriginal }) { return <><div className="mask" onClick={onClose}/><aside className="drawer lens-panel"><header><div><small>WORKLENS 透镜</small><h2>这条资讯对工作意味着什么</h2></div><button aria-label="关闭" onClick={onClose}><Icon name="close"/></button></header><div className="drawer-body"><p className="meta"><span>{KIND_LABELS[item.kind]}</span>{item.source} · {item.timeLabel}</p><h3>{item.title}</h3><h4>WorkLens 的解读</h4><p className="lens-copy">{item.lens}</p><h4>工作信号</h4>{item.signals.map(signal => <div className="signal" key={signal.name}><span>{signal.name}</span><i><b style={{ width: `${signal.value}%` }}/></i><em>{signal.value}</em></div>)}<div className="drawer-actions"><button className={fav ? 'active' : ''} onClick={onFav}><Icon name="bookmark" filled={fav}/>{fav ? '已收藏' : '本地收藏'}</button><button disabled={!item.url} onClick={onOriginal}><Icon name="external"/>安全打开原文</button></div><p className="note">透镜由标题与公开来源生成，仅作信号参考，不替代原文判断。</p></div></aside></>; }
function SidePanel({ type, items, model, source, onSource, onClose, onItem }) {
  const title = type === 'favs' ? '本地收藏' : type === 'history' ? '阅读历史' : '来源筛选';
  return <><div className="mask" onClick={onClose}/><aside className="drawer compact"><header><h2>{title}</h2><button aria-label="关闭" onClick={onClose}><Icon name="close"/></button></header><div className="drawer-body">{type === 'filters' ? <div className="source-list"><FilterButton active={source === 'all'} label="全部来源" count={model.items.length} onClick={() => { onSource('all'); onClose(); }}/>{model.sources.map(item => <FilterButton key={item.name} active={source === item.name} label={item.name} count={item.count} onClick={() => { onSource(item.name); onClose(); }}/>)}</div> : items.length ? items.map(item => <button className="history-row" key={item.id} onClick={() => onItem(item)}><small>{item.source} · {item.timeLabel}</small><span>{item.title}</span></button>) : <State title="这里还是空的" body={type === 'favs' ? '在晨报中收藏感兴趣的资讯。' : '打开透镜或原文后会记录在本机。'}/>}</div></aside></>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
