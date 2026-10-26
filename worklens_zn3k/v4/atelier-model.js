/* global window */
/*
 * WorkLens v4 · Atelier（只读工坊）视图模型
 * ------------------------------------------------------------
 * 纯函数层：把 data/skill-review-queue.json、data/core-circle.json 转为
 * 页面可消费的只读模型，不访问 DOM、不 fetch、不写入任何外部状态。
 * 中文标签映射照抄 v3 data-adapter.js 的 CHECK_LABELS / STATE_LABELS。
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

  const IDEA_STAGE_LABELS = {
    idea: 'Idea',
    research: '调研',
    plan: '方案',
    scaffold: '脚手架',
    accepted: '验收通过',
    archived: '已归档',
  };

  const IDEA_STAGE_ORDER = ['idea', 'research', 'plan', 'scaffold', 'accepted'];

  const REVIEW_CONCLUSION_LABELS = {
    keep: '保留推荐',
    downgrade: '降级观察',
    remove: '移出推荐',
  };

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

  function normalizeRecommendationReview(review) {
    const subject = safeObject(review && review.subject);
    const recommendation = safeObject(review && review.recommendation);
    const snapshot = safeObject(review && review.subject_snapshot);
    const observationWindow = safeObject(review && review.observation_window);
    const subjectName = subject.full_name || '';
    const subjectParts = splitSubject(subjectName);
    const facts = safeList(review && review.observed_facts).map((fact) => {
      const sourceUrl = fact && fact.source_url ? fact.source_url : '';
      let sourceHost = '';
      try {
        sourceHost = sourceUrl ? new URL(sourceUrl).host : '';
      } catch {
        sourceHost = '';
      }
      return {
        fact: fact && fact.fact ? fact.fact : '',
        sourceUrl,
        sourceHost,
        observedAt: shortDate(fact && fact.observed_at),
      };
    });

    return {
      id: review && review.id ? review.id : '',
      recommendationId: recommendation.id || '',
      subject: subjectName,
      owner: subjectParts.owner,
      repo: subjectParts.repo,
      subjectUrl: subject.html_url || '',
      channel: recommendation.channel || '',
      signalSource: recommendation.signal_source || '',
      recommendedReason: recommendation.reason || '',
      recommendedAt: shortDate(recommendation.recommended_at),
      reviewedAt: shortDate(review && review.reviewed_at),
      reviewedBy: review && review.reviewed_by ? review.reviewed_by : '',
      authority: review && review.authority ? review.authority : '',
      policyRef: review && review.policy_ref ? review.policy_ref : '',
      conclusion: review && review.conclusion ? review.conclusion : '',
      conclusionLabel: REVIEW_CONCLUSION_LABELS[review && review.conclusion] || review.conclusion || '未知',
      adjustment: review && review.adjustment ? review.adjustment : '',
      observationWindowLabel: `${shortDate(observationWindow.from)} → ${shortDate(observationWindow.to)}`,
      facts,
      factCount: facts.length,
      snapshot: {
        stars: Number(snapshot.stars || 0),
        starsCompact: compactNumber(snapshot.stars),
        license: snapshot.license || '未声明',
        archived: snapshot.archived === true,
        pushedAt: shortDate(snapshot.pushed_at),
      },
    };
  }

  function buildRecommendationReviewBoard(reviewData) {
    const policy = safeObject(reviewData && reviewData.policy);
    const reviews = safeList(reviewData && reviewData.reviews).map(normalizeRecommendationReview);
    return {
      available: true,
      generatedAt: reviewData && reviewData.generated_at ? reviewData.generated_at : null,
      generatedLabel: formatGenerated(reviewData && reviewData.generated_at),
      publicOnly: policy.public_only === true,
      autoAdjustProfile: policy.auto_adjust_profile === true,
      requireHumanPolicyRef: policy.require_human_policy_ref === true,
      automationMaxConclusion: policy.automation_max_conclusion || '',
      conclusions: safeList(policy.conclusions),
      reviews,
      totals: {
        total: reviews.length,
        keep: reviews.filter((item) => item.conclusion === 'keep').length,
        downgrade: reviews.filter((item) => item.conclusion === 'downgrade').length,
        remove: reviews.filter((item) => item.conclusion === 'remove').length,
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

  function buildEmptyRecommendationReviewBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      publicOnly: false,
      autoAdjustProfile: false,
      requireHumanPolicyRef: false,
      automationMaxConclusion: '',
      conclusions: [],
      reviews: [],
      totals: { total: 0, keep: 0, downgrade: 0, remove: 0 },
    };
  }

  const api = {
    CHECK_LABELS,
    STATE_LABELS,
    STATE_ORDER,
    buildQueueBoard,
    buildCircleBoard,
    buildIdeaPipelineBoard,
    buildRecommendationReviewBoard,
    buildEmptyQueueBoard,
    buildEmptyCircleBoard,
    buildEmptyIdeaPipelineBoard,
    buildEmptyRecommendationReviewBoard,
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
