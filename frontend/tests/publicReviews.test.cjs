const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, process, URLSearchParams, encodeURIComponent, Error, SyntaxError, __DEV__: false,
    require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  return exports;
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
const button = (tree, label) => nodes(tree).find((node) => node.props?.label === label);
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text')
  .flatMap((node) => [node.props.children].flat(Infinity)).join('\n');
const book = {
  id: 1, title: 'Test book', google_books_id: 'volume', reading_status: 'reading',
  current_page: 10, total_pages: 100, latest_iteration: 1,
};
const review = (id, overrides = {}) => ({
  id, public_display_name: 'Public reader', page_number: 10, iteration_number: 1,
  review_text: `Body ${id}`, contains_spoilers: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', ...overrides,
});
const page = (items, offset = 0) => ({ items, limit: 20, offset });
function harness(file = 'src/screens/books/PublicReviewsScreen.tsx', extra = {}) {
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
        const index = cursor++, prior = effects[index];
        if (!prior || deps.some((value, i) => value !== prior.deps[i])) {
          scheduled.push(() => {
            prior?.cleanup?.();
            effects[index] = { deps, cleanup: effect() };
          });
        }
      },
    },
    'react/jsx-runtime': jsx,
    'react-native': {
      StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View', ScrollView: 'ScrollView',
    },
    '../../lib/api': {
      getBook: (...args) => request('book', args),
      getPublicReviews: (...args) => request('reviews', args),
      getBookReviews: async () => [], getBookEmotions: async () => ({}), getIterations: async () => [],
    },
    '../../components/organisms/EmotionAnalysisCard': {
      getEmotionTint: () => '#fff', EmotionAnalysisCard: 'EmotionAnalysisCard',
    },
    ...extra,
  });
  return {
    requests, module,
    get target() { return target; }, get backs() { return backs; },
    render(withBack = true) {
      cursor = 0; scheduled = [];
      const Screen = module.PublicReviewsScreen ?? module.BookDetailScreen;
      const tree = Screen({ bookId: 1, onNavigate: (value) => { target = value; }, onBack: withBack ? () => { backs++; } : undefined });
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}
async function ready(h, items = [], value = book) {
  h.render();
  h.requests[0].resolve(value);
  await flush();
  if (value.google_books_id) {
    h.requests[1].resolve(page(items));
    await flush();
  }
  return h.render();
}

test('hidden boundaries: spoilers, unread, unknown progress and rereading are conservative', () => {
  const { publicReviewHiddenReason: reason } = harness().module;
  assert.equal(reason(book, review(1)), null);
  assert.equal(reason(book, review(1, { page_number: 11 })), '未読ページ');
  assert.equal(reason(book, review(1, { contains_spoilers: true })), 'ネタバレあり');
  assert.equal(reason(book, review(1, { contains_spoilers: true, page_number: 11 })), 'ネタバレあり・未読ページ');
  for (const current_page of [null, undefined, -1, NaN, 1.5]) {
    assert.equal(reason({ ...book, current_page }, review(1)), '読書位置が不明');
  }
  assert.equal(reason({ ...book, reading_status: 'unknown' }, review(1)), '読書位置が不明');
  assert.equal(reason({ ...book, current_page: 0 }, review(1)), '未読ページ');
  assert.equal(reason({ ...book, reading_status: 'completed' }, review(1, { page_number: 100 })), null);
  assert.equal(reason({ ...book, reading_status: 'completed' }, review(1, { contains_spoilers: true })), 'ネタバレあり');
  assert.equal(reason({ ...book, latest_iteration: 2 }, review(1, { page_number: 11 })), '未読ページ');
});

test('renders safe text and public identity; hidden text is absent until individually revealed', async () => {
  const h = harness();
  let tree = await ready(h, [review(1), review(2, { contains_spoilers: true }), review(3, { page_number: 11 })]);
  assert.match(text(tree), /Body 1/);
  assert.doesNotMatch(text(tree), /Body 2|Body 3/);
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel === '本のデフォルトアイコン').length, 3);
  assert.match(text(tree), /Public reader/);
  button(tree, 'この感想を表示する').props.onPress();
  tree = h.render();
  assert.match(text(tree), /Body 2/);
  assert.doesNotMatch(text(tree), /Body 3/);
  button(tree, 'この感想を隠す').props.onPress();
  assert.doesNotMatch(text(h.render()), /Body 2/);
  tree.props.headerLeading.props.onPress();
  assert.equal(h.backs, 1);
  h.render(false).props.headerLeading.props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(h.target)), { name: 'book-detail', bookId: 1 });
});

test('initial loading, failures, retry, empty list and manual books', async () => {
  const h = harness();
  assert.match(text(h.render()), /読み込んでいます/);
  h.requests[0].reject(new Error('Offline'));
  await flush();
  assert.match(text(h.render()), /Offline/);
  button(h.render(), '読み込みを再試行').props.onPress();
  h.render();
  h.requests.at(-1).resolve(book);
  await flush();
  h.requests.at(-1).reject(new Error('Reviews unavailable'));
  await flush();
  assert.match(text(h.render()), /Reviews unavailable/);
  assert.doesNotMatch(text(h.render()), /公開感想はまだありません/);
  button(h.render(), '読み込みを再試行').props.onPress();
  h.render();
  h.requests.at(-1).resolve(book);
  await flush();
  h.requests.at(-1).resolve(page([review(1)]));
  await flush();
  assert.match(text(h.render()), /Body 1/);
  const empty = harness();
  assert.match(text(await ready(empty)), /公開感想はまだありません/);
  const manual = harness();
  assert.match(text(await ready(manual, [], { ...book, google_books_id: null })), /手動登録/);
  assert.equal(manual.requests.length, 1);
});

test('pagination locks duplicate requests, retains items on error, retries same offset and deduplicates', async () => {
  const h = harness();
  let tree = await ready(h, Array.from({ length: 20 }, (_, i) => review(i + 1)));
  button(tree, 'さらに読み込む').props.onPress();
  button(tree, 'さらに読み込む').props.onPress();
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests.at(-1).args[1], 20);
  assert.equal(button(h.render(), '読み込み中…').props.disabled, true);
  h.requests.at(-1).reject(new Error('More offline'));
  await flush();
  tree = h.render();
  assert.match(text(tree), /Body 1/);
  assert.match(text(tree), /More offline/);
  button(tree, '追加の読み込みを再試行').props.onPress();
  assert.equal(h.requests.at(-1).args[1], 20);
  h.requests.at(-1).resolve(page([review(20), review(21)], 20));
  await flush();
  tree = h.render();
  assert.equal(nodes(tree).filter((node) => node.type === 'Text' && node.props.children === 'Body 20').length, 1);
  assert.match(text(tree), /Body 21/);
  assert.equal(button(tree, 'さらに読み込む'), undefined);
});

test('refresh refetches progress and first page, hides revealed text and ignores stale extra page', async () => {
  const h = harness();
  let tree = await ready(h, Array.from({ length: 20 }, (_, i) => review(i + 1, { contains_spoilers: true })));
  button(tree, 'この感想を表示する').props.onPress();
  assert.match(text(h.render()), /Body 1/);
  button(h.render(), 'さらに読み込む').props.onPress();
  const stale = h.requests.at(-1);
  button(h.render(), '最新の情報に更新').props.onPress();
  assert.doesNotMatch(text(h.render()), /Body 1/);
  h.requests.at(-1).resolve({ ...book, current_page: 0 });
  await flush();
  assert.equal(h.requests.at(-1).args.length, 1);
  h.requests.at(-1).resolve(page([review(1)]));
  await flush();
  stale.resolve(page([review(999)], 20));
  await flush();
  tree = h.render();
  assert.doesNotMatch(text(tree), /Body 1|Body 999/);
  assert.match(text(tree), /未読ページ/);
});

test('pagination advances by raw response count rather than deduplicated count and stops on empty page', async () => {
  const h = harness();
  await ready(h, Array.from({ length: 20 }, (_, i) => review(i + 1)));
  button(h.render(), 'さらに読み込む').props.onPress();
  h.requests.at(-1).resolve(page(Array.from({ length: 20 }, (_, i) => review(i + 20)), 20));
  await flush();
  button(h.render(), 'さらに読み込む').props.onPress();
  assert.equal(h.requests.at(-1).args[1], 40);
  h.requests.at(-1).resolve(page([], 40));
  await flush();
  assert.equal(button(h.render(), 'さらに読み込む'), undefined);
  assert.match(text(h.render()), /Body 39/);
});

test('unmount prevents late initial and pagination responses from modifying state', async () => {
  const h = harness();
  h.render();
  h.unmount();
  h.requests[0].resolve(book);
  await flush();
  assert.equal(h.requests.length, 1);
  const other = harness();
  await ready(other, Array.from({ length: 20 }, (_, i) => review(i + 1)));
  button(other.render(), 'さらに読み込む').props.onPress();
  other.unmount();
  other.requests.at(-1).resolve(page([review(999)], 20));
  await flush();
  assert.doesNotMatch(text(other.render()), /Body 999/);
});

test('book detail opens public reviews with internal book ID; manual books have no action', async () => {
  const h = harness('src/screens/books/BookDetailScreen.tsx');
  h.render(); h.requests[0].resolve(book); await flush();
  button(h.render(), 'みんなの公開感想を見る').props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(h.target)), { name: 'public-reviews', bookId: 1 });
  const manual = harness('src/screens/books/BookDetailScreen.tsx');
  manual.render(); manual.requests[0].resolve({ ...book, google_books_id: null }); await flush();
  assert.equal(button(manual.render(), 'みんなの公開感想を見る'), undefined);
  assert.match(text(manual.render()), /手動登録/);
});

test('App routes authenticated reviews and back to book detail; unauthenticated access is gated', () => {
  let routes = [{ name: 'book-detail', bookId: 1 }], cursor = 0, user = { id: 1 };
  const { default: App } = load('App.tsx', {
    react: {
      useState() {
        const index = cursor++;
        if (index === 0) return [routes, (next) => { routes = typeof next === 'function' ? next(routes) : next; }];
        return index === 1 ? [user, () => {}] : [false, () => {}];
      },
      useEffect() {},
    },
    'react/jsx-runtime': jsx,
    './src/lib/auth': { currentUser: () => user },
  });
  const render = () => { cursor = 0; return App(); };
  render().props.onNavigate({ name: 'public-reviews', bookId: 1 });
  assert.equal(render().type, 'PublicReviewsScreen');
  assert.equal(render().props.bookId, 1);
  render().props.onBack();
  assert.equal(render().type, 'BookDetailScreen');
  user = null; routes = [{ name: 'public-reviews', bookId: 1 }];
  assert.equal(render().type, 'LoginScreen');
});

test('API authenticates, encodes volume ID, pages and reports HTTP/network/invalid spoiler failures', async () => {
  const calls = [];
  let response = new Response(JSON.stringify(page([review(1)])), { headers: { 'content-type': 'application/json' } });
  let failure = null;
  const api = load('src/lib/api.ts', {
    './auth': { authenticatedFetch: async (...args) => {
      calls.push(args);
      if (failure) throw failure;
      return response.clone();
    } },
  });
  assert.equal((await api.getPublicReviews('volume/id')).items[0].id, 1);
  assert.match(calls[0][0], /catalog\/books\/volume%2Fid\/reviews\?limit=20&offset=0$/);
  response = new Response(JSON.stringify(page([], 20)), { headers: { 'content-type': 'application/json' } });
  await api.getPublicReviews('volume', 20);
  assert.match(calls.at(-1)[0], /offset=20$/);
  for (const contains_spoilers of [undefined, null, 'false', 0]) {
    response = new Response(JSON.stringify(page([review(1, { contains_spoilers })])), { headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getPublicReviews('volume'), /取得結果を確認できません/);
  }
  for (const status of [401, 422, 503]) {
    response = new Response('{"detail":"Failure"}', { status, headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getPublicReviews('volume'), (error) => error.status === status);
  }
  response = new Response('not json', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(api.getPublicReviews('volume'), /JSONではない/);
  failure = new Error('Network offline');
  await assert.rejects(api.getPublicReviews('volume'), /Network offline/);
});
