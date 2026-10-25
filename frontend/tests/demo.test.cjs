const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, dependencies, env = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, process: { env },
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === 'react/jsx-runtime') return jsx;
      return new Proxy({}, { get: (_, key) => String(key) });
    },
  });
  return exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = (tree) => nodes(tree).filter(node => node.type === 'Text').map(node => [node.props.children].flat(Infinity).join('')).join('\n');
function harness() {
  const state = [];
  let cursor;
  const { DemoScreen } = load('src/screens/demo/DemoScreen.tsx', {
    react: { useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    } },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
    './demoData': load('src/screens/demo/demoData.ts', {}),
  });
  return { render() { cursor = 0; return DemoScreen(); } };
}
function press(tree, label) {
  const target = nodes(tree).find(node => node.type === 'Pressable' && (node.props.accessibilityLabel === label || text(node) === label));
  assert.ok(target, label);
  target.props.onPress();
}

test('demo starts with honest sample notices and opens without login', () => {
  const h = harness();
  let tree = h.render();
  assert.match(text(tree), /ログイン不要/);
  assert.match(text(tree), /実際のAI解析や他の利用者との通信は行いません/);
  assert.match(text(tree), /再読み込みすると最初に戻ります/);
  press(tree, 'サンプルの本を開く');
  tree = h.render();
  assert.match(text(tree), /24ページ · 期待/);
  assert.match(text(tree), /色は体験用の固定値/);
});

test('page selection survives switching reader and reset restores the initial sample', () => {
  const h = harness();
  press(h.render(), 'サンプルの本を開く');
  press(h.render(), '96ページの悲しみの栞を開く');
  assert.match(text(h.render()), /96ページ · 悲しみ/);
  press(h.render(), 'みんなの栞');
  assert.match(text(h.render()), /96ページ · 信頼/);
  assert.match(text(h.render()), /別の読者の感想を想定したサンプル/);
  press(h.render(), '自分の栞');
  assert.match(text(h.render()), /96ページ · 悲しみ/);
  press(h.render(), '← デモの最初に戻る');
  press(h.render(), 'サンプルの本を開く');
  assert.match(text(h.render()), /24ページ · 期待/);
});

test('demo entry never mounts regular authentication and only enables for explicit true', () => {
  for (const flag of [undefined, 'false', 'true']) {
    const { default: App } = load('App.tsx', {
      './src/screens/demo/DemoScreen': { DemoScreen: 'DemoScreen' },
      react: {
        useState() { throw new Error('App entry must not run regular hooks'); },
        useEffect() { throw new Error('App entry must not restore auth'); },
      },
    }, { EXPO_PUBLIC_DEMO_MODE: flag });
    const tree = App();
    if (flag === 'true') assert.equal(tree.type, 'DemoScreen');
    else assert.equal(tree.type.name, 'RegularApp');
  }
});

test('choosing a sample previews its fixed color and adds, compares, updates and resets one bookmark', () => {
  const h = harness();
  press(h.render(), 'サンプルの本を開く');
  const submit = () => nodes(h.render()).find(node => node.type === 'Pressable' && /選んだ感想で栞/.test(text(node)));
  assert.equal(submit().props.disabled, true);
  submit().props.onPress();
  assert.doesNotMatch(text(h.render()), /120ページ · /);
  press(h.render(), '喜びの感想を選ぶ');
  assert.equal(submit().props.disabled, false);
  assert.match(text(h.render()), /プレビュー · 喜び/);
  assert.ok(nodes(h.render()).some(node => Array.isArray(node.props?.style) && node.props.style.some(style => style?.backgroundColor === '#E6C84D')));
  press(h.render(), '選んだ感想で栞を追加');
  assert.match(text(h.render()), /120ページ · 喜び/);
  assert.match(text(h.render()), /喜びの色で追加しました/);
  assert.equal(submit().props.disabled, true);
  press(h.render(), 'みんなの栞');
  assert.match(text(h.render()), /120ページ · 信頼/);
  press(h.render(), '悲しみの感想を選ぶ');
  press(h.render(), '選んだ感想で栞を更新');
  assert.match(text(h.render()), /120ページ · 悲しみ/);
  assert.match(text(h.render()), /悲しみの色で更新しました/);
  assert.equal(nodes(h.render()).filter(node => node.props?.accessibilityLabel?.endsWith('の栞を開く')).length, 4);
  press(h.render(), '24ページの期待の栞を開く');
  assert.match(text(h.render()), /24ページ · 期待/);
  press(h.render(), '← デモの最初に戻る');
  press(h.render(), 'サンプルの本を開く');
  assert.equal(nodes(h.render()).filter(node => node.props?.accessibilityLabel?.endsWith('の栞を開く')).length, 3);
  assert.doesNotMatch(text(h.render()), /色で更新しました/);
  assert.equal(submit().props.disabled, true);
});

test('Pages config preserves normal settings and only adds a validated demo base path', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'app.config.js'), 'utf8');
  const config = { name: 'Original', experiments: { existing: true } };
  function configure(env) {
    const module = { exports: {} };
    vm.runInNewContext(code, { module, process: { env } });
    return module.exports({ config });
  }
  assert.equal(configure({}).name, 'Original');
  assert.equal(configure({}).experiments.baseUrl, undefined);
  const demo = configure({ EXPO_PUBLIC_DEMO_MODE: 'true', DEMO_BASE_PATH: '/tkb_2629' });
  assert.equal(demo.experiments.baseUrl, '/tkb_2629');
  assert.equal(demo.experiments.existing, true);
  assert.throws(() => configure({ DEMO_BASE_PATH: '/tkb_2629' }), /requires/);
  assert.throws(() => configure({ EXPO_PUBLIC_DEMO_MODE: 'true', DEMO_BASE_PATH: '../bad' }), /single absolute path/);
});
