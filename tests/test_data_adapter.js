/**
 * WorkLens 前端只读视图模型契约测试（零依赖，Node 内置 test runner）。
 *
 * 锚定 data/skill-review-queue.json 到 PC/移动端适配器的只读契约：
 * - 队列状态计数、阻断项进度、试用排序必须与数据一致；
 * - 页面模型只暴露展示字段，不暴露任何安装/流转动作；
 * - 缺数据时回退种子数据，不抛异常。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};

const ROOT = path.resolve(__dirname, '..');
const ADAPTERS = [
  ['PC', path.join(ROOT, 'worklens_zn3k', 'v3', 'data-adapter.js')],
  ['移动端', path.join(ROOT, 'worklens-mobile_8a6r', 'v2', 'data-adapter.js')],
];

const BLOCKING = [
  'license_declared',
  'license_compatible',
  'secret_clean',
  'install_safe',
  'network_declared',
  'write_scope_declared',
  'injection_surface_reviewed',
];
const STATES = ['candidate', 'screening', 'needs_changes', 'trial', 'adopted', 'rejected', 'quarantined'];

function makeEntry(id, subject, state, passCount) {
  const checks = {};
  BLOCKING.forEach((key, index) => {
    checks[key] = { status: index < passCount ? 'pass' : 'missing' };
  });
  return {
    id,
    subject,
    state,
    checks,
    license: 'MIT',
    stars: 5,
    archived: false,
    pushed_at: '2026-10-01T00:00:00Z',
    risk_flags: [],
    html_url: `https://github.com/${subject}`,
    trial: state === 'trial' ? { scope: '只读限范围试用' } : null,
  };
}

function makeQueue() {
  return {
    schema_version: 1,
    generated_at: '2026-10-25T00:00:00+00:00',
    policy: { auto_install: false, human_gate: 'candidate 之后必须人工流转', blocking_checks: BLOCKING, states: STATES },
    queue: [
      makeEntry('SR-1', 'org/trial-skill', 'trial', 7),
      makeEntry('SR-2', 'org/new-skill', 'candidate', 5),
      makeEntry('SR-3', 'org/another', 'candidate', 0),
    ],
  };
}

function makeDiscoveries() {
  return {
    generated_at: '2026-10-25T00:00:00+00:00',
    candidates: [
      { full_name: 'org/trial-skill', html_url: 'u', description: 'd', language: 'Python', stargazers_count: 5, license: { spdx_id: 'MIT' }, archived: false, pushed_at: '2026-10-01T00:00:00Z', topics: [], collected_at: '2026-10-25T00:00:00Z', scores: { fit: 80, risk: 20 }, notes: ['n'], category: 'skill' },
      { full_name: 'zzz/other', html_url: 'u', description: 'd2', language: 'Go', stargazers_count: 1, license: { spdx_id: 'MIT' }, archived: false, pushed_at: '2026-10-01T00:00:00Z', topics: [], collected_at: '2026-10-25T00:00:00Z', scores: { fit: 10, risk: 90 }, notes: ['n'], category: 'infra' },
    ],
  };
}

for (const [label, adapterPath] of ADAPTERS) {
  const adapter = require(adapterPath);

  test(`${label}：buildSkillQueue 输出状态计数与阻断项进度`, () => {
    const vm = adapter.buildSkillQueue(makeQueue());
    assert.equal(vm.total, 3);
    assert.equal(vm.blockingTotal, 7);
    assert.equal(vm.byState.trial, 1);
    assert.equal(vm.byState.candidate, 2);
    assert.equal(vm.autoInstall, false);
    assert.equal(vm.humanGate, 'candidate 之后必须人工流转');
    const trial = vm.entries[0];
    assert.equal(trial.owner, 'org');
    assert.equal(trial.repo, 'trial-skill');
    assert.equal(trial.state, 'trial');
    assert.equal(trial.stateLabel, '限范围试用');
    assert.equal(trial.passed, 7);
    assert.equal(trial.total, 7);
    assert.deepEqual(trial.pendingLabels, []);
    const pending = vm.entries[1];
    assert.equal(pending.passed, 5);
    assert.equal(pending.pendingLabels.length, 2);
  });

  test(`${label}：队列视图模型只读，不暴露安装或流转动作`, () => {
    const vm = adapter.buildSkillQueue(makeQueue());
    assert.equal(vm.autoInstall, false);
    for (const entry of vm.entries) {
      for (const [key, value] of Object.entries(entry)) {
        assert.notEqual(typeof value, 'function', `${entry.id}.${key} 只读模型不得包含可执行动作`);
      }
      assert.equal(entry.install, undefined);
      assert.equal(entry.transition, undefined);
    }
  });

  test(`${label}：空队列/缺载荷安全降级`, () => {
    assert.doesNotThrow(() => adapter.buildSkillQueue(null));
    assert.equal(adapter.buildSkillQueue(null).total, 0);
    assert.doesNotThrow(() => adapter.buildPcData({}, { candidates: [] }, null));
    assert.deepEqual(adapter.buildPcData({ KEEP: 1 }, { candidates: [] }, null), { KEEP: 1 });
  });

  test(`${label}：buildPcData 将试用候选置顶并透传队列模型`, () => {
    const pc = adapter.buildPcData({}, makeDiscoveries(), makeQueue());
    assert.equal(pc.SKILL_QUEUE.byState.trial, 1);
    assert.equal(pc.SKILL_PROPOSALS[0].review_state, 'trial');
    assert.match(pc.SKILL_PROPOSALS[0].family, /限范围试用/);
    assert.match(pc.SKILL_PROPOSALS[0].evidence[0], /阻断项 7\/7 通过/);
    assert.ok(pc.SKILL_PROPOSALS.every(p => /不安装、不执行/.test(p.why)));
  });

  test(`${label}：buildMobileData 透传袖珍对比器模型与建议字段`, () => {
    const mobile = adapter.buildMobileData({}, makeDiscoveries(), makeQueue());
    assert.equal(mobile.skillQueue.byState.trial, 1);
    assert.equal(mobile.skillQueue.total, 3);
    assert.ok(mobile.proposals.length >= 1);
    for (const proposal of mobile.proposals) {
      assert.equal(typeof proposal.confidence, 'number');
      assert.ok(Array.isArray(proposal.evidence));
    }
  });
}

test('真实数据：队列与 discoveries 全链路不崩溃且计数一致', () => {
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skill-review-queue.json'), 'utf8'));
  const discoveries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'discoveries.json'), 'utf8'));
  assert.equal(queue.policy.auto_install, false);
  for (const [label, adapterPath] of ADAPTERS) {
    const current = require(adapterPath);
    const vm = current.buildSkillQueue(queue);
    assert.equal(vm.total, queue.queue.length, `${label} 条目数一致`);
    let trialCount = 0;
    for (const entry of vm.entries) {
      if (entry.state === 'trial') {
        trialCount += 1;
      }
      assert.equal(entry.passed + entry.pendingLabels.length, entry.total, `${label} ${entry.id} 进度闭合`);
      assert.ok(entry.total <= 7);
    }
    assert.equal(trialCount, 1, `${label} 当前仅 1 个限范围试用候选`);
    const mobile = current.buildMobileData({}, discoveries, queue);
    assert.equal(mobile.skillQueue.total, queue.queue.length);
  }
});

/* Issue #5：移动端 Idea 项目化「袖珍只读摘要」契约（仅锚定移动端 v2 适配器）。 */
const MOBILE_ADAPTER_PATH = path.join(ROOT, 'worklens-mobile_8a6r', 'v2', 'data-adapter.js');

function makeIdeaPipeline() {
  return {
    schema_version: 1,
    generated_at: '2026-10-26T12:00:00Z',
    policy: { public_only: true, auto_scaffold: false, automation_max_stage: 'research' },
    ideas: [
      {
        id: 'scorecard-skill-metrics',
        title: '为 Skill 待审队列补充 OpenSSF Scorecard 公开安全指标',
        stage: 'research',
        evidence: [{ url: 'https://github.com/ossf/scorecard' }, { url: 'https://api.github.com/repos/ossf/scorecard' }],
      },
      { id: 'fresh-idea', title: '刚登记的灵感', stage: 'idea', evidence: [] },
    ],
  };
}

test('移动端 Idea 袖珍模型：只暴露总数/research 项/自动化上限/下一步四个事实', () => {
  const adapter = require(MOBILE_ADAPTER_PATH);
  const pocket = adapter.buildIdeaPocket(makeIdeaPipeline());
  assert.equal(pocket.available, true);
  assert.equal(pocket.total, 2);
  assert.equal(pocket.researchCount, 1);
  assert.deepEqual(pocket.researchItems, [
    { id: 'scorecard-skill-metrics', title: '为 Skill 待审队列补充 OpenSSF Scorecard 公开安全指标' },
  ]);
  assert.equal(pocket.automationMaxStage, 'research');
  assert.equal(pocket.automationMaxStageLabel, '调研（research）');
  assert.equal(pocket.nextStage, 'plan');
  assert.equal(pocket.nextStageLabel, '方案');
  assert.match(pocket.nextStep, /等待真人确认后进入方案/);
  assert.equal(pocket.publicOnly, true);
  assert.equal(pocket.autoScaffold, false);
  assert.equal(pocket.updatedAt, '2026-10-26');
});

test('移动端 Idea 袖珍模型：严格只读，不含任何可执行动作或写入口', () => {
  const adapter = require(MOBILE_ADAPTER_PATH);
  const pocket = adapter.buildIdeaPocket(makeIdeaPipeline());
  assert.equal(pocket.readOnly, true);
  const forbiddenKeys = ['install', 'transition', 'advance', 'create', 'createTask', 'scaffold', 'start', 'move', 'actions'];
  for (const key of forbiddenKeys) {
    assert.equal(pocket[key], undefined, `袖珍模型不得暴露 ${key}`);
  }
  const walk = (node, prefix) => {
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      assert.notEqual(typeof value, 'function', `${prefix}.${key} 只读模型不得包含函数`);
      walk(value, `${prefix}.${key}`);
    }
  };
  walk(pocket, 'pocket');
});

test('移动端 Idea 袖珍模型：缺数据/空数据安全降级且不越界', () => {
  const adapter = require(MOBILE_ADAPTER_PATH);
  for (const broken of [null, undefined, {}, { ideas: null }, { ideas: 'x' }, 'invalid']) {
    const degraded = adapter.buildIdeaPocket(broken);
    assert.equal(degraded.available, false);
    assert.equal(degraded.total, 0);
    assert.equal(degraded.researchCount, 0);
    assert.deepEqual(degraded.researchItems, []);
    assert.equal(degraded.automationMaxStage, '');
    assert.equal(degraded.nextStep, '');
    assert.equal(degraded.autoScaffold, false);
    assert.equal(degraded.readOnly, true);
  }
  const emptyButValid = adapter.buildIdeaPocket({ ideas: [], policy: { automation_max_stage: 'research' } });
  assert.equal(emptyButValid.available, true);
  assert.equal(emptyButValid.total, 0);
  assert.equal(emptyButValid.researchCount, 0);
  assert.equal(emptyButValid.nextStage, '');
  assert.equal(emptyButValid.nextStep, '');
});

test('移动端 buildMobileData 第四参数接入 Idea 袖珍模型，缺省即降级', () => {
  const adapter = require(MOBILE_ADAPTER_PATH);
  const discoveries = makeDiscoveries();
  const queue = makeQueue();
  const withPocket = adapter.buildMobileData({}, discoveries, queue, makeIdeaPipeline());
  assert.equal(withPocket.ideaPocket.available, true);
  assert.equal(withPocket.ideaPocket.total, 2);
  const legacyCall = adapter.buildMobileData({}, discoveries, queue);
  assert.equal(legacyCall.ideaPocket.available, false);
  assert.equal(legacyCall.ideaPocket.readOnly, true);
});

test('真实数据：移动端 Idea 袖珍模型与 data/idea-pipeline.json 一致且只读', () => {
  const adapter = require(MOBILE_ADAPTER_PATH);
  const pipeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'idea-pipeline.json'), 'utf8'));
  const pocket = adapter.buildIdeaPocket(pipeline);
  assert.equal(pocket.available, true);
  assert.equal(pocket.total, pipeline.ideas.length);
  assert.equal(pocket.researchCount, pipeline.ideas.filter(i => i.stage === 'research').length);
  assert.equal(pocket.automationMaxStage, pipeline.policy.automation_max_stage);
  assert.equal(pocket.autoScaffold, pipeline.policy.auto_scaffold);
  assert.equal(pocket.autoScaffold, false);
  assert.equal(pocket.readOnly, true);
  if (pocket.researchCount > 0) assert.equal(pocket.nextStage, 'plan');
});
