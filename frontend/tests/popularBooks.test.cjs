const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const stub = new Proxy({}, { get: (_, key) => String(key) });
const book = (id) => ({
  google_books_id: id, title: `Title ${id}`, author: null, total_pages: 100,
  isbn_13: null, thumbnail_url: null,
});
const nodes = (node) => !node || typeof node !== 'object' ? [] :
  [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').flatMap((node) => node.props.children).join('\n');
const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);

function load(file, deps) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Error, SyntaxError, Promise, process, __DEV__: false,
    require: (name) => deps[name] ?? stub,
  });
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
const native = { StyleSheet: { create: (x) => x }, Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView' };

function api(payload, status = 200) {
  const requests = [];
  const module = load('src/lib/api.ts', {
    './auth': { authenticatedFetch: async (...args) => {
      requests.push(args);
      return {
        status, ok: status === 200, headers: { get: () => 'application/json' },
        json: async () => payload,
      };
    } },
  });
  return { ...module, requests };
}

test('popular API authenticates a bounded request and preserves the aggregate order', async () => {
  const items = [{ book: book('a'), reader_count: 12 }, { book: book('b'), reader_count: 2 }];
  const h = api({ items, limit: 5 });
  assert.equal(await h.getPopularBooks(), items);
  assert.match(h.requests[0][0], /\/catalog\/books\/popular\?limit=5$/);
  assert.deepEqual([...await api({ items: [], limit: 5 }).getPopularBooks()], []);
  await assert.rejects(api({ detail: 'API unavailable' }, 503).getPopularBooks(), /API unavailable/);
});

test('popular API rejects invalid counts, metadata, duplicates, limit, size and order', async () => {
  const valid = { book: book('a'), reader_count: 1 };
  const invalid = [
    null, {}, { items: null, limit: 5 }, { items: [null], limit: 5 },
    { items: [valid], limit: 20 },
    ...[0, -1, 1.5, '2', Infinity].map((reader_count) => ({ items: [{ ...valid, reader_count }], limit: 5 })),
    ...[null, {}, { ...book('a'), title: '' }, { ...book('a'), google_books_id: '' },
      { ...book('a'), total_pages: 0 }, { ...book('a'), author: 1 },
      { ...book('a'), isbn_13: undefined }, { ...book('a'), thumbnail_url: 1 },
    ].map((book) => ({ items: [{ ...valid, book }], limit: 5 })),
    { items: [valid, valid], limit: 5 },
    { items: [valid, { book: book('b'), reader_count: 2 }], limit: 5 },
    { items: Array.from({ length: 6 }, (_, i) => ({ book: book(String(i)), reader_count: 1 })), limit: 5 },
  ];
  for (const payload of invalid) {
    await assert.rejects(api(payload).getPopularBooks(), /応答形式/);
  }
});

function panel(component = 'PopularBooks') {
  const h = hooks(), requests = [], selections = [];
  const module = load(`src/components/organisms/${component}.tsx`, {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    '../../theme/colors': { colors: {} },
    '../../lib/api': {
      getPopularBooks: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
      getEmotionRecommendations: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    },
  });
  return {
    requests, selections, unmount: h.unmount,
    render: () => h.render(() => module[component]({ onSelect: (book) => selections.push(book) })),
  };
}

test('popular panel distinguishes loading, empty, errors and retry without invented books', async () => {
  const h = panel();
  assert.match(text(h.render()), /読み込み中/);
  h.requests[0].reject(new Error('catalog offline'));
  await flush();
  let tree = h.render();
  assert.match(text(tree), /catalog offline/);
  assert.doesNotMatch(text(tree), /まだ人気の本はありません/);
  assert.ok(nodes(tree).some((node) => node.props?.accessibilityRole === 'alert'));
  button(tree, '人気の本を再読み込み').props.onPress();
  h.render();
  assert.match(text(h.render()), /読み込み中/);
  h.requests[1].resolve([]);
  await flush();
  tree = h.render();
  assert.match(text(tree), /まだ人気の本はありません/);
  assert.equal(nodes(tree).filter((node) => node.type === 'Pressable').length, 0);
});

test('popular cards expose real title and reader count and navigate only on selection', async () => {
  const h = panel(), item = book('real');
  h.render();
  h.requests[0].resolve([{ book: item, reader_count: 4 }]);
  await flush();
  const tree = h.render();
  assert.equal(h.selections.length, 0);
  assert.match(text(tree), /Title real/);
  assert.match(text(tree), /4\n人の本棚/);
  assert.doesNotMatch(text(tree), /本棚に追加した人数順|詳細を見る/);
  const card = button(tree, '1位 Title real、4人の本棚');
  assert.equal(card.props.accessibilityRole, 'button');
  assert.ok(card.props.style({ pressed: false })[0].minHeight >= 44);
  card.props.onPress();
  assert.equal(h.selections[0], item);
  assert.equal(h.requests.length, 1);
});

test('only the top three cards show gold, silver and bronze medals', async () => {
  const h = panel();
  h.render();
  h.requests[0].resolve(Array.from({ length: 5 }, (_, index) => ({
    book: book(String(index)), reader_count: 5 - index,
  })));
  await flush();
  const tree = h.render();
  const medals = nodes(tree).filter((node) => node.props?.name === 'medal');
  assert.deepEqual(medals.map((node) => node.props.color), ['#C99700', '#9CA3AF', '#B87333']);
  const cards = nodes(tree).filter((node) => node.type === 'Pressable');
  assert.equal(cards.length, 5);
  cards.forEach((card, index) => {
    assert.equal(nodes(card).filter((node) => node.props?.name === 'medal').length, index < 3 ? 1 : 0);
    assert.match(text(card), new RegExp(`${index + 1}\\n位`));
  });
  assert.doesNotMatch(text(tree), /本棚に追加した人数順|詳細を見る/);
});

test('popular panel ignores late success and failure after leaving', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const h = panel();
    h.render();
    h.unmount();
    h.requests[0][outcome](outcome === 'resolve' ? [{ book: book('late'), reader_count: 1 }] : new Error('late failure'));
    await flush();
    assert.match(text(h.render()), /読み込み中/);
    assert.doesNotMatch(text(h.render()), /Title late|late failure/);
  }
});

for (const discovery of ['PopularBooks', 'EmotionRecommendations']) {
test(`${discovery} routes unowned books to preview, owned books to detail and keeps search intact`, async () => {
  const h = hooks(), imported = [];
  const { AddBookScreen } = load('src/screens/books/AddBookScreen.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    '../../lib/readingBooks': { loadAllBooks: async () => [{ id: 7, google_books_id: 'owned' }] },
    '../../lib/searchHistory': { useSearchHistory: () => ({
      items: [], error: null, loading: false, remember: async () => {}, remove: async () => {}, clear: async () => {},
    }) },
    '../../lib/api': { importGoogleBook: async (id) => { imported.push(id); return { id: 8, google_books_id: id }; } },
  });
  const render = () => h.render(() => AddBookScreen({ onNavigate() {} }));
  render(); await flush();
  nodes(render()).find((node) => node.type === 'ShadowInput').props.onChangeText('Keep query');
  const popular = () => nodes(render()).find((node) => node.type === discovery);
  popular().props.onSelect(book('new'));
  let tree = render();
  assert.equal(tree.type, 'BookPreviewScreen');
  assert.equal(tree.props.book.google_books_id, 'new');
  assert.equal(imported.length, 0);
  tree.props.onBack();
  popular().props.onSelect(book('owned'));
  tree = render();
  assert.equal(tree.type, 'BookDetailScreen');
  assert.equal(tree.props.bookId, 7);
  tree.props.onBack();
  assert.equal(nodes(render()).find((node) => node.type === 'ShadowInput').props.value, 'Keep query');
  popular().props.onSelect(book('new'));
  render().props.onAdd();
  await flush();
  assert.deepEqual(imported, ['new']);
  assert.equal(render().type, 'BookDetailScreen');
  assert.equal(render().props.bookId, 8);
});
}

test('emotion recommendations API validates real books, states, size, duplicates and errors', async () => {
  for (const status of ['needs_reviews', 'no_candidates']) {
    const payload = { status, items: [], limit: 5 };
    const h = api(payload);
    assert.equal(await h.getEmotionRecommendations(), payload);
    assert.match(h.requests[0][0], /\/catalog\/books\/recommendations\?limit=5$/);
  }
  const ready = { status: 'ready', items: [book('real')], limit: 5 };
  assert.equal(await api(ready).getEmotionRecommendations(), ready);
  for (const invalid of [
    null, {}, { ...ready, limit: 20 }, { ...ready, items: [] },
    { ...ready, status: 'unknown' }, { ...ready, status: 'needs_reviews' },
    { ...ready, status: 'no_candidates' }, { ...ready, items: [null] },
    { ...ready, items: [book('real'), book('real')] },
    { ...ready, items: [{ ...book('real'), total_pages: 0 }] },
    { ...ready, items: Array.from({ length: 6 }, (_, i) => book(String(i))) },
  ]) await assert.rejects(api(invalid).getEmotionRecommendations(), /応答形式/);
  await assert.rejects(api({ detail: 'recommendations offline' }, 503).getEmotionRecommendations(), /recommendations offline/);
});

test('emotion recommendations show distinct cold-start guidance and real clickable books', async () => {
  for (const status of ['needs_reviews', 'no_candidates', 'ready']) {
    const h = panel('EmotionRecommendations');
    assert.match(text(h.render()), /読み込み中/);
    h.requests[0].resolve({ status, items: status === 'ready' ? [book('real')] : [], limit: 5 });
    await flush();
    const tree = h.render();
    if (status === 'needs_reviews') assert.match(text(tree), /感想を残すと/);
    if (status === 'no_candidates') assert.match(text(tree), /まだ感情の近い本が見つかりません/);
    if (status !== 'ready') {
      assert.match(text(tree), /ジャンルや人気の本/);
      assert.equal(nodes(tree).filter((node) => node.type === 'Pressable').length, 0);
    } else {
      const card = button(tree, 'おすすめの本 Title real');
      assert.ok(card.props.style({ pressed: false })[0].minHeight >= 44);
      assert.equal(h.selections.length, 0);
      card.props.onPress();
      assert.equal(h.selections[0].google_books_id, 'real');
    }
  }
});

test('emotion recommendations expose failures, retry independently and ignore late responses', async () => {
  const h = panel('EmotionRecommendations');
  h.render();
  h.requests[0].reject(new Error('recommendations offline'));
  await flush();
  let tree = h.render();
  assert.match(text(tree), /recommendations offline/);
  assert.doesNotMatch(text(tree), /感想を残すと|まだ感情の近い本/);
  assert.ok(nodes(tree).some((node) => node.props?.accessibilityRole === 'alert'));
  button(tree, 'おすすめの本を再読み込み').props.onPress();
  h.render();
  h.requests[1].resolve({ status: 'ready', items: [book('real')], limit: 5 });
  await flush();
  assert.ok(button(h.render(), 'おすすめの本 Title real'));
  for (const outcome of ['resolve', 'reject']) {
    const late = panel('EmotionRecommendations');
    late.render();
    late.unmount();
    late.requests[0][outcome](outcome === 'resolve' ? { status: 'ready', items: [book('late')], limit: 5 } : new Error('late failure'));
    await flush();
    tree = late.render();
    assert.match(text(tree), /読み込み中/);
    assert.doesNotMatch(text(tree), /Title late|late failure/);
  }
});
