/* global window */
/*
 * WorkLens Hub · 待审 / 实验室视图模型（原 v4 Atelier 模型，随 IA 收敛迁入 Hub）
 * ------------------------------------------------------------
 * 纯函数层：把 data/skill-review-queue.json、data/core-circle.json 转为
 * 页面可消费的只读模型，不访问 DOM、不 fetch、不写入任何外部状态。
 */
(function () {
  const CHECK_LABELS = {
    license_declared: '许可证声明',
    license_compatible: '许可证兼容',
    secret_clean: '凭证与私有地址',
    install_safe: '安装脚本透明',
    network_declared: '外发网络声明',
    write_scope_declared: '写入范围声明',
    injection_surface_reviewed: '注入面审查',
    dependencies_pinned: '依赖可追溯',
    maintained: '维护活跃度',
  };

  const STATE_LABELS = {
    candidate: '待审',
    screening: '评测中',
    needs_changes: '待整改',
    trial: '限范围试用',
    adopted: '已引入',
    rejected: '已拒绝',
    quarantined: '已隔离',
  };

  // 展示顺序：试用在最前，候选在最后
  const STATE_ORDER = ['trial', 'screening', 'needs_changes', 'candidate'];

  const RISK_LABELS = {
    no_license: '无许可证',
    license_unrecognized: '许可证无法识别',
    archived: '上游已归档',
    stale_upstream: '上游半年未更新',
  };

  const CHECK_STATUS_LABEL = {
    pass: '通过',
    warn: '待观察',
    fail: '不通过',
    missing: '未执行',
    unknown: '未执行',
  };

  function safeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function shortDate(value) {
    if (!value) return '未知';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未知';
    return date.toISOString().slice(0, 10);
  }

  function formatGenerated(value) {
    if (!value) return '未知';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未知';
    // UTC+8 展示：规整为 yyyy-mm-dd HH:MM（本地时区）
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function splitSubject(subject) {
    const text = String(subject || '');
    const slash = text.indexOf('/');
    if (slash < 0) return { owner: '', repo: text };
    return { owner: text.slice(0, slash), repo: text.slice(slash + 1) };
  }

  function compactNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(n);
  }

  function normalizeCheck(key, raw) {
    const obj = safeObject(raw);
    const status = obj.status || 'missing';
    return {
      key,
      label: CHECK_LABELS[key] || key,
      status,
      statusLabel: CHECK_STATUS_LABEL[status] || status,
      evidence: obj.evidence || '',
      by: obj.by || '',
      checkedAt: shortDate(obj.checked_at),
    };
  }

  function normalizeQueueEntry(entry, blockingChecks) {
    const subject = splitSubject(entry.subject);
    const checks = safeObject(entry.checks);
    const blockingList = blockingChecks.map((key) => normalizeCheck(key, checks[key]));
    const passedCount = blockingList.filter((item) => item.status === 'pass').length;
    const pendingLabels = blockingList
      .filter((item) => item.status !== 'pass')
      .map((item) => item.label);
    const riskFlags = safeList(entry.risk_flags).map((flag) => RISK_LABELS[flag] || flag);
    const trial = entry.trial && typeof entry.trial === 'object' ? entry.trial : null;

    const state = STATE_LABELS[entry.state] ? entry.state : 'candidate';
    return {
      id: entry.id,
      subject: entry.subject,
      owner: subject.owner,
      repo: subject.repo,
      url: entry.html_url || `https://github.com/${entry.subject}`,
      state,
      stateLabel: STATE_LABELS[state] || state,
      license: entry.license || '未声明',
      stars: Number(entry.stars || 0),
      starsCompact: compactNumber(entry.stars),
      archived: entry.archived === true,
      pushedAt: shortDate(entry.pushed_at),
      source: entry.source || '',
      riskFlags,
      blockingList,
      passed: passedCount,
      total: blockingList.length,
      pendingLabels,
      trial,
      trialScope: trial && trial.scope ? trial.scope : '',
      trialStarted: trial && trial.started_at ? shortDate(trial.started_at) : '',
      trialPlannedEnd: trial && trial.planned_end_at ? shortDate(trial.planned_end_at) : '',
    };
  }

  function buildQueueBoard(queue) {
    const policy = safeObject(queue && queue.policy);
    const blockingChecks = safeList(policy.blocking_checks);
    const states = safeList(policy.states);
    const rawEntries = safeList(queue && queue.queue);

    const entries = rawEntries.map((entry) => normalizeQueueEntry(entry, blockingChecks));

    // 分组：按 STATE_ORDER 顺序，不在列表的状态（如 adopted / rejected）追加在末尾
    const groupMap = new Map();
    STATE_ORDER.forEach((state) => groupMap.set(state, []));
    entries.forEach((entry) => {
      const key = STATE_ORDER.includes(entry.state) ? entry.state : entry.state;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(entry);
    });

    const groups = Array.from(groupMap.entries()).map(([state, items]) => ({
      state,
      label: STATE_LABELS[state] || state,
      items: items.sort((a, b) => {
        // trial 中按 trialStarted 倒序；其他按 passed 多的在前
        if (state === 'trial') return (b.trialStarted || '').localeCompare(a.trialStarted || '');
        return b.passed - a.passed;
      }),
      empty: items.length === 0,
    }));

    // 统计
    const totals = {
      total: entries.length,
      trial: (groupMap.get('trial') || []).length,
      screening: (groupMap.get('screening') || []).length,
      needsChanges: (groupMap.get('needs_changes') || []).length,
      candidate: (groupMap.get('candidate') || []).length,
    };

    return {
      available: true,
      generatedAt: queue && queue.generated_at ? queue.generated_at : null,
      generatedLabel: formatGenerated(queue && queue.generated_at),
      autoInstall: policy.auto_install === true,
      humanGate: policy.human_gate || '',
      blockingChecks: blockingChecks.map((key) => ({ key, label: CHECK_LABELS[key] || key })),
      states,
      totals,
      groups,
      entries,
    };
  }

  function normalizePerson(person) {
    const evidence = safeObject(person.public_evidence);
    return {
      login: person.login || '',
      profileUrl: person.profile_url || `https://github.com/${person.login}`,
      tier: person.tier || '',
      tierReason: person.tier_reason || '',
      publicRepos: Number(evidence.public_repos || 0),
      followers: Number(evidence.followers || 0),
      followersCompact: compactNumber(evidence.followers),
      following: Number(evidence.following || 0),
      profileCheckedAt: shortDate(evidence.profile_checked_at),
      evidenceUrl: evidence.evidence_url || '',
      qualityNote: person.quality_note || '',
    };
  }

  function normalizeProject(project) {
    const evidence = safeObject(project.evidence);
    const licenseSpdx = evidence.license_spdx;
    return {
      fullName: project.full_name || '',
      url: project.url || `https://github.com/${project.full_name}`,
      category: project.category || '',
      status: project.status || '',
      recommendation: project.recommendation === true,
      reason: project.reason || '',
      description: evidence.description || '',
      readme: evidence.readme || 'missing',
      topics: safeList(evidence.topics),
      license: licenseSpdx || null,
      licenseLabel: licenseSpdx || '未声明',
      stars: Number(evidence.stars || 0),
      starsCompact: compactNumber(evidence.stars),
      forks: Number(evidence.forks || 0),
      releases: Number(evidence.releases || 0),
      updatedAt: shortDate(evidence.updated_at),
      pushedAt: shortDate(evidence.pushed_at),
      defaultBranch: evidence.default_branch || '',
      fileEvidence: safeList(evidence.file_evidence),
    };
  }

  function buildCircleBoard(circle) {
    const people = safeList(circle && circle.people).map(normalizePerson);
    const projects = safeList(circle && circle.projects).map(normalizeProject);
    const recommended = projects.filter((p) => p.recommendation);
    const notRecommended = projects.filter((p) => !p.recommendation);

    return {
      available: true,
      generatedAt: circle && circle.generated_at ? circle.generated_at : null,
      generatedLabel: formatGenerated(circle && circle.generated_at),
      source: (circle && circle.source) || '',
      people,
      projects,
      recommendedCount: recommended.length,
      notRecommendedCount: notRecommended.length,
      noLicenseCount: projects.filter((p) => !p.license).length,
    };
  }

  function normalizeCandidate(row) {
    const evidence = safeObject(row && row.public_evidence);
    const promotion = safeObject(row && row.promotion_hint);
    return {
      login: (row && row.login) || '',
      profileUrl: (row && row.profile_url) || (row && row.login ? `https://github.com/${row.login}` : ''),
      evidenceUrl: (row && row.evidence_url) || '',
      sourceProjects: safeList(row && row.source_projects),
      contributionsTotal: Number((row && row.contributions_total) || 0),
      profileFetched: Boolean(row && row.profile_fetched),
      profileCheckedAt: shortDate(row && row.profile_checked_at),
      publicRepos: evidence.public_repos != null ? Number(evidence.public_repos) : null,
      followers: evidence.followers != null ? Number(evidence.followers) : null,
      followersCompact: evidence.followers != null ? compactNumber(evidence.followers) : '—',
      following: evidence.following != null ? Number(evidence.following) : null,
      accountCreatedAt: shortDate(evidence.created_at),
      proposedTier: promotion.proposed_tier || 'watch',
      humanDecisionRequired: promotion.human_decision_required !== false,
      note: promotion.notes || '',
    };
  }

  function buildCircleCandidatesBoard(doc) {
    const candidates = safeList(doc && doc.candidates).map(normalizeCandidate);
    const policy = safeObject(doc && doc.policy);
    const summary = safeObject(doc && doc.summary);
    return {
      available: true,
      generatedAt: doc && doc.generated_at ? doc.generated_at : null,
      generatedLabel: formatGenerated(doc && doc.generated_at),
      source: (doc && doc.source) || '',
      policy: {
        publicGithubOnly: policy.public_github_only !== false,
        autoFollow: policy.auto_follow === true,
        autoMessage: policy.auto_message === true,
        humanPromoteRequired: policy.human_promote_required !== false,
      },
      candidateCount: Number(summary.candidate_count != null ? summary.candidate_count : candidates.length),
      fetchedCount: Number(summary.fetched_count != null ? summary.fetched_count : candidates.filter((c) => c.profileFetched).length),
      candidates,
    };
  }

  function buildEmptyCircleCandidatesBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      source: '',
      policy: {
        publicGithubOnly: true,
        autoFollow: false,
        autoMessage: false,
        humanPromoteRequired: true,
      },
      candidateCount: 0,
      fetchedCount: 0,
      candidates: [],
    };
  }

  const IDEA_STAGE_LABELS = {
    idea: 'Idea',
    research: '调研',
    plan: '方案',
    scaffold: '脚手架',
    accepted: '验收通过',
    archived: '已归档',
  };

  const IDEA_STAGE_ORDER = ['idea', 'research', 'plan', 'scaffold', 'accepted'];

  function normalizeIdea(idea) {
    const stage = IDEA_STAGE_LABELS[idea.stage] ? idea.stage : 'idea';
    const stageIndex = Math.max(0, IDEA_STAGE_ORDER.indexOf(stage));
    return {
      id: idea.id || '',
      title: idea.title || '',
      summary: idea.summary || '',
      stage,
      stageLabel: IDEA_STAGE_LABELS[stage] || stage,
      progress: stage === 'archived' ? 0 : Math.round(((stageIndex + 1) / IDEA_STAGE_ORDER.length) * 100),
      evidenceCount: safeList(idea.evidence).length,
      researchNotes: idea.research_notes || '',
      historyCount: safeList(idea.history).length,
    };
  }

  function buildIdeaPipelineBoard(pipeline) {
    const policy = safeObject(pipeline && pipeline.policy);
    const ideas = safeList(pipeline && pipeline.ideas).map(normalizeIdea);
    return {
      available: true,
      generatedAt: pipeline && pipeline.generated_at ? pipeline.generated_at : null,
      generatedLabel: formatGenerated(pipeline && pipeline.generated_at),
      publicOnly: policy.public_only === true,
      autoScaffold: policy.auto_scaffold === true,
      automationMaxStage: policy.automation_max_stage || '',
      ideas,
      totals: {
        total: ideas.length,
        research: ideas.filter((item) => item.stage === 'research').length,
        accepted: ideas.filter((item) => item.stage === 'accepted').length,
      },
    };
  }

  function buildEmptyQueueBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      autoInstall: false,
      humanGate: '',
      blockingChecks: [],
      totals: { total: 0, trial: 0, screening: 0, needsChanges: 0, candidate: 0 },
      groups: STATE_ORDER.map((state) => ({ state, label: STATE_LABELS[state], items: [], empty: true })),
      entries: [],
    };
  }

  function buildEmptyCircleBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      people: [],
      projects: [],
      recommendedCount: 0,
      notRecommendedCount: 0,
      noLicenseCount: 0,
    };
  }

  function buildEmptyIdeaPipelineBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      publicOnly: false,
      autoScaffold: false,
      automationMaxStage: '',
      ideas: [],
      totals: { total: 0, research: 0, accepted: 0 },
    };
  }

  // ---------- Skill 正式引入账本（adoptions）----------

  function normalizeAdoption(row) {
    const history = safeList(row && row.history).map((event) => ({
      at: shortDate(event && event.at),
      event: (event && event.event) || '',
      by: (event && event.by) || '',
      note: (event && event.note) || '',
    }));
    const subject = splitSubject(row && row.subject);
    return {
      adoptionId: (row && row.adoption_id) || '',
      skillReviewId: (row && row.skill_review_id) || '',
      subject: (row && row.subject) || '',
      owner: subject.owner,
      repo: subject.repo,
      htmlUrl: (row && row.html_url) || '',
      decidedBy: (row && row.decided_by) || '',
      decidedAt: shortDate(row && row.decided_at),
      decisionReason: (row && row.decision_reason) || '',
      trialReportUrl: (row && row.trial_report_url) || '',
      importScope: (row && row.import_scope) || '',
      rollbackPlan: (row && row.rollback_plan) || '',
      revertCommand: (row && row.revert_command) || '',
      humanAccepted: row && row.human_accepted === true,
      history,
      historyCount: history.length,
    };
  }

  function buildAdoptionsBoard(doc) {
    const policy = safeObject(doc && doc.policy);
    const adoptions = safeList(doc && doc.adoptions).map(normalizeAdoption);
    return {
      available: true,
      generatedAt: doc && doc.generated_at ? doc.generated_at : null,
      generatedLabel: formatGenerated(doc && doc.generated_at),
      source: (doc && doc.source) || '',
      policy: {
        autoInstall: policy.auto_install === true,
        autoExecute: policy.auto_execute === true,
        humanDecisionRequired: policy.human_decision_required !== false,
        publicGithubOnly: policy.public_github_only !== false,
        maxAutomationStage: policy.max_automation_stage || '',
      },
      totals: {
        total: adoptions.length,
        humanAccepted: adoptions.filter((item) => item.humanAccepted).length,
      },
      adoptions,
    };
  }

  function buildEmptyAdoptionsBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      source: '',
      policy: {
        autoInstall: false,
        autoExecute: false,
        humanDecisionRequired: true,
        publicGithubOnly: true,
        maxAutomationStage: 'candidate',
      },
      totals: { total: 0, humanAccepted: 0 },
      adoptions: [],
    };
  }

  const api = {
    CHECK_LABELS,
    STATE_LABELS,
    STATE_ORDER,
    buildQueueBoard,
    buildCircleBoard,
    buildCircleCandidatesBoard,
    buildIdeaPipelineBoard,
    buildAdoptionsBoard,
    buildEmptyQueueBoard,
    buildEmptyCircleBoard,
    buildEmptyCircleCandidatesBoard,
    buildEmptyIdeaPipelineBoard,
    buildEmptyAdoptionsBoard,
    formatGenerated,
    shortDate,
    compactNumber,
  };

  if (typeof window !== 'undefined') {
    window.WL_ATELIER_MODEL = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
