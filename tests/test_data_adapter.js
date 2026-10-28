/**
 * WorkLens Hub 数据适配层契约测试（零依赖，Node 内置 test runner）。
 *
 * 收敛后 PC / H5 共用一套 worklens-hub_9bx8/v1/data-adapter.js：
 * - 只从 discoveries.json 的公开字段推导，不再生成演示/示意数据；
 * - 编辑优先级只依赖 verdict 与 scores；
 * - 缺数据时安全降级，不抛异常。
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
const ROOT = path.resolve(__dirname, '..');
const adapter = require(path.join(ROOT, 'worklens-hub_9bx8', 'v1', 'data-adapter.js'));
const NOW = Date.parse('2026-10-28T00:00:00Z');

function candidate(name, extra = {}) {
  return Object.assign({
    full_name: name,
    html_url: `https://github.com/${name}`,
    description: 'Useful developer tool.',
    language: 'TypeScript',
    stars: 1200,
    forks: 100,
    open_issues: 8,
    license: 'MIT',
    archived: false,
    pushed_at: '2026-10-27T00:00:00Z',
    topics: ['developer-tools'],
    source: 'search:topic:developer-tools stars:>500 archived:false',
    collected_at: '2026-10-27T01:00:00Z',
  }, extra);
}

test('buildHubData：按优先级排序，头条 + 三条精选，统计一行事实', () => {
  const hub = adapter.buildHubData({
    generated_at: '2026-10-27T22:00:00Z',
    candidates: [
      candidate('small/early', { stars: 20, topics: [] }),
      candidate('org/no-license', { license: null, stars: 90000 }),
      candidate('big/agent-skill', { stars: 400000, forks: 10, topics: ['agent-skills', 'claude-skill'] }),
      candidate('mid/ui-kit', { stars: 30000, forks: 50, topics: ['design-system', 'react'] }),
    ],
    source_status: {
      'repository:a/b': { ok: true, count: 1, cached: true, fetched_at: '2026-10-27T22:00:00Z' },
      'search:topic:x': { ok: false, error: 'HTTP 503' },
    },
  }, NOW);

  assert.equal(hub.available, true);
  assert.equal(hub.entries.length, 4);
  assert.equal(hub.lead.fullName, 'big/agent-skill');
  assert.equal(hub.lead.kind, 'Skill');
  assert.equal(hub.picks.length, 3);
  assert.equal(hub.stats.scanned, 4);
  assert.equal(hub.stats.evaluate, 1, '无许可证的候选必须先评估风险');
  assert.equal(hub.stats.readable, 3);
  assert.ok(hub.kinds.every(item => adapter.KIND_ORDER.includes(item.kind)));
  assert.equal(hub.sources.total, 2);
  assert.equal(hub.sources.ok, 1);
  assert.equal(hub.sources.cached, 1);
  assert.equal(hub.sources.failed[0].error, 'HTTP 503');
  const noLicense = hub.entries.find(entry => entry.fullName === 'org/no-license');
  assert.equal(noLicense.verdict, 'evaluate');
  assert.equal(noLicense.license, '');
});

test('条目只携带公开字段与真实链接，不再生成示意趋势或演示推送', () => {
  const hub = adapter.buildHubData({ candidates: [candidate('org/project')] }, NOW);
  const entry = hub.entries[0];
  assert.equal(entry.url, 'https://github.com/org/project');
  assert.equal(entry.avatarUrl, 'https://github.com/org.png?size=96');
  assert.equal(entry.description, 'Useful developer tool.');
  assert.equal(entry.raw.full_name, 'org/project');
  for (const removed of ['repoMetrics', 'starTrend', 'activityHeat', 'pushes', 'routes']) {
    assert.equal(entry[removed], undefined, `不得再生成 ${removed}`);
    assert.equal(hub[removed], undefined, `不得再生成 ${removed}`);
  }
});

test('相同话题的候选互相关联，最多 3 条且不含自身', () => {
  const hub = adapter.buildHubData({
    candidates: ['a/1', 'a/2', 'a/3', 'a/4', 'a/5'].map(name => candidate(name, { topics: ['shared'] })),
  }, NOW);
  for (const entry of hub.entries) {
    assert.ok(entry.related.length <= 3);
    assert.ok(!entry.related.includes(entry.id));
  }
});

test('编辑优先级只依赖既有 verdict 与 scores 字段', () => {
  assert.equal(adapter.editorialPriority({ verdict: 'adopt', scores: { fit: 99, novelty: 20 } }), 'P0');
  assert.equal(adapter.editorialPriority({ verdict: 'adopt', scores: { fit: 92, novelty: 20 } }), 'P1');
  assert.equal(adapter.editorialPriority({ verdict: 'evaluate', scores: { fit: 76, novelty: 20 } }), 'P2');
  assert.equal(adapter.editorialPriority({ verdict: 'evaluate', scores: { fit: 60, novelty: 81 } }), 'P2');
  assert.equal(adapter.editorialPriority({ verdict: 'shelf', scores: { fit: 60, novelty: 20 } }), null);
});

test('缺数据 / 坏数据安全降级', () => {
  for (const broken of [null, undefined, {}, { candidates: null }, { candidates: [{}] }]) {
    const hub = adapter.buildHubData(broken, NOW);
    assert.equal(hub.available, false);
    assert.equal(hub.entries.length, 0);
    assert.equal(hub.lead, null);
    assert.equal(hub.sources.total, 0);
  }
});

test('画像信号源：读取 profile.json 开关，私有信号保持关闭', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'profile.json'), 'utf8'));
  const signals = adapter.buildProfileSignals(profile, { summary: { record_count: 3 } });
  const byKey = Object.fromEntries(signals.map(item => [item.key, item]));
  assert.equal(byKey.repositories.enabled, true);
  assert.equal(byKey.meetings.enabled, false);
  assert.equal(byKey.lark_docs.enabled, false);
  assert.match(byKey.podcasts_articles.note, /3 条/);
  assert.deepEqual(adapter.buildProfileSignals(null, null), []);
});

test('真实数据：discoveries 全链路不崩溃且计数一致', () => {
  const discoveries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'discoveries.json'), 'utf8'));
  const hub = adapter.buildHubData(discoveries);
  const valid = discoveries.candidates.filter(item => item && item.full_name);
  assert.equal(hub.entries.length, valid.length);
  assert.equal(hub.stats.readable + hub.stats.evaluate, hub.stats.scanned);
  assert.equal(new Set(hub.entries.map(entry => entry.id)).size, hub.entries.length, 'id 必须唯一');
  assert.equal(hub.sources.total, Object.keys(discoveries.source_status || {}).length);
});
