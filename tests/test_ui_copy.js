'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('桌面导航与评分说明优先使用简体中文', () => {
  const app = read('worklens_zn3k/v3/app.jsx');
  const components = read('worklens_zn3k/v3/components.jsx');
  const views = read('worklens_zn3k/v3/views.jsx');

  for (const copy of ['本期精选', '筛选过程', '项目资料库', '项目详解', '行动路线', '使用复盘', '偏好画像']) {
    assert.ok(app.includes(copy), `缺少中文导航：${copy}`);
  }
  for (const copy of ['匹配度', '新颖度', '引入成本', '风险', '评分说明']) {
    assert.ok(components.includes(copy), `缺少中文评分解释：${copy}`);
  }
  assert.ok(views.includes('待审队列'));
  assert.ok(views.includes('喜好账本'));
  assert.ok(!app.includes("sub: 'This Issue'"));
  assert.ok(!views.includes('REVIEW QUEUE'));
});

test('AI 情报页显式展示数据新鲜度与缓存降级徽标文案', () => {
  const app = read('worklens-ai-news/v2/app.jsx');
  assert.ok(app.includes('数据更新时间'), 'AI 情报页应展示数据更新时间文案');
  assert.ok(app.includes('UTC {generatedUtc}'), 'AI 情报页应展示 UTC 更新时间');
  assert.ok(app.includes('>缓存<'), 'AI 情报页应保留缓存徽标文案');
  assert.ok(app.includes('>降级<'), 'AI 情报页应保留降级徽标文案');
});
