/* global React, ReactDOM */
/*
 * WorkLens v4 · Atelier（只读工坊）
 * 顶部：刊头 + 安全边界条
 * 主区 A：Skill 待审队列看板（按状态分组）
 * 主区 B：核心开源者圈层（people + projects）
 *
 * 全部运行时数据来自 ../data/*.json；失败时进入显式空态，不白屏、不抛异常。
 */

const { useState, useEffect, useMemo } = React;
const MODEL = window.WL_ATELIER_MODEL;
const REVIEW_MODEL = window.WL_REVIEW_MODEL;

// ---------- 顶级常量 ----------

const DATA_SOURCES = {
  queue: '../data/skill-review-queue.json',
  circle: '../data/core-circle.json',
  ideas: '../data/idea-pipeline.json',
  reviews: '../data/recommendation-reviews.json',
  discoveries: '../data/discoveries.json',
};

const PREVIEW_HINT =
  '页面需要通过 HTTP 加载 JSON。本地预览请在仓库根执行 `python3 -m http.server 18999 -s`，然后访问 http://127.0.0.1:18999/worklens_zn3k/v4/index.html；或先 `python3 scripts/build_pages.py` 后访问 _site/atelier/。';

const TIER_LABELS = {
  seed: '种子观察',
  core: '核心',
  watch: '长线关注',
};

const CATEGORY_LABELS = {
  'game-emulator-frontend': '游戏模拟器 · 前端',
  'app-landing-page': '产品着陆页',
};

// ---------- 小型 UI 原件 ----------

function Section({ eyebrow, title, sub, children, trailing }) {
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <div className="ff-mono text-[10px] tracking-[0.3em] uppercase text-[color:var(--ink-mute)] mb-1">
            {eyebrow}
          </div>
          <h2 className="ff-serif font-bold text-3xl tracking-tight leading-none">{title}</h2>
          {sub ? (
            <p className="ff-serif italic text-[color:var(--ink-soft)] mt-2 text-sm max-w-3xl">
              {sub}
            </p>
          ) : null}
        </div>
        {trailing ? <div className="ff-mono text-[10px] text-[color:var(--ink-mute)] uppercase tracking-[0.1em]">{trailing}</div> : null}
      </div>
      <hr className="hr-double mb-6" />
      {children}
    </section>
  );
}

function StatBlock({ num, label, hint }) {
  return (
    <div className="flex flex-col gap-1 pr-4">
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
      {hint ? <div className="ff-serif italic text-xs text-[color:var(--ink-mute)]">{hint}</div> : null}
    </div>
  );
}

function Masthead({ queueUpdated, circleUpdated, queueTotal, circleTotal, loadError }) {
  return (
    <header className="pt-10 pb-6">
      <div className="grid grid-cols-[1fr_auto] gap-10 items-end">
        <div>
          <div className="ff-mono text-[11px] tracking-[0.4em] uppercase text-[color:var(--ink-mute)] mb-3">
            WorkLens · Atelier · Volume 04 · Read Only
          </div>
          <h1 className="masthead-title text-[76px]">
            工坊<span className="text-[color:var(--cinnabar)]">·</span>只读
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="ff-mono text-xs text-[color:var(--ink-mute)]">
              WorkLens / Atelier · v4
            </span>
            <span className="w-6 h-px bg-[color:var(--rule-strong)]" />
            <span className="ff-serif italic text-sm text-[color:var(--ink-soft)]">
              只呈现公开证据 · 不安装 · 不执行 · 不流转
            </span>
          </div>
        </div>
        <div className="vertical-rl pb-2">GITHUB · PUBLIC EVIDENCE ONLY</div>
      </div>

      <hr className="hr-thick mt-6 mb-5" />

      <div className="flex items-center flex-wrap gap-x-10 gap-y-3">
        <StatBlock num={queueTotal !== null && queueTotal !== undefined ? queueTotal : '—'} label="待审 Skill" hint="全部进入人工评测队列" />
        <StatBlock num={circleTotal !== null && circleTotal !== undefined ? circleTotal : '—'} label="核心人物" hint="外部弱信号，不计背书" />
        <StatBlock num="0" label="自动安装" hint="Policy · auto_install = false" />
        <StatBlock num="0" label="自动流转" hint="candidate 之后必须人工" />
        <div className="ml-auto text-right">
          <div className="ff-mono text-[10px] text-[color:var(--ink-mute)] uppercase tracking-[0.1em]">
            数据更新
          </div>
          <div className="ff-serif text-base text-[color:var(--ink)] mt-1">
            Skill 队列 · <span className="ff-mono text-sm">{queueUpdated || '—'}</span>
          </div>
          <div className="ff-serif text-base text-[color:var(--ink)]">
            核心圈层 · <span className="ff-mono text-sm">{circleUpdated || '—'}</span>
          </div>
        </div>
      </div>

      <div className="safety-banner mt-6">
        <span className="safety-banner__badge">Safety Boundary</span>
        <span className="safety-banner__item">
          待审队列 <span className="ff-mono not-italic text-[color:var(--paper)]">auto_install = false</span>，永不自动安装；
        </span>
        <span className="safety-banner__sep">·</span>
        <span className="safety-banner__item">仅展示 GitHub 公开元数据；</span>
        <span className="safety-banner__sep">·</span>
        <span className="safety-banner__item">不安装、不执行、不流转，所有决定留给真人。</span>
      </div>

      {loadError ? (
        <div className="mt-4 border border-[color:var(--cinnabar)] bg-[color:var(--paper-warm)] p-3 text-sm text-[color:var(--cinnabar-ink)] ff-serif">
          <span className="ff-mono text-xs uppercase tracking-[0.1em] mr-2">Data Notice</span>
          {loadError}
        </div>
      ) : null}
    </header>
  );
}

// ---------- Skill 待审队列 ----------

function CheckCell({ item }) {
  const bucket = item.status === 'pass' ? 'pass'
    : item.status === 'warn' ? 'warn'
    : item.status === 'fail' ? 'fail'
    : 'missing';
  return (
    <div className={`check-cell check-cell--${bucket}`} title={item.evidence || item.statusLabel}>
      <span className={`check-cell__badge check-cell__badge--${bucket}`} />
      <div className="check-cell__label">{item.label}</div>
      <div className="check-cell__status">{item.statusLabel}</div>
    </div>
  );
}

function QueueCard({ entry }) {
  const [open, setOpen] = useState(false);
  const stateClass = `state-ribbon state-ribbon--${entry.state}`;
  const progress = entry.total ? Math.round((entry.passed / entry.total) * 100) : 0;
  const evidenceCount = entry.blockingList.filter((c) => c.evidence).length;
  return (
    <article className="lib-card p-5 anim-in">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={stateClass}>{entry.stateLabel}</span>
            <span className="dewey-chip">{entry.id}</span>
          </div>
          <h3 className="ff-serif font-semibold text-xl leading-tight break-all">
            <a
              className="ulink"
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {entry.owner}<span className="text-[color:var(--ink-mute)]">/</span>{entry.repo}
            </a>
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[color:var(--ink-mute)] ff-mono">
            <span>许可证 · {entry.license}</span>
            <span>★ {entry.starsCompact}</span>
            <span>最近推送 · {entry.pushedAt}</span>
            {entry.archived ? <span className="text-[color:var(--cinnabar)]">已归档</span> : null}
          </div>
        </div>
        <div className="text-right shrink-0 min-w-[120px]">
          <div className="ff-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-mute)]">阻断项通过</div>
          <div className="ff-serif text-2xl font-semibold leading-none mt-1">
            {entry.passed}<span className="text-[color:var(--ink-mute)] text-base">/{entry.total}</span>
          </div>
          <div className="progress-rail mt-2">
            <div
              className={`progress-rail__fill${progress < 100 ? ' progress-rail__fill--partial' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {entry.trialScope ? (
        <div className="trial-scope mb-3">
          <div className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--forest-ink)] mb-1">
            Trial Scope · {entry.trialStarted} → {entry.trialPlannedEnd}
          </div>
          {entry.trialScope}
        </div>
      ) : null}

      <div className="check-grid mb-3">
        {entry.blockingList.map((item) => <CheckCell key={item.key} item={item} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {entry.pendingLabels.length === 0 ? (
          <span className="tag-pill tag-pill--filled">阻断项全通过</span>
        ) : (
          <>
            <span className="ff-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-mute)]">待补</span>
            {entry.pendingLabels.map((label) => (
              <span key={label} className="tag-pill">{label}</span>
            ))}
          </>
        )}
        {entry.riskFlags.map((flag) => (
          <span key={flag} className="tag-pill tag-pill--risk">⚑ {flag}</span>
        ))}
      </div>

      <button
        type="button"
        className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-mute)] hover:text-[color:var(--ink)]"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '收起证据链' : `展开 ${evidenceCount} 条证据`}
      </button>

      {open ? (
        <ul className="mt-3 border-t border-dashed border-[color:var(--rule)] pt-3 space-y-2">
          {entry.blockingList.map((item) => (
            <li key={item.key} className="text-xs text-[color:var(--ink-soft)]">
              <span className="ff-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-mute)] mr-2">
                {item.label} · {item.statusLabel}
              </span>
              <span className="ff-serif">{item.evidence || '未留证据'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function QueueGroup({ group }) {
  return (
    <div className="mb-10">
      <div className="group-head">
        <span className="group-head__count">{group.items.length}</span>
        <span className="group-head__label">{group.label}</span>
        <span className="group-head__meta ml-auto">{group.state}</span>
      </div>
      {group.empty ? (
        <div className="empty-slot mt-3">本状态下暂无条目——这是正常现象，意味着没有候选处在该阶段。</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          {group.items.map((entry) => <QueueCard key={entry.id} entry={entry} />)}
        </div>
      )}
    </div>
  );
}

function QueueBoard({ board }) {
  if (!board.available) {
    return (
      <div className="empty-slot">
        未能加载 Skill 待审队列数据 ({board.reason}). {PREVIEW_HINT}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.trial}</div>
          <div className="stat-label">限范围试用</div>
          <div className="ff-serif italic text-xs text-[color:var(--ink-mute)] mt-1">只读、7 天复盘</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.screening}</div>
          <div className="stat-label">评测中</div>
          <div className="ff-serif italic text-xs text-[color:var(--ink-mute)] mt-1">人工正在审查</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.needsChanges}</div>
          <div className="stat-label">待整改</div>
          <div className="ff-serif italic text-xs text-[color:var(--ink-mute)] mt-1">返工后再评估</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.candidate}</div>
          <div className="stat-label">候选</div>
          <div className="ff-serif italic text-xs text-[color:var(--ink-mute)] mt-1">尚未人工介入</div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-mute)]">
          Blocking Checks · 7 项
        </span>
        {board.blockingChecks.map((c) => (
          <span key={c.key} className="ff-serif text-sm text-[color:var(--ink-soft)]">
            {c.label}
          </span>
        ))}
      </div>

      {board.groups.map((group) => <QueueGroup key={group.state} group={group} />)}
    </>
  );
}

// ---------- 核心开源者圈层 ----------

function PersonCard({ person }) {
  const tierKey = person.tier || 'watch';
  const tierLabel = TIER_LABELS[tierKey] || person.tier || '观察';
  return (
    <article className="lib-card p-5 anim-in">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`tier-badge tier-badge--${tierKey}`}>{tierLabel}</span>
            <span className="pulse pulse--live" title="公开 GitHub 元数据" />
          </div>
          <h3 className="ff-serif font-semibold text-2xl leading-tight">
            <a className="ulink" href={person.profileUrl} target="_blank" rel="noopener noreferrer">
              {person.login}
            </a>
          </h3>
          {person.tierReason ? (
            <p className="ff-serif italic text-sm text-[color:var(--ink-soft)] mt-1 max-w-md">
              {person.tierReason}
            </p>
          ) : null}
        </div>
        <div className="text-right ff-mono text-[10px] text-[color:var(--ink-mute)] uppercase tracking-[0.08em]">
          <div>profile · checked</div>
          <div className="text-sm text-[color:var(--ink-soft)] ff-mono mt-1">{person.profileCheckedAt}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="border border-[color:var(--rule)] p-3 bg-[color:var(--paper)]">
          <div className="stat-num">{person.publicRepos}</div>
          <div className="stat-label">公开仓库</div>
        </div>
        <div className="border border-[color:var(--rule)] p-3 bg-[color:var(--paper)]">
          <div className="stat-num">{person.followersCompact}</div>
          <div className="stat-label">Followers</div>
          <div className="ff-serif italic text-[11px] text-[color:var(--cinnabar-ink)] mt-1">
            弱信号 · 不作背书
          </div>
        </div>
        <div className="border border-[color:var(--rule)] p-3 bg-[color:var(--paper)]">
          <div className="stat-num">{person.following}</div>
          <div className="stat-label">Following</div>
        </div>
      </div>

      {person.qualityNote ? (
        <div className="mt-4 border-l-2 border-[color:var(--cinnabar)] pl-3">
          <div className="ff-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-mute)] mb-1">
            质量注记
          </div>
          <p className="ff-serif text-sm text-[color:var(--ink)]">{person.qualityNote}</p>
        </div>
      ) : null}

      {person.evidenceUrl ? (
        <div className="mt-3 text-xs text-[color:var(--ink-mute)] ff-mono break-all">
          evidence · <a className="ulink" href={person.evidenceUrl} target="_blank" rel="noopener noreferrer">{person.evidenceUrl.replace(/^https?:\/\//, '')}</a>
        </div>
      ) : null}
    </article>
  );
}

function ProjectRow({ project }) {
  const readmeMissing = project.readme === 'missing';
  return (
    <article className="lib-card p-4 anim-in">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-[64px] text-center">
          <div className="ff-mono text-[10px] text-[color:var(--ink-mute)] uppercase tracking-[0.08em]">★</div>
          <div className="ff-serif text-2xl font-semibold leading-none">{project.starsCompact}</div>
          <div className="ff-mono text-[10px] text-[color:var(--ink-mute)] mt-2">forks</div>
          <div className="ff-serif text-base leading-none">{project.forks}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rec-chip ${project.recommendation ? 'rec-chip--yes' : 'rec-chip--no'}`}>
              {project.recommendation ? '推荐研读' : '暂不推荐'}
            </span>
            {CATEGORY_LABELS[project.category] ? (
              <span className="tag-pill tag-pill--filled">{CATEGORY_LABELS[project.category]}</span>
            ) : project.category ? (
              <span className="tag-pill">{project.category}</span>
            ) : null}
            <span className="tag-pill">状态 · {project.status || '观察'}</span>
          </div>
          <h3 className="ff-serif font-semibold text-xl leading-tight break-all">
            <a className="ulink" href={project.url} target="_blank" rel="noopener noreferrer">
              {project.fullName}
            </a>
          </h3>
          {project.description ? (
            <p className="ff-serif text-sm text-[color:var(--ink-soft)] mt-1 italic">{project.description}</p>
          ) : null}
          {project.reason ? (
            <p className="text-sm text-[color:var(--ink)] mt-2">{project.reason}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs ff-mono text-[color:var(--ink-mute)]">
            <span>许可证 · <span className={project.license ? 'text-[color:var(--ink)]' : 'text-[color:var(--cinnabar)]'}>{project.licenseLabel}</span></span>
            <span>README · {readmeMissing ? <span className="text-[color:var(--cinnabar)]">缺失</span> : project.readme}</span>
            <span>最近推送 · {project.pushedAt}</span>
            <span>更新 · {project.updatedAt}</span>
            <span>Releases · {project.releases}</span>
            <span>默认分支 · {project.defaultBranch || '未知'}</span>
          </div>
          {!project.license ? (
            <div className="mt-2 ff-serif italic text-[12px] text-[color:var(--cinnabar-ink)]">
              规则 · 无许可证不推荐研读与再分发
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CircleBoard({ board }) {
  if (!board.available) {
    return (
      <div className="empty-slot">
        未能加载核心圈层数据 ({board.reason}). {PREVIEW_HINT}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="lib-card p-4">
          <div className="stat-num">{board.people.length}</div>
          <div className="stat-label">核心人物</div>
          <div className="ff-serif italic text-xs text-[color:var(--ink-mute)] mt-1">仅公开 Profile</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.projects.length}</div>
          <div className="stat-label">在观察项目</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.recommendedCount}</div>
          <div className="stat-label">推荐研读</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.noLicenseCount}</div>
          <div className="stat-label">无许可证</div>
          <div className="ff-serif italic text-xs text-[color:var(--cinnabar-ink)] mt-1">不推荐</div>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6">
        <div>
          <div className="group-head mb-4">
            <span className="group-head__count">{board.people.length}</span>
            <span className="group-head__label">人物 · People</span>
            <span className="group-head__meta ml-auto">public evidence</span>
          </div>
          {board.people.length === 0 ? (
            <div className="empty-slot">当前名册为空。</div>
          ) : (
            <div className="space-y-4">
              {board.people.map((person) => <PersonCard key={person.login} person={person} />)}
            </div>
          )}
        </div>

        <div>
          <div className="group-head mb-4">
            <span className="group-head__count">{board.projects.length}</span>
            <span className="group-head__label">项目 · Projects</span>
            <span className="group-head__meta ml-auto">watch list</span>
          </div>
          {board.projects.length === 0 ? (
            <div className="empty-slot">观察列表为空。</div>
          ) : (
            <div className="space-y-4">
              {board.projects.map((project) => <ProjectRow key={project.fullName} project={project} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Idea 项目化流程 ----------

function IdeaPipelineBoard({ board }) {
  if (!board.available) {
    return (
      <div className="empty-slot">
        未能加载 Idea 项目化流程数据 ({board.reason}). {PREVIEW_HINT}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.total}</div>
          <div className="stat-label">项目化 Idea</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.research}</div>
          <div className="stat-label">调研中</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.autoScaffold ? '1' : '0'}</div>
          <div className="stat-label">自动脚手架</div>
          <div className="ff-serif italic text-xs text-[color:var(--cinnabar-ink)] mt-1">必须保持 0</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.automationMaxStage || '—'}</div>
          <div className="stat-label">自动化上限</div>
        </div>
      </div>

      {board.ideas.length === 0 ? (
        <div className="empty-slot">当前没有项目化 Idea。</div>
      ) : (
        <div className="space-y-4">
          {board.ideas.map((idea) => (
            <article key={idea.id} className="lib-card p-5 anim-in">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="dewey-chip">{idea.id}</span>
                    <span className="tag-pill tag-pill--filled">当前 · {idea.stageLabel}</span>
                    <span className="tag-pill">证据 · {idea.evidenceCount}</span>
                    <span className="tag-pill">历史 · {idea.historyCount}</span>
                  </div>
                  <h3 className="ff-serif font-semibold text-2xl leading-tight">{idea.title}</h3>
                  <p className="ff-serif italic text-sm text-[color:var(--ink-soft)] mt-2 max-w-3xl">{idea.summary}</p>
                </div>
                <div className="text-right shrink-0 min-w-[120px]">
                  <div className="ff-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-mute)]">流程进度</div>
                  <div className="ff-serif text-3xl font-semibold leading-none mt-1">{idea.progress}%</div>
                  <div className="progress-rail mt-2">
                    <div className="progress-rail__fill progress-rail__fill--partial" style={{ width: `${idea.progress}%` }} />
                  </div>
                </div>
              </div>
              {idea.researchNotes ? (
                <div className="trial-scope mt-3">
                  <div className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--forest-ink)] mb-1">
                    Research Notes
                  </div>
                  {idea.researchNotes}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- 推荐复盘（只读） ----------

function ReviewCard({ entry }) {
  const verdictClass = ['keep', 'downgrade', 'remove'].includes(entry.conclusion)
    ? `verdict-chip--${entry.conclusion}`
    : 'verdict-chip--unknown';
  return (
    <article className="lib-card p-5 anim-in">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="dewey-chip">{entry.id}</span>
            <span className={`verdict-chip ${verdictClass}`}>结论 · {entry.conclusionLabel}</span>
            <span className="tag-pill">{entry.authorityLabel}</span>
            <span className="tag-pill">渠道 · {entry.channelLabel}</span>
          </div>
          <h3 className="ff-serif font-semibold text-2xl leading-tight break-all">
            {entry.subject.url ? (
              <a className="ulink" href={entry.subject.url} target="_blank" rel="noopener noreferrer">
                {entry.subject.owner}<span className="text-[color:var(--ink-mute)]">/</span>{entry.subject.repo}
              </a>
            ) : entry.subject.fullName}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[color:var(--ink-mute)] ff-mono">
            <span>推荐 · {entry.recommendedAtLabel}</span>
            <span>观察窗口 · {entry.window.fromLabel} → {entry.window.toLabel}</span>
            <span>快照 ★ {entry.snapshot.starsLabel}</span>
            <span>许可证 · {entry.snapshot.licenseLabel}</span>
            <span>最近推送 · {entry.snapshot.pushedAtLabel}</span>
            {entry.snapshot.archived ? <span className="text-[color:var(--cinnabar)]">已归档</span> : null}
          </div>
        </div>
        <div className="text-right shrink-0 min-w-[120px]">
          <div className="ff-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-mute)]">复盘时间</div>
          <div className="ff-serif text-xl font-semibold leading-none mt-1">{entry.reviewedAtLabel}</div>
          <div className="ff-mono text-[10px] text-[color:var(--ink-mute)] mt-2">by {entry.reviewedBy}</div>
        </div>
      </div>

      <div className="trial-scope mb-3">
        <div className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--forest-ink)] mb-1">
          当时推荐理由 · 信号 {entry.signalSource}
        </div>
        {entry.reason}
      </div>

      <div className="space-y-2 mb-3">
        {entry.facts.map((fact, index) => (
          <div key={`${fact.observedAtLabel}-${fact.sourceUrl}-${fact.text.slice(0, 16)}`} className="flex gap-3 text-sm ff-serif text-[color:var(--ink)]">
            <span className="ff-mono text-[10px] text-[color:var(--ink-mute)] shrink-0 pt-1">{String(index + 1).padStart(2, '0')}</span>
            <div>
              {fact.text}
              {fact.sourceUrl ? (
                <span className="ml-2 ff-mono text-[10px]">
                  [
                  <a className="ulink" href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">
                    公开证据 · {fact.observedAtLabel}
                  </a>
                  ]
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="border-l-4 border-[color:var(--cinnabar)] pl-3 py-1 ff-serif text-sm text-[color:var(--cinnabar-ink)]">
        <span className="ff-mono not-italic text-[10px] uppercase tracking-[0.12em] mr-2">画像 / 推荐调整（人工说明）</span>
        {entry.adjustment}
      </div>
      {entry.policyRef ? (
        <div className="ff-serif italic text-xs text-[color:var(--ink-mute)] mt-2">策略依据：{entry.policyRef}</div>
      ) : null}
    </article>
  );
}

function ReviewBoard({ board }) {
  if (!board.available) {
    return (
      <div className="empty-slot">
        未能加载推荐复盘数据 ({board.reason}). {PREVIEW_HINT}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.total}</div>
          <div className="stat-label">复盘记录</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.keep}</div>
          <div className="stat-label">保留</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.totals.downgrade}</div>
          <div className="stat-label">降权</div>
        </div>
        <div className="lib-card p-4">
          <div className="stat-num">{board.autoAdjustProfile ? '1' : '0'}</div>
          <div className="stat-label">自动调整画像</div>
          <div className="ff-serif italic text-xs text-[color:var(--cinnabar-ink)] mt-1">必须保持 0</div>
        </div>
      </div>

      {board.reviews.length === 0 ? (
        <div className="empty-slot">当前没有推荐复盘记录。</div>
      ) : (
        <div className="space-y-4">
          {board.reviews.map((entry) => <ReviewCard key={entry.id} entry={entry} />)}
        </div>
      )}
    </>
  );
}

// ---------- 根组件 ----------

function App() {
  const [state, setState] = useState({
    loading: true,
    queue: null,
    circle: null,
    ideas: null,
    reviews: null,
    discoveries: null,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadJson(path) {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        return { __error: err && err.message ? err.message : String(err), __path: path };
      }
    }

    (async () => {
      const [queueRaw, circleRaw, ideasRaw, reviewsRaw, discoveriesRaw] = await Promise.all([
        loadJson(DATA_SOURCES.queue),
        loadJson(DATA_SOURCES.circle),
        loadJson(DATA_SOURCES.ideas),
        loadJson(DATA_SOURCES.reviews),
        loadJson(DATA_SOURCES.discoveries),
      ]);
      if (cancelled) return;

      const problems = [];
      const queueOk = queueRaw && !queueRaw.__error;
      const circleOk = circleRaw && !circleRaw.__error;
      const ideasOk = ideasRaw && !ideasRaw.__error;
      const reviewsOk = reviewsRaw && !reviewsRaw.__error;
      if (!queueOk) problems.push(`${DATA_SOURCES.queue} 加载失败：${queueRaw && queueRaw.__error}`);
      if (!circleOk) problems.push(`${DATA_SOURCES.circle} 加载失败：${circleRaw && circleRaw.__error}`);
      if (!ideasOk) problems.push(`${DATA_SOURCES.ideas} 加载失败：${ideasRaw && ideasRaw.__error}`);
      if (!reviewsOk) problems.push(`${DATA_SOURCES.reviews} 加载失败：${reviewsRaw && reviewsRaw.__error}`);

      setState({
        loading: false,
        queue: queueOk ? queueRaw : null,
        circle: circleOk ? circleRaw : null,
        ideas: ideasOk ? ideasRaw : null,
        reviews: reviewsOk ? reviewsRaw : null,
        discoveries: discoveriesRaw && !discoveriesRaw.__error ? discoveriesRaw : null,
        error: problems.length ? problems.join(' ｜ ') + ' ｜ ' + PREVIEW_HINT : '',
      });
    })();

    return () => { cancelled = true; };
  }, []);

  const queueBoard = useMemo(() => {
    if (!state.queue) return MODEL.buildEmptyQueueBoard(state.error ? 'load_failed' : (state.loading ? 'loading' : 'data_absent'));
    return MODEL.buildQueueBoard(state.queue);
  }, [state.queue, state.loading, state.error]);

  const circleBoard = useMemo(() => {
    if (!state.circle) return MODEL.buildEmptyCircleBoard(state.error ? 'load_failed' : (state.loading ? 'loading' : 'data_absent'));
    return MODEL.buildCircleBoard(state.circle);
  }, [state.circle, state.loading, state.error]);

  const ideaPipelineBoard = useMemo(() => {
    if (!state.ideas) return MODEL.buildEmptyIdeaPipelineBoard(state.error ? 'load_failed' : (state.loading ? 'loading' : 'data_absent'));
    return MODEL.buildIdeaPipelineBoard(state.ideas);
  }, [state.ideas, state.loading, state.error]);

  const reviewBoard = useMemo(() => {
    if (!state.reviews) return REVIEW_MODEL.buildEmptyReviewBoard(state.error ? 'load_failed' : (state.loading ? 'loading' : 'data_absent'));
    return REVIEW_MODEL.buildReviewBoard(state.reviews);
  }, [state.reviews, state.loading, state.error]);

  return (
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-10">
        <Masthead
          queueUpdated={queueBoard.available ? queueBoard.generatedLabel : (state.loading ? '加载中…' : '未加载')}
          circleUpdated={circleBoard.available ? circleBoard.generatedLabel : (state.loading ? '加载中…' : '未加载')}
          queueTotal={queueBoard.available ? queueBoard.totals.total : null}
          circleTotal={circleBoard.available ? circleBoard.people.length : null}
          loadError={state.error}
        />

        <Section
          eyebrow="A · Skill Review Queue"
          title="Skill 待审队列看板"
          sub="每一条候选都要通过 7 项阻断检查并经过真人决定，才能继续向下流转。本面板只呈现当前状态与证据，不提供安装、流转或执行入口。"
          trailing={queueBoard.available ? `${queueBoard.totals.total} 条 · updated ${queueBoard.generatedLabel}` : ''}
        >
          <QueueBoard board={queueBoard} />
        </Section>

        <Section
          eyebrow="B · Core Open-Source Circle"
          title="核心开源者圈层"
          sub="维护一张克制的名册：先记录公开 Profile 与仓库证据，再决定研读与否。followers / stars 只作弱信号；无许可证不推荐研读与再分发。"
          trailing={circleBoard.available ? `${circleBoard.people.length} 人 · ${circleBoard.projects.length} 项目 · updated ${circleBoard.generatedLabel}` : ''}
        >
          <CircleBoard board={circleBoard} />
        </Section>

        <Section
          eyebrow="C · Idea Project Pipeline"
          title="Idea 项目化闭环"
          sub="每个 Idea 只能沿 idea、research、plan、scaffold、accepted 单向推进；自动化最多停在调研阶段，方案、脚手架和验收都必须由真人记录。本面板只读展示，不创建外部任务、不生成脚手架、不安装 Skill。"
          trailing={ideaPipelineBoard.available ? `${ideaPipelineBoard.totals.total} 项 · updated ${ideaPipelineBoard.generatedLabel}` : ''}
        >
          <IdeaPipelineBoard board={ideaPipelineBoard} />
        </Section>

        <Section
          eyebrow="D · Recommendation Review"
          title="推荐复盘"
          sub="为「发现 → 推荐」留下公开复盘：对象必须来自 discoveries 公开候选，事实只引用公开链接。自动化在真人策略下最多记录降权，移除与画像规则固化必须由真人完成；本面板只读，不自动调整画像、不改写推荐。"
          trailing={reviewBoard.available ? `${reviewBoard.totals.total} 条 · updated ${reviewBoard.generatedLabel}` : ''}
        >
          <ReviewBoard board={reviewBoard} />
        </Section>

        <footer className="py-10 border-t border-[color:var(--rule)] mt-6">
          <div className="ornament mb-4">WorkLens · Atelier</div>
          <div className="grid grid-cols-[1fr_auto] gap-6 items-end">
            <p className="ff-serif italic text-sm text-[color:var(--ink-soft)] max-w-2xl">
              本页为 WorkLens 的只读工坊：数据来自 <span className="ff-mono not-italic">data/*.json</span>，
              由仓库 Actions 定期采集；不含私有工作内容、不含凭证、不展示会议 / IM / 浏览历史等私有信号。
            </p>
            <div className="text-right">
              <div className="ff-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-mute)]">Routes</div>
              <div className="ff-mono text-xs text-[color:var(--ink-soft)] mt-1 space-y-0.5">
                <div>/</div>
                <div>/desktop/</div>
                <div className="text-[color:var(--cinnabar)]">/atelier/ ← 当前</div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
