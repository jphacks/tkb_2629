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
  color_code: '#92A160', analysis_status: 'completed', source: 'jev',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', ...overrides,
});
const page = (items, offset = 0) => ({ items, limit: 20, offset });
function harness(file = 'src/components/organisms/PublicReviewList.tsx', extra = {}) {
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
      StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable',
    },
    '../../lib/api': {
      getBook: (...args) => request('book', args),
      getPublicReviews: (...args) => request('reviews', args),
      getPublicReviewDistribution: (...args) => request('distribution', args),
      getReviewReactions: (...args) => request('reactions', args),
      setReviewReaction: (...args) => request('react', args),
      reviewAnalysisLabel: load('src/lib/api.ts').reviewAnalysisLabel,
      getBookReviews: async () => [], getEmotionComparison: () => new Promise(() => {}), getIterations: async () => [],
    },
    '../../components/organisms/EmotionAnalysisCard': {
      getEmotionTint: () => '#fff', EmotionAnalysisCard: 'EmotionAnalysisCard',
    },
    '../../lib/reviewDistribution': load('src/lib/reviewDistribution.ts'),
    ...extra,
  });
  return {
    requests, module,
    get target() { return target; }, get backs() { return backs; },
    render(withBack = true, props = {}) {
      cursor = 0; scheduled = [];
      const Screen = module.PublicReviewList ?? module.BookDetailScreen ?? module.CommunityBookmarks ?? module.BookmarkListCard ?? module.ReviewReactionBar;
      const tree = Screen({ bookId: 1, onNavigate: (value) => { target = value; }, onBack: withBack ? () => { backs++; } : undefined, ...props });
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
  for (const current_page of [null, undefined, -1, NaN, 1.5, 101]) {
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
  assert.doesNotMatch(text(tree), /本文と色は非表示/);
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.props.children === 'ネタバレあり' && node.props.style.fontWeight === '700'));
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel === '感想の色').length, 1);
  assert.deepEqual(nodes(tree).filter((node) => node.type === 'ReviewReactionBar').map((node) => node.props.reviewId), [1]);
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel === '本のデフォルトアイコン').length, 3);
  assert.match(text(tree), /Public reader/);
  button(tree, 'この感想を表示する').props.onPress();
  tree = h.render();
  assert.match(text(tree), /Body 2/);
  assert.deepEqual(nodes(tree).filter((node) => node.type === 'ReviewReactionBar').map((node) => node.props.reviewId), [1, 2]);
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel === '感想の色').length, 2);
  assert.doesNotMatch(text(tree), /Body 3/);
  button(tree, 'この感想を隠す').props.onPress();
  assert.doesNotMatch(text(h.render()), /Body 2/);
  assert.deepEqual(nodes(h.render()).filter((node) => node.type === 'ReviewReactionBar').map((node) => node.props.reviewId), [1]);
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

test('book detail embeds community bookmarks and keeps own errors independent', async () => {
  const h = harness('src/screens/books/BookDetailScreen.tsx');
  h.render(); h.requests[0].resolve(book); await flush();
  const card = nodes(h.render()).find((node) => node.type === 'BookmarkListCard');
  assert.equal(card.props.community(42).type, 'CommunityBookmarks');
  assert.equal(card.props.community(42).props.bookId, 1);
  assert.equal(card.props.community(42).props.initialPage, 42);
  assert.equal(button(h.render(), 'みんなの公開感想を見る'), undefined);
  const manual = harness('src/screens/books/BookDetailScreen.tsx');
  manual.render(); manual.requests[0].resolve({ ...book, google_books_id: null }); await flush();
  assert.equal(button(manual.render(), 'みんなの公開感想を見る'), undefined);
  assert.ok(nodes(manual.render()).find((node) => node.type === 'BookmarkListCard').props.community);
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
  response = new Response(JSON.stringify(page([])), { headers: { 'content-type': 'application/json' } });
  await api.getPublicReviews('volume', 0, { start: 1, end: 20 });
  assert.match(calls.at(-1)[0], /offset=0&page_start=1&page_end=20$/);
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

test('bins preserve every page and exact counts, reverse the axis and never use colors', () => {
  const { reviewBins } = load('src/lib/reviewDistribution.ts');
  for (const total of [1, 2, 7, 100, 301, 1000]) {
    for (const columns of [1, 3, 6, 12]) {
      const distribution = {
        items: Array.from({ length: total }, (_, i) => ({ page_number: i + 1, review_count: (i % 3) + 1 })),
      };
      const bins = reviewBins(total, columns, distribution);
      assert.equal(bins[0].end, total);
      assert.equal(bins.at(-1).start, 1);
      assert.equal(bins.length, Math.min(total, columns));
      assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), distribution.items.reduce((sum, item) => sum + item.review_count, 0));
      for (let page = 1; page <= total; page++) {
        assert.equal(bins.filter((bin) => bin.start <= page && page <= bin.end).length, 1);
      }
      assert.ok(bins.every((bin) => !('color_code' in bin)));
    }
  }
  assert.throws(() => reviewBins(0, 6, { items: [] }), /総ページ数/);
  assert.throws(() => reviewBins(10, 6, { items: [{ page_number: 11, review_count: 1 }] }), /総ページ数を超える/);
  for (const total of [1, 7, 100, 537]) {
    const bins = reviewBins(total, 10, {
      items: Array.from({ length: total }, (_, i) => ({ page_number: i + 1, review_count: 1 })),
    }, true);
    assert.equal(bins.length, 10);
    assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), total);
    for (let page = 1; page <= total; page++) {
      assert.equal(bins.filter((bin) => bin.start <= page && page <= bin.end).length, 1);
    }
    assert.equal(bins[7].start, Math.floor(total * 0.2) + 1);
    assert.equal(bins[7].end, Math.floor(total * 0.3));
  }
});

async function distributionReady(h, distribution = { items: [{ page_number: 1, review_count: 1 }, { page_number: 100, review_count: 3 }], total_count: 4 }, value = book) {
  h.render();
  h.requests[0].resolve(value);
  await flush();
  if (value.google_books_id) {
    h.requests[1].resolve(distribution);
    await flush();
  }
  return h.render();
}

test('community distribution uses full aggregate, reversed axis, neutral bars and touchable ranges', async () => {
  const h = harness('src/components/organisms/CommunityBookmarks.tsx');
  let tree = await distributionReady(h);
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.props.style?.fontSize === 20 && node.props.children === 4));
  assert.match(text(tree), /件の公開しおり/);
  assert.equal(h.requests[1].kind, 'distribution');
  assert.equal(h.requests.length, 2);
  const bins = nodes(tree).filter((node) => node.type === 'Pressable');
  assert.equal(bins.length, 10);
  assert.match(bins[0].props.accessibilityLabel, /91〜100ページ、公開しおり3件/);
  assert.match(bins.at(-1).props.accessibilityLabel, /1〜10ページ、公開しおり1件/);
  assert.equal(bins[0].props.style[0].minHeight, 112);
  assert.doesNotMatch(text(tree), /読み進める方向|曲線は目安|薄い背景は/);
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.props.children === '100%'));
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.props.children === '10%'));
  bins.at(-1).props.onPress();
  tree = h.render();
  const list = nodes(tree).find((node) => node.type === 'PublicReviewList');
  assert.deepEqual(JSON.parse(JSON.stringify(list.props.range)), { start: 1, end: 10 });
  assert.equal(nodes(tree).filter((node) => node.type === 'Pressable').at(-1).props.accessibilityState.selected, true);
  bins[7].props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(nodes(h.render()).find((node) => node.type === 'PublicReviewList').props.range)), { start: 21, end: 30 });
});

test('community retry, refresh, empty and manual books never present a failed count as zero', async () => {
  const h = harness('src/components/organisms/CommunityBookmarks.tsx');
  h.render(); h.requests[0].resolve(book); await flush();
  h.requests[1].reject(new Error('Distribution offline')); await flush();
  let tree = h.render();
  assert.match(text(tree), /Distribution offline/);
  assert.doesNotMatch(text(tree), /0件の公開しおり/);
  button(tree, '分布の読み込みを再試行').props.onPress();
  h.render();
  h.requests.at(-1).resolve(book); await flush();
  h.requests.at(-1).resolve({ items: [], total_count: 0 }); await flush();
  tree = h.render();
  assert.match(text(tree), /公開しおりはまだありません/);
  nodes(tree).find((node) => node.type === 'Pressable').props.onPress();
  assert.ok(nodes(h.render()).find((node) => node.type === 'PublicReviewList'));
  assert.equal(button(h.render(), 'しおりを更新'), undefined);
  h.unmount();
  const reopened = harness('src/components/organisms/CommunityBookmarks.tsx');
  await distributionReady(reopened);
  assert.equal(reopened.requests[0].kind, 'book');
  assert.equal(reopened.requests[1].kind, 'distribution');
  const manual = harness('src/components/organisms/CommunityBookmarks.tsx');
  assert.match(text(await distributionReady(manual, undefined, { ...book, google_books_id: null })), /手動登録/);
  assert.equal(manual.requests.length, 1);
});

test('community ignores late requests and explicitly reports invalid total pages', async () => {
  const h = harness('src/components/organisms/CommunityBookmarks.tsx');
  h.render(); h.requests[0].resolve(book); await flush(); h.unmount();
  h.requests[1].resolve({ items: [], total_count: 0 }); await flush();
  assert.match(text(h.render()), /読み込んでいます/);
  const invalid = harness('src/components/organisms/CommunityBookmarks.tsx');
  const tree = await distributionReady(invalid, { items: [], total_count: 0 }, { ...book, total_pages: 0 });
  assert.match(text(tree), /総ページ数/);
  assert.ok(button(tree, '分布の読み込みを再試行'));
});

test('bookmark tabs use real community content, remove sample data and preserve own state', () => {
  const h = harness('src/components/organisms/BookmarkListCard.tsx', {
    '../../lib/api': { reviewAnalysisLabel: () => 'AIが決めた色' },
  });
  const props = {
    reviews: [review(1)], currentPage: 10, onOpen() {},
    community: { type: 'RealCommunity', props: {} },
  };
  let tree = h.render(true, props);
  let tabs = nodes(tree).find((node) => node.type === 'SegmentedTabs');
  assert.equal(tabs.props.options[1].label, 'みんなのしおり');
  assert.ok(nodes(tree).find((node) => node.type === 'BookmarkTimeline'));
  assert.equal(nodes(tree).find((node) => node.type === 'RealCommunity'), undefined);
  tabs.props.onChange('others');
  tree = h.render(true, props);
  assert.ok(nodes(tree).find((node) => node.type === 'RealCommunity'));
  assert.doesNotMatch(text(tree), /サンプル|他の人のしおり/);
  assert.equal(nodes(tree).find((node) => node.type === 'BookmarkTimeline'), undefined);
  nodes(tree).find((node) => node.type === 'SegmentedTabs').props.onChange('mine');
  assert.ok(nodes(h.render(true, props)).find((node) => node.type === 'BookmarkTimeline'));
  const fallback = { type: 'OwnError', props: {} };
  assert.ok(nodes(h.render(true, { ...props, ownFallback: fallback })).find((node) => node.type === 'OwnError'));
});

test('embedded range is preserved for initial load, pagination and retry with no nested ScrollView', async () => {
  const h = harness();
  const props = { range: { start: 1, end: 20 } };
  h.render(true, props); h.requests[0].resolve(book); await flush();
  assert.equal(h.requests[1].args[1], 0);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[1].args[2])), props.range);
  h.requests[1].resolve(page(Array.from({ length: 20 }, (_, i) => review(i + 1)))); await flush();
  let tree = h.render(true, props);
  assert.equal(nodes(tree).find((node) => node.type === 'ScrollView'), undefined);
  button(tree, 'さらに読み込む').props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests.at(-1).args)), ['volume', 20, props.range]);
  h.requests.at(-1).reject(new Error('offline')); await flush();
  tree = h.render(true, props);
  button(tree, '追加の読み込みを再試行').props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests.at(-1).args)), ['volume', 20, props.range]);
});

test('unknown progress hides both body and color; analysis labels distinguish real, mock and unavailable results', async () => {
  const h = harness();
  let tree = await ready(h, [review(1)], { ...book, reading_status: 'unknown' });
  assert.doesNotMatch(text(tree), /Body 1/);
  assert.equal(nodes(tree).find((node) => node.props?.accessibilityLabel === '感想の色'), undefined);
  button(tree, 'この感想を表示する').props.onPress();
  tree = h.render();
  assert.match(text(tree), /Body 1/);
  const swatch = nodes(tree).find((node) => node.props?.accessibilityLabel === '感想の色');
  assert.equal(swatch.props.style[1].backgroundColor, '#92A160');
  assert.match(text(tree), /感想の色/);
  const other = harness();
  tree = await ready(other, [
    review(1, { source: 'mock' }),
    review(2, { analysis_status: 'pending', source: null, color_code: '#808080' }),
    review(3, { analysis_status: 'failed', source: null, color_code: '#808080' }),
    review(4, { source: null, color_code: '#808080' }),
  ]);
  assert.match(text(tree), /感想の色（仮）/);
  assert.match(text(tree), /感想の色を準備中/);
  assert.match(text(tree), /色の取得に失敗/);
  assert.match(text(tree), /感想の色を確認できません/);
});

test('standalone review screen retains back navigation while sharing scroll-free list content', () => {
  const { PublicReviewsScreen } = load('src/screens/books/PublicReviewsScreen.tsx', {
    'react/jsx-runtime': jsx,
    'react-native': { ScrollView: 'ScrollView', StyleSheet: { create: (value) => value } },
  });
  let target, backs = 0;
  let tree = PublicReviewsScreen({ bookId: 7, onNavigate: (value) => { target = value; } });
  tree.props.headerLeading.props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(target)), { name: 'book-detail', bookId: 7 });
  assert.equal(nodes(tree).find((node) => node.type === 'PublicReviewList').props.bookId, 7);
  tree = PublicReviewsScreen({ bookId: 7, onNavigate() {}, onBack: () => { backs++; } });
  tree.props.headerLeading.props.onPress();
  assert.equal(backs, 1);
});

test('distribution API authenticates and validates shape, ordering and exact total instead of defaulting empty', async () => {
  const calls = [];
  let payload = { items: [{ page_number: 1, review_count: 2 }], total_count: 2 };
  let status = 200;
  const api = load('src/lib/api.ts', {
    './auth': { authenticatedFetch: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
    } },
  });
  assert.equal((await api.getPublicReviewDistribution('a/b')).total_count, 2);
  assert.match(calls[0][0], /catalog\/books\/a%2Fb\/reviews\/distribution$/);
  for (const invalid of [
    null, {}, { items: [], total_count: 1 },
    { items: [{ page_number: 0, review_count: 1 }], total_count: 1 },
    { items: [{ page_number: 1, review_count: 0 }], total_count: 0 },
    { items: [{ page_number: 1, review_count: 1 }, { page_number: 1, review_count: 1 }], total_count: 2 },
    { items: [{ page_number: 2, review_count: 1 }, { page_number: 1, review_count: 1 }], total_count: 2 },
  ]) {
    payload = invalid;
    await assert.rejects(api.getPublicReviewDistribution('volume'), /取得結果を確認できません/);
  }
  for (const code of [401, 422, 503]) {
    status = code; payload = { detail: 'failure' };
    await assert.rejects(api.getPublicReviewDistribution('volume'), (error) => error.status === code);
  }
});

  test('compact preview shows only latest entry, opens scrollable modal and hides spoilers again on close', async () => {
    const h = harness();
    const props = { compact: true, range: { start: 1, end: 20 } };
    h.render(true, props); h.requests[0].resolve(book); await flush();
    h.requests[1].resolve(page([review(1, { contains_spoilers: true }), review(2)])); await flush();
    let tree = h.render(true, props);
    assert.doesNotMatch(text(tree), /Body 1|Body 2/);
    assert.equal(nodes(tree).filter((node) => node.type === 'ReviewReactionBar').length, 0);
    assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel === '本のデフォルトアイコン').length, 1);
    assert.equal(button(tree, '最新の情報に更新'), undefined);
    nodes(tree).find((node) => node.props?.accessibilityLabel === 'このページ範囲の感想一覧を開く').props.onPress();
    tree = h.render(true, props);
    assert.ok(nodes(tree).find((node) => node.type === 'ScrollView'));
    assert.match(text(tree), /Body 2/);
    assert.deepEqual(nodes(tree).filter((node) => node.type === 'ReviewReactionBar').map((node) => node.props.reviewId), [2]);
    button(tree, 'この感想を表示する').props.onPress();
    assert.match(text(h.render(true, props)), /Body 1/);
    button(h.render(true, props), '閉じる').props.onPress();
    tree = h.render(true, props);
    assert.doesNotMatch(text(tree), /Body 1|Body 2/);
    assert.equal(nodes(tree).filter((node) => node.type === 'ReviewReactionBar').length, 0);
  });

  test('exact page search validates input, preserves selection on refresh and supports initial same-page target', async () => {
    const h = harness('src/components/organisms/CommunityBookmarks.tsx');
    await distributionReady(h);
    for (const value of ['0', '101', '1.5', '']) {
      let tree = h.render();
      nodes(tree).find((node) => node.props?.accessibilityLabel === '感想を探すページ番号').props.onChangeText(value);
      button(h.render(), '感想を読む').props.onPress();
      assert.match(text(h.render()), /整数を入力/);
    }
    nodes(h.render()).find((node) => node.props?.accessibilityLabel === '感想を探すページ番号').props.onChangeText('10');
    button(h.render(), '感想を読む').props.onPress();
    let tree = h.render();
    let list = nodes(tree).find((node) => node.type === 'PublicReviewList');
    assert.deepEqual(JSON.parse(JSON.stringify(list.props.range)), { start: 10, end: 10 });
    assert.equal(list.props.compact, true);
    assert.doesNotMatch(text(tree), /ページを指定/);
    assert.equal(button(tree, 'このページを見る'), undefined);
    const input = nodes(tree).find((node) => node.props?.accessibilityLabel === '感想を探すページ番号');
    assert.equal(input.props.placeholder, 'ページ番号');
    const group = nodes(tree).find((node) =>
      node.props?.style?.borderRadius === 14 && nodes(node).includes(input) && button(node, '感想を読む')
    );
    assert.ok(group);
    assert.ok(nodes(group).some((node) => node.type === 'Text' && node.props.children === 'ページの'));
    assert.ok(nodes(tree).some((node) => node.type === 'Text' && node.props.style?.fontSize === 20 && node.props.children === 10));
    assert.equal(button(tree, 'しおりを更新'), undefined);
    const other = harness('src/components/organisms/CommunityBookmarks.tsx');
    other.render(true, { initialPage: 42 }); other.requests[0].resolve(book); await flush();
    other.requests[1].resolve({ items: [], total_count: 0 }); await flush();
    assert.equal(nodes(other.render(true, { initialPage: 42 })).find((node) => node.type === 'PublicReviewList').props.range.start, 42);
  });

const reactionProps = { googleBooksId: 'volume', reviewId: 1 };
const summary = (my_reaction = null, counts = {}) => ({
    review_id: 1, counts: { empathy: 0, insight: 0, curious: 0, ...counts }, my_reaction,
});
const reactionButtons = (tree) => nodes(tree).filter((node) => node.props?.accessibilityLabel?.includes('、'));
const pressReaction = (tree, index = 0) => reactionButtons(tree)[index].props.onPress();
const retryReactions = (tree) => nodes(tree).find((node) =>
    node.type === 'Pressable' && text(node).includes('リアクションを再読み込み')).props.onPress();
function reactionHarness() {
    const h = harness('src/components/molecules/ReviewReactionBar.tsx');
    return { ...h, render: (props = reactionProps) => h.render(true, props) };
}

test('reactions load real counts, use cute icons and expose accessible selected states', async () => {
    const h = reactionHarness();
    let tree = h.render();
    assert.ok(reactionButtons(tree).every((node) => node.props.disabled));
    assert.match(text(tree), /読み込み中/);
    assert.doesNotMatch(text(tree), /\b0\b/);
    assert.deepEqual(h.requests[0].args, ['volume', 1]);
    h.requests[0].resolve(summary('insight', { empathy: 3, insight: 2, curious: 1 }));
    await flush();
    tree = h.render();
    assert.deepEqual(reactionButtons(tree).map((node) => node.props.accessibilityLabel),
      ['共感した、3件', 'なるほど、2件', '気になる、1件']);
    assert.deepEqual(reactionButtons(tree).map((node) => node.props.accessibilityState.selected), [false, true, false]);
    assert.deepEqual(nodes(tree).filter((node) => node.props?.name).map((node) => node.props.name),
      ['heart-outline', 'bulb', 'eye-outline']);
    assert.ok(reactionButtons(tree).every((node) => node.props.style[0].minHeight >= 44));
});

test('reactions add, switch and cancel only after server success and prevent duplicate taps', async () => {
    const h = reactionHarness();
    h.render(); h.requests[0].resolve(summary()); await flush();
    let tree = h.render();
    pressReaction(tree); pressReaction(tree, 1);
    assert.equal(h.requests.length, 2);
    assert.deepEqual(h.requests[1].args, ['volume', 1, 'empathy']);
    tree = h.render();
    assert.ok(reactionButtons(tree).every((node) => node.props.disabled));
    assert.ok(reactionButtons(tree).every((node) => !node.props.accessibilityState.selected));
    assert.match(text(tree), /送信中/);
    h.requests[1].resolve(summary('empathy', { empathy: 1 })); await flush();
    tree = h.render();
    assert.equal(reactionButtons(tree)[0].props.accessibilityState.selected, true);
    pressReaction(tree, 2);
    assert.deepEqual(h.requests[2].args, ['volume', 1, 'curious']);
    h.requests[2].resolve(summary('curious', { curious: 1 })); await flush();
    tree = h.render(); pressReaction(tree, 2);
    assert.deepEqual(h.requests[3].args, ['volume', 1, null]);
    h.requests[3].resolve(summary()); await flush();
    assert.ok(reactionButtons(h.render()).every((node) => !node.props.accessibilityState.selected));
});

test('reaction fetch failures are explicit, retryable and do not invent zero counts', async () => {
    const h = reactionHarness();
    h.render(); h.requests[0].reject(new Error('503 unavailable')); await flush();
    let tree = h.render();
    assert.match(text(tree), /503 unavailable/);
    assert.ok(nodes(tree).some((node) => node.props?.accessibilityRole === 'alert'));
    assert.ok(reactionButtons(tree).every((node) => node.props.disabled));
    assert.ok(reactionButtons(tree).every((node) => node.props.accessibilityLabel.includes('件数読み込み前')));
    retryReactions(tree); h.render();
    h.requests[1].resolve(summary()); await flush();
    assert.equal(reactionButtons(h.render())[0].props.accessibilityLabel, '共感した、0件');
});

test('failed updates preserve confirmed state and require reconciliation before new operations', async () => {
    const h = reactionHarness();
    h.render(); h.requests[0].resolve(summary('empathy', { empathy: 2 })); await flush();
    pressReaction(h.render(), 1);
    h.requests[1].reject(new Error('更新を確認できません')); await flush();
    let tree = h.render();
    assert.match(text(tree), /更新を確認できません/);
    assert.equal(reactionButtons(tree)[0].props.accessibilityLabel, '共感した、2件');
    assert.equal(reactionButtons(tree)[0].props.accessibilityState.selected, true);
    assert.ok(reactionButtons(tree).every((node) => node.props.disabled));
    pressReaction(tree, 2);
    assert.equal(h.requests.length, 2);
    retryReactions(tree); h.render();
    // The write might have reached the server even if its response was lost.
    h.requests[2].resolve(summary('insight', { empathy: 1, insight: 1 })); await flush();
    tree = h.render();
    assert.equal(reactionButtons(tree)[1].props.accessibilityState.selected, true);
    assert.ok(reactionButtons(tree).every((node) => !node.props.disabled));
});

test('changing review or unmounting ignores late reaction reads and writes', async () => {
    const h = reactionHarness();
    h.render();
    const other = { googleBooksId: 'other-volume', reviewId: 2 };
    h.render(other);
    h.requests[0].resolve(summary('empathy', { empathy: 10 })); await flush();
    assert.ok(reactionButtons(h.render(other)).every((node) => node.props.disabled));
    h.requests[1].resolve({ ...summary(), review_id: 2 }); await flush();
    pressReaction(h.render(other));
    assert.deepEqual(h.requests[2].args, ['other-volume', 2, 'empathy']);
    h.render();
    h.requests[2].resolve({ ...summary('empathy', { empathy: 1 }), review_id: 2 }); await flush();
    assert.ok(reactionButtons(h.render()).every((node) => node.props.disabled));
    h.unmount();
    h.requests[3].resolve(summary('curious', { curious: 3 })); await flush();
    assert.ok(reactionButtons(h.render()).every((node) => node.props.disabled));
});

test('reaction API encodes IDs, authenticates and uses idempotent PUT/DELETE contracts', async () => {
    const calls = [];
    let payload = summary();
    const api = load('src/lib/api.ts', {
      './auth': { authenticatedFetch: async (...args) => {
        calls.push(args);
        return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
      } },
    });
    await api.getReviewReactions('volume/id', 1);
    assert.match(calls[0][0], /catalog\/books\/volume%2Fid\/reviews\/1\/reactions$/);
    payload = summary('empathy', { empathy: 1 });
    await api.setReviewReaction('volume/id', 1, 'empathy');
    assert.match(calls[1][0], /\/1\/reaction$/);
    assert.equal(calls[1][1].method, 'PUT');
    assert.deepEqual(JSON.parse(calls[1][1].body), { kind: 'empathy' });
    assert.equal(calls[1][1].headers['Content-Type'], 'application/json');
    payload = summary();
    await api.setReviewReaction('volume/id', 1, null);
    assert.equal(calls[2][1].method, 'DELETE');
    assert.equal(calls[2][1].body, undefined);
});

test('reaction API rejects malformed counts, mismatched results and HTTP/network/non-JSON errors', async () => {
    let payload = summary(), status = 200, contentType = 'application/json', failure;
    const api = load('src/lib/api.ts', {
      './auth': { authenticatedFetch: async () => {
        if (failure) throw failure;
        return new Response(JSON.stringify(payload), { status, headers: { 'content-type': contentType } });
      } },
    });
    for (const invalid of [
      null, {}, { ...summary(), review_id: 2 }, { ...summary(), counts: null },
      { ...summary(), counts: { empathy: 0, insight: 0 } },
      summary(null, { empathy: -1 }), summary(null, { insight: '1' }),
      summary(null, { curious: 1.5 }), summary(null, { empathy: Number.MAX_SAFE_INTEGER + 1 }),
      summary('unknown'), summary('empathy'), { ...summary(), my_reaction: undefined },
    ]) {
      payload = invalid;
      await assert.rejects(api.getReviewReactions('volume', 1), /取得結果を確認できません/);
    }
    payload = summary();
    await assert.rejects(api.setReviewReaction('volume', 1, 'empathy'), /取得結果を確認できません/);
    payload = summary('empathy', { empathy: 1 });
    await assert.rejects(api.setReviewReaction('volume', 1, null), /取得結果を確認できません/);
    for (const code of [401, 404, 422, 503]) {
      status = code; payload = { detail: 'Failure' };
      await assert.rejects(api.getReviewReactions('volume', 1), (error) => error.status === code);
      await assert.rejects(api.setReviewReaction('volume', 1, 'curious'), (error) => error.status === code);
      await assert.rejects(api.setReviewReaction('volume', 1, null), (error) => error.status === code);
    }
    status = 200; contentType = 'text/html';
    await assert.rejects(api.getReviewReactions('volume', 1), /JSONではない/);
    failure = new Error('Network offline');
    await assert.rejects(api.setReviewReaction('volume', 1, null), /Network offline/);
});
  test('own bookmark same-page action switches community tab with exact page instead of opening editor', () => {
    const h = harness('src/components/organisms/BookmarkListCard.tsx', {
      '../../lib/api': { reviewAnalysisLabel: () => '感想の色' },
    });
    let opened = false;
    const props = { reviews: [review(1)], currentPage: 10, onOpen() { opened = true; },
      community: (page) => ({ type: 'Community', props: { page } }) };
    const tree = h.render(true, props);
    const communityButton = nodes(tree).find((node) => node.props?.accessibilityLabel === '10ページのみんなの感想を読む');
    assert.ok(nodes(communityButton).some((node) => node.props?.name === 'chatbubbles-outline'));
    assert.equal(nodes(communityButton).filter((node) => node.type === 'Text').length, 0);
    assert.equal(communityButton.props.style.width, 44);
    assert.equal(communityButton.props.style.height, 44);
    const row = nodes(tree).find((node) => node.type === 'View' &&
      [node.props.children].flat().includes(communityButton));
    assert.equal(row.props.style.flexDirection, 'row');
    assert.equal(row.props.style.alignItems, 'center');
    const ownReview = [row.props.children].flat().find((node) =>
      node.props?.accessibilityLabel === '10ページの感想を開く');
    assert.ok(ownReview);
    assert.equal(ownReview.props.style.flex, 1);
    assert.doesNotMatch(text(tree), /同じページのみんなのしおりを見る/);
    communityButton.props.onPress();
    assert.equal(nodes(h.render(true, props)).find((node) => node.type === 'Community').props.page, 10);
    assert.equal(opened, false);
  });
