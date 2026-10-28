/**
 * 仓库详情「速读」契约测试：buildRepoBrief 只能从公开元数据推导，不得编造。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

global.window = {};
const adapter = require(path.join(__dirname, '..', 'worklens-hub_9bx8', 'v1', 'data-adapter.js'));

const NOW = Date.parse('2026-10-28T00:00:00Z');

function entry(raw, extra = {}) {
  return Object.assign({ title: 'demo', description: 'A demo repo.', kind: 'Skill', tags: ['x'], raw }, extra);
}

test('健康仓库：许可证/维护/参与度均为正向信号', () => {
  const brief = adapter.buildRepoBrief(entry({
    language: 'TypeScript', license: 'MIT', stars: 40000, forks: 8000, open_issues: 40,
    pushed_at: '2026-10-27T00:00:00Z', topics: ['a', 'b'], source: 'search:topic:a stars:>50 archived:false', also_seen_in: ['repository:x/y'],
  }), NOW);
  const fact = key => brief.facts.find(f => f.key === key);
  assert.equal(fact('语言').value, 'TypeScript');
  assert.equal(fact('许可证').tone, 'good');
  assert.equal(fact('最近推送').value, '1 天前');
  assert.equal(fact('来源命中').value, '2 处');
  assert.deepEqual(brief.topics, ['a', 'b']);
  assert.ok(brief.signals.some(s => s.label === '交叉命中'));
  assert.ok(brief.summary.includes('TypeScript'));
  assert.ok(brief.checklist.length >= 3);
});

test('风险仓库：未声明许可证、已归档、长期未推送均标红', () => {
  const brief = adapter.buildRepoBrief(entry({
    stars: 120, forks: 1, open_issues: 30, archived: true, pushed_at: '2024-01-01T00:00:00Z',
  }), NOW);
  const tones = Object.fromEntries(brief.signals.map(s => [s.label, s.tone]));
  assert.equal(tones['许可证'], 'risk');
  assert.equal(tones['维护'], 'risk');
  assert.equal(tones['状态'], 'risk');
  assert.equal(tones['议题压力'], 'warn');
  assert.equal(brief.facts.find(f => f.key === '状态').value, '已归档');
});

test('缺元数据时安全降级，不抛异常', () => {
  const brief = adapter.buildRepoBrief({ title: 'bare' }, NOW);
  assert.equal(brief.facts.find(f => f.key === '语言').value, '未标注语言');
  assert.equal(brief.facts.find(f => f.key === '最近推送').value, '未知');
});

test('Hub 条目携带速读所需的 raw 与 related', () => {
  const discoveries = require(path.join(__dirname, '..', 'data', 'discoveries.json'));
  const hub = adapter.buildHubData(discoveries);
  assert.ok(hub.entries.length > 0);
  hub.entries.forEach(e => {
    assert.ok(e.raw && e.raw.full_name, `${e.id} 缺少 raw`);
    assert.ok(Array.isArray(e.related));
    assert.doesNotThrow(() => adapter.buildRepoBrief(e));
  });
});
