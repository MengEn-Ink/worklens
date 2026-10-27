'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = {};
const adapter = require('../worklens-ai-news/v2/data-adapter.js');
const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ai-news.json'), 'utf8'));

test('AI 情报适配器读取真实数据并生成筛选维度', () => {
  const vm = adapter.normalize(real, { now: '2026-10-26T09:00:00Z' });
  assert.equal(vm.status, 'ready');
  assert.equal(vm.items.length, real.items.length);
  assert.ok(vm.sources.length > 0);
  assert.equal(vm.categories.reduce((sum, item) => sum + item.count, 0), vm.items.length);
  assert.ok(vm.items.every(item => item.id && item.title && item.source && item.lens));
});

test('AI 情报适配器对空数据和缺字段安全降级', () => {
  assert.deepEqual(adapter.normalize(null).items, []);
  assert.equal(adapter.normalize({ items: [] }).status, 'empty');
  const vm = adapter.normalize({ items: [{ title: '', url: 'javascript:alert(1)' }, null] });
  assert.equal(vm.items.length, 2);
  assert.equal(vm.items[0].title, '未命名资讯');
  assert.equal(vm.items[0].source, '未知来源');
  assert.equal(vm.items[0].url, '');
});

test('AI 情报适配器只允许 HTTP(S) 外链并正确过滤时间', () => {
  assert.equal(adapter.safeUrl('javascript:alert(1)'), '');
  assert.equal(adapter.safeUrl('file:///tmp/a'), '');
  assert.match(adapter.safeUrl('https://example.com/a'), /^https:/);
  const item = { publishedAt: '2026-10-26T08:30:00Z' };
  const now = new Date('2026-10-26T09:00:00Z').getTime();
  assert.equal(adapter.withinRange(item, '1h', now), true);
  assert.equal(adapter.withinRange(item, 'all', now), true);
  assert.equal(adapter.withinRange({ publishedAt: '' }, '24h', now), false);
});


test('公开源字段兼容并按 P0/P1/P2/无级与时间排序', () => {
  const payload = { items: [
    { title: '无级最新', url: 'https://example.com/none', published_at: '2026-10-27T12:00:00Z', source: 'legacy' },
    { title: 'P2', url: 'https://example.com/p2', published_at: '2026-10-27T11:00:00Z', source: ['rss'] , priority: 'P2', category: 'community' },
    { title: 'P1 较旧', url: 'https://example.com/p1-old', published_at: '2026-10-26T10:00:00Z', source: ['official', 'mirror'], priority: 'P1', category: 'release', tags: ['sdk'] },
    { title: 'P0', url: 'https://example.com/p0', published_at: '2026-10-20T10:00:00Z', source: ['OSV.dev', 'CISA KEV'], priority: 'P0', category: 'security' },
    { title: 'P1 较新', url: 'https://example.com/p1-new', published_at: '2026-10-27T10:00:00Z', source: ['official'], priority: 'P1', category: 'ai' },
  ] };
  const vm = adapter.normalize(payload, { now: '2026-10-27T13:00:00Z' });
  assert.deepEqual(vm.items.map(item => item.title), ['P0', 'P1 较新', 'P1 较旧', 'P2', '无级最新']);
  assert.equal(vm.items[0].kind, 'risk');
  assert.equal(vm.items[2].kind, 'tool');
  assert.deepEqual(vm.items[2].sourceList, ['official', 'mirror']);
  assert.equal(vm.sources.find(source => source.name === 'official').count, 2);
  assert.deepEqual(vm.items[2].tags, ['sdk']);
});
