/**
 * WorkLens Hub 数据适配层契约测试（零依赖，Node 内置 test runner）。
 *
 * 收敛后 PC / H5 共用一套 worklens-hub_9bx8/v1/data-adapter.js：
 * - 只从 discoveries.json 的公开字段推导；示意图形必须带 illustrative 标记且末点等于实测值；
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

test('条目只携带公开字段与真实链接，不生成演示推送', () => {
  const hub = adapter.buildHubData({ candidates: [candidate('org/project')] }, NOW);
  const entry = hub.entries[0];
  assert.equal(entry.url, 'https://github.com/org/project');
  assert.equal(entry.avatarUrl, 'https://github.com/org.png?size=96');
  assert.equal(entry.description, 'Useful developer tool.');
  assert.equal(entry.raw.full_name, 'org/project');
  for (const removed of ['pushes', 'routes']) {
    assert.equal(entry[removed], undefined, `不得再生成 ${removed}`);
    assert.equal(hub[removed], undefined, `不得再生成 ${removed}`);
  }
});

test('仓库卡片指标：数字为实测快照，曲线 / 活跃度显式标记为示意', () => {
  const hub = adapter.buildHubData({ candidates: [candidate('org/project', { stars: 4321, forks: 210, open_issues: 17 })] }, NOW);
  const m = hub.entries[0].repoMetrics;
  assert.equal(m.stars, 4321);
  assert.equal(m.forks, 210);
  assert.equal(m.issues, 17);
  assert.equal(m.starTrend.length, 12);
  assert.equal(m.starTrend[11], 4321, '曲线末点必须等于真实 stars');
  assert.ok(m.starTrend.every(value => value <= 4321 && value >= 0));
  assert.equal(m.activityHeat.length, 7);
  assert.ok(m.activityHeat.every(level => level >= 1 && level <= 5));
  assert.equal(m.starTrendIllustrative, true);
  assert.equal(m.activityHeatIllustrative, true);
  assert.deepEqual(adapter.buildRepoMetrics({ stars: 4321, forks: 210, open_issues: 17 }), m, '同一快照推演结果必须确定');
  assert.deepEqual(adapter.buildRepoMetrics({}).starTrend, Array(12).fill(0));
});

test('本机相关：冷启动不打分；喜欢后同话题/作者升权，跳过后降权', () => {
  const hub = adapter.buildHubData({
    candidates: [
      candidate('alice/a', { topics: ['agent', 'mcp'] }),
      candidate('alice/b', { topics: ['agent'] }),
      candidate('bob/c', { topics: ['mcp'], language: 'Go' }),
      candidate('carol/d', { topics: ['css'], language: 'CSS', description: 'design tokens ui' }),
    ],
  }, NOW);
  const byName = Object.fromEntries(hub.entries.map(entry => [entry.fullName, entry]));
  const cold = adapter.buildLocalProfile(hub.entries, {});
  assert.equal(cold.ready, false);
  assert.equal(adapter.localRelevance(byName['alice/b'], cold, {}).ready, false);

  const taste = { [byName['alice/a'].id]: 'love', [byName['carol/d'].id]: 'skip' };
  const profile = adapter.buildLocalProfile(hub.entries, taste);
  assert.equal(profile.ready, true);
  assert.equal(profile.loved, 1);
  assert.equal(profile.skipped, 1);
  const relB = adapter.localRelevance(byName['alice/b'], profile, taste);
  const relC = adapter.localRelevance(byName['bob/c'], profile, taste);
  assert.ok(relB.score > relC.score, '同作者 + 同话题应高于仅同话题');
  assert.equal(relB.level, 'high');
  assert.ok(relB.reasons.some(reason => reason.text.includes('作者 alice')));
  assert.equal(adapter.localRelevance(byName['alice/a'], profile, taste).level, 'loved');
  assert.equal(adapter.localRelevance(byName['carol/d'], profile, taste).level, 'skipped');
  assert.equal(adapter.buildLocalProfile(null, null).ready, false);
});

test('解释说明：分数 / 结论 / 优先级都能翻译成人话', () => {
  const hub = adapter.buildHubData({ candidates: [candidate('org/project'), candidate('org/no-license', { license: null })] }, NOW);
  const entry = hub.entries.find(item => item.fullName === 'org/project');
  const notes = adapter.explainScores(entry);
  assert.deepEqual(notes.map(note => note.key), ['fit', 'novelty', 'cost', 'risk']);
  assert.ok(notes.every(note => typeof note.how === 'string' && note.how.length > 10));
  const noLicense = hub.entries.find(item => item.fullName === 'org/no-license');
  assert.match(adapter.explainVerdict(noLicense), /没有声明许可证/);
  assert.match(adapter.explainPriority('P0'), /P0/);
  assert.equal(adapter.explainPriority(null), '');
});

test('来源构成与新上榜：全部候选都列出，渠道归并、多源命中、12 小时新上榜', () => {
  const hub = adapter.buildHubData({
    generated_at: '2026-10-29T01:00:00Z',
    candidates: [
      candidate('hot/trend', { stars: 300, source: 'trending:daily/all', also_seen_in: ['search:topic:mcp'], first_seen_at: '2026-10-29T01:00:00Z' }),
      candidate('cold/new', { stars: 9000, source: 'search:created:>{days_ago:30} stars:>300', first_seen_at: '2026-10-28T20:00:00Z' }),
      candidate('my/star', { source: 'profile:me:starred', first_seen_at: '2026-10-20T00:00:00Z' }),
      candidate('risky/none', { license: null, archived: true, stars: 1, source: 'mention:ai-news' }),
    ],
    source_status: {
      'trending:daily/all': { ok: true, count: 1 },
      'search:topic:mcp': { ok: true, count: 1 },
      'search:created:>{days_ago:30} stars:>300': { ok: true, count: 1 },
      'profile:me:starred': { ok: true, count: 1 },
      'mention:ai-news': { ok: true, count: 1 },
    },
  }, NOW);
  assert.equal(hub.entries.length, 4, '高风险 / 低星候选也不能被丢弃');
  assert.deepEqual(hub.intake, { feeds: 5, hits: 5, unique: 4, merged: 1 });
  const byKey = Object.fromEntries(hub.channels.map(item => [item.key, item]));
  assert.equal(byKey.trending.count, 1);
  assert.equal(byKey.search.count, 2);
  assert.equal(byKey.search.feeds, 2);
  assert.equal(byKey.starred.count, 1);
  assert.equal(byKey.mention.count, 1);
  const hot = hub.entries.find(entry => entry.fullName === 'hot/trend');
  assert.deepEqual(hot.channels, ['trending', 'search']);
  assert.equal(hot.hits, 2);
  assert.equal(hot.trending, true);
  assert.equal(hub.stats.fresh, 2);
  assert.deepEqual(hub.fresh.map(entry => entry.fullName), ['hot/trend', 'cold/new'], '新上榜热榜优先于 Stars');
  assert.equal(hub.entries.find(entry => entry.fullName === 'my/star').fresh, false);
  assert.equal(hub.entries.find(entry => entry.fullName === 'risky/none').fresh, false, '缺 first_seen_at 不算新上榜');
  assert.equal(adapter.channelOf('repository:a/b'), 'pinned');
  assert.equal(adapter.channelLabel('trending'), 'Trending 热榜');
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
