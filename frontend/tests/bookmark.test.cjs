const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process, __DEV__: false, Error, SyntaxError,
    require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
    ...globals,
  });
  return exports;
}

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

const find = (tree, type) => nodes(tree).find((node) => node.type === type);
const button = (tree, label) => nodes(tree).find((node) => node.props?.label === label);
const book = (id = 7) => ({
  id, title: `Book ${id}`, total_pages: 180, latest_iteration: 2, reading_status: 'reading',
});
const review = (id = 7, page = 42) => ({
  id: 1, book_id: id, page_number: page, iteration_number: 2,
  review_text: 'Saved text', color_code: '#123456',
  created_at: '2026-10-25T04:00:00Z', updated_at: '2026-10-25T04:00:00Z',
  analysis_status: 'completed', source: 'jev',
});

function screenHarness() {
  let state = [], refs = [], effects = [], cursor = 0, scheduled = [], component, props;
  let target;
  const requests = [], animations = [];
  const timers = new Map();
  function request(kind, args) {
    const pending = deferred();
    requests.push({ kind, args, ...pending });
    return pending.promise;
  }
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => {
          state[index] = typeof value === 'function' ? value(state[index]) : value;
        }];
      },
      useRef(initial) {
        const index = cursor++;
        return refs[index] ??= { current: initial };
      },
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
      Fragment: 'Fragment',
    },
    'react-native': {
      StyleSheet: { create: (value) => value },
      SafeAreaView: 'SafeAreaView', Text: 'Text', View: 'View',
      Keyboard: { dismiss() {} },
      Animated: {
        Value: class { setValue() {} stopAnimation() {} },
        timing: (_, config) => ({ start: (callback) => animations.push({ config, callback }) }),
        spring: () => ({ start() {} }),
      },
    },
    '../../lib/api': {
      getBook: (...args) => request('book', args),
      getPageReview: (...args) => request('get', args),
      savePageReview: (...args) => request('put', args),
      reviewAnalysisLabel: (review) => `${review.analysis_status}:${review.source}`,
    },
  };
  const { BookmarkScreen } = load('src/components/templates/BookmarkScreen.tsx', dependencies, {
    setTimeout: (callback) => { const key = {}; timers.set(key, callback); return key; },
    clearTimeout: (key) => timers.delete(key),
  });
  return {
    requests, animations,
    runTimers() {
      for (const [key, callback] of timers) {
        timers.delete(key);
        callback();
      }
    },
    get target() { return target; },
    mount(id = 7, iteration = 2, initialPage) {
      const element = BookmarkScreen({
        bookId: id, iteration, initialPage, onNavigate: (value) => { target = value; },
      });
      component = element.type;
      props = element.props;
      return this.render();
    },
    unselected() {
      return BookmarkScreen({ onNavigate: (value) => { target = value; } });
    },
    render() {
      cursor = 0;
      scheduled = [];
      const tree = component(props);
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

async function openBook(h, id = 7) {
  h.mount(id);
  h.requests[0].resolve(book(id));
  await flush();
  return find(h.render(), 'BookmarkCard');
}

async function openPage(h, existing = null, page = '42') {
  let card = find(h.render(), 'BookmarkCard');
  card.props.onPageChange(page);
  h.render();
  h.runTimers();
  h.requests.at(-1).resolve(existing);
  await flush();
  return find(h.render(), 'BookmarkCard');
}

test('API sends explicit book/page/iteration, trims text, and only treats JSON 404 as absence', async () => {
  const calls = [];
  let response;
  const api = load('src/lib/api.ts', {}, {
    fetch: async (...args) => { calls.push(args); return response.clone(); },
  });
  response = new Response(JSON.stringify(review()), { headers: { 'content-type': 'application/json' } });
  assert.equal((await api.savePageReview(7, 42, 2, '  text  ')).color_code, '#123456');
  assert.ok(calls[0][0].endsWith('/books/7/pages/42/review?iteration=2'));
  assert.equal(calls[0][1].method, 'PUT');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(calls[0][1].body).review_text, 'text');
  response = new Response('{"detail":"Review not found"}', { status: 404, headers: { 'content-type': 'application/json' } });
  assert.equal(await api.getPageReview(12, 10, 3), null);
  assert.ok(calls[1][0].endsWith('/books/12/pages/10/review?iteration=3'));
  for (const status of [401, 409, 422, 503]) {
    response = new Response('{"detail":"Failure"}', { status, headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getPageReview(7, 42, 2), (error) => error.status === status);
    await assert.rejects(api.savePageReview(7, 42, 2, 'text'), (error) => error.status === status);
  }
  response = new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } });
  await assert.rejects(api.getPageReview(7, 42, 2), /JSON/);
});

test('no selected book shows a bookshelf link and never loads or saves', () => {
  const h = screenHarness();
  const tree = h.unselected();
  assert.equal(find(tree, 'BookmarkCard'), undefined);
  button(tree, '本棚で本を選ぶ').props.onPress();
  assert.equal(h.target, 'bookshelf');
  assert.equal(h.requests.length, 0);
});

test('app keeps bookmark target and iteration together and also allows the book selection entry', () => {
  let route = { name: 'bookmark', bookId: 12, iteration: 3, page: 42 };
  const { default: App } = load('App.tsx', {
    react: { useState: () => [route, (next) => { route = next; }] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  });
  let tree = App();
  assert.equal(tree.type, 'BookmarkScreen');
  assert.equal(tree.props.bookId, 12);
  assert.equal(tree.props.iteration, 3);
  assert.equal(tree.props.initialPage, 42);
  tree.props.onNavigate('bookmark');
  tree = App();
  assert.equal(tree.props.bookId, undefined);
  assert.equal(tree.props.iteration, undefined);
  tree.props.onNavigate({ name: 'book-detail', bookId: 12 });
  tree = App();
  assert.equal(tree.type, 'BookDetailScreen');
  assert.equal(tree.props.bookId, 12);
});

test('create: wait for successful save before animation, use returned color, preserve IDs and block duplicates', async () => {
  const h = screenHarness();
  const initial = await openBook(h);
  assert.equal(initial.props.title, 'Book 7');
  let card = await openPage(h);
  assert.equal(card.props.loaded, true);
  assert.equal(card.props.updating, false);
  card.props.onThoughtsChange('  New note  ');
  card = find(h.render(), 'BookmarkCard');
  card.props.onSubmit();
  card.props.onSubmit();
  assert.equal(h.requests.filter((r) => r.kind === 'put').length, 1);
  assert.deepEqual(h.requests.at(-1).args, [7, 42, 2, 'New note']);
  assert.equal(h.animations.length, 0);
  assert.equal(find(h.render(), 'BookmarkCard').props.busy, true);
  const saved = { ...review(), review_text: 'New note' };
  h.requests.at(-1).resolve(saved);
  await flush();
  assert.equal(h.animations.length, 1);
  card = find(h.render(), 'BookmarkCard');
  assert.equal(card.props.color, saved.color_code);
  assert.equal(card.props.busy, true);
  h.animations[0].callback({ finished: true });
  const tree = h.render();
  assert.equal(find(tree, 'BookmarkCard'), undefined);
  button(tree, '本の詳細へ').props.onPress();
  assert.equal(h.target.name, 'book-detail');
  assert.equal(h.target.bookId, 7);
  button(tree, '別のページに記録する').props.onPress();
  card = find(h.render(), 'BookmarkCard');
  assert.equal(card.props.loaded, false);
  assert.equal(card.props.busy, false);
  card = await openPage(h, saved);
  assert.equal(card.props.thoughts, 'New note');
  assert.equal(card.props.updating, true);
});

test('existing review is loaded for update; failed save retains text and can retry', async () => {
  const h = screenHarness();
  await openBook(h, 12);
  let card = await openPage(h, review(12));
  assert.deepEqual(h.requests[1].args, [12, 42, 2]);
  assert.equal(card.props.thoughts, 'Saved text');
  assert.equal(card.props.color, '#123456');
  assert.equal(card.props.analysisLabel, 'completed:jev');
  assert.equal(card.props.updating, true);
  card.props.onThoughtsChange('Edited note');
  card = find(h.render(), 'BookmarkCard');
  card.props.onSubmit();
  h.requests.at(-1).reject(new Error('Offline'));
  await flush();
  card = find(h.render(), 'BookmarkCard');
  assert.equal(card.props.thoughts, 'Edited note');
  assert.equal(card.props.error, 'Offline');
  assert.equal(card.props.busy, false);
  assert.equal(h.animations.length, 0);
  card.props.onSubmit();
  assert.deepEqual(h.requests.at(-1).args, [12, 42, 2, 'Edited note']);
  h.requests.at(-1).resolve(review(12));
  await flush();
  assert.equal(h.animations.length, 1);
});

test('page and Unicode text boundaries match the API, and lookup failures do not allow saving', async () => {
  const h = screenHarness();
  await openBook(h);
  for (const page of ['0', '181', '-1', '1.2', 'x', '9007199254740993']) {
    let card = find(h.render(), 'BookmarkCard');
    card.props.onPageChange(page);
    card = find(h.render(), 'BookmarkCard');
    h.runTimers();
    assert.equal(h.requests.length, 1);
    assert.ok(find(h.render(), 'BookmarkCard').props.error);
  }
  let card = find(h.render(), 'BookmarkCard');
  card.props.onPageChange('180');
  h.render();
  h.runTimers();
  h.runTimers();
  assert.equal(h.requests.length, 2);
  h.requests.at(-1).reject(new Error('Lookup failed'));
  await flush();
  card = find(h.render(), 'BookmarkCard');
  assert.equal(card.props.loaded, false);
  card.props.onSubmit();
  assert.equal(h.requests.length, 2);
  await openPage(h, null, '1');
  for (const text of ['   ', 'x'.repeat(141)]) {
    card = find(h.render(), 'BookmarkCard');
    card.props.onThoughtsChange(text);
    find(h.render(), 'BookmarkCard').props.onSubmit();
    assert.equal(h.requests.filter((r) => r.kind === 'put').length, 0);
  }
  card = find(h.render(), 'BookmarkCard');
  card.props.onThoughtsChange(String.fromCodePoint(0x1F600).repeat(140));
  find(h.render(), 'BookmarkCard').props.onSubmit();
  assert.equal(h.requests.filter((r) => r.kind === 'put').length, 1);
  h.requests.at(-1).resolve(review(7, 1));
  await flush();
});

test('completed and stale iterations allow reading but block saving; book fetch has retry; unmounted requests have no animation', async () => {
  for (const change of [{ reading_status: 'completed' }, { latest_iteration: 3 }]) {
    const h = screenHarness();
    h.mount(7, 2, 42);
    h.requests[0].resolve({ ...book(), ...change });
    await flush();
    h.render();
    h.runTimers();
    h.requests.at(-1).resolve(review());
    await flush();
    const card = find(h.render(), 'BookmarkCard');
    assert.equal(card.props.page, '42');
    assert.equal(card.props.readOnly, true);
    assert.equal(card.props.thoughts, 'Saved text');
    card.props.onSubmit();
    assert.equal(h.requests.filter((request) => request.kind === 'put').length, 0);
    assert.ok(button(h.render(), '本の詳細へ'));
  }
  const h = screenHarness();
  h.mount();
  h.requests[0].reject(new Error('Book failed'));
  await flush();
  button(h.render(), '再試行').props.onPress();
  h.render();
  h.requests[1].resolve(book());
  await flush();
  await openPage(h);
  find(h.render(), 'BookmarkCard').props.onThoughtsChange('note');
  find(h.render(), 'BookmarkCard').props.onSubmit();
  h.unmount();
  h.requests.at(-1).resolve(review());
  await flush();
  assert.equal(h.animations.length, 0);
});

test('swipe uses current form callbacks, is blocked while busy, and never performs a success animation itself', () => {
  const refs = [];
  let cursor = 0, gestures, submitted = 0, springs = 0;
  const { BookmarkCard } = load('src/components/organisms/BookmarkCard.tsx', {
    react: {
      useRef(initial) {
        const index = cursor++;
        return refs[index] ??= { current: initial };
      },
    },
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: 'Fragment',
    },
    'react-native': {
      StyleSheet: { create: (value) => value },
      View: 'View', Text: 'Text', ScrollView: 'ScrollView',
      Animated: { View: 'AnimatedView', spring: () => ({ start: () => { springs += 1; } }) },
      PanResponder: { create: (config) => { gestures = config; return { panHandlers: {} }; } },
    },
  });

  let props = {
    translateY: { setValue() {} }, title: 'Book', page: '42', thoughts: 'note',
    loaded: false, updating: false, busy: false, error: null,
    onPageChange() {}, onThoughtsChange() {}, onRetry() {},
    onSubmit: () => { submitted += 1; },
  };
  function render(update) {
    props = { ...props, ...update };
    cursor = 0;
    return BookmarkCard(props);
  }
  render();
  assert.equal(gestures.onMoveShouldSetPanResponder(null, { dy: -130, dx: 0 }), false);
  render({ loaded: true });
  assert.equal(gestures.onMoveShouldSetPanResponder(null, { dy: -130, dx: 0 }), true);
  assert.equal(gestures.onMoveShouldSetPanResponderCapture(null, { dy: -130, dx: 0 }), true);
  gestures.onPanResponderRelease(null, { dy: -79 });
  assert.equal(submitted, 0);
  gestures.onPanResponderRelease(null, { dy: -81 });
  assert.equal(submitted, 1);
  render({ busy: true });
  assert.equal(gestures.onMoveShouldSetPanResponder(null, { dy: -130, dx: 0 }), false);
  gestures.onPanResponderRelease(null, { dy: -150 });
  assert.equal(submitted, 1);
  const tree = render({ busy: false, onSubmit: () => { submitted += 10; } });
  gestures.onPanResponderRelease(null, { dy: -150 });
  assert.equal(submitted, 11);
  button(tree, 'しおりを追加する').props.onPress();
  assert.equal(submitted, 21);
  assert.equal(springs, 3);
  const readOnlyTree = render({ readOnly: true });
  assert.equal(gestures.onMoveShouldSetPanResponder(null, { dy: -130, dx: 0 }), false);
  gestures.onPanResponderRelease(null, { dy: -150 });
  assert.equal(submitted, 21);
  assert.equal(button(readOnlyTree, 'しおりを追加する'), undefined);
  assert.equal(find(readOnlyTree, 'ThoughtsField').props.editable, false);
});

test('automatic page lookup ignores stale responses and never copies another page into the editor', async () => {
    const h = screenHarness();
    await openBook(h);
    find(h.render(), 'BookmarkCard').props.onPageChange('12');
    h.render();
    h.runTimers();
    const first = h.requests.at(-1);
    find(h.render(), 'BookmarkCard').props.onPageChange('42');
    h.render();
    h.runTimers();
    const second = h.requests.at(-1);
    second.resolve({ ...review(), review_text: 'Page 42', color_code: '#CC0000' });
    await flush();
    first.resolve({ ...review(7, 12), review_text: 'Page 12', color_code: '#00CC00' });
    await flush();
    const card = find(h.render(), 'BookmarkCard');
    assert.equal(card.props.page, '42');
    assert.equal(card.props.thoughts, 'Page 42');
    assert.equal(card.props.color, '#CC0000');
    assert.equal(card.props.loaded, true);
    card.props.onPageChange('7');
    h.render();
    assert.equal(find(h.render(), 'BookmarkCard').props.loaded, false);
    assert.equal(find(h.render(), 'BookmarkCard').props.thoughts, '');
  });

  test('list API fetches all pages and analysis labels distinguish AI, mock and failed analysis', async () => {
    const urls = [];
    const api = load('src/lib/api.ts', {}, {
      fetch: async (url) => {
        urls.push(url);
        const items = urls.length === 1 ? Array.from({ length: 100 }, () => review()) : [review(7, 150)];
        return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json' } });
      },
    });
    const items = await api.getBookReviews(7, 2);
    assert.equal(items.length, 101);
    assert.ok(urls[0].endsWith('/books/7/reviews?iteration=2&limit=100&offset=0'));
    assert.ok(urls[1].endsWith('offset=100'));
    assert.equal(api.reviewAnalysisLabel(review()), 'AIが決めた色');
    assert.equal(api.reviewAnalysisLabel({ ...review(), source: 'mock' }), 'AI未接続・仮の色');
    assert.match(api.reviewAnalysisLabel({ ...review(), analysis_status: 'failed', source: null }), /失敗/);
  });

  test('own bookmarks map real text, per-review colors and current page instead of sample bookmarks', () => {
    const { BookmarkListCard } = load('src/components/organisms/BookmarkListCard.tsx', {
      react: { useState: (initial) => [initial, () => {}] },
      'react/jsx-runtime': {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      'react-native': { StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View' },
      '../../lib/api': { reviewAnalysisLabel: () => 'AI' },
    });
    const tree = BookmarkListCard({
      reviews: [review(), { ...review(7, 150), id: 2, review_text: 'Second', color_code: '#00CC00' }],
      currentPage: 150, onOpen() {},
    });
    const timeline = find(tree, 'BookmarkTimeline');
    assert.equal(timeline.props.currentPage, 150);
    assert.equal(timeline.props.bookmarks.length, 2);
    assert.equal(timeline.props.bookmarks[0].color, '#123456');
    assert.equal(timeline.props.bookmarks[1].color, '#00CC00');
    assert.equal(timeline.props.bookmarks[1].note, 'Second');
    assert.equal(find(BookmarkListCard({ reviews: [], currentPage: 0, onOpen() {} }), 'BookmarkTimeline').props.bookmarks.length, 0);
  });

test('timeline expands only crowded intervals, preserves all markers and ends at the read page', () => {
  const { createTimelineLayout, BookmarkTimeline } = load('src/components/molecules/BookmarkTimeline.tsx', {
    react: { useState: (value) => [value, () => {}] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: (value) => value }, View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView' },
  });
  const bookmarks = [42, 43, 44, 120].map((page) => ({ id: String(page), page }));
  const layout = createTimelineLayout(bookmarks, 120, 300);
  assert.equal(layout.markers.length, 4);
  for (let i = 1; i < layout.markers.length; i++) {
    assert.ok(layout.markers[i - 1].x - layout.markers[i].x >= 56);
  }
  assert.equal(layout.markers.at(-1).x, 32);
  assert.ok(layout.markers[0].x > layout.markers.at(-1).x);
  assert.ok(layout.width > 300);
  const trailing = createTimelineLayout(bookmarks.slice(0, 3), 120, 300);
  assert.ok(trailing.markers.at(-1).x > 32);
  const empty = createTimelineLayout([], 0, 300);
  assert.ok(Number.isFinite(empty.endX));
  assert.equal(empty.width, 300);
  const dense = createTimelineLayout(Array.from({ length: 100 }, (_, i) => ({ id: String(i), page: i + 1 })), 100, 300);
  assert.equal(dense.markers.length, 100);
  assert.ok(dense.width >= 100 * 56);
  assert.ok(dense.markers.every((marker) => marker.x >= 32 && marker.x <= dense.endX));
  let selected;
  const tree = BookmarkTimeline({ bookmarks, currentPage: 120, onSelect: (id) => { selected = id; } });
  assert.equal(find(tree, 'ScrollView').props.horizontal, true);
  assert.equal(nodes(tree).filter((node) => node.type === 'Pressable').length, 4);
  nodes(tree).find((node) => node.props?.accessibilityLabel === '43ページのしおりを開く').props.onPress();
  assert.equal(selected, '43');
  assert.ok(nodes(tree).some((node) => Array.isArray(node.props?.children) && node.props.children.join('') === '120ページ'));
  const endpoints = nodes(tree).filter((node) => node.type === 'Text' && Array.isArray(node.props?.style));
  const farthest = endpoints.find((node) => Array.isArray(node.props.children) && node.props.children.join('') === '120ページ');
  const zero = endpoints.find((node) => node.props.children === '0ページ');
  assert.ok(farthest.props.style[1].left < zero.props.style[1].left);
});

test('nine reviews paginate as five then four, while all timeline points remain selectable', () => {
  let states = [], cursor = 0, opened;
  const { BookmarkListCard } = load('src/components/organisms/BookmarkListCard.tsx', {
    react: { useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    } },
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'react-native': { StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View', Pressable: 'Pressable' },
    '../../lib/api': { reviewAnalysisLabel: () => 'AI' },
  });
  let reviews = Array.from({ length: 9 }, (_, i) => ({ ...review(7, i + 1), id: i + 1 }));
  function render() {
    cursor = 0;
    return BookmarkListCard({ reviews, currentPage: 9, onOpen: (page) => { opened = page; } });
  }
  const rows = (tree) => nodes(tree).filter((node) => node.props?.accessibilityLabel?.endsWith('ページの感想を開く'));
  const pager = (tree, text) => nodes(tree).find((node) => node.type === 'Pressable' && node.props.children?.props?.children === text);
  let tree = render();
  assert.equal(rows(tree).length, 5);
  assert.ok(nodes(tree).some((node) => node.props?.children === '1/2'));
  assert.equal(pager(tree, '前へ').props.disabled, true);
  assert.equal(find(tree, 'BookmarkTimeline').props.bookmarks.length, 9);
  rows(tree)[0].props.onPress();
  assert.equal(opened, 1);
  find(tree, 'BookmarkTimeline').props.onSelect('9');
  assert.equal(opened, 9);
  pager(tree, '次へ').props.onPress();
  tree = render();
  assert.equal(rows(tree).length, 4);
  assert.ok(nodes(tree).some((node) => node.props?.children === '2/2'));
  assert.equal(pager(tree, '次へ').props.disabled, true);
  rows(tree)[0].props.onPress();
  assert.equal(opened, 6);
  pager(tree, '前へ').props.onPress();
  assert.equal(rows(render()).length, 5);
  reviews = [];
  tree = render();
  assert.equal(rows(tree).length, 0);
  assert.equal(pager(tree, '次へ'), undefined);
  for (const count of [1, 5, 6, 10, 11]) {
    states = [];
    reviews = Array.from({ length: count }, (_, i) => ({ ...review(7, i + 1), id: i + 1 }));
    tree = render();
    assert.equal(rows(tree).length, Math.min(5, count));
    assert.ok(nodes(tree).some((node) => node.props?.children === `1/${Math.ceil(count / 5)}`));
  }
});

test('selected page opens directly and loads its existing note without retyping the page', async () => {
  const h = screenHarness();
  h.mount(12, 2, 150);
  h.requests[0].resolve(book(12));
  await flush();
  h.render();
  h.runTimers();
  assert.deepEqual(h.requests.at(-1).args, [12, 150, 2]);
  h.requests.at(-1).resolve(review(12, 150));
  await flush();
  const card = find(h.render(), 'BookmarkCard');
  assert.equal(card.props.page, '150');
  assert.equal(card.props.thoughts, 'Saved text');
  assert.equal(card.props.color, '#123456');
  assert.equal(card.props.readOnly, false);
});
