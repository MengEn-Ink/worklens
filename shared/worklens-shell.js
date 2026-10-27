(() => {
  const pages = [
    { id: 'field', label: '田野', path: '' },
    { id: 'desktop', label: '工作台', path: 'desktop/' },
    { id: 'atelier', label: '工坊', path: 'atelier/' },
    { id: 'ai-news', label: 'AI 情报', path: 'ai-news/' }
  ]
  const script = document.currentScript
  const current = script.dataset.current
  const base = new URL('../', script.src)
  const link = (page, className, index) => {
    const active = page.id === current ? ' aria-current="page"' : ''
    const dataIndex = index ? ` data-index="0${index}"` : ''
    return `<a class="${className}" href="${new URL(page.path, base).href}"${active}${dataIndex}>${page.label}</a>`
  }

  const header = document.createElement('header')
  header.className = 'wl-shell'
  const logo = new URL('shared/assets/worklens-mark.svg', base)
  header.innerHTML = `<div class="wl-shell__inner"><a class="wl-shell__brand" href="${base.href}"><img class="wl-shell__brand-mark" src="${logo.href}" alt="" width="32" height="32" />WorkLens <small>FIELD NOTES</small></a><nav class="wl-shell__nav" aria-label="主要导航">${pages.map(page => link(page, 'wl-shell__link')).join('')}</nav><span class="wl-shell__edition">E-Ink Workspace</span><button class="wl-shell__menu" type="button" aria-label="打开总目菜单" aria-expanded="false" aria-controls="wl-drawer">☰</button></div>`

  const bottom = document.createElement('nav')
  bottom.className = 'wl-bottom'
  bottom.setAttribute('aria-label', '移动端导航')
  bottom.innerHTML = pages.map((page, index) => link(page, 'wl-bottom__link', index + 1)).join('')

  const scrim = document.createElement('div')
  scrim.className = 'wl-shell__scrim'
  scrim.setAttribute('aria-hidden', 'true')
  scrim.innerHTML = `<div class="wl-drawer" id="wl-drawer" role="dialog" aria-modal="true" aria-label="WorkLens 总目"><div class="wl-drawer__head"><span>WorkLens · 总目</span><button class="wl-drawer__close" type="button" aria-label="关闭总目菜单">×</button></div>${pages.map(page => link(page, '')).join('')}</div>`

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
