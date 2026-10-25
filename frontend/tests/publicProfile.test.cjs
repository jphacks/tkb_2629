const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const flush = () => new Promise((resolve) => setImmediate(resolve));
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
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
const button = (tree, label) => nodes(tree).find((node) => node.props?.label === label);
const input = (tree) => nodes(tree).find((node) => node.type === 'ShadowInput');
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).join('\n');

function harness() {
  const state = [], refs = [], effects = [], requests = [];
  let cursor = 0, scheduled = [], target, backs = 0;
  function request(kind, args) {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ kind, args, resolve, reject });
    return promise;
  }
  const { PublicProfileScreen } = load('src/screens/account/PublicProfileScreen.tsx', {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useRef(initial) { return refs[cursor++] ??= { current: initial }; },
      useEffect(effect, deps) {
        const index = cursor++;
        const prior = effects[index];
        if (!prior || deps.some((value, i) => value !== prior.deps[i])) {
          scheduled.push(() => {
            prior?.cleanup?.();
            effects[index] = { deps, cleanup: effect() };
          });
        }
      },
    },
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'react-native': {
      StyleSheet: { create: (value) => value }, Platform: { OS: 'android' },
      Text: 'Text', View: 'View', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView',
    },
    '../../lib/api': {
      getPublicProfile: () => request('get', []),
      savePublicDisplayName: (...args) => request('put', args),
    },
  });
  return {
    requests,
    get target() { return target; },
    get backs() { return backs; },
    render(withBack = false) {
      cursor = 0; scheduled = [];
      const tree = PublicProfileScreen({
        onNavigate: (value) => { target = value; },
        onBack: withBack ? () => { backs += 1; } : undefined,
      });
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

async function ready(h, name = null) {
  h.render();
  h.requests[0].resolve({ public_display_name: name });
  await flush();
  return h.render();
}

test('settings opens dedicated public profile screen', () => {
  let target;
  const { AccountSettingsScreen } = load('src/screens/account/AccountSettingsScreen.tsx', {
    react: { useState: (initial) => [initial, () => {}] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: (value) => value } },
    '../../lib/auth': { currentUser: () => ({ name: 'Private', email: 'private@example.test' }) },
  });
  const tree = AccountSettingsScreen({ onNavigate: (value) => { target = value; } });
  button(tree, '公開プロフィール').props.onPress();
  assert.equal(target, 'public-profile');
});

test('authenticated app routes to profile and back to settings, unauthenticated access goes to login', () => {
  let routes = [{ name: 'account-settings' }];
  let cursor = 0;
  let user = { id: 1 };
  const { default: App } = load('App.tsx', {
    react: {
      useState() {
        const index = cursor++;
        if (index === 0) return [routes, (next) => { routes = typeof next === 'function' ? next(routes) : next; }];
        return index === 1 ? [user, () => {}] : [false, () => {}];
      },
      useEffect() {},
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    './src/lib/auth': { currentUser: () => user },
  });
  const render = () => { cursor = 0; return App(); };
  render().props.onNavigate('public-profile');
  let tree = render();
  assert.equal(tree.type, 'PublicProfileScreen');
  tree.props.onBack();
  assert.equal(render().type, 'AccountSettingsScreen');
  user = null;
  routes = [{ name: 'public-profile' }];
  assert.equal(render().type, 'LoginScreen');
});

test('unset stays empty; existing name loads and back returns to settings or caller', async () => {
  const h = harness();
  let tree = await ready(h);
  assert.equal(input(tree).props.value, '');
  assert.match(text(tree), /未設定/);
  tree.props.headerLeading.props.onPress();
  assert.equal(h.target, 'account-settings');
  h.render(true).props.headerLeading.props.onPress();
  assert.equal(h.backs, 1);
  const other = harness();
  tree = await ready(other, 'Reader');
  assert.equal(input(tree).props.value, 'Reader');
  assert.match(text(tree), /保存済みの表示名：Reader/);
});

test('load failure prevents editing and supports retry', async () => {
  const h = harness();
  assert.equal(input(h.render()), undefined);
  h.requests[0].reject(new Error('Offline'));
  await flush();
  let tree = h.render();
  assert.match(text(tree), /Offline/);
  assert.equal(input(tree), undefined);
  button(tree, '読み込みを再試行').props.onPress();
  h.render();
  h.requests.at(-1).resolve({ public_display_name: 'Recovered' });
  await flush();
  assert.equal(input(h.render()).props.value, 'Recovered');
});

test('validates blank and Unicode limit; retains input on save failure and locks duplicate saves', async () => {
  const h = harness();
  await ready(h);
  for (const value of ['   ', '😀'.repeat(101)]) {
    input(h.render()).props.onChangeText(value);
    button(h.render(), '表示名を保存する')?.props.onPress();
    assert.match(text(h.render()), /1〜100文字/);
    assert.equal(h.requests.length, 1);
  }
  input(h.render()).props.onChangeText(`  ${'😀'.repeat(100)}  `);
  let tree = h.render();
  button(tree, '表示名を保存する').props.onPress();
  button(tree, '表示名を保存する').props.onPress();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].args[0], '😀'.repeat(100));
  tree = h.render();
  assert.equal(input(tree).props.editable, false);
  assert.equal(tree.props.headerLeading.props.disabled, true);
  assert.equal(tree.props.showNavigation, false);
  h.requests[1].reject(new Error('Save failed'));
  await flush();
  tree = h.render();
  assert.match(text(tree), /Save failed/);
  assert.equal(input(tree).props.value, `  ${'😀'.repeat(100)}  `);
  button(tree, '再度保存する').props.onPress();
  h.requests.at(-1).resolve({ public_display_name: '😀'.repeat(100) });
  await flush();
  tree = h.render();
  assert.match(text(tree), /保存しました/);
  assert.equal(input(tree).props.value, '😀'.repeat(100));
  assert.equal(tree.props.showNavigation, true);
  input(tree).props.onChangeText('Changed');
  assert.doesNotMatch(text(h.render()), /保存しました/);
});

test('unmount ignores late load and save responses', async () => {
  const h = harness();
  h.render(); h.unmount();
  h.requests[0].resolve({ public_display_name: 'Late' });
  await flush();
  assert.equal(input(h.render()), undefined);
  const other = harness();
  const tree = await ready(other, 'Reader');
  button(tree, '表示名を保存する').props.onPress();
  other.unmount();
  other.requests.at(-1).resolve({ public_display_name: 'Reader' });
  await flush();
  assert.doesNotMatch(text(other.render()), /保存しました/);
});

test('API authenticates, trims name, preserves null and reports failures or mismatched result', async () => {
  const calls = [];
  let response = new Response('{"public_display_name":null}', { headers: { 'content-type': 'application/json' } });
  const api = load('src/lib/api.ts', {
    './auth': { authenticatedFetch: async (...args) => { calls.push(args); return response.clone(); } },
  });
  assert.equal((await api.getPublicProfile()).public_display_name, null);
  assert.ok(calls[0][0].endsWith('/users/me/public-profile'));
  response = new Response('{"public_display_name":"Reader"}', { headers: { 'content-type': 'application/json' } });
  await api.savePublicDisplayName(' Reader ');
  assert.equal(calls.at(-1)[1].method, 'PUT');
  assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { public_display_name: 'Reader' });
  await assert.rejects(api.savePublicDisplayName('Other'), /一致しません/);
  for (const status of [401, 404, 422, 503]) {
    response = new Response('{"detail":"Failure"}', { status, headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getPublicProfile(), (error) => error.status === status);
    await assert.rejects(api.savePublicDisplayName('Reader'), (error) => error.status === status);
  }
});
