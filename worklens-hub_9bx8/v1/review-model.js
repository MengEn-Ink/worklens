/* global window */
/*
 * WorkLens v4 · Atelier（只读工坊）推荐复盘视图模型
 * ------------------------------------------------------------
 * 纯函数层：把 data/recommendation-reviews.json 转为页面可消费的只读模型。
 * 不访问 DOM、不 fetch、不写入任何外部状态；输出只含可展示的字符串 / 数字 /
 * 普通对象与数组，不暴露任何动作函数或回调，页面不得据此产生写入口。
 */
(function () {
  const CONCLUSION_LABELS = {
    keep: '保留',
    downgrade: '降权',
    remove: '移除',
  };

  const AUTHORITY_LABELS = {
    human: '真人决定',
    'human-policy': '真人策略授权',
  };

  const CHANNEL_LABELS = {
    daily_discovery: '每日发现',
    manual: '人工记录',
  };

  function shortDate(value) {
    if (!value || typeof value !== 'string') return '—';
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
    return match ? match[1] : value.slice(0, 10);
  }

  function compactNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  }

  function splitOwnerRepo(fullName) {
    if (typeof fullName !== 'string' || fullName.indexOf('/') === -1) {
      return { owner: fullName || '—', repo: '' };
    }
    const [owner, ...rest] = fullName.split('/');
    return { owner, repo: rest.join('/') };
  }

  function mapReview(raw) {
    const review = raw || {};
    const recommendation = review.recommendation || {};
    const subject = review.subject || {};
    const snapshot = review.subject_snapshot || {};
    const windowRange = review.observation_window || {};
    const { owner, repo } = splitOwnerRepo(subject.full_name);

    return {
      id: review.id || '—',
      recId: recommendation.id || '—',
      recommendedAtLabel: shortDate(recommendation.recommended_at),
      channelLabel: CHANNEL_LABELS[recommendation.channel] || recommendation.channel || '—',
      signalSource: recommendation.signal_source || '—',
      reason: recommendation.reason || '',
      subject: {
        fullName: subject.full_name || '—',
        owner,
        repo,
        url: subject.html_url || '',
      },
      snapshot: {
        starsLabel: snapshot.stars === undefined || snapshot.stars === null ? '—' : compactNumber(snapshot.stars),
        licenseLabel: snapshot.license ? String(snapshot.license) : '未声明',
        pushedAtLabel: shortDate(snapshot.pushed_at),
        archived: Boolean(snapshot.archived),
        collectedAtLabel: shortDate(snapshot.collected_at),
      },
      window: {
        fromLabel: shortDate(windowRange.from),
        toLabel: shortDate(windowRange.to),
      },
      facts: Array.isArray(review.observed_facts)
        ? review.observed_facts.map((fact) => ({
            text: (fact && fact.fact) || '',
            sourceUrl: (fact && fact.source_url) || '',
            observedAtLabel: shortDate(fact && fact.observed_at),
          }))
        : [],
      conclusion: review.conclusion || 'unknown',
      conclusionLabel: CONCLUSION_LABELS[review.conclusion] || '未知',
      adjustment: review.adjustment || '',
      reviewedBy: review.reviewed_by || '—',
      authority: review.authority || 'unknown',
      authorityLabel: AUTHORITY_LABELS[review.authority] || '未知',
      policyRef: review.policy_ref || '',
      reviewedAtLabel: shortDate(review.reviewed_at),
    };
  }

  function buildReviewBoard(payload) {
    const reviewsPayload = payload && Array.isArray(payload.reviews) ? payload.reviews : [];
    const policy = (payload && payload.policy) || {};
    const reviews = reviewsPayload.map(mapReview);
    return {
      available: Boolean(payload),
      generatedLabel: payload && payload.generated_at ? shortDate(payload.generated_at) : '—',
      publicOnly: policy.public_only === true,
      autoAdjustProfile: policy.auto_adjust_profile === true,
      reviews,
      totals: {
        total: reviews.length,
        keep: reviews.filter((item) => item.conclusion === 'keep').length,
        downgrade: reviews.filter((item) => item.conclusion === 'downgrade').length,
        remove: reviews.filter((item) => item.conclusion === 'remove').length,
      },
    };
  }

  function buildEmptyReviewBoard(reason) {
    return {
      available: false,
      reason: reason || 'data_absent',
      generatedLabel: '未加载',
      publicOnly: true,
      autoAdjustProfile: false,
      reviews: [],
      totals: { total: 0, keep: 0, downgrade: 0, remove: 0 },
    };
  }

  const api = {
    CONCLUSION_LABELS,
    AUTHORITY_LABELS,
    CHANNEL_LABELS,
    buildReviewBoard,
    buildEmptyReviewBoard,
    shortDate,
    compactNumber,
  };

  if (typeof window !== 'undefined') {
    window.WL_REVIEW_MODEL = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
