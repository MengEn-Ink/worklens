'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../worklens_zn3k/v4/atelier-model.js');

test('Atelier 队列模型只读聚合待审状态与阻断项', () => {
  const board = model.buildQueueBoard({
    generated_at: '2026-10-25T00:00:00Z',
    policy: {
      auto_install: false,
      human_gate: '人工流转',
      blocking_checks: ['license_declared', 'secret_clean'],
      states: ['candidate', 'trial'],
    },
    queue: [
      {
        id: 'SR-1',
        subject: 'owner/toolkit',
        html_url: 'https://github.com/owner/toolkit',
        state: 'trial',
        license: 'MIT',
        stars: 1250,
        pushed_at: '2026-10-24T00:00:00Z',
        checks: {
          license_declared: { status: 'pass' },
          secret_clean: { status: 'fail' },
        },
        trial: { scope: '本地只读试用', started_at: '2026-10-20T00:00:00Z' },
      },
    ],
  });

  assert.equal(board.available, true);
  assert.equal(board.autoInstall, false);
  assert.equal(board.totals.total, 1);
  assert.equal(board.totals.trial, 1);
  assert.equal(board.entries[0].repo, 'toolkit');
  assert.equal(board.entries[0].starsCompact, '1.3k');
  assert.deepEqual(board.entries[0].pendingLabels, ['凭证与私有地址']);
  assert.equal(board.entries[0].trialScope, '本地只读试用');
});

test('Atelier 核心圈模型保留公开证据并标记无许可证项目', () => {
  const board = model.buildCircleBoard({
    generated_at: '2026-10-25T00:00:00+08:00',
    people: [
      {
        login: 'alchaincyf',
        profile_url: 'https://github.com/alchaincyf',
        tier: 'seed',
        tier_reason: '用户指定研究对象',
        public_evidence: { public_repos: 92, followers: 11860 },
        quality_note: 'followers 仅为弱流行度信号',
      },
    ],
    projects: [
      {
        full_name: 'alchaincyf/nes-arcade',
        url: 'https://github.com/alchaincyf/nes-arcade',
        category: 'game-emulator-frontend',
        status: 'watch',
        recommendation: false,
        reason: '许可证门槛不满足',
        evidence: { stars: 24, forks: 11, license_spdx: null, readme: 'missing' },
      },
    ],
  });

  assert.equal(board.available, true);
  assert.equal(board.people[0].followersCompact, '11.9k');
  assert.equal(board.projects[0].licenseLabel, '未声明');
  assert.equal(board.projects[0].recommendation, false);
  assert.equal(board.noLicenseCount, 1);
});

test('Atelier Idea 项目化模型保持只读边界与调研进度', () => {
  const board = model.buildIdeaPipelineBoard({
    generated_at: '2026-10-25T22:42:00+08:00',
    policy: {
      public_only: true,
      auto_scaffold: false,
      automation_max_stage: 'research',
    },
    ideas: [
      {
        id: 'worklens-weekly-picks',
        title: 'WorkLens 每周精选项目化',
        summary: '把 discoveries 候选从列表沉淀为每周精选',
        stage: 'research',
        evidence: [{}, {}],
        research_notes: '已核对公开证据',
        history: [{}, {}],
      },
    ],
  });

  assert.equal(board.available, true);
  assert.equal(board.publicOnly, true);
  assert.equal(board.autoScaffold, false);
  assert.equal(board.automationMaxStage, 'research');
  assert.equal(board.totals.total, 1);
  assert.equal(board.totals.research, 1);
  assert.equal(board.ideas[0].stageLabel, '调研');
  assert.equal(board.ideas[0].progress, 40);
  assert.equal(board.ideas[0].evidenceCount, 2);
});

test('Atelier 空模型不抛错且显式说明未加载', () => {
  const queue = model.buildEmptyQueueBoard('not_found');
  const circle = model.buildEmptyCircleBoard('not_found');
  const ideas = model.buildEmptyIdeaPipelineBoard('not_found');

  assert.equal(queue.available, false);
  assert.equal(queue.reason, 'not_found');
  assert.equal(queue.groups.length, model.STATE_ORDER.length);
  assert.equal(circle.available, false);
  assert.equal(circle.projects.length, 0);
  assert.equal(ideas.available, false);
  assert.equal(ideas.ideas.length, 0);
});

test('Atelier 候选观察池模型只读聚合候选并保留政策回显', () => {
  const board = model.buildCircleCandidatesBoard({
    generated_at: '2026-10-27T00:00:00Z',
    source: 'GitHub public REST API',
    policy: {
      public_github_only: true,
      auto_follow: false,
      auto_message: false,
      human_promote_required: true,
      store_email: false,
    },
    summary: { candidate_count: 2, fetched_count: 1 },
    candidates: [
      {
        login: 'alice',
        profile_url: 'https://github.com/alice',
        evidence_url: 'https://api.github.com/users/alice',
        source_projects: ['owner/skill-a', 'owner/skill-b'],
        contributions_total: 3,
        profile_fetched: true,
        profile_checked_at: '2026-10-27T00:00:00Z',
        public_evidence: {
          public_repos: 42,
          followers: 1250,
          following: 5,
          created_at: '2020-01-01T00:00:00Z',
          html_url: 'https://github.com/alice',
          type: 'User',
        },
        promotion_hint: {
          proposed_tier: 'watch',
          human_decision_required: true,
          notes: '仅存在协作事实',
        },
      },
      {
        login: 'bob',
        source_projects: ['owner/skill-c'],
        contributions_total: 1,
        profile_fetched: false,
        profile_checked_at: '2026-10-27T00:00:00Z',
        public_evidence: null,
      },
    ],
  });

  assert.equal(board.available, true);
  assert.equal(board.candidateCount, 2);
  assert.equal(board.fetchedCount, 1);
  assert.equal(board.policy.publicGithubOnly, true);
  assert.equal(board.policy.autoFollow, false);
  assert.equal(board.policy.humanPromoteRequired, true);
  assert.equal(board.candidates[0].login, 'alice');
  assert.equal(board.candidates[0].followersCompact, '1.3k');
  assert.equal(board.candidates[0].proposedTier, 'watch');
  assert.equal(board.candidates[0].humanDecisionRequired, true);
  assert.deepEqual(board.candidates[0].sourceProjects, ['owner/skill-a', 'owner/skill-b']);
  assert.equal(board.candidates[1].profileFetched, false);
  assert.equal(board.candidates[1].followersCompact, '—');
  assert.equal(board.candidates[1].publicRepos, null);
});

test('Atelier 候选观察池空态保持安全默认', () => {
  const empty = model.buildEmptyCircleCandidatesBoard('data_absent');
  assert.equal(empty.available, false);
  assert.equal(empty.candidateCount, 0);
  assert.equal(empty.candidates.length, 0);
  assert.equal(empty.policy.humanPromoteRequired, true);
  assert.equal(empty.policy.autoFollow, false);
});
