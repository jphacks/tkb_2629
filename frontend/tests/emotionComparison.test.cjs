const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process, Error, SyntaxError, __DEV__: false,
    require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  return exports;
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
const scores = Object.fromEntries(['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'].map((key) => [key, 0.5]));
const summary = (count = 1) => ({ review_count: count, emotion_scores: count ? scores : {}, color_code: '#7950A5' });
const chart = load('src/components/organisms/EmotionAnalysisCard.tsx', {
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  'react-native': { StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View' },
  '../../theme/colors': { colors: {} },
});
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).join('\n');

test('one octagon overlays raw scores using each average emotion color and solid or dotted outlines', () => {
  const tree = chart.EmotionAnalysisCard({ summary: {
    mine: summary(), others: { ...summary(), color_code: '#D9A431', emotion_scores: { ...scores, joy: 1 } },
  } });
  const polygons = nodes(tree).filter((node) => node.type === 'Polygon');
  assert.equal(polygons.length, 6);
  assert.equal(polygons[4].props.strokeDasharray, '1 5');
  assert.equal(polygons[4].props.strokeLinecap, 'round');
  assert.equal(polygons[4].props.stroke, '#D9A431');
  assert.equal(polygons[4].props.fill, '#D9A431');
  assert.equal(polygons[5].props.stroke, '#7950A5');
  assert.equal(polygons[5].props.fill, '#7950A5');
  const legends = nodes(tree).filter((node) => Array.isArray(node.props?.style) && node.props.style[1]?.borderColor);
  assert.deepEqual(legends.map((node) => node.props.style[1].borderColor), ['#7950A5', '#D9A431']);
  assert.equal(legends[1].props.style[0].borderStyle, 'dotted');
  assert.equal(polygons[5].props.strokeDasharray, undefined);
  assert.notEqual(polygons[4].props.points, polygons[5].props.points);
  assert.equal(polygons[5].props.points.split(' ')[0], '160,91');
  assert.equal(nodes(tree).filter((node) => node.type === 'RadialGradient').length, 8);
  assert.match(text(tree), /自分/);
  assert.match(text(tree), /みんな/);
  assert.doesNotMatch(text(tree), /全ユーザー|全読書回|全1件|JEV/);
});

test('missing summaries have guidance and no invented zero polygon', () => {
  for (const [mine, others, expected] of [[0, 0, 4], [1, 0, 5], [0, 1, 5]]) {
    const tree = chart.EmotionAnalysisCard({ summary: { mine: summary(mine), others: summary(others) } });
    assert.equal(nodes(tree).filter((node) => node.type === 'Polygon').length, expected);
    if (!mine) assert.match(text(tree), /しおりを書くと/);
    if (!others) assert.match(text(tree), /公開しおり/);
  }
});

test('comparison API authenticates, validates scores and surfaces failures', async () => {
  const calls = [];
  let payload = { mine: summary(), others: summary(0) }, status = 200;
  const api = load('src/lib/api.ts', {
    './auth': { authenticatedFetch: async (...args) => {
      calls.push(args);
      return { status, ok: status === 200, headers: { get: () => 'application/json' }, json: async () => payload };
    } },
  });
  assert.equal(await api.getEmotionComparison(10), payload);
  assert.match(calls[0][0], /\/books\/10\/emotions\/comparison$/);
  for (const value of [null, {}, { mine: summary() }, { mine: { ...summary(), emotion_scores: {} }, others: summary() },
    { mine: { ...summary(), emotion_scores: { ...scores, joy: 1.1 } }, others: summary() }]) {
    payload = value;
    await assert.rejects(api.getEmotionComparison(10), /応答形式/);
  }
  payload = { detail: 'Unavailable' };
  status = 503;
  await assert.rejects(api.getEmotionComparison(10), (error) => error.status === 503);
});
