const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const stub = new Proxy({}, { get: (_, key) => String(key) });
const jsx = (type, props) => ({ type, props });
function load(file, deps, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, Error, SyntaxError, Promise, require: (name) => deps[name] ?? stub, ...globals });
  return exports;
}
function storage(os = 'android', hooks = {}) {
  const data = new Map();
  let failure = false, user = 1;
  const check = () => { if (failure) throw new Error('Storage unavailable'); };
  const api = load('src/lib/searchHistory.ts', {
    react: hooks,
    'react-native': { Platform: { OS: os } },
    './auth': { currentUser: () => user === null ? null : { id: user } },
    'expo-secure-store': {
      getItemAsync: async (key) => { check(); return data.get(key) ?? null; },
      setItemAsync: async (key, value) => { check(); data.set(key, value); },
      deleteItemAsync: async (key) => { check(); data.delete(key); },
    },
  }, {
    localStorage: {
      getItem: (key) => { check(); return data.get(key) ?? null; },
      setItem: (key, value) => { check(); data.set(key, value); },
      removeItem: (key) => { check(); data.delete(key); },
    },
  });
  return { ...api, data, fail: (value) => { failure = value; }, user: (id) => { user = id; } };
}

for (const os of ['android', 'web']) {
  test(`${os}: account and scope isolation, normalization, deduplication, newest first and ten-item bound`, async () => {
    const { searchHistory: h } = storage(os);
    await h.remember(1, 'catalog', '  宇宙   の本  ');
    assert.deepEqual([...await h.read(1, 'catalog')], ['宇宙 の本']);
    assert.deepEqual([...await h.read(2, 'catalog')], []);
    assert.deepEqual([...await h.read(1, 'bookshelf')], []);
    await Promise.all(Array.from({ length: 12 }, (_, i) => h.remember(1, 'catalog', `Book ${i}`)));
    const list = [...await h.read(1, 'catalog')];
    assert.equal(list.length, 10);
    assert.equal(list[0], 'Book 11');
    assert.equal(list[9], 'Book 2');
    await h.remember(1, 'catalog', 'Book 5');
    assert.equal((await h.read(1, 'catalog'))[0], 'Book 5');
    assert.equal((await h.read(1, 'catalog')).length, 10);
    await h.remember(1, 'catalog', '  ');
    await h.remove(1, 'catalog', 'Book 5');
    assert.equal((await h.read(1, 'catalog')).includes('Book 5'), false);
    await h.clear(1, 'catalog');
    assert.deepEqual([...await h.read(1, 'catalog')], []);
  });
}

test('storage failures reject, queued operations recover, corrupted history can be cleared', async () => {
  const s = storage();
  s.fail(true);
  await assert.rejects(s.searchHistory.remember(1, 'catalog', 'First'), /Storage unavailable/);
  s.fail(false);
  await s.searchHistory.remember(1, 'catalog', 'Recovered');
  const key = [...s.data.keys()][0];
  for (const invalid of ['broken JSON', '{}', '[""]', '["duplicate","duplicate"]']) {
    s.data.set(key, invalid);
    await assert.rejects(s.searchHistory.read(1, 'catalog'));
    await s.searchHistory.clear(1, 'catalog');
    assert.deepEqual([...await s.searchHistory.read(1, 'catalog')], []);
  }
});

function hooks() {
  const state = [], effects = [], refs = [];
  let cursor, scheduled;
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
      },
      useRef(initial) { return refs[cursor++] ??= { current: initial }; },
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

test('history hook reports failures without pretending to save and keeps users separate', async () => {
  const h = hooks(), s = storage('android', h.react);
  const render = () => h.render(() => s.useSearchHistory('catalog'));
  render(); await flush();
  await render().remember('First');
  assert.deepEqual([...render().items], ['First']);
  s.fail(true);
  await render().remember('Not saved');
  assert.match(render().error, /Storage unavailable/);
  assert.deepEqual([...render().items], ['First']);
  s.fail(false); s.user(2);
  assert.deepEqual([...render().items], []);
  await flush();
  assert.deepEqual([...render().items], []);
  await render().remember('Second user');
  s.user(1); render(); await flush();
  assert.deepEqual([...render().items], ['First']);
  h.unmount();
});

test('pending saves survive reentry but do not update an unmounted history hook', async () => {
  const h = hooks(), s = storage('android', h.react);
  const render = () => h.render(() => s.useSearchHistory('catalog'));
  render(); await flush();
  const write = render().remember('Pending');
  h.unmount();
  await write;
  assert.deepEqual([...await s.searchHistory.read(1, 'catalog')], ['Pending']);
  assert.deepEqual([...render().items], []);
});

test('history panel has independent accessible search and delete controls with usable touch targets', () => {
  const { SearchHistory } = load('src/components/molecules/SearchHistory.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: (x) => x }, View: 'View', Text: 'Text', Pressable: 'Pressable' },
    '../../theme/colors': { colors: {} },
  });
  const calls = [];
  const tree = SearchHistory({
    items: ['宇宙'], loading: false, error: 'Storage unavailable',
    onSelect: (query) => calls.push(['select', query]),
    onRemove: (query) => calls.push(['remove', query]),
    onClear: () => calls.push(['clear']),
  });
  const controls = nodes(tree).filter((node) => node.type === 'Pressable');
  for (const control of controls) {
    assert.equal(control.props.accessibilityRole, 'button');
    assert.ok(control.props.style.minHeight >= 44);
    control.props.onPress();
  }
  assert.deepEqual(calls, [['clear'], ['select', '宇宙'], ['remove', '宇宙']]);
  assert.ok(nodes(tree).some((node) => node.props?.accessibilityRole === 'alert'));
});

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
for (const scope of ['catalog', 'bookshelf']) {
  test(`${scope}: typing does not save, submit and history selection do, removal and clearing are wired`, async () => {
    const h = hooks(), calls = [];
    const history = {
      items: ['Previous'], error: null, loading: false,
      remember: async (query) => { calls.push(['remember', query]); },
      remove: async (query) => { calls.push(['remove', query]); },
      clear: async () => { calls.push(['clear']); },
    };
    const file = scope === 'catalog' ? 'src/screens/books/AddBookScreen.tsx' : 'src/screens/main/BookshelfScreen.tsx';
    const module = load(file, {
      react: h.react,
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': { StyleSheet: { create: (x) => x }, View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable' },
      '../../lib/searchHistory': { useSearchHistory: (value) => { assert.equal(value, scope); return history; } },
      '../../lib/readingBooks': { loadAllBooks: async () => [] },
      '../../lib/api': { searchGoogleBooks: async (query) => { calls.push(['search', query]); return []; } },
      '../../lib/bookshelf': { loadCompletedShelf: async () => [], matchesKeyword: () => true },
    });
    const Screen = module.AddBookScreen ?? module.BookshelfScreen;
    const render = () => h.render(() => Screen({ onNavigate() {} }));
    const input = () => nodes(render()).find((node) => node.type === 'ShadowInput');
    input().props.onChangeText('  New  ');
    assert.deepEqual(calls, []);
    input().props.onSubmitEditing();
    await flush();
    assert.ok(calls.some(([kind, query]) => kind === 'remember' && query === 'New'));
    const panel = nodes(render()).find((node) => node.type === 'SearchHistory');
    panel.props.onSelect('Previous');
    await flush();
    assert.equal(input().props.value, 'Previous');
    panel.props.onRemove('Previous');
    panel.props.onClear();
    assert.ok(calls.some(([kind, query]) => kind === 'remember' && query === 'Previous'));
    assert.ok(calls.some(([kind]) => kind === 'remove'));
    assert.ok(calls.some(([kind]) => kind === 'clear'));
    assert.equal(nodes(render()).filter((node) => node.type === 'SearchHistory').length, 1);
  });
}

function genreHarness() {
  const h = hooks(), requests = [], remembered = [];
  const { AddBookScreen } = load('src/screens/books/AddBookScreen.tsx', {
    react: h.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: (x) => x }, View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable' },
    '../../lib/readingBooks': { loadAllBooks: async () => [] },
    '../../lib/searchHistory': { useSearchHistory: () => ({
      items: [], error: null, loading: false,
      remember: async (query) => { remembered.push(query); },
    }) },
    '../../lib/api': {
      searchGoogleBooks: (query) => new Promise((resolve, reject) => { requests.push({ query, resolve, reject }); }),
      importGoogleBook: () => { assert.fail('genre selection must not import a book'); },
    },
  });
  const render = () => h.render(() => AddBookScreen({ onNavigate() {} }));
  const press = (label) => nodes(render()).find((node) => node.props?.accessibilityLabel === label).props.onPress();
  const input = () => nodes(render()).find((node) => node.type === 'ShadowInput');
  return { render, press, input, requests, remembered };
}

test('all genre buttons perform real keyword searches, populate the input and record history', async () => {
  const h = genreHarness();
  const genres = ['小説', 'ミステリー', 'SF', 'ファンタジー', 'エッセイ', '歴史', 'ビジネス', '科学'];
  assert.equal(h.requests.length, 0);
  for (const genre of genres) {
    const button = nodes(h.render()).find((node) => node.props?.accessibilityLabel === `${genre}の本を探す`);
    assert.equal(button.props.accessibilityRole, 'button');
    assert.ok(button.props.style({ pressed: false })[0].minHeight >= 44);
    assert.ok(button.props.style({ pressed: false })[0].minWidth >= 44);
    button.props.onPress();
    assert.equal(h.input().props.value, genre);
    assert.equal(h.requests.at(-1).query, genre);
    assert.equal(h.remembered.at(-1), genre);
    h.requests.at(-1).resolve([]);
    await flush();
    assert.ok(nodes(h.render()).some((node) => node.props?.children === 'ページ数を確認できる書籍が見つかりませんでした。'));
  }
  h.input().props.onChangeText('自由なタイトル');
  h.input().props.onSubmitEditing();
  assert.equal(h.requests.at(-1).query, '自由なタイトル');
  h.requests.at(-1).reject(new Error('検索サービスに接続できません'));
  await flush();
  assert.ok(nodes(h.render()).some((node) => node.props?.children === '検索サービスに接続できません'));
});

test('rapid genre changes ignore outdated results and failures and can recover after an error', async () => {
  const h = genreHarness();
  h.press('小説の本を探す');
  h.press('科学の本を探す');
  const book = { google_books_id: 'science', title: '科学の本', total_pages: 120 };
  h.requests[1].resolve([book]);
  await flush();
  h.requests[0].reject(new Error('古い検索の失敗'));
  await flush();
  const result = () => nodes(h.render()).find((node) => node.props?.accessibilityLabel === '科学の本の検索結果');
  assert.ok(result());
  assert.equal(h.input().props.value, '科学');
  assert.ok(!nodes(h.render()).some((node) => node.props?.children === '古い検索の失敗'));
  h.press('歴史の本を探す');
  h.press('SFの本を探す');
  h.requests[3].reject(new Error('最新の検索の失敗'));
  await flush();
  h.requests[2].resolve([book]);
  await flush();
  assert.equal(result(), undefined);
  assert.ok(nodes(h.render()).some((node) => node.props?.children === '最新の検索の失敗'));
  h.press('科学の本を探す');
  h.requests[4].resolve([book]);
  await flush();
  assert.ok(result());
  nodes(h.render()).find((node) => node.props?.accessibilityLabel === '科学の本の詳細を見る').props.onPress();
  let tree = h.render();
  assert.equal(tree.type, 'BookPreviewScreen');
  tree.props.onBack();
  assert.ok(result());
  assert.equal(h.input().props.value, '科学');
});
