'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../worklens_zn3k/v4/review-model.js');

const DATA_PATH = path.join(__dirname, '..', 'data', 'recommendation-reviews.json');

function payload(overrides) {
  return {
    schema_version: 1,
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
          reason: '公开 Star 弱信号进入每日发现',
        },
        subject: {
          full_name: 'fighting41love/funNLP',
          html_url: 'https://github.com/fighting41love/funNLP',
        },
        subject_snapshot: { stars: 84133, license: null, archived: false, pushed_at: '2024-05-10T07:38:24Z' },
        observation_window: { from: '2026-10-25T06:07:53Z', to: '2026-10-26T06:20:00Z' },
        observed_facts: [
          {
            fact: '仍未声明许可证，默认分支两年无推送',
            source_url: 'https://api.github.com/repos/fighting41love/funNLP',
            observed_at: '2026-10-26T06:20:00Z',
          },
        ],
        conclusion: 'downgrade',
        adjustment: '弱信号不得单独推荐（人工策略说明）',
        reviewed_by: 'worklens-loop',
        authority: 'human-policy',
        policy_ref: 'README 数据与隐私原则第 4 条',
        reviewed_at: '2026-10-26T06:26:00Z',
      },
    ],
    ...overrides,
  };
}

test('真实复盘数据可被模型完整映射', () => {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const board = model.buildReviewBoard(raw);
  assert.equal(board.available, true);
  assert.equal(board.totals.total, 1);
  assert.equal(board.totals.downgrade, 1);
  assert.equal(board.publicOnly, true);
  assert.equal(board.autoAdjustProfile, false);
  const entry = board.reviews[0];
  assert.equal(entry.subject.fullName, 'fighting41love/funNLP');
  assert.equal(entry.subject.owner, 'fighting41love');
  assert.equal(entry.subject.repo, 'funNLP');
  assert.equal(entry.subject.url, 'https://github.com/fighting41love/funNLP');
  assert.equal(entry.conclusionLabel, '降权');
  assert.equal(entry.authorityLabel, '真人策略授权');
  assert.equal(entry.channelLabel, '每日发现');
  assert.equal(entry.recommendedAtLabel, '2026-10-25');
  assert.equal(entry.window.fromLabel, '2026-10-25');
  assert.equal(entry.window.toLabel, '2026-10-26');
  assert.equal(entry.snapshot.licenseLabel, '未声明');
  assert.equal(entry.snapshot.starsLabel, '8.4w');
  assert.equal(entry.facts.length, 3);
  assert.match(entry.facts[0].text, /SPDX 许可证/);
});

test('结论计数正确并支持 keep / remove 标签', () => {
  const base = payload().reviews[0];
  const data = payload({
    reviews: [
      { ...base, id: 'rr-keep-0001', conclusion: 'keep' },
      { ...base, id: 'rr-remove-0001', conclusion: 'remove', reviewed_by: 'MengEn-Ink', authority: 'human' },
      { ...base, id: 'rr-down-0001' },
    ],
  });
  const board = model.buildReviewBoard(data);
  assert.deepEqual(board.totals, { total: 3, keep: 1, downgrade: 1, remove: 1 });
  assert.equal(board.reviews[1].conclusionLabel, '移除');
  assert.equal(board.reviews[0].conclusionLabel, '保留');
  assert.equal(board.reviews[1].authorityLabel, '真人决定');
});

test('空数据降级：null/缺字段/空 reviews 均不抛异常', () => {
  assert.equal(model.buildReviewBoard(null).available, false);
  assert.equal(model.buildReviewBoard(undefined).totals.total, 0);

  const empty = model.buildReviewBoard({ policy: { public_only: true }, reviews: [] });
  assert.equal(empty.available, true);
  assert.equal(empty.reviews.length, 0);
  assert.deepEqual(empty.totals, { total: 0, keep: 0, downgrade: 0, remove: 0 });

  const malformed = model.buildReviewBoard({ reviews: [{ id: 'rr-bad-one' }] });
  const entry = malformed.reviews[0];
  assert.equal(entry.conclusionLabel, '未知');
  assert.equal(entry.authorityLabel, '未知');
  assert.equal(entry.subject.owner, '—');
  assert.equal(entry.snapshot.licenseLabel, '未声明');
  assert.deepEqual(entry.facts, []);

  const emptyBoard = model.buildEmptyReviewBoard('load_failed');
  assert.equal(emptyBoard.available, false);
  assert.equal(emptyBoard.reason, 'load_failed');
  assert.equal(emptyBoard.publicOnly, true);
  assert.equal(emptyBoard.autoAdjustProfile, false);
});

test('只读边界：输出为纯数据，无函数与任何动作键', () => {
  const board = model.buildReviewBoard(payload());
  // 只拦截写动作命名（onXxx/action/handler/mutate/dispatch/install/transition/write）；
  // totals.remove 等是结论计数，不属于动作键。
  const actionKeyPattern = /(^|_)(on[A-Z]|action|handler|mutat|dispatch|install|transition|write)/i;

  (function walk(node, keyPath) {
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      assert.notEqual(typeof value, 'function', `${keyPath}.${key} 不得是函数（只读视图模型）`);
      assert.ok(!actionKeyPattern.test(key), `${keyPath}.${key} 看起来像写动作入口`);
      walk(value, `${keyPath}.${key}`);
    }
  })(board, '$');

  // 纯数据必须可 JSON 序列化（无函数、无循环引用）
  assert.doesNotThrow(() => JSON.stringify(board));
  const apiKeys = Object.keys(model);
  assert.ok(!apiKeys.some((name) => /^(install|transition|adjust|write|mutate)/i.test(name)));
});

test('owner/repo 拆分与数字压缩的边界表现', () => {
  const board = model.buildReviewBoard(
    payload({
      reviews: [
        {
          ...payload().reviews[0],
          id: 'rr-plain-name01',
          subject: { full_name: 'plain', html_url: 'https://github.com/plain' },
          subject_snapshot: { stars: 950, license: 'MIT' },
        },
      ],
    })
  );
  assert.equal(board.reviews[0].subject.owner, 'plain');
  assert.equal(board.reviews[0].subject.repo, '');
  assert.equal(board.reviews[0].snapshot.starsLabel, '950');
  assert.equal(model.compactNumber('not-a-number'), '—');
  assert.equal(model.shortDate(''), '—');
});
