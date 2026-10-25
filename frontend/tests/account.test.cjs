const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const stub = new Proxy({}, { get: (_, key) => String(key) });
const nodes = (node) => !node || typeof node !== 'object' ? [] :
  [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').flatMap((node) => node.props.children).join('\n');
const button = (tree, label) => nodes(tree).find((node) => node.props?.label === label);
const book = (id, latest_iteration = 1, reading_status = 'reading') => ({ id, latest_iteration, reading_status });
const iteration = (iteration_number, status, current_page) => ({ iteration_number, status, current_page });

function load(file, deps) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, Promise, require: (name) => deps[name] ?? stub });
  return exports;
}

function hooks() {
  const state = [], effects = [];
  let cursor = 0, scheduled = [];
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
      },
      useRef(initial) {
        const i = cursor++;
        return state[i] ??= { current: initial };
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (!effects[i] || deps.some((value, j) => effects[i].deps[j] !== value)) scheduled.push(() => {
          effects[i]?.cleanup?.();
          effects[i] = { deps, cleanup: effect() };
        });
      },
    },
    render(component) {
      cursor = 0; scheduled = [];
      const tree = component();
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}
const native = { StyleSheet: { create: (x) => x }, Text: 'Text', View: 'View', ScrollView: 'ScrollView' };
const status = load('src/lib/readingStatus.ts', {});

function statistics(api, react = {}) {
  const readingBooks = load('src/lib/readingBooks.ts', { './api': api });
  return load('src/lib/readingStatistics.ts', {
    react, './api': api, './readingBooks': readingBooks, './readingStatus': status,
  });
}

test('statistics includes every shelf page and sums stored progress from every reread', async () => {
  const offsets = [], ids = [];
  const books = Array.from({ length: 101 }, (_, index) => book(index + 1));
  books[0] = book(1, 3, 'reading');
  books[100] = book(101, 2, 'completed');
  const h = statistics({
    getBooks: async (offset) => { offsets.push(offset); return books.slice(offset, offset + 100); },
    getIterations: async (id) => {
      ids.push(id);
      if (id === 1) return [iteration(1, 'completed', 200), iteration(2, 'completed', 180), iteration(3, 'reading', 25)];
      if (id === 101) return [iteration(1, 'completed', 100), iteration(2, 'completed', 120)];
      return [iteration(1, 'reading', 0)];
    },
  });
  const result = await h.loadReadingStatistics(() => true);
  assert.deepEqual({ ...result }, { completed: 4, reading: 100, pages: 625 });
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(ids.length, 101);
  assert.equal(result.completed, status.completedReadCount(books));
});

test('empty shelf is actual zero and never requests iterations', async () => {
  const h = statistics({
    getBooks: async () => [],
    getIterations: () => assert.fail('no book'),
  });
  assert.deepEqual({ ...await h.loadReadingStatistics(() => true) }, { completed: 0, reading: 0, pages: 0 });
});

test('invalid or incomplete histories and unsafe sums fail instead of displaying partial statistics', async () => {
  for (const rows of [
    null, {}, [], [null], [iteration(2, 'reading', 1)],
    [iteration(1, 'unknown', 1)], [iteration(1, 'completed', 1)],
    [iteration(1, 'reading', -1)], [iteration(1, 'reading', 1.5)],
    [iteration(1, 'reading', NaN)], [iteration(1, 'reading', '10')],
  ]) {
    const h = statistics({ getBooks: async () => [book(1)], getIterations: async () => rows });
    await assert.rejects(h.loadReadingStatistics(() => true), /読書の記録/);
  }
  for (const books of [[book(1), book(1)], [book(-1)], [book(1, 0)], [book(1, 1, 'unknown')]]) {
    const h = statistics({
      getBooks: async () => books,
      getIterations: async () => [iteration(1, 'reading', 10)],
    });
    await assert.rejects(h.loadReadingStatistics(() => true));
  }
  const overflow = statistics({
    getBooks: async () => [book(1, 2)],
    getIterations: async () => [iteration(1, 'completed', Number.MAX_SAFE_INTEGER), iteration(2, 'reading', 1)],
  });
  await assert.rejects(overflow.loadReadingStatistics(() => true), /ページ数/);
});

test('statistics failure remains explicit and leaving stops both pagination and history loading', async () => {
  const h = statistics({
    getBooks: async () => [book(1), book(2)],
    getIterations: async (id) => {
      if (id === 2) throw new Error('history offline');
      return [iteration(1, 'reading', 10)];
    },
  });
  await assert.rejects(h.loadReadingStatistics(() => true), /history offline/);
  for (const during of ['shelf', 'history']) {
    let active = true, shelfCalls = 0, historyCalls = 0;
    const h = statistics({
      getBooks: async () => {
        shelfCalls += 1;
        if (during === 'shelf') active = false;
        return Array.from({ length: 100 }, (_, i) => book(i + 1));
      },
      getIterations: async () => {
        historyCalls += 1; active = false;
        return [iteration(1, 'reading', 10)];
      },
    });
    // For the history case return a short shelf so pagination finishes first.
    if (during === 'history') {
      const single = statistics({
        getBooks: async () => [book(1), book(2)],
        getIterations: async () => { historyCalls += 1; active = false; return [iteration(1, 'reading', 10)]; },
      });
      assert.equal(await single.loadReadingStatistics(() => active), null);
      assert.equal(historyCalls, 1);
    } else {
      assert.equal(await h.loadReadingStatistics(() => active), null);
      assert.equal(shelfCalls, 1);
      assert.equal(historyCalls, 0);
    }
  }
});

function accountHarness() {
  const h = hooks(), requests = [], profiles = [];
  const api = {
    getBooks: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    getIterations: async () => [iteration(1, 'reading', 42)],
  };
  const module = load('src/screens/main/AccountScreen.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    '../../lib/readingStatistics': statistics(api, h.react),
    '../../lib/api': { getPublicProfile: () => new Promise((resolve, reject) => profiles.push({ resolve, reject })) },
    '../../lib/auth': { currentUser: () => ({ id: 1, email: 'one@example.test' }) },
  });
  return {
    requests, profiles, unmount: h.unmount,
    render: () => h.render(() => module.AccountScreen({ onNavigate() {} })),
  };
}
const values = (tree) => nodes(tree).filter((node) => node.type?.name === 'Stat').map((node) => node.props.value);

test('account shows three loading placeholders, actual totals and independent statistics retry', async () => {
  const h = accountHarness();
  assert.deepEqual(values(h.render()), ['—', '—', '—']);
  h.profiles[0].resolve({ public_display_name: 'Reader' });
  h.requests[0].reject(new Error('shelf offline'));
  await flush();
  let tree = h.render();
  assert.deepEqual(values(tree), ['—', '—', '—']);
  assert.match(text(tree), /shelf offline|Reader/);
  button(tree, '読書の概要を再読み込み').props.onPress();
  h.render();
  assert.equal(h.profiles.length, 1);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve([book(1)]);
  await flush();
  tree = h.render();
  assert.deepEqual(values(tree), ['0', '1', '42']);
  assert.match(text(tree), /しおりの保存や読了時/);
  assert.doesNotMatch(text(tree), /shelf offline/);
});

test('account ignores late statistics and profile responses after leaving', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const h = accountHarness();
    h.render(); h.unmount();
    h.requests[0][outcome](outcome === 'resolve' ? [] : new Error('late error'));
    h.profiles[0].resolve({ public_display_name: 'Late name' });
    await flush();
    assert.deepEqual(values(h.render()), ['—', '—', '—']);
    assert.doesNotMatch(text(h.render()), /late error|Late name/);
  }
});

test('settings retain working account routes, hide samples and guard logout including rapid presses', async () => {
  const h = hooks(), requests = [], targets = [];
  const { AccountSettingsScreen } = load('src/screens/account/AccountSettingsScreen.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    '../../lib/auth': {
      currentUser: () => ({ id: 1, email: 'one@example.test' }),
      logout: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    },
  });
  const render = () => h.render(() => AccountSettingsScreen({ onNavigate: (target) => targets.push(target) }));
  let tree = render();
  const rows = nodes(tree).filter((node) => node.type === 'SettingsRow');
  assert.deepEqual(rows.map((row) => row.props.label), ['メールアドレス', '名前', 'パスワード']);
  assert.equal(rows[0].props.value, 'one@example.test');
  rows[1].props.onPress(); rows[2].props.onPress();
  assert.deepEqual(targets, ['public-profile', 'forgot-password']);
  assert.doesNotMatch(text(tree), /月3冊|20:00|サンプル|サポート|読書の設定/);
  const logout = button(tree, 'ログアウト');
  logout.props.onPress(); logout.props.onPress();
  assert.equal(requests.length, 1);
  assert.equal(button(render(), 'ログアウト中…').props.disabled, true);
  requests[0].reject(new Error('logout offline'));
  await flush();
  tree = render();
  assert.match(text(tree), /logout offline/);
  assert.equal(targets.includes('login'), false);
  button(tree, 'ログアウト').props.onPress();
  requests[1].resolve();
  await flush();
  assert.equal(targets.at(-1), 'login');
});
