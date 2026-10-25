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

function harness(file = 'src/screens/account/PublicProfileScreen.tsx') {
  const state = [], refs = [], effects = [], requests = [];
  let cursor = 0, scheduled = [], target, backs = 0;
  function request(kind, args) {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ kind, args, resolve, reject });
    return promise;
  }
  const module = load(file, {
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
    '../../lib/auth': { currentUser: () => ({ name: 'PRIVATE LEGACY NAME', email: 'private@example.test' }) },
    '../../lib/readingStatistics': { useReadingStatistics: () => ({ statistics: null, error: null, retry() {} }) },
  });
  return {
    requests,
    get target() { return target; },
    get backs() { return backs; },
    render(withBack = false) {
      cursor = 0; scheduled = [];
      const Screen = module.PublicProfileScreen ?? module.AccountScreen;
      const tree = Screen({
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

test('default book avatar accompanies only the saved public name, never the unsaved draft', async () => {
  const h = harness();
  let tree = await ready(h);
  const avatar = nodes(tree).find((node) => node.props?.accessibilityLabel === '本のデフォルトアイコン');
  assert.ok(avatar);
  assert.equal(avatar.props.accessibilityRole, 'image');
  assert.equal(avatar.props.style.width, 64);
  assert.equal(avatar.props.style.height, 64);
  assert.equal(avatar.props.style.borderRadius, 32);
  assert.equal(avatar.props.children.props.name, 'book-outline');
  assert.match(text(tree), /名前は未設定/);
  input(tree).props.onChangeText('Draft reader');
  tree = h.render();
  assert.match(text(tree), /名前は未設定/);
  assert.doesNotMatch(text(tree), /Draft reader/);
  button(tree, '名前を保存する').props.onPress();
  h.requests.at(-1).resolve({ public_display_name: 'Draft reader' });
  await flush();
  tree = h.render();
  const name = nodes(tree).find((node) => node.props?.style?.fontSize === 20);
  assert.equal(name.props.children, 'Draft reader');
  assert.equal(name.props.numberOfLines, undefined);
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel === '本のデフォルトアイコン').length, 1);
});

test('settings opens dedicated public profile screen', () => {
  let target;
  const { AccountSettingsScreen } = load('src/screens/account/AccountSettingsScreen.tsx', {
    react: { useState: (initial) => [initial, () => {}], useRef: (current) => ({ current }) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: (value) => value } },
    '../../lib/auth': { currentUser: () => ({ name: 'Private', email: 'private@example.test' }) },
  });
  const tree = AccountSettingsScreen({ onNavigate: (value) => { target = value; } });
  button(tree, '名前').props.onPress();
  assert.equal(nodes(tree).filter((node) => node.props?.label === 'ユーザー名' || node.props?.label === '公開プロフィール').length, 0);
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
  assert.match(text(tree), /保存済みの名前：Reader/);
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
    button(h.render(), '名前を保存する')?.props.onPress();
    assert.match(text(h.render()), /1〜100文字/);
    assert.equal(h.requests.length, 1);
  }
  input(h.render()).props.onChangeText(`  ${'😀'.repeat(100)}  `);
  let tree = h.render();
  button(tree, '名前を保存する').props.onPress();
  button(tree, '名前を保存する').props.onPress();
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
  button(tree, '名前を保存する').props.onPress();
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
  for (const payload of [null, {}, { public_display_name: 1 }, { public_display_name: '' }, { public_display_name: '   ' }, { public_display_name: 'x'.repeat(101) }]) {
    response = new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getPublicProfile(), /取得結果を確認できません/);
  }
  for (const status of [401, 404, 422, 503]) {
    response = new Response('{"detail":"Failure"}', { status, headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getPublicProfile(), (error) => error.status === status);
    await assert.rejects(api.savePublicDisplayName('Reader'), (error) => error.status === status);
  }
});

test('name editor explains public account name and never fills a legacy private name', async () => {
  const h = harness();
  let tree = await ready(h);
  assert.equal(tree.props.title, '名前');
  assert.match(text(tree), /アカウントと公開した感想/);
  assert.match(text(tree), /他の読者にも表示/);
  assert.match(text(tree), /以前の登録名は自動公開しません/);
  assert.doesNotMatch(text(tree), /PRIVATE LEGACY NAME|登録時のユーザー名とは別/);
  assert.equal(input(tree).props.value, '');
  assert.equal(input(tree).props.accessibilityLabel, '名前（他の読者にも表示）');
});

test('account reads current chosen name instead of stale login name and shows unset safely', async () => {
  for (const name of [null, 'Updated reader', '😀 Reader']) {
    const h = harness('src/screens/main/AccountScreen.tsx');
    assert.doesNotMatch(text(h.render()), /PRIVATE LEGACY NAME/);
    const tree = await ready(h, name);
    assert.match(text(tree), name === null ? /名前は未設定/ : new RegExp(name));
    assert.doesNotMatch(text(tree), /PRIVATE LEGACY NAME/);
    button(tree, '名前を設定・変更').props.onPress();
    assert.equal(h.target, 'public-profile');
    if (name?.startsWith('😀')) assert.ok(nodes(tree).some((node) => node.props?.children === '😀'));
  }
});

test('account name read failure is explicit and retries, not a private-name fallback', async () => {
  const h = harness('src/screens/main/AccountScreen.tsx');
  h.render(); h.requests[0].reject(new Error('Offline')); await flush();
  let tree = h.render();
  assert.match(text(tree), /Offline/);
  assert.doesNotMatch(text(tree), /PRIVATE LEGACY NAME|名前は未設定/);
  button(tree, '名前を再読み込み').props.onPress(); h.render();
  h.requests[1].resolve({ public_display_name: 'Recovered' }); await flush();
  assert.match(text(h.render()), /Recovered/);
  const unmounted = harness('src/screens/main/AccountScreen.tsx');
  unmounted.render(); unmounted.unmount();
  unmounted.requests[0].resolve({ public_display_name: 'Late' }); await flush();
  assert.doesNotMatch(text(unmounted.render()), /Late/);
});

test('registration discloses public use and explicitly opts in only on valid submit', async () => {
  const calls = [];
  let target, failure;
  const { AccountRegisterScreen } = load('src/screens/auth/AccountRegisterScreen.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../../lib/auth': { authPost: async (...args) => { calls.push(args); if (failure) throw failure; } },
  });
  const tree = AccountRegisterScreen({ onNavigate: (value) => { target = value; } });
  assert.match(tree.props.description, /他の読者にも表示/);
  assert.match(tree.props.fields.find((field) => field.key === 'name').label, /他の読者にも表示/);
  const values = { name: '  Reader😀  ', email: ' reader@example.com ', password: 'Strong-password!', confirmation: 'Strong-password!' };
  for (const name of ['  ', '😀'.repeat(101)]) {
    await assert.rejects(tree.props.submit({ ...values, name }), /1〜100文字/);
  }
  await assert.rejects(tree.props.submit({ ...values, confirmation: 'different' }), /一致しません/);
  assert.equal(calls.length, 0);
  await tree.props.submit(values);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['register', {
    name: 'Reader😀', name_is_public: true, email: 'reader@example.com', password: 'Strong-password!',
  }]);
  assert.equal(target, 'verify-email');
  target = undefined; failure = new Error('Registration unavailable');
  await assert.rejects(tree.props.submit(values), /Registration unavailable/);
  assert.equal(target, undefined);
});
