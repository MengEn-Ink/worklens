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

test('Atelier 推荐复盘模型只读展示公开事实与人工结论', () => {
  const board = model.buildRecommendationReviewBoard({
    generated_at: '2026-10-26T06:26:00Z',
    policy: {
      public_only: true,
      auto_adjust_profile: false,
      require_human_policy_ref: true,
      automation_max_conclusion: 'downgrade',
      conclusions: ['keep', 'downgrade', 'remove'],
    },
    reviews: [
      {
        id: 'rr-20261026-01',
        recommendation: {
          id: 'rec-20261025-01',
          recommended_at: '2026-10-25T06:07:53Z',
          channel: 'daily_discovery',
          signal_source: 'profile:MengEn-Ink:starred',
          reason: '公开弱信号进入每日发现批次。',
        },
        subject: {
          full_name: 'fighting41love/funNLP',
          html_url: 'https://github.com/fighting41love/funNLP',
        },
        subject_snapshot: {
          stars: 84133,
          license: null,
          archived: false,
          pushed_at: '2024-05-10T07:38:24Z',
        },
        observation_window: {
          from: '2026-10-25T06:07:53Z',
          to: '2026-10-26T06:20:00Z',
        },
        observed_facts: [
          {
            fact: '仍未声明 SPDX 许可证。',
            source_url: 'https://api.github.com/repos/fighting41love/funNLP',
            observed_at: '2026-10-26T06:20:00Z',
          },
        ],
        conclusion: 'downgrade',
        adjustment: 'profile-star 弱信号不得单独触发推荐。',
        reviewed_by: 'worklens-loop',
        authority: 'human-policy',
        policy_ref: 'README 数据与隐私原则第 4 条',
        reviewed_at: '2026-10-26T06:26:00Z',
      },
    ],
  });

  assert.equal(board.available, true);
  assert.equal(board.publicOnly, true);
  assert.equal(board.autoAdjustProfile, false);
  assert.equal(board.automationMaxConclusion, 'downgrade');
  assert.equal(board.totals.downgrade, 1);
  assert.equal(board.reviews[0].conclusionLabel, '降级观察');
  assert.equal(board.reviews[0].snapshot.license, '未声明');
  assert.equal(board.reviews[0].facts[0].sourceHost, 'api.github.com');
  assert.equal(board.reviews[0].factCount, 1);
});

test('Atelier 空模型不抛错且显式说明未加载', () => {
  const queue = model.buildEmptyQueueBoard('not_found');
  const circle = model.buildEmptyCircleBoard('not_found');
  const ideas = model.buildEmptyIdeaPipelineBoard('not_found');
  const reviews = model.buildEmptyRecommendationReviewBoard('not_found');

  assert.equal(queue.available, false);
  assert.equal(queue.reason, 'not_found');
  assert.equal(queue.groups.length, model.STATE_ORDER.length);
  assert.equal(circle.available, false);
  assert.equal(circle.projects.length, 0);
  assert.equal(ideas.available, false);
  assert.equal(ideas.ideas.length, 0);
  assert.equal(reviews.available, false);
  assert.equal(reviews.reviews.length, 0);
  assert.equal(reviews.totals.downgrade, 0);
});
