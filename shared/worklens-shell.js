(() => {
  // 收敛后的唯一一级导航：看（本期 / 情报）→ 判（待审）→ 用（我的）。
  // 本期 / 待审 / 我的 同属 Hub 单页，以 hash 区分；情报是独立页面。
  const pages = [
    { id: 'issue', label: '本期', path: '#issue' },
    { id: 'ai-news', label: '情报', path: 'ai-news/' },
    { id: 'review', label: '待审', path: '#review' },
    { id: 'me', label: '我的', path: '#me' }
  ]
  const hubViews = ['issue', 'review', 'me']
  const script = document.currentScript
  const page = script.dataset.current
  const base = new URL('../', script.src)
  const currentId = () => {
    if (page !== 'hub') return page
    const view = (window.location.hash || '').replace(/^#\/?/, '').split('/')[0]
    return hubViews.includes(view) ? view : 'issue'
  }
  const hrefOf = item => (page === 'hub' && item.path.startsWith('#') ? item.path : new URL(item.path, base).href)
  const link = (item, className, index) => {
    const active = item.id === currentId() ? ' aria-current="page"' : ''
    const dataIndex = index ? ` data-index="0${index}"` : ''
    return `<a class="${className}" data-page="${item.id}" href="${hrefOf(item)}"${active}${dataIndex}>${item.label}</a>`
  }

  const header = document.createElement('header')
  header.className = 'wl-shell'
  const logo = new URL('shared/assets/worklens-mark.svg', base)
  header.innerHTML = `<div class="wl-shell__inner"><a class="wl-shell__brand" href="${base.href}"><img class="wl-shell__brand-mark" src="${logo.href}" alt="" width="32" height="32" />WorkLens <small>FIELD NOTES</small></a><nav class="wl-shell__nav" aria-label="主要导航">${pages.map(item => link(item, 'wl-shell__link')).join('')}</nav><span class="wl-shell__edition">E-Ink Workspace</span><button class="wl-shell__menu" type="button" aria-label="打开总目菜单" aria-expanded="false" aria-controls="wl-drawer">☰</button></div>`

  const bottom = document.createElement('nav')
  bottom.className = 'wl-bottom'
  bottom.setAttribute('aria-label', '移动端导航')
  bottom.innerHTML = pages.map((item, index) => link(item, 'wl-bottom__link', index + 1)).join('')

  const scrim = document.createElement('div')
  scrim.className = 'wl-shell__scrim'
  scrim.setAttribute('aria-hidden', 'true')
  scrim.innerHTML = `<div class="wl-drawer" id="wl-drawer" role="dialog" aria-modal="true" aria-label="WorkLens 总目"><div class="wl-drawer__head"><span>WorkLens · 总目</span><button class="wl-drawer__close" type="button" aria-label="关闭总目菜单">×</button></div>${pages.map(item => link(item, '')).join('')}</div>`

  const layer = document.createElement('div')
  layer.className = 'wl-shell-layer'
  layer.setAttribute('data-worklens-shell', '')
  layer.append(header, bottom, scrim)
  document.body.classList.add('wl-shell-mounted')
  document.body.append(layer)
  const button = header.querySelector('.wl-shell__menu')
  const closeButton = scrim.querySelector('.wl-drawer__close')
  let previousFocus = null
  const focusable = () => Array.from(scrim.querySelectorAll('a[href], button:not([disabled])'))
  const close = () => {
    if (!scrim.classList.contains('is-open')) return
    scrim.classList.remove('is-open')
    scrim.setAttribute('aria-hidden', 'true')
    button.setAttribute('aria-expanded', 'false')
    if (previousFocus) previousFocus.focus()
    previousFocus = null
  }
  const open = () => {
    previousFocus = document.activeElement
    scrim.classList.add('is-open')
    scrim.setAttribute('aria-hidden', 'false')
    button.setAttribute('aria-expanded', 'true')
    closeButton.focus()
  }
  const syncCurrent = () => {
    const id = currentId()
    layer.querySelectorAll('a[data-page]').forEach(anchor => {
      if (anchor.dataset.page === id) anchor.setAttribute('aria-current', 'page')
      else anchor.removeAttribute('aria-current')
    })
  }
  window.addEventListener('hashchange', syncCurrent)
  scrim.querySelectorAll('a[data-page]').forEach(anchor => anchor.addEventListener('click', close))
  button.addEventListener('click', open)
  closeButton.addEventListener('click', close)
  scrim.addEventListener('click', event => {
    if (event.target === scrim) close()
  })
  document.addEventListener('keydown', event => {
    if (!scrim.classList.contains('is-open')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusable()
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
})()
