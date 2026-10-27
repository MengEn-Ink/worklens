/* @jsxRuntime classic */
/* global React, ReactDOM, fetch */
(() => {
  const { useEffect, useMemo, useRef, useState } = React
  const adapter = window.WL_DISCOVERY_ADAPTER
  const chapters = [
    { id: 'all', label: '全部' },
    { id: 'must', label: '必读' },
    { id: 'adopt', label: '引入' },
    { id: 'review', label: '评测' },
    { id: 'skill', label: 'Skill' }
  ]
  const tabs = [
    { id: 'cover', glyph: 'E', label: '卷首' },
    { id: 'issue', glyph: '◐', label: '本期' },
    { id: 'profile', glyph: 'P', label: '画像' },
    { id: 'index', glyph: '目', label: '目录' }
  ]
  const priorityRank = { P0: 0, P1: 1, P2: 2 }
  const validRoutes = new Set(['cover', 'issue', 'profile', 'index'])
  const validChapters = new Set(chapters.map(chapter => chapter.id))
  const readLocation = () => {
    const match = /^#mwb\/(cover|issue|profile|index)(?:\?(.*))?$/.exec(window.location.hash)
    if (!match) return { route: 'cover', chapter: 'all', entry: null, valid: false }
    const params = new URLSearchParams(match[2] || '')
    const chapter = validChapters.has(params.get('chapter')) ? params.get('chapter') : 'all'
    return { route: validRoutes.has(match[1]) ? match[1] : 'cover', chapter, entry: params.get('entry') || null, valid: true }
  }
  const locationHash = (route, chapter = 'all', entry = null) => {
    const params = new URLSearchParams()
    if (route === 'issue') params.set('chapter', validChapters.has(chapter) ? chapter : 'all')
    if (route === 'issue' && entry) params.set('entry', entry)
    const query = params.toString()
    return `#mwb/${validRoutes.has(route) ? route : 'cover'}${query ? `?${query}` : ''}`
  }
  const githubUrl = value => {
    const text = String(value || '').trim()
    if (/^https?:\/\/github\.com\//i.test(text)) return text
    if (/^github\.com\//i.test(text)) return `https://${text}`
    return null
  }
  const priorityOf = entry => entry.priority || adapter.editorialPriority(entry)

  function Priority({ level }) {
    if (!level) return null
    const labels = { P0: '本期必读', P1: '编辑重点', P2: '值得关注' }
    return <span className={`mwb-priority mwb-priority--${level.toLowerCase()}`}>{level} · {labels[level]}</span>
  }

  function RepoLink({ entry }) {
    const href = githubUrl(entry.url)
    if (!href) return <span className="mwb-source">{entry.source || entry.author}</span>
    return <a className="mwb-repo-link" href={href} target="_blank" rel="noopener noreferrer">{entry.author}/{entry.title}<span aria-hidden="true"> ↗</span></a>
  }

  function EntryCard({ entry }) {
    const priority = priorityOf(entry)
    const tags = (entry.tags || []).slice(0, 3)
    return (
      <article id={`mwb-entry-${encodeURIComponent(entry.id)}`} className={`mwb-card ${priority ? `mwb-card--${priority.toLowerCase()}` : ''}`} data-entry-id={entry.id} data-priority={priority || undefined}>
        <div
          className={`mwb-card__band mwb-card__band--${entry.brandBand || 'ink'}`}
          style={entry.ogImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(20,18,16,.78), rgba(20,18,16,.28)), url("${entry.ogImageUrl}")` } : undefined}
          aria-hidden="true"
        />
        <div className="mwb-card__meta"><span>{entry.dewey}</span><Priority level={priority} /></div>
        <div className="mwb-card__identity">
          {entry.avatarUrl ? <img className="mwb-card__avatar" src={entry.avatarUrl} alt="" loading="lazy" /> : null}
          <div>
            <h2>{priority === 'P1' && <span className="mwb-title-mark" aria-hidden="true" />}{entry.title}</h2>
            <RepoLink entry={entry} />
          </div>
        </div>
        <p className="mwb-card__summary">{entry.sub}</p>
        <div className="mwb-card__signals">
          {entry.language ? <span className="mwb-signal mwb-signal--language"><i />{entry.language}</span> : null}
          {tags.map(tag => <span className="mwb-signal" key={tag}>{tag}</span>)}
          <span className="mwb-signal mwb-signal--activity">● {entry.activityLabel || '活跃度未知'}</span>
        </div>
        <p className="mwb-card__why">{entry.why}</p>
        <div className="mwb-card__facts"><span>FIT {entry.scores?.fit || '—'}</span><span>{entry.verdict === 'adopt' ? '建议引入' : entry.verdict === 'evaluate' ? '需要评测' : '进入书架'}</span></div>
      </article>
    )
  }

  function ChapterRibbon({ current, onPick }) {
    return <nav className="mwb-ribbon" aria-label="本期章节">{chapters.map(chapter => <button key={chapter.id} className={current === chapter.id ? 'is-active' : ''} onClick={() => onPick(chapter.id)}>{chapter.label}</button>)}</nav>
  }

  function MobileWorkbench() {
    const initialLocation = useRef(readLocation()).current
    const [data, setData] = useState(window.WL_DATA)
    const [route, setRoute] = useState(initialLocation.route)
    const [chapter, setChapter] = useState(initialLocation.chapter)
    const [targetEntry, setTargetEntry] = useState(initialLocation.entry)
    const [lastReading, setLastReading] = useState({ route: 'issue', chapter: 'all', scrollTop: 0 })
    const scroller = useRef(null)

    useEffect(() => {
      if (!initialLocation.valid) window.history.replaceState(null, '', locationHash('cover'))
      const syncFromLocation = () => {
        const location = readLocation()
        if (!location.valid) {
          window.history.replaceState(null, '', locationHash('cover'))
          setRoute('cover')
          setChapter('all')
          setTargetEntry(null)
          return
        }
        setRoute(location.route)
        setChapter(location.chapter)
        setTargetEntry(location.entry)
        requestAnimationFrame(() => {
          if (scroller.current && !location.entry) scroller.current.scrollTop = 0
        })
      }
      window.addEventListener('hashchange', syncFromLocation)
      window.addEventListener('popstate', syncFromLocation)
      return () => {
        window.removeEventListener('hashchange', syncFromLocation)
        window.removeEventListener('popstate', syncFromLocation)
      }
    }, [initialLocation.valid])

    useEffect(() => {
      let alive = true
      Promise.all([
        fetch('../data/discoveries.json', { cache: 'no-cache' }).then(response => response.ok ? response.json() : Promise.reject(new Error('discoveries'))),
        fetch('../data/skill-review-queue.json', { cache: 'no-cache' }).then(response => response.ok ? response.json() : {})
      ]).then(([discoveries, queue]) => {
        if (alive) setData(adapter.buildPcData(window.WL_DATA, discoveries, queue))
      }).catch(() => {})
      return () => { alive = false }
    }, [])

    const entries = useMemo(() => data.ENTRIES || [], [data.ENTRIES])
    const sortedEntries = useMemo(() => [...entries].sort((a, b) => (priorityRank[priorityOf(a)] ?? 9) - (priorityRank[priorityOf(b)] ?? 9)), [entries])
    const filtered = useMemo(() => sortedEntries.filter(entry => {
      if (chapter === 'must') return priorityOf(entry) === 'P0'
      if (chapter === 'adopt') return entry.verdict === 'adopt'
      if (chapter === 'review') return entry.verdict === 'evaluate'
      if (chapter === 'skill') return entry.kind === 'Skill'
      return true
    }), [chapter, sortedEntries])

    useEffect(() => {
      if (route !== 'issue' || !targetEntry) return
      const target = document.getElementById(`mwb-entry-${encodeURIComponent(targetEntry)}`)
      if (target) target.scrollIntoView({ block: 'start' })
    }, [data, filtered, route, targetEntry])

    const remember = () => {
      if (route !== 'index') setLastReading({ route, chapter, scrollTop: scroller.current?.scrollTop || 0 })
    }
    const go = (next, nextChapter = next === 'issue' ? chapter : 'all', entry = null) => {
      remember()
      const safeChapter = next === 'issue' ? nextChapter : 'all'
      window.history.pushState(null, '', locationHash(next, safeChapter, entry))
      setRoute(validRoutes.has(next) ? next : 'cover')
      setChapter(safeChapter)
      setTargetEntry(entry)
      requestAnimationFrame(() => { if (scroller.current && !entry) scroller.current.scrollTop = 0 })
    }
    const pickChapter = nextChapter => {
      window.history.pushState(null, '', locationHash('issue', nextChapter))
      setChapter(nextChapter)
      setTargetEntry(null)
      requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = 0 })
    }
    const returnToReading = () => {
      const readingRoute = validRoutes.has(lastReading.route) ? lastReading.route : 'issue'
      window.history.pushState(null, '', locationHash(readingRoute, lastReading.chapter))
      setRoute(readingRoute)
      setChapter(lastReading.chapter)
      setTargetEntry(null)
      requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = lastReading.scrollTop })
    }
    const locator = route === 'index' ? '全库目录' : route === 'issue' ? `本期 · ${chapters.find(item => item.id === chapter)?.label}` : route === 'profile' ? '工作画像' : '卷首'

    return (
      <div className="mwb-shell">
        <header className="mwb-head">
          <div><b>Work<em>Lens</em></b><small>Mobile Workbench · V2</small></div>
          <button className="mwb-locator" onClick={() => route === 'index' ? returnToReading() : go('index')} aria-label={route === 'index' ? '返回上次阅读位置' : '打开全库目录'}><span>{route === 'index' ? '← 返回阅读' : locator}</span><small>{route === 'index' ? 'Locator' : '目录 →'}</small></button>
        </header>
        {route === 'issue' && <ChapterRibbon current={chapter} onPick={pickChapter} />}
        <main className="mwb-main" ref={scroller}>
          {route === 'cover' && <section className="mwb-cover"><p className="mwb-kicker">Vol.04 · 本周工作情报</p><h1>{data.ISSUE?.curator_note ? '把真实信号整理成下一步行动' : 'WorkLens 移动工作台'}</h1><p>{data.ISSUE?.curator_note}</p><div className="mwb-stats">{Object.entries(data.ISSUE?.stats || {}).slice(0, 4).map(([key, value]) => <div key={key}><b>{value}</b><span>{key.replaceAll('_', ' ')}</span></div>)}</div><button className="mwb-primary" onClick={() => go('issue')}>进入本期重点 →</button></section>}
          {route === 'issue' && <section className="mwb-reading"><header><p className="mwb-kicker">Issue · {chapter}</p><h1>本期编辑精选</h1><p>P0/P1/P2 仅表达编辑重要程度，与已读、收藏状态相互独立。</p></header>{filtered.length ? filtered.map(entry => <EntryCard key={entry.id} entry={entry} />) : <p className="mwb-empty">当前章节暂无符合明确规则的条目。</p>}</section>}
          {route === 'profile' && <section className="mwb-profile"><p className="mwb-kicker">Profile · Public Signals</p><h1>工作画像</h1><p>仅使用公开 GitHub 元数据和浏览器本地喜好信号。</p>{(data.PROFILE_RADAR || []).map(item => <div className="mwb-radar" key={item.axis}><span>{item.axis}</span><i><b style={{ width: `${item.score}%` }} /></i><strong>{item.score}</strong></div>)}</section>}
          {route === 'index' && <section className="mwb-index"><header><p className="mwb-kicker">Index · Full Library</p><h1>全库目录</h1><p>P0 必读置顶；点击条目返回本期阅读页。</p></header>{sortedEntries.map(entry => { const priority = priorityOf(entry); return <button className={`mwb-index-row ${priority === 'P0' ? 'is-p0' : ''}`} key={entry.id} onClick={() => go('issue', 'all', entry.id)}><span>{entry.dewey}</span><span><b>{entry.title}</b><small>{entry.shelf}</small></span><Priority level={priority} /></button> })}</section>}
        </main>
        <nav className="mwb-tabs" aria-label="移动工作台一级导航">{tabs.map(tab => <button key={tab.id} className={route === tab.id || (tab.id === 'issue' && route === 'issue') ? 'is-active' : ''} onClick={() => go(tab.id)}><span>{tab.glyph}</span><small>{tab.label}</small></button>)}</nav>
      </div>
    )
  }

  ReactDOM.createRoot(document.getElementById('mobile-workbench-root')).render(<MobileWorkbench />)
})()
