'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const HUB = 'worklens-hub_9bx8/v1';

test('IA 收敛：一级导航只剩 本期 / 情报 / 待审 / 我的', () => {
  const shell = read('shared/worklens-shell.js');
  const labels = Array.from(shell.matchAll(/label: '([^']+)'/g)).map(match => match[1]);
  assert.deepEqual(labels, ['本期', '情报', '待审', '我的']);
});

test('IA 收敛：已砍掉的板块不再出现在页面源码中', () => {
  const source = ['app.jsx', 'views.jsx', 'components.jsx', 'data-adapter.js'].map(file => read(`${HUB}/${file}`)).join('\n');
  for (const removed of ['推送中心', '学习路径', '引入复盘', '时间地图', '能力雷达', '你的词汇表', '已服役', '订阅主题', '下次重算']) {
    assert.ok(!source.includes(removed), `已收敛的板块不应再出现：${removed}`);
  }
  assert.ok(!/§ 第 \d+ 章/.test(source), '章节编号装饰应移除');
});

test('Hub 三个视图与关键中文文案齐备', () => {
  const app = read(`${HUB}/app.jsx`);
  const views = read(`${HUB}/views.jsx`);
  for (const copy of ['喜好账本', '信号源与隐私', '实验室', '核心开源者圈层', 'Idea 项目化', '推荐复盘', '四小时健康巡检']) {
    assert.ok(app.includes(copy), `「我的」缺少：${copy}`);
  }
  for (const copy of ['全部候选', '深度解读', '匹配度', '新颖度', '引入成本', '风险', 'Skill 待审', '阻断项', '正式引入']) {
    assert.ok(views.includes(copy), `视图缺少：${copy}`);
  }
});

test('仓库卡片指标动画与「本机相关」文案齐备，示意图形必须标注', () => {
  const components = read(`${HUB}/components.jsx`);
  const views = read(`${HUB}/views.jsx`);
  const css = read(`${HUB}/styles.css`);
  for (const copy of ['RepoSparkline', 'CountUp', 'IntersectionObserver', '示意 · 12 点', '示意 · 7 格', '实测', '非真实历史数据', '非真实事件统计']) {
    assert.ok(components.includes(copy), `组件缺少：${copy}`);
  }
  for (const copy of ['本机相关', '怎么读这一期', '为什么是头条', '相关分怎么算', '来源构成', '新上榜', '候选从哪来', '全部列出', '按来源筛选', '源命中']) {
    assert.ok(views.includes(copy), `视图缺少：${copy}`);
  }
  assert.ok(/prefers-reduced-motion/.test(css), '动画需尊重减少动态偏好');
});

test('只读声明收敛为页脚一处，页面不提供安装入口', () => {
  const app = read(`${HUB}/app.jsx`);
  const views = read(`${HUB}/views.jsx`);
  assert.equal((app.match(/不安装、不执行任何 Skill/g) || []).length, 1);
  assert.ok(!/onInstall|install\(/.test(app + views));
});

test('Hub 入口 HTML 是薄骨架：只含空 #root 与外部脚本', () => {
  const html = read(`${HUB}/worklens-hub_9bx8_pc.html`);
  assert.ok(html.includes('<div id="root"></div>'));
  assert.ok(!/<style/.test(html));
  assert.ok(!/<script>(?!<\/script>)/.test(html), '不得有 inline script');
  for (const file of ['./styles.css', './data-adapter.js', './atelier-model.js', './review-model.js', './components.jsx', './views.jsx', './app.jsx']) {
    assert.ok(html.includes(file), `缺少依赖 ${file}`);
  }
});

test('AI 情报页显式展示数据新鲜度与缓存降级徽标文案', () => {
  const app = read('worklens-ai-news/v2/app.jsx');
  assert.ok(app.includes('数据更新时间'), 'AI 情报页应展示数据更新时间文案');
  assert.ok(app.includes('UTC {generatedUtc}'), 'AI 情报页应展示 UTC 更新时间');
  assert.ok(app.includes('>缓存<'), 'AI 情报页应保留缓存徽标文案');
  assert.ok(app.includes('>降级<'), 'AI 情报页应保留降级徽标文案');
});

test('深度解读：六节结构、出处标记与缓存票根文案齐备', () => {
  const adapterSource = read(`${HUB}/data-adapter.js`);
  const views = read(`${HUB}/views.jsx`);
  const app = read(`${HUB}/app.jsx`);
  for (const copy of ['设计场景', '解决的痛点', '优点', '能帮你做什么', '设计思路与架构', '注意事项']) {
    assert.ok(adapterSource.includes(copy), `解读分节缺少：${copy}`);
  }
  for (const copy of ['原文', '实测', '推断', '精读', '模型']) assert.ok(adapterSource.includes(`'${copy}'`), `出处标签缺少：${copy}`);
  for (const copy of ['深度解读', '快速上手', '解读缓存', '0 次模型调用', '指纹', '排队中']) assert.ok(views.includes(copy), `解读界面缺少：${copy}`);
  assert.ok(app.includes("'repo-insights.json'"), '页面需读取解读缓存文件');
});
