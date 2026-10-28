/* @jsxRuntime classic */
/* global React */
/* ================================================================
   WorkLens v3 · 全部视图
   01 本期策展  02 发现管道  03 藏书架  04 深度阅读
   05 学习路径  06 引入复盘  07 工作画像
   08 技能工坊 Skill Studio（AI 工程能力）—— v3 新增
   09 推送中心 & 演化日志                       —— v3 新增
   ---------------------------------------------------------------- */
(function () {
  const { useState, useMemo } = React;
  const D = window.WL_DATA;
  const C = window.WL_COMP;

  /* ==================== 01 HERO · 本期策展头版 ==================== */
  function HeroView({ goto, openEntry, taste, onTaste }) {
    const headline = enrich(D.ENTRIES[0], taste);
    const secondary = D.ENTRIES.slice(1, 4).map(e => enrich(e, taste));
    const sourceOkCount = D.SOURCES.filter(source => source.health >= 0.8).length;
    const sourceTotalCount = D.SOURCES.length;

    const newProposals = D.SKILL_PROPOSALS.length;
    const newPushes = D.PUSHES.filter(p => !p.read).length;

    return (
      <div className="anim-in">
        {/* 刊头 */}
        <div className="pt-6 pb-4">
          <div className="ornament">创刊 2026 · 一人份的私家周刊</div>
          <div className="flex items-end justify-between mt-3">
            <div className="flex items-end gap-6">
              <div className="masthead-title" style={{fontSize: '96px'}}>WorkLens</div>
              <div className="pb-3">
                <div className="ff-serif italic text-[18px]" style={{color: 'var(--ink-mute)'}}>
                  —— 一本写给 Agent 时代工作者的田野杂志
                </div>
              </div>
            </div>
            <div className="text-right pb-3">
              <div className="issue-num">{D.ISSUE.volume}</div>
              <div className="ff-mono text-[11px] mt-1 tracking-widest uppercase" style={{color: 'var(--ink-mute)'}}>
                {D.ISSUE.issue} · {D.ISSUE.date}
              </div>
            </div>
          </div>
          <div className="ruler mt-4" />
          <hr className="hr-double mt-1" />
        </div>

        {/* v3 新增：喜好感召的推送横幅 */}
        <section className="my-5 lib-card p-4 flex items-center gap-4"
                 style={{background: 'linear-gradient(90deg, var(--parchment), var(--paper-warm))'}}>
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
               style={{background: 'var(--cinnabar)', color: 'var(--parchment)'}}>
            <C.I.sparkle />
          </div>
          <div className="flex-1">
            <div className="ff-mono text-[9.5px] uppercase tracking-[0.3em]" style={{color: 'var(--cinnabar)'}}>
              因你本周的 ❤ · Agent 的回礼
            </div>
            <div className="ff-serif text-[17px] mt-0.5" style={{letterSpacing: '-0.01em'}}>
              新孕育 <em className="not-italic font-semibold" style={{color: 'var(--cinnabar)'}}>{newProposals}</em> 条 Skill 建议 ·
              推送中心 <em className="not-italic font-semibold" style={{color: 'var(--cinnabar)'}}>{newPushes}</em> 条匹配你口味的新线索
            </div>
          </div>
          <button className="btn btn--primary" onClick={() => goto('studio')}>进入技能工坊 <C.I.arrowRight /></button>
          <button className="btn btn--ghost" onClick={() => goto('push')}>查看推送</button>
        </section>

        {/* 五大数字 */}
        <div className="grid grid-cols-5 gap-6 py-6 border-b" style={{borderColor: 'var(--rule)'}}>
          <C.Stat num={D.ISSUE.stats.scanned} label="本周扫描" />
          <C.Stat num={D.ISSUE.stats.shortlisted} label="Agent 入围" />
          <C.Stat num={D.ISSUE.stats.curated} label="本期收录" accent />
          <C.Stat num={D.TASTE_SUMMARY.week_likes} label="本周 ❤" sub={`累计 ${D.TASTE_SUMMARY.total_likes} · 新订阅 ${D.TASTE_SUMMARY.week_subscriptions}`} accent />
          <div className="pl-6 border-l" style={{borderColor: 'var(--rule)'}}>
            <div className="stat-label">编辑部</div>
            <div className="ff-serif text-[15px] mt-1" style={{letterSpacing: '-0.01em'}}>
              主编 · <em>你本人</em>
            </div>
            <div className="ff-serif italic text-[13px]" style={{color: 'var(--ink-mute)'}}>
              策展人与研究 Agent · WorkLens
            </div>
          </div>
        </div>

        {/* 策展人手记 + 头条 */}
        <div className="grid gap-10 pt-8 wl-hero-grid" style={{gridTemplateColumns: '280px 1fr 300px'}}>
          <aside>
            <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>
              策展人手记
            </div>
            <h4 className="ff-serif text-[22px] font-semibold mb-3 leading-tight" style={{letterSpacing: '-0.015em'}}>
              Agent 作为图书管理员
            </h4>
            <p className="ff-serif text-[14px] leading-[1.65] drop-cap" style={{color: 'var(--ink-soft)'}}>
              {D.ISSUE.curator_note}
            </p>
            <div className="mt-6 sidenote">
              每一次 ❤ 都会被写进我的权重账本。每周三 09:00 合刊；若有紧急发现，Agent 会推号外。
            </div>
          </aside>

          <main>
            <div className="flex items-center gap-3 mb-3">
              <span className="shelf-tab">本周头条</span>
              <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{headline.dewey}</span>
              <C.VerdictPill v={headline.verdict} />
            </div>
            <h1 className="ff-serif font-bold leading-[0.95] mb-3 wl-headline"
                style={{letterSpacing: '-0.025em'}}>
              {headline.title}<br/>
              <span className="ff-serif italic font-normal wl-headline-sub" style={{color: 'var(--ink-mute)'}}>
                —— {headline.sub}
              </span>
            </h1>

            <div className="flex items-center gap-3 mb-5 ff-mono text-[11px]" style={{color: 'var(--ink-mute)'}}>
              <C.I.gh /> <span>{headline.author}</span>
              <span>·</span>
              <span className="ulink">{headline.url}</span>
              <C.I.external />
            </div>

            <div className="reader-grid">
              <div>
                <p className="ff-serif text-[16px] leading-[1.7] mb-4" style={{color: 'var(--ink)'}}>
                  <span className="ff-serif font-semibold">为什么它值得本期头条？</span> {headline.why}
                </p>
                <p className="ff-serif text-[15px] leading-[1.7]" style={{color: 'var(--ink-soft)'}}>
                  可信边界：这张卡片只使用公开 GitHub 元数据、采集来源、许可证、更新时间与仓库描述；
                  WorkLens 不根据仓库名编造摘要，不写入私有会议、飞书原文、个人信息、凭证或内部地址。
                  当前来源状态为 {sourceOkCount}/{sourceTotalCount} 可用，失败来源会保留在「发现管道」里作为状态证据。
                </p>
                <div className="mt-5 flex gap-2">
                  <button className="btn btn--primary" onClick={() => openEntry(headline.id)}>
                    打开藏书卡片 <C.I.arrowRight />
                  </button>
                  <button className="btn">加入学习路径</button>
                  <button className="btn btn--ghost"><C.I.bookmark /> 稍后读</button>
                </div>

                {/* v3：头条位置也放 taste */}
                <div className="mt-4 inline-flex">
                  <C.TasteBar entry={headline} onChange={onTaste} />
                </div>
              </div>
              <aside className="pl-6 border-l" style={{borderColor: 'var(--rule)'}}>
                <div className="ff-mono text-[10px] uppercase tracking-widest mb-2" style={{color: 'var(--ink-mute)'}}>
                  Agent 建议动作
                </div>
                <ol className="space-y-2 ff-serif text-[13px]" style={{color: 'var(--ink)'}}>
                  <li className="flex gap-2"><span className="circ-num">1</span>{headline.action}</li>
                  {headline.notes.slice(0, 2).map((note, index) => (
                    <li key={note} className="flex gap-2"><span className="circ-num">{index + 2}</span>{note}</li>
                  ))}
                </ol>
                <div className="mt-5 sidenote">
                  "最有价值的开源项目往往不是最热门的，而是最适配你当前问题的。" <br/>— Agent, 00:21
                </div>
              </aside>
            </div>
          </main>

          <aside className="pl-6 border-l" style={{borderColor: 'var(--rule)'}}>
            <div className="flex items-baseline justify-between mb-3">
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em]" style={{color: 'var(--cinnabar)'}}>
                实时策展日志
              </div>
              <div className="flex items-center gap-1 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background: 'var(--forest)'}} />
                Agent 在线
              </div>
            </div>
            <C.FieldNotes notes={D.FIELD_NOTES} />
          </aside>
        </div>

        <div className="mt-10 pt-6 border-t" style={{borderColor: 'var(--rule-strong)'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="ff-serif text-[24px] font-semibold" style={{letterSpacing: '-0.02em'}}>
              本期其他收录
            </h3>
            <button className="btn btn--ghost" onClick={() => goto('shelf')}>
              进入藏书架 <C.I.arrowRight />
            </button>
          </div>
          <div className="grid gap-5" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
            {secondary.map(e => <C.LibraryCard key={e.id} entry={e} onOpen={openEntry} onTaste={onTaste} />)}
          </div>
        </div>
      </div>
    );
  }

  /* ==================== 02 PIPELINE ==================== */
  function PipelineView({ taste, onTaste }) {
    const [stage, setStage] = useState('评估');
    const items = D.ENTRIES.slice(0, 4).map(e => enrich(e, taste));

    return (
      <div className="anim-in">
        <ViewHeader
          num="02"
          title="发现管道"
          sub={`从 ${D.ISSUE.stats.scanned.toLocaleString()} 条真实候选到 ${D.ISSUE.stats.curated} 条页面展示；每个来源保留成功/失败、更新时间与队列规模。`}
        />

        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="ff-serif text-[18px] font-semibold">来源状态 · {D.SOURCES.length}</h3>
            <button className="btn btn--ghost"><C.I.plus /> 添加信息源</button>
          </div>
          <div className="grid gap-3" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>
            {D.SOURCES.map(s => (
              <div key={s.id} className="lib-card p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="ff-mono text-[10px] uppercase tracking-wider" style={{color: 'var(--ink-mute)'}}>
                    {s.freq}
                  </span>
                  <span className="ff-mono text-[11px]"
                        style={{color: s.health > 0.85 ? 'var(--forest)' : s.health > 0.7 ? 'var(--mustard)' : 'var(--cinnabar)'}}>
                    {Math.round(s.health * 100)}%
                  </span>
                </div>
                <div className="ff-serif text-[15px] font-semibold leading-tight mb-1" style={{letterSpacing: '-0.01em'}}>
                  {s.kind}
                </div>
                <div className="ff-serif italic text-[12px] mb-2.5" style={{color: 'var(--ink-mute)'}}>
                  {s.signal}
                </div>
                <div className="flex justify-between items-center ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
                  <span>上次 · {s.last}</span>
                  <span>队列 · {s.queued}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h3 className="ff-serif text-[18px] font-semibold mb-3">本周漏斗 · 2026-W43</h3>
          <C.Pipeline stages={D.PIPELINE} active={stage} onPick={setStage} />
        </section>

        <section className="grid gap-8" style={{gridTemplateColumns: '1fr 320px'}}>
          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="shelf-tab">阶段</span>
              <h3 className="ff-serif text-[24px] font-semibold" style={{letterSpacing: '-0.015em'}}>
                {stage} —— 待入下一阶段的候选
              </h3>
            </div>
            <div className="grid gap-3" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
              {items.map(e => <C.LibraryCard key={e.id} entry={e} onTaste={onTaste} />)}
            </div>
          </div>

          <aside className="lib-card p-5">
            <div className="ff-mono text-[10px] uppercase tracking-widest mb-2" style={{color: 'var(--cinnabar)'}}>
              Agent 当前规则
            </div>
            <h4 className="ff-serif text-[18px] font-semibold mb-3" style={{letterSpacing: '-0.015em'}}>
              {stage} 阶段评估准则
            </h4>
            <ol className="space-y-2.5 ff-serif text-[13.5px]" style={{color: 'var(--ink)'}}>
              <li className="flex gap-2.5"><span className="circ-num">1</span>匹配度 ≥ 70 · 新颖度 ≥ 60</li>
              <li className="flex gap-2.5"><span className="circ-num">2</span>有活跃维护者（30 天 ≥ 10 次提交）</li>
              <li className="flex gap-2.5"><span className="circ-num">3</span>可被 Skill 化或可直接集成</li>
              <li className="flex gap-2.5"><span className="circ-num">4</span>与现有 Skill 覆盖重合度 ≤ 60%</li>
              <li className="flex gap-2.5"><span className="circ-num">5</span>命中你本月订阅主题 → 匹配度自动 +12</li>
            </ol>
            <hr className="hr-thin my-4" />
            <div className="sidenote">
              规则由 Agent 自动演化：喜好账本每日注入权重；下架条目反向喂回匹配度模型。
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn">编辑规则</button>
              <button className="btn btn--ghost">查看演化历史</button>
            </div>
          </aside>
        </section>
      </div>
    );
  }

  /* ==================== 03 SHELF 藏书架 ==================== */
  function ShelfView({ openEntry, taste, onTaste }) {
    const [tags, setTags] = useState([]);
    const [kind, setKind] = useState('all');
    const [verdict, setVerdict] = useState('all');
    const [tasteFilter, setTasteFilter] = useState('all');

    const kindOpts = [
      { id: 'all',               label: '全部', count: D.ENTRIES.length },
      { id: 'Skill',             label: 'Skill' },
      { id: 'UI 组件',           label: 'UI 组件' },
      { id: '信息源',             label: '信息源' },
      { id: '读物',               label: '读物' },
      { id: '集成',               label: '集成' },
    ];
    const verdictOpts = [
      { id: 'all',      label: '全部' },
      { id: 'adopt',    label: '引入' },
      { id: 'evaluate', label: '评估中' },
      { id: 'shelf',    label: '上架' },
    ];
    const tasteOpts = [
      { id: 'all',     label: '全部' },
      { id: 'love',    label: '❤ 极喜欢' },
      { id: 'like',    label: '❤ 喜欢' },
      { id: 'none',    label: '未标记' },
      { id: 'dislike', label: '✕ 已降权' },
    ];

    const list = useMemo(() => {
      return D.ENTRIES.map(e => enrich(e, taste)).filter(e => {
        const t = e._taste;
        return (kind === 'all' || e.kind === kind) &&
          (verdict === 'all' || e.verdict === verdict) &&
          (tags.length === 0 || tags.every(x => e.tags.includes(x))) &&
          (tasteFilter === 'all' ||
            (tasteFilter === 'none' && !t) ||
            (tasteFilter === t));
      });
    }, [kind, verdict, tags, tasteFilter, taste]);

    const allTags = Array.from(new Set(D.ENTRIES.flatMap(e => e.tags))).slice(0, 14);

    return (
      <div className="anim-in">
        <ViewHeader
          num="03"
          title="藏书架"
          sub="全部已入库条目。按杜威式书架编号组织，支持多维筛选；现在也可以按你的喜好筛。"
        />

        <section className="mb-6">
          <div className="flex items-center gap-6 overflow-x-auto pb-2 border-b" style={{borderColor: 'var(--rule)'}}>
            {D.SHELVES.map(sh => (
              <button key={sh.code} className="flex items-baseline gap-2 whitespace-nowrap group">
                <span className="ff-mono text-[11px]" style={{color: 'var(--cinnabar)'}}>{sh.code}</span>
                <span className="ff-serif text-[16px] group-hover:text-[var(--cinnabar)]"
                      style={{letterSpacing: '-0.01em'}}>{sh.name}</span>
                <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>· {sh.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="ff-mono text-[10px] uppercase tracking-widest w-16" style={{color: 'var(--ink-mute)'}}>类型</span>
            <C.ChipGroup options={kindOpts} value={kind} onChange={setKind} />
          </div>
          <div className="flex items-center gap-3">
            <span className="ff-mono text-[10px] uppercase tracking-widest w-16" style={{color: 'var(--ink-mute)'}}>判定</span>
            <C.ChipGroup options={verdictOpts} value={verdict} onChange={setVerdict} />
          </div>
          <div className="flex items-center gap-3">
            <span className="ff-mono text-[10px] uppercase tracking-widest w-16" style={{color: 'var(--cinnabar)'}}>喜好</span>
            <C.ChipGroup options={tasteOpts} value={tasteFilter} onChange={setTasteFilter} />
          </div>
          <div className="flex items-start gap-3">
            <span className="ff-mono text-[10px] uppercase tracking-widest w-16 pt-1" style={{color: 'var(--ink-mute)'}}>标签</span>
            <C.ChipGroup
              options={allTags.map(t => ({ id: t, label: '#' + t }))}
              value={tags}
              multi
              onChange={(id) => setTags(tags.includes(id) ? tags.filter(x => x !== id) : [...tags, id])}
            />
          </div>
        </section>

        <div className="flex items-baseline justify-between mb-3">
          <span className="ff-serif italic text-[14px]" style={{color: 'var(--ink-mute)'}}>
            显示 {list.length} / {D.ENTRIES.length} 条
          </span>
          <div className="flex items-center gap-2">
            <button className="btn btn--ghost">按匹配度 ↓</button>
            <button className="btn btn--ghost">导出清单</button>
          </div>
        </div>

        <div className="grid gap-4" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
          {list.map(e => <C.LibraryCard key={e.id} entry={e} onOpen={openEntry} onTaste={onTaste} />)}
        </div>
      </div>
    );
  }

  /* ==================== 04 READER 深度阅读 ==================== */
  function ReaderView({ entryId, openEntry, goto, taste, onTaste }) {
    const raw = D.ENTRIES.find(e => e.id === entryId) || D.ENTRIES[0];
    const entry = enrich(raw, taste);
    const related = raw.related.map(id => enrich(D.ENTRIES.find(e => e.id === id), taste)).filter(Boolean);

    return (
      <div className="anim-in">
        <div className="pt-4 pb-2 flex items-center gap-2 ff-mono text-[10.5px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
          <span className="ulink" onClick={() => goto('shelf')}>藏书架</span>
          <C.I.chevron />
          <span>{entry.shelf}</span>
          <C.I.chevron />
          <span style={{color: 'var(--ink)'}}>{entry.dewey}</span>
        </div>

        <div className="flex gap-6 pt-4 pb-6 border-b" style={{borderColor: 'var(--rule-strong)'}}>
          <div className="flex-shrink-0 w-14 flex flex-col items-center justify-start">
            <div className="shelf-tab mb-2">{entry.dewey}</div>
            <div className="vertical-rl py-2">{entry.shelf}</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <C.VerdictPill v={entry.verdict} size="lg" />
              <span className="ff-mono text-[10.5px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
                {entry.kind}
              </span>
              <span className="ff-mono text-[10.5px]" style={{color: 'var(--ink-mute)'}}>· 入库 {entry.added}</span>
            </div>
            <h1 className="ff-serif font-bold leading-[0.98]"
                style={{fontSize: '56px', letterSpacing: '-0.03em'}}>
              {entry.title}
            </h1>
            <p className="ff-serif italic mt-2 text-[20px]" style={{color: 'var(--ink-mute)'}}>
              {entry.sub}
            </p>
            <div className="mt-4 flex items-center gap-3 ff-mono text-[11.5px] flex-wrap" style={{color: 'var(--ink-mute)'}}>
              <C.I.gh /> <span>{entry.author}</span>
              <span>·</span>
              <span className="ulink">{entry.url}</span>
              <C.I.external />
              <span>·</span>
              {entry.tags.map(t => <span key={t} className="tag-pill tag-pill--filled">#{t}</span>)}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <C.TasteBar entry={entry} onChange={onTaste} />
              <span className="ff-serif italic text-[12.5px]" style={{color: 'var(--ink-mute)'}}>
                你的一次 ❤ 会被写入喜好账本，影响下一期匹配度排序。
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 w-48 pl-6 border-l" style={{borderColor: 'var(--rule)'}}>
            <div className="stat-label mb-2">Agent 评分</div>
            <div className="space-y-2.5">
              <C.ScoreBar label="Fit"     value={entry.scores.fit} />
              <C.ScoreBar label="Novelty" value={entry.scores.novelty} />
              <C.ScoreBar label="Cost"    value={entry.scores.cost} invert />
              <C.ScoreBar label="Risk"    value={entry.scores.risk} invert />
            </div>
          </div>
        </div>

        <div className="reader-grid pt-8">
          <article>
            <section className="mb-8">
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>§ 理由</div>
              <h3 className="ff-serif text-[24px] font-semibold mb-3" style={{letterSpacing: '-0.015em'}}>为什么它值得被收录</h3>
              <p className="ff-serif text-[16px] leading-[1.75]" style={{color: 'var(--ink)'}}>{entry.why}</p>
            </section>

            <section className="mb-8">
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>§ 引入方案</div>
              <h3 className="ff-serif text-[24px] font-semibold mb-3" style={{letterSpacing: '-0.015em'}}>Agent 的引入方案</h3>
              <p className="ff-serif text-[16px] leading-[1.75]" style={{color: 'var(--ink)'}}>{entry.action}</p>

              <div className="mt-5 lib-card p-5" style={{background: 'var(--paper-warm)'}}>
                <div className="flex items-center gap-2 mb-3">
                  <C.I.sparkle style={{color: 'var(--cinnabar)'}} />
                  <span className="ff-mono text-[10.5px] uppercase tracking-widest">Agent · 建议的 WorkLens Skill 定义</span>
                </div>
                <pre className="ff-mono text-[11.5px] leading-[1.7] whitespace-pre-wrap" style={{color: 'var(--ink)'}}>
{`skill: wl.source.aisafety-hub
trigger: cron "0 */4 * * *"
inputs:  { tags: ["safety", "jailbreak"] }
outputs: { shortlist: Entry[], dedupe_with: "WL-240-012" }
score:   fit=0.78  novelty=0.71  cost_min=12  risk=low
derived_from: ${entry.url}`}
                </pre>
              </div>
            </section>

            <section className="mb-8">
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>§ 阅读笔记</div>
              <h3 className="ff-serif text-[24px] font-semibold mb-3" style={{letterSpacing: '-0.015em'}}>摘注与边注</h3>
              <ul className="space-y-3">
                {entry.notes.map((n, i) => (
                  <li key={i} className="flex gap-3 ff-serif text-[15px] leading-[1.65]">
                    <span className="circ-num flex-shrink-0 mt-1">{i + 1}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>

            {related.length > 0 && (
              <section>
                <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>§ 相关</div>
                <h3 className="ff-serif text-[24px] font-semibold mb-3" style={{letterSpacing: '-0.015em'}}>与之共振的条目</h3>
                <div className="grid gap-3" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
                  {related.map(r => <C.LibraryCard key={r.id} entry={r} onOpen={openEntry} onTaste={onTaste} />)}
                </div>
              </section>
            )}
          </article>

          <aside>
            <div className="sticky top-6 space-y-6">
              <div>
                <div className="stat-label mb-3">立即动作</div>
                <div className="space-y-2">
                  <button className="btn btn--cinnabar w-full justify-center">
                    引入工作流 · 创建 Skill 卡
                  </button>
                  <button className="btn w-full justify-center">加入学习路径 R-01</button>
                  <button className="btn btn--ghost w-full justify-center"><C.I.bookmark /> 稍后读</button>
                </div>
              </div>

              <hr className="hr-thin" />

              <div>
                <div className="stat-label mb-2">Agent 自评</div>
                <p className="sidenote">
                  这条收录对本周 Hero 做了结构启发；若 7 天内未被引入，我会把它降为上架层。
                </p>
              </div>

              <hr className="hr-thin" />

              <div>
                <div className="stat-label mb-2">元数据</div>
                <dl className="ff-mono text-[11px] space-y-1" style={{color: 'var(--ink-soft)'}}>
                  <div className="flex justify-between"><dt style={{color: 'var(--ink-mute)'}}>ID</dt><dd>{entry.id}</dd></div>
                  <div className="flex justify-between"><dt style={{color: 'var(--ink-mute)'}}>编号</dt><dd>{entry.dewey}</dd></div>
                  <div className="flex justify-between"><dt style={{color: 'var(--ink-mute)'}}>书架</dt><dd>{entry.shelf}</dd></div>
                  <div className="flex justify-between"><dt style={{color: 'var(--ink-mute)'}}>来源</dt><dd>{entry.source}</dd></div>
                  <div className="flex justify-between"><dt style={{color: 'var(--ink-mute)'}}>入库</dt><dd>{entry.added}</dd></div>
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  /* ==================== 05 ROUTES ==================== */
  function RoutesView({ openEntry }) {
    const [activeId, setActive] = useState('R-01');
    const active = D.ROUTES.find(r => r.id === activeId);

    return (
      <div className="anim-in">
        <ViewHeader
          num="05"
          title="学习路径"
          sub="把若干条目串成一条可执行的学习/构建路径。每条路径都有里程碑与可交付物。"
        />

        <div className="grid gap-8" style={{gridTemplateColumns: '320px 1fr'}}>
          <aside>
            {D.ROUTES.map(r => (
              <div
                key={r.id}
                className={`lib-card p-4 mb-3 cursor-pointer ${activeId === r.id ? 'lib-card--active' : ''}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="ff-mono text-[10px]" style={{color: 'var(--cinnabar)'}}>{r.id}</span>
                  <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{Math.round(r.progress*100)}%</span>
                </div>
                <h3 className="ff-serif text-[18px] font-semibold leading-tight" style={{letterSpacing: '-0.01em'}}>
                  {r.title}
                </h3>
                <p className="ff-serif italic text-[12.5px] mt-1" style={{color: 'var(--ink-mute)'}}>{r.sub}</p>
                <div className="score-bar mt-3"><div className="score-bar__fill" style={{width: (r.progress*100)+'%', background: 'var(--cinnabar)'}} /></div>
                <div className="ff-mono text-[10px] mt-1.5" style={{color: 'var(--ink-mute)'}}>{r.duration}</div>
              </div>
            ))}
            <button className="btn btn--ghost w-full justify-center mt-2"><C.I.plus /> 新建学习路径</button>
          </aside>

          <section>
            <div className="flex items-center gap-3 mb-2">
              <span className="shelf-tab">路径 · {active.id}</span>
              <span className="ff-mono text-[10px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
                {active.duration}
              </span>
            </div>
            <h2 className="ff-serif font-bold leading-tight mb-2"
                style={{fontSize: '42px', letterSpacing: '-0.025em'}}>{active.title}</h2>
            <p className="ff-serif italic text-[18px] mb-6" style={{color: 'var(--ink-mute)'}}>{active.sub}</p>

            <div className="route-timeline pl-0">
              {active.stages.map((st, i) => {
                const now = Math.round(active.progress * active.stages.length);
                const done = i < now;
                const current = i === now;
                return (
                  <div key={i} className="flex items-start mb-5">
                    <div className={`route-dot ${done ? 'route-dot--done' : current ? 'route-dot--now' : ''} mt-1`} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="ff-mono text-[11px]" style={{color: 'var(--cinnabar)'}}>{st.day}</span>
                        <h4 className="ff-serif text-[18px] font-semibold" style={{letterSpacing: '-0.01em'}}>{st.topic}</h4>
                        <span className="ff-mono text-[10px] ml-auto" style={{color: 'var(--ink-mute)'}}>投入 · {st.effort}</span>
                      </div>
                      <div className="ff-serif text-[14px] mb-2" style={{color: 'var(--ink-soft)'}}>
                        交付 ⟶ <em>{st.deliverable}</em>
                      </div>
                      {st.refs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {st.refs.map(id => {
                            const e = D.ENTRIES.find(x => x.id === id);
                            if (!e) return null;
                            return (
                              <span key={id} className="tag-pill tag-pill--filled cursor-pointer" onClick={() => openEntry(id)}>
                                <span style={{color: 'var(--cinnabar)'}} className="ff-mono mr-1">{e.dewey}</span>
                                {e.title}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  /* ==================== 06 LOOP ==================== */
  function LoopView() {
    const kept = D.ADOPTIONS.filter(a => a.metric.kept === true);
    const dropped = D.ADOPTIONS.filter(a => a.metric.kept === false);
    const watching = D.ADOPTIONS.filter(a => a.metric.kept === null);
    const totalSaved = D.ADOPTIONS.reduce((s, a) => s + a.metric.saved_min, 0);

    return (
      <div className="anim-in">
        <ViewHeader
          num="06"
          title="引入复盘"
          sub="引入后 30 天的使用追踪与保留决策。闭环的意义在于让「筛选」自我进化。"
        />

        <div className="grid grid-cols-4 gap-6 py-6 border-y mb-8" style={{borderColor: 'var(--rule)'}}>
          <C.Stat num={D.ADOPTIONS.length} label="已引入总数" />
          <C.Stat num={kept.length} label="30 天后仍保留" />
          <C.Stat num={dropped.length} label="复盘决定下架" />
          <C.Stat num={totalSaved + ' 分钟'} label="累计节省时间" accent sub="≈ 每周 86 分钟" />
        </div>

        <div className="grid gap-6" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
          <AdoptCol title="继续保留" tone="forest" items={kept} />
          <AdoptCol title="观察中"   tone="mustard" items={watching} />
          <AdoptCol title="已下架"   tone="cinnabar" items={dropped} />
        </div>

        <section className="mt-10 pt-6 border-t" style={{borderColor: 'var(--rule-strong)'}}>
          <div className="grid gap-10" style={{gridTemplateColumns: '1fr 1fr'}}>
            <div>
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>
                § Agent 月度反思
              </div>
              <h3 className="ff-serif text-[28px] font-semibold mb-3" style={{letterSpacing: '-0.02em'}}>
                这个月，我们筛掉了什么？
              </h3>
              <p className="ff-serif text-[15.5px] leading-[1.75]" style={{color: 'var(--ink)'}}>
                本月下架 <em className="not-italic font-semibold" style={{color: 'var(--cinnabar)'}}>1</em> 件引入物。
                共性是 <em>学习曲线过陡</em> + <em>与现有 Skill 覆盖重合</em>。为此我把
                「上手成本 ≤ 30 分钟」加入了 Adopt 阶段的硬门槛；下期起生效。
              </p>
              <div className="mt-5 sidenote">
                下架不是失败——它是把一次"评估"升级为"规则"的机会。
              </div>
            </div>
            <div>
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>
                § 待复盘
              </div>
              <h3 className="ff-serif text-[28px] font-semibold mb-3" style={{letterSpacing: '-0.02em'}}>
                11-10 待复盘
              </h3>
              <ul className="divide-y" style={{borderColor: 'var(--rule)'}}>
                {watching.map(a => (
                  <li key={a.id} className="py-3 flex justify-between items-baseline">
                    <div>
                      <div className="ff-serif text-[16px] font-semibold" style={{letterSpacing: '-0.01em'}}>{a.title}</div>
                      <div className="ff-mono text-[10.5px]" style={{color: 'var(--ink-mute)'}}>
                        已运行 {a.daysLive} 天 · 使用 {a.metric.usage} 次
                      </div>
                    </div>
                    <button className="btn btn--ghost">查看</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function AdoptCol({ title, tone, items }) {
    const colorMap = { forest: 'var(--forest)', mustard: 'var(--mustard)', cinnabar: 'var(--cinnabar)' };
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 inline-block" style={{background: colorMap[tone]}} />
            <h4 className="ff-serif text-[18px] font-semibold" style={{letterSpacing: '-0.01em'}}>{title}</h4>
          </div>
          <span className="ff-mono text-[11px]" style={{color: 'var(--ink-mute)'}}>{items.length}</span>
        </div>
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="lib-card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{a.id} · {a.entry}</span>
                <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>D+{a.daysLive}</span>
              </div>
              <h5 className="ff-serif text-[16px] font-semibold mb-2 leading-tight" style={{letterSpacing: '-0.01em'}}>
                {a.title}
              </h5>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="stat-label">使用次数</div>
                  <div className="ff-serif text-[22px] font-semibold" style={{letterSpacing: '-0.01em'}}>{a.metric.usage}</div>
                </div>
                <div>
                  <div className="stat-label">节省</div>
                  <div className="ff-serif text-[22px] font-semibold" style={{letterSpacing: '-0.01em'}}>
                    {a.metric.saved_min}<span className="ff-mono text-[11px] ml-1" style={{color: 'var(--ink-mute)'}}>分钟</span>
                  </div>
                </div>
              </div>
              <p className="ff-serif italic text-[12.5px]" style={{color: 'var(--ink-soft)'}}>{a.note}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ==================== 07 PROFILE 工作画像 ==================== */
  function ProfileView() {
    const sources = [...D.PROFILE_SOURCES, D.TASTE_SOURCE];  /* v3：注入 taste 作为第 9 条信号 */
    const radar = D.PROFILE_RADAR;
    const keywords = D.PROFILE_KEYWORDS;
    const timemap = D.PROFILE_TIMEMAP;
    const evidence = D.PROFILE_EVIDENCE;
    const privacy = D.PRIVACY_RULES;
    const summary = D.TASTE_SUMMARY;

    return (
      <div className="anim-in">
        <ViewHeader
          num="07"
          title="工作画像"
          sub="把日常工作中的 9 条信号编织成一面镜子；你的每一次 ❤ 都会立刻刷新它。"
        />

        {/* v3 新增：Taste 概览条带 */}
        <section className="mb-8 grid gap-3" style={{gridTemplateColumns: 'repeat(5, 1fr)'}}>
          <div className="lib-card p-4" style={{background: 'var(--parchment)'}}>
            <div className="stat-label">本周 ❤</div>
            <div className="ff-serif text-[36px] font-semibold mt-1" style={{color: 'var(--cinnabar)', letterSpacing: '-0.02em'}}>
              {summary.week_likes}<span className="ff-mono text-[11px] ml-1" style={{color: 'var(--ink-mute)'}}>次</span>
            </div>
            <div className="mt-2 spark">
              {summary.trend_7d.map((v, i) => (
                <span key={i} className="spark__bar" style={{height: (6 + v * 3) + 'px'}} />
              ))}
            </div>
          </div>
          <StatBox label="❤❤ 极喜欢" num={summary.week_loves} tone="cinnabar" />
          <StatBox label="✕ 已降权"  num={summary.week_skips} />
          <StatBox label="稍后读"     num={summary.week_saves} />
          <StatBox label="新订阅主题"  num={summary.week_subscriptions} tone="forest" />
        </section>

        {/* 顶部概览 */}
        <section className="grid gap-6 mb-10" style={{gridTemplateColumns: '420px 1fr'}}>
          <div className="lib-card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="ff-serif text-[20px] font-semibold" style={{letterSpacing: '-0.015em'}}>
                你的六维关注分布
              </h3>
              <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>近 90 天</span>
            </div>
            <RadarChart data={radar} size={360} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {radar.map(r => (
                <div key={r.axis}>
                  <div className="ff-serif text-[13px] font-semibold" style={{letterSpacing: '-0.01em'}}>{r.axis}</div>
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="ff-serif text-[18px] font-semibold">{r.score}</span>
                    <span className="ff-mono text-[10px]"
                          style={{color: r.delta > 0 ? 'var(--forest)' : r.delta < 0 ? 'var(--cinnabar)' : 'var(--ink-mute)'}}>
                      {r.delta > 0 ? '↑' : r.delta < 0 ? '↓' : '·'}{Math.abs(r.delta)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-3" style={{color: 'var(--cinnabar)'}}>
              § 你本周 ❤ 最多的主题
            </div>
            <div className="lib-card p-4 mb-4">
              <ul>
                {summary.top_topics.map((t, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 border-b" style={{borderColor: 'var(--rule)'}}>
                    <span className="ff-mono text-[10px] w-5 text-right" style={{color: 'var(--ink-mute)'}}>{String(i+1).padStart(2,'0')}</span>
                    <span className="ff-serif text-[15px] font-semibold flex-1" style={{letterSpacing: '-0.01em'}}>{t.topic}</span>
                    <span className="ff-mono text-[11px] w-16 text-right" style={{color: t.trend==='up'?'var(--cinnabar)':'var(--ink-mute)'}}>
                      {t.trend === 'up' ? '↑' : '↓'} ❤ {t.count}
                    </span>
                    <div className="w-24 score-bar"><div className="score-bar__fill" style={{width: Math.round(t.weight*100)+'%', background: 'var(--cinnabar)'}} /></div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-3" style={{color: 'var(--cinnabar)'}}>
              § Agent 对你的三条判断
            </div>
            <div className="space-y-3">
              {evidence.map((ev, i) => (
                <div key={i} className="lib-card p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="circ-num mt-0.5">{i + 1}</span>
                    <h4 className="ff-serif text-[16px] font-semibold flex-1" style={{letterSpacing: '-0.01em'}}>
                      {ev.claim}
                    </h4>
                  </div>
                  <ul className="space-y-1 ml-8">
                    {ev.evidence.slice(0, 3).map((e, j) => (
                      <li key={j} className="ff-serif text-[13px] leading-[1.55] flex gap-2" style={{color: 'var(--ink-soft)'}}>
                        <span className="ff-mono text-[10px] mt-1" style={{color: 'var(--cinnabar)'}}>§</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ml-8 mt-2 flex items-center gap-2 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
                    <span>置信度</span>
                    <div className="flex-1 max-w-[160px] score-bar">
                      <div className="score-bar__fill" style={{width: Math.round(ev.confidence * 100) + '%', background: 'var(--cinnabar)'}} />
                    </div>
                    <span>{Math.round(ev.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 信号源 */}
        <section className="mb-10 pt-6 border-t" style={{borderColor: 'var(--rule-strong)'}}>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h3 className="ff-serif text-[26px] font-semibold" style={{letterSpacing: '-0.02em'}}>
                画像信号源 · {sources.length}
              </h3>
              <p className="ff-serif italic text-[14px] mt-1" style={{color: 'var(--ink-mute)'}}>
                每一条信号的权重与状态；你的 ❤ 是其中增长最快的那条。
              </p>
            </div>
            <button className="btn btn--ghost"><C.I.plus /> 添加信号源</button>
          </div>

          <div className="grid gap-3" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
            {sources.map(s => <ProfileSourceCard key={s.id} s={s} />)}
          </div>
        </section>

        {/* 关键词 + 时间热力 */}
        <section className="mb-10 grid gap-6" style={{gridTemplateColumns: '1fr 1fr'}}>
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="ff-serif text-[20px] font-semibold" style={{letterSpacing: '-0.015em'}}>
                你的词汇表
              </h3>
              <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>TF-IDF · 跨源聚合</span>
            </div>
            <div className="lib-card p-4 flex flex-wrap">
              {keywords.map(k => (
                <span key={k.w}
                      className={`kw-chip ${k.trend === 'up' ? 'kw-chip--up' : k.trend === 'down' ? 'kw-chip--down' : ''}`}
                      style={{fontSize: Math.min(26, 12 + k.n / 10) + 'px', fontWeight: k.trend === 'up' ? 600 : 500}}>
                  {k.w} <span className="kw-chip__n">{k.n}</span>
                </span>
              ))}
            </div>
            <div className="mt-3 sidenote">
              Agent 会优先用<em>趋势上升</em>的词去匹配本周候选条目；下降词在三周后自动降权。
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="ff-serif text-[20px] font-semibold" style={{letterSpacing: '-0.015em'}}>
                工作时间地图
              </h3>
              <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>近 7 天 · 24h × 7</span>
            </div>
            <div className="lib-card p-4">
              <TimeHeatmap data={timemap} />
              <div className="mt-3 flex items-center justify-between ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
                <span>少</span>
                <div className="flex gap-1">
                  {[0,1,2,3,4,5].map(l => (
                    <span key={l} className="w-3 h-3 inline-block" style={{
                      background: l===0?'var(--paper-warm)':l===1?'#d9d1b8':l===2?'#b8ad8f':l===3?'#8a7f5f':l===4?'#574c33':'var(--ink)'
                    }} />
                  ))}
                </div>
                <span>多</span>
              </div>
            </div>
            <div className="mt-3 sidenote">
              时间地图仍为本地演示占位；真实页面当前不接入会议、日历或飞书原文，避免把私有工作信号写入公开仓库。
            </div>
          </div>
        </section>

        {/* 隐私契约 */}
        <section className="pt-6 border-t" style={{borderColor: 'var(--rule-strong)'}}>
          <div className="grid gap-8" style={{gridTemplateColumns: '1fr 320px'}}>
            <div>
              <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>
                § 隐私契约
              </div>
              <h3 className="ff-serif text-[24px] font-semibold mb-4" style={{letterSpacing: '-0.015em'}}>
                你决定哪些信号被看见
              </h3>
              <ul className="space-y-2">
                {privacy.map((p, i) => (
                  <li key={i} className="flex items-center justify-between py-2 border-b" style={{borderColor: 'var(--rule)'}}>
                    <span className="ff-serif text-[14.5px]" style={{color: p.on ? 'var(--ink)' : 'var(--ink-mute)'}}>
                      {p.text}
                    </span>
                    <span className={`inline-block w-9 h-5 rounded-full relative transition-colors`}
                          style={{background: p.on ? 'var(--forest)' : 'var(--paper-cool)', border: '1px solid var(--rule)'}}>
                      <span className="absolute top-[1px] w-[15px] h-[15px] rounded-full transition-transform"
                            style={{background: 'var(--parchment)', boxShadow: 'var(--sh-sm)',
                                    transform: p.on ? 'translateX(16px)' : 'translateX(1px)'}} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <aside>
              <div className="ff-mono text-[10px] uppercase tracking-widest mb-2" style={{color: 'var(--ink-mute)'}}>
                画像即将刷新
              </div>
              <div className="ff-serif text-[32px] font-semibold" style={{letterSpacing: '-0.02em'}}>03:47:12</div>
              <p className="sidenote mt-3">
                每 4 小时合并一次信号；喜好信号实时注入。画像只用于本期策展决策，不会离开你的设备。
              </p>
              <button className="btn btn--primary mt-4 w-full justify-center">立即重算画像</button>
              <button className="btn btn--ghost mt-2 w-full justify-center">导出画像快照 JSON</button>
            </aside>
          </div>
        </section>
      </div>
    );
  }

  /* ==================== 08 STUDIO · 技能工坊（v3 新增） ==================== */
  function StudioView({ subscriptions, onToggleSub, onAcceptProposal, acceptedProposals }) {
    const [tab, setTab] = useState('skills');  /* skills | proposals | queue | subscriptions */
    const skillQueue = D.SKILL_QUEUE || { total: 0, byState: {}, entries: [], checklist: [], blockingTotal: 0, autoInstall: false };
    const activeReviews = (skillQueue.byState.screening || 0) + (skillQueue.byState.trial || 0);
    const openBlockingCount = (skillQueue.entries || []).reduce((sum, entry) => sum + (entry.pendingLabels || []).length, 0);
    const queueStates = [
      ['candidate', '待审'],
      ['screening', '评测中'],
      ['trial', '限范围试用'],
      ['needs_changes', '待整改'],
      ['adopted', '已引入'],
      ['rejected', '已拒绝'],
      ['quarantined', '已隔离'],
    ];
    const focusQueueEntries = (skillQueue.entries || [])
      .slice()
      .sort((a, b) => (b.passed / Math.max(b.total, 1)) - (a.passed / Math.max(a.total, 1)))
      .slice(0, 4);

    return (
      <div className="anim-in">
        <ViewHeader
          num="08"
          title="技能工坊"
          sub="你喜欢什么，Agent 就给你孵化什么。这里是正在服役的 AI 工程能力与新孵化的 Skill 建议。"
        />

        {/* 概览数字 */}
        <section className="grid grid-cols-4 gap-6 py-6 border-y mb-8" style={{borderColor: 'var(--rule)'}}>
          <C.Stat num={D.AI_SKILLS.filter(s => s.status==='live').length} label="服役中技能" />
          <C.Stat num={D.AI_SKILLS.reduce((s, x) => s + x.runs_7d, 0)} label="近 7 天运行次数" />
          <C.Stat num={skillQueue.total || D.SKILL_PROPOSALS.length} label="待审队列" accent sub={`${activeReviews} 个评测/试用中`} />
          <C.Stat num={openBlockingCount} label="阻断项待补证" sub="试用前必须清零" />
        </section>

        {/* Tab */}
        <div className="flex items-center gap-2 mb-5 border-b" style={{borderColor: 'var(--rule)'}}>
          {[
            { id: 'skills',        label: '已服役能力', count: D.AI_SKILLS.length },
            { id: 'proposals',     label: 'Agent 建议', count: D.SKILL_PROPOSALS.length },
            { id: 'queue',         label: '待审队列',    count: skillQueue.total || 0 },
            { id: 'subscriptions', label: '订阅主题',    count: subscriptions.length },
            { id: 'evolution',     label: '演化日志',    count: D.EVOLUTION_LOG.length },
          ].map(t => (
            <button key={t.id}
                    onClick={() => setTab(t.id)}
                    className="px-4 py-2 ff-serif text-[16px] relative"
                    style={{
                      color: tab === t.id ? 'var(--ink)' : 'var(--ink-mute)',
                      fontWeight: tab === t.id ? 600 : 400,
                      borderBottom: tab === t.id ? '2px solid var(--cinnabar)' : '2px solid transparent',
                      marginBottom: '-1px',
                      letterSpacing: '-0.01em',
                    }}>
              {t.label} <span className="ff-mono text-[10px] ml-1 opacity-60">{t.count}</span>
            </button>
          ))}
        </div>

        {/* ---- Tab: 已服役能力 ---- */}
        {tab === 'skills' && (
          <div className="grid gap-4" style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
            {D.AI_SKILLS.map(s => <C.SkillCard key={s.id} s={s} />)}
          </div>
        )}

        {/* ---- Tab: Agent 建议 ---- */}
        {tab === 'proposals' && (
          <div className="space-y-4">
            <article className="lib-card p-5" style={{borderColor: 'rgba(161, 62, 45, .36)'}}>
              <div className="flex items-center gap-3 mb-3">
                <span className="skill-ribbon">待审队列</span>
                <span className="ff-mono text-[11px]" style={{color: 'var(--ink-mute)'}}>
                  自动化只负责加入待审队列，后续必须人工记录决策人、时间与证据
                </span>
              </div>
              <div className="grid gap-4" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>
                {[
                  ['待审', skillQueue.byState.candidate || 0],
                  ['评测中', skillQueue.byState.screening || 0],
                  ['限范围试用', skillQueue.byState.trial || 0],
                  ['待补证', openBlockingCount],
                ].map(([label, value]) => (
                  <div key={label} className="hair-card p-3">
                    <div className="stat-num text-[30px]">{value}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                ))}
              </div>
            </article>
            {D.SKILL_PROPOSALS.map(p => {
              const accepted = acceptedProposals.includes(p.id);
              return (
                <article key={p.id} className={`lib-card p-5 ${accepted ? 'lib-card--active' : ''}`}>
                  <div className="grid gap-6" style={{gridTemplateColumns: '1fr 320px'}}>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="skill-ribbon">PROPOSAL · {p.id}</span>
                        <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{p.family}</span>
                        <span className="ff-mono text-[10px] ml-auto" style={{color: 'var(--cinnabar)'}}>
                          成本 {p.cost_est} · 置信 {Math.round(p.confidence*100)}%
                        </span>
                      </div>
                      <h3 className="ff-serif text-[26px] font-semibold leading-tight mb-1" style={{letterSpacing: '-0.02em'}}>
                        <span className="ff-mono text-[14px]" style={{color: 'var(--cinnabar)'}}>skill:</span> {p.name}
                      </h3>
                      <p className="ff-serif italic text-[14px] mb-3" style={{color: 'var(--ink-mute)'}}>{p.why}</p>

                      <div className="sidenote mb-4">
                        <div className="ff-mono text-[9.5px] uppercase tracking-widest mb-2" style={{color: 'var(--cinnabar)', borderLeft: 0, paddingLeft: 0}}>
                          触发依据
                        </div>
                        <ul className="space-y-1 not-italic ff-serif text-[13px]" style={{color: 'var(--ink)'}}>
                          {p.evidence.map((e, i) => (
                            <li key={i}>§ {e}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button className={`btn ${accepted ? 'btn--ghost' : 'btn--cinnabar'}`}
                                onClick={() => onAcceptProposal(p.id)}>
                          {accepted ? '✓ 已接受 · 加入 Skill 层' : '接受建议 · 加入 Skill 层'}
                        </button>
                        <button className="btn btn--ghost">需要更多证据</button>
                        <button className="btn btn--ghost">驳回并降权此类</button>
                      </div>
                    </div>

                    <aside>
                      <div className="ff-mono text-[9.5px] uppercase tracking-widest mb-2" style={{color: 'var(--ink-mute)'}}>
                        技能配置预览
                      </div>
                      <pre className="ff-mono text-[11px] leading-[1.65] p-3 whitespace-pre-wrap"
                           style={{background: 'var(--ink)', color: 'var(--parchment)', borderRadius: 1}}>
{p.preview_dsl}
                      </pre>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ---- Tab: 待审队列 ---- */}
        {tab === 'queue' && (
          <div className="space-y-5">
            <section className="lib-card p-5">
              <div className="flex items-start justify-between gap-6 mb-4">
                <div>
                  <div className="ff-mono text-[10px] uppercase tracking-widest mb-2" style={{color: 'var(--cinnabar)'}}>
                    Review-only queue · auto_install={String(skillQueue.autoInstall)}
                  </div>
                  <h3 className="ff-serif text-[26px] font-semibold leading-tight" style={{letterSpacing: '-0.02em'}}>
                    Skill 候选只读评测台
                  </h3>
                  <p className="sidenote mt-2 max-w-[720px]">
                    {skillQueue.humanGate || '候选进入评测、试用和引入前必须由真人记录证据；页面不提供安装或流转按钮。'}
                  </p>
                </div>
                <div className="ff-mono text-[11px] text-right" style={{color: 'var(--ink-mute)'}}>
                  更新 {skillQueue.updatedAt || '未知'}<br />阻断清单 {skillQueue.blockingTotal || 0} 项
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {queueStates.map(([state, label]) => (
                  <div key={state} className="p-3 border" style={{borderColor: 'var(--rule)', background: state === 'trial' ? 'var(--paper-warm)' : 'transparent'}}>
                    <div className="ff-serif text-[24px] font-semibold">{skillQueue.byState[state] || 0}</div>
                    <div className="ff-mono text-[9px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4" style={{gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
              {focusQueueEntries.map(entry => (
                <article key={entry.id} className="lib-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="skill-ribbon">{entry.id} · {entry.stateLabel}</span>
                      <h4 className="ff-serif text-[24px] font-semibold mt-2 leading-tight" style={{letterSpacing: '-0.02em'}}>{entry.repo}</h4>
                      <p className="ff-mono text-[10px] mt-1" style={{color: 'var(--ink-mute)'}}>{entry.owner} · {entry.license} · ★ {entry.stars}</p>
                    </div>
                    <div className="ff-serif text-[22px] font-semibold" style={{color: entry.pendingLabels.length ? 'var(--mustard)' : 'var(--forest)'}}>
                      {entry.passed}/{entry.total}
                    </div>
                  </div>
                  <div className="score-bar mt-4"><div className="score-bar__fill" style={{width: `${Math.round((entry.passed / Math.max(entry.total, 1)) * 100)}%`}} /></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(entry.pendingLabels.length ? entry.pendingLabels.slice(0, 4) : ['阻断项已通过']).map(label => (
                      <span key={label} className="tag-pill" style={{color: entry.pendingLabels.length ? 'var(--cinnabar)' : 'var(--forest)'}}>{label}</span>
                    ))}
                  </div>
                  <p className="sidenote mt-4">
                    {entry.riskFlags.length ? `风险提示：${entry.riskFlags.join('、')}` : '当前无风险标记；仍需限范围试用结果后才能正式引入。'}
                  </p>
                </article>
              ))}
            </section>
          </div>
        )}

        {/* ---- Tab: 订阅主题 ---- */}
        {tab === 'subscriptions' && (
          <div>
            <div className="ff-serif italic text-[13.5px] mb-4" style={{color: 'var(--ink-mute)'}}>
              点 ❤ 一次 ≈ 一次倾向；订阅一次 ≈ 一声承诺。订阅后 Agent 会把该主题推到首页，并持续在工坊里替你孵化能力。
            </div>
            <div className="lib-card p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{background: 'var(--paper-warm)'}}>
                    {['主题', '订阅起始', '来源', '推送', '已孵化', '状态'].map(h => (
                      <th key={h} className="ff-mono text-[10px] uppercase tracking-widest text-left py-3 px-4 border-b"
                          style={{color: 'var(--ink-mute)', borderColor: 'var(--rule)'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(s => (
                    <tr key={s.id} className="border-b" style={{borderColor: 'var(--rule)', opacity: s.muted ? 0.55 : 1}}>
                      <td className="py-3 px-4">
                        <div className="ff-serif text-[15px] font-semibold" style={{letterSpacing: '-0.01em'}}>{s.topic}</div>
                        <div className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{s.id}</div>
                      </td>
                      <td className="py-3 px-4 ff-mono text-[11px]" style={{color: 'var(--ink-mute)'}}>{s.since}</td>
                      <td className="py-3 px-4">
                        <span className="tag-pill" style={{color: s.from_likes ? 'var(--cinnabar)' : 'var(--ink-mute)'}}>
                          {s.from_likes ? '源于你的 ❤' : '你主动订阅'}
                        </span>
                      </td>
                      <td className="py-3 px-4 ff-serif text-[16px] font-semibold">{s.pushes}</td>
                      <td className="py-3 px-4 ff-serif text-[14px]">
                        {s.cover_entries} 条候选
                      </td>
                      <td className="py-3 px-4">
                        <button className="btn btn--ghost" onClick={() => onToggleSub(s.id)}>
                          {s.muted ? '取消静音' : '静音'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- Tab: 演化日志 ---- */}
        {tab === 'evolution' && (
          <div className="lib-card p-5">
            <div className="ff-mono text-[10px] uppercase tracking-widest mb-3" style={{color: 'var(--cinnabar)'}}>
              § 你的操作 → Agent 的调整
            </div>
            {D.EVOLUTION_LOG.map((row, i) => (
              <div key={i} className="evo-row">
                <span className="evo-row__time">{row.time}</span>
                <span className={`evo-row__trig evo-row__trig--${row.trigger}`}>{labelOfTrigger(row.trigger)}</span>
                <span className="evo-row__act">{row.action}</span>
                <span className="evo-row__delta">{row.delta}</span>
              </div>
            ))}
            <div className="mt-4 sidenote">
              这就是「活的编辑部」：你不是设置规则——你用喜好写就规则。
            </div>
          </div>
        )}
      </div>
    );
  }

  function labelOfTrigger(t) {
    const m = {
      you_like: '你 ❤',
      you_love: '你 ❤❤',
      you_dislike: '你 ✕',
      you_subscribe: '你订阅',
      proposal_new: '新建议',
      proposal_accepted: '建议采纳',
      adopt_success: '引入成功',
      agent_insight: 'Agent 洞察',
    };
    return m[t] || t;
  }

  /* ==================== 09 PUSH · 推送中心（v3 新增） ==================== */
  function PushView({ goto, openEntry }) {
    const unread = D.PUSHES.filter(p => !p.read).length;

    return (
      <div className="anim-in">
        <ViewHeader
          num="09"
          title="推送中心"
          sub={`Agent 根据你的 ❤ / 订阅主动推给你的线索；当前 ${unread} 条未读。`}
        />

        <div className="grid gap-3">
          {D.PUSHES.map(p => <C.PushRow key={p.id} p={p} onAct={(id, action) => {
            if (action === 'open' && p.topic) {
              /* 简化：跳到藏书架 */
              goto('shelf');
            }
          }} />)}
        </div>

        <section className="mt-10 pt-6 border-t grid gap-8" style={{borderColor: 'var(--rule-strong)', gridTemplateColumns: '1fr 320px'}}>
          <div>
            <div className="ff-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{color: 'var(--cinnabar)'}}>
              § 推送节律
            </div>
            <h3 className="ff-serif text-[22px] font-semibold mb-3" style={{letterSpacing: '-0.02em'}}>
              何时打扰你 · 由你定
            </h3>
            <ul className="space-y-2 ff-serif text-[14px]">
              <li className="py-2 border-b flex justify-between" style={{borderColor: 'var(--rule)'}}>
                <span>紧急号外（匹配度 ≥ 90 且订阅命中）</span>
                <span className="ff-mono text-[11px]" style={{color: 'var(--forest)'}}>即时</span>
              </li>
              <li className="py-2 border-b flex justify-between" style={{borderColor: 'var(--rule)'}}>
                <span>一般推送</span>
                <span className="ff-mono text-[11px]" style={{color: 'var(--ink)'}}>合并到合刊（每周三 09:00）</span>
              </li>
              <li className="py-2 border-b flex justify-between" style={{borderColor: 'var(--rule)'}}>
                <span>趋势下降类</span>
                <span className="ff-mono text-[11px]" style={{color: 'var(--ink-mute)'}}>仅在工坊可见</span>
              </li>
            </ul>
          </div>
          <aside>
            <div className="ff-mono text-[10px] uppercase tracking-widest mb-2" style={{color: 'var(--ink-mute)'}}>
              进入工坊
            </div>
            <p className="sidenote">
              每一条推送都会在工坊留下一条痕迹——它要么升级你的喜好权重，要么孕育一条新 Skill。
            </p>
            <button className="btn btn--primary mt-4 w-full justify-center" onClick={() => goto('studio')}>
              去技能工坊看今日孕育 <C.I.arrowRight />
            </button>
          </aside>
        </section>
      </div>
    );
  }

  /* ---- Profile 子组件（来自 v2，附加 taste 图标） ---- */
  function ProfileSourceCard({ s }) {
    const iconMap = {
      code:     <C.I.gh />,
      calendar: <CalIcon />,
      doc:      <DocIcon />,
      chat:     <ChatIcon />,
      pod:      <PodIcon />,
      rss:      <C.I.rss />,
      globe:    <GlobeIcon />,
      book:     <BookIcon />,
      heart:    <HeartIcon />,
    };
    return (
      <div className={`lib-card p-4 flex items-start gap-3 ${s.isTaste ? 'lib-card--active' : ''}`}>
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center border"
             style={{borderColor: s.isTaste ? 'var(--cinnabar)' : 'var(--rule)',
                     background: s.isTaste ? 'var(--cinnabar)' : 'var(--paper-warm)',
                     color: s.isTaste ? 'var(--parchment)' : 'inherit'}}>
          {iconMap[s.icon] || <C.I.dot />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <h4 className="ff-serif text-[16px] font-semibold truncate" style={{letterSpacing: '-0.01em'}}>
              {s.kind}
              {s.isTaste && <span className="ff-mono text-[9px] ml-2 px-1.5 py-0.5" style={{background: 'var(--cinnabar)', color: 'var(--parchment)'}}>新增</span>}
            </h4>
            <div className="flex items-center gap-1.5 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
              <span className={s.status === 'live' ? 'pulse pulse--live' : 'pulse pulse--paused'} />
              {s.status === 'live' ? '采集中' : '已暂停'}
            </div>
          </div>
          <div className="ff-serif italic text-[12.5px] mb-1.5" style={{color: 'var(--ink-mute)'}}>
            {s.name} · {s.scope}
          </div>
          <div className="ff-mono text-[10.5px] mb-2" style={{color: 'var(--ink-soft)'}}>
            信号：{s.signal}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 score-bar">
              <div className="score-bar__fill" style={{width: Math.min(100, Math.round(s.weight*100*3)) + '%',
                                                       background: s.isTaste ? 'var(--cinnabar)' : 'var(--ink)'}} />
            </div>
            <span className="ff-serif text-[15px] font-semibold" style={{letterSpacing: '-0.01em'}}>
              {(s.weight * 100).toFixed(0)}
              <span className="ff-mono text-[9px] ml-0.5" style={{color: 'var(--ink-mute)'}}>%权重</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>
            <span>上次 · {s.last}</span>
            <span>{s.hint}</span>
          </div>
        </div>
      </div>
    );
  }

  function StatBox({ label, num, tone }) {
    const color = tone === 'cinnabar' ? 'var(--cinnabar)' : tone === 'forest' ? 'var(--forest)' : 'var(--ink)';
    return (
      <div className="lib-card p-4">
        <div className="stat-label">{label}</div>
        <div className="ff-serif text-[36px] font-semibold mt-1" style={{color, letterSpacing: '-0.02em'}}>
          {num}
        </div>
      </div>
    );
  }

  /* 自绘雷达图 */
  function RadarChart({ data, size = 300 }) {
    const cx = size / 2, cy = size / 2;
    const R = size * 0.38;
    const n = data.length;
    const points = data.map((d, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (d.score / 100) * R;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    const axisPoints = data.map((d, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    });
    const labelPoints = data.map((d, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      const rr = R + 20;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, a];
    });
    const polygon = points.map(p => p.join(',')).join(' ');

    return (
      <div className="flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {[0.25, 0.5, 0.75, 1].map((k, i) => (
            <circle key={i} cx={cx} cy={cy} r={R * k}
                    fill="none" stroke="var(--rule)" strokeWidth={i === 3 ? 1.2 : 0.8} />
          ))}
          {axisPoints.map(([x, y], i) => (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--rule)" strokeWidth="0.8" />
          ))}
          <polygon points={polygon}
                   fill="var(--cinnabar)" fillOpacity="0.15"
                   stroke="var(--cinnabar)" strokeWidth="1.4"
                   style={{transition: 'all 400ms ease'}} />
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3.5} fill="var(--cinnabar)" stroke="var(--parchment)" strokeWidth="1.5" />
          ))}
          {labelPoints.map(([x, y, a], i) => (
            <text key={i} x={x} y={y}
                  textAnchor={Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'}
                  dominantBaseline={Math.abs(Math.sin(a)) < 0.1 ? 'middle' : Math.sin(a) > 0 ? 'hanging' : 'auto'}
                  fontFamily="Fraunces, serif" fontSize="12.5" fontWeight="600" fill="var(--ink)">
              {data[i].axis}
            </text>
          ))}
        </svg>
      </div>
    );
  }

  function TimeHeatmap({ data }) {
    const hours = Array.from({length: 24}, (_, i) => i);
    return (
      <div>
        <div className="grid gap-[2px] items-center mb-1" style={{gridTemplateColumns: '28px repeat(24, 1fr)'}}>
          <span />
          {hours.map(h => (
            <span key={h} className="ff-mono text-[8.5px] text-center" style={{color: 'var(--ink-mute)'}}>
              {h % 6 === 0 ? h : ''}
            </span>
          ))}
        </div>
        {data.map(row => (
          <div key={row.day} className="grid gap-[2px] items-center mb-[2px]" style={{gridTemplateColumns: '28px repeat(24, 1fr)'}}>
            <span className="ff-mono text-[10px]" style={{color: 'var(--ink-mute)'}}>{row.day}</span>
            {row.hours.map((v, i) => (
              <span key={i} className="aspect-square" style={{
                background: v===0?'var(--paper-warm)':v===1?'#d9d1b8':v===2?'#b8ad8f':v===3?'#8a7f5f':v===4?'#574c33':'var(--ink)',
                minHeight: '10px'
              }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  function CalIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="2" y="3" width="12" height="11" />
        <path d="M2 6h12M5 1v3M11 1v3" strokeLinecap="round" />
      </svg>
    );
  }
  function DocIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M3 1h7l3 3v11H3z" />
        <path d="M10 1v3h3M6 7h5M6 10h5M6 13h3" strokeLinecap="round" />
      </svg>
    );
  }
  function ChatIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 3h12v8H6l-3 3V3z" strokeLinejoin="round" />
      </svg>
    );
  }
  function PodIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="6" y="2" width="4" height="7" rx="2" />
        <path d="M3 7a5 5 0 0 0 10 0M8 12v2" strokeLinecap="round" />
      </svg>
    );
  }
  function GlobeIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12" />
      </svg>
    );
  }
  function BookIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 3h5a2 2 0 0 1 2 2v9a1 1 0 0 0-1-1H2zM14 3H9a2 2 0 0 0-2 2v9a1 1 0 0 1 1-1h6z" strokeLinejoin="round" />
      </svg>
    );
  }
  function HeartIcon() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M8 14s-5-3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 4-5 7-5 7z"/>
      </svg>
    );
  }

  /* ---------- Page Header ---------- */
  function ViewHeader({ num, title, sub }) {
    return (
      <header className="pt-6 pb-5 border-b mb-6" style={{borderColor: 'var(--rule-strong)'}}>
        <div className="flex items-end justify-between">
          <div>
            <div className="ff-mono text-[11px] uppercase tracking-[0.3em]" style={{color: 'var(--cinnabar)'}}>
              第 {num} 章
            </div>
            <h1 className="ff-serif font-bold leading-none mt-2"
                style={{fontSize: '56px', letterSpacing: '-0.03em'}}>
              {title}
            </h1>
            <p className="ff-serif italic mt-2 text-[16px]" style={{color: 'var(--ink-mute)'}}>
              {sub}
            </p>
          </div>
          <div className="pb-2 text-right">
            <div className="ff-mono text-[10px] uppercase tracking-widest" style={{color: 'var(--ink-mute)'}}>
              第 04 卷 · 第 17 期
            </div>
            <div className="ff-serif italic text-[12.5px]" style={{color: 'var(--ink-mute)'}}>
              2026 · 10 月 · 第 4 周
            </div>
          </div>
        </div>
      </header>
    );
  }

  /* ---- helper: 把运行时 taste 覆盖到 entry 上 ---- */
  function enrich(entry, taste) {
    if (!entry) return entry;
    const t = taste && taste[entry.id];
    return Object.assign({}, entry, {
      _taste: t ? t.taste : entry.taste || null,
      _subscribed: t ? !!t.subscribed : false,
    });
  }

  window.WL_VIEWS = {
    HeroView, PipelineView, ShelfView, ReaderView, RoutesView, LoopView, ProfileView,
    StudioView, PushView,
  };
})();
