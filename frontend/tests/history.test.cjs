const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const stub = new Proxy({}, { get: (_, key) => String(key) });
// Local-time ISO strings so formatted dates do not depend on the machine's time zone.
const at = (day) => `2026-10-${String(day).padStart(2, '0')}T12:00:00`;

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children, node.props?.headerAction, node.props?.headerLeading].flat(Infinity).flatMap(nodes)];
}
const text = (node) => [node?.props?.children].flat(Infinity)
  .map((child) => (child && typeof child === 'object' ? text(child) : child ?? '')).join('');
const texts = (tree) => nodes(tree).filter((node) => node.type === 'Text').map(text);

function compile(relative, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', ...relative.split('/')), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Error, Promise, Date, Number, String, require: (name) => dependencies[name] ?? stub });
  return exports;
}

function hooks() {
  const state = [], effects = [];
  let cursor = 0, scheduled = [];
  return {
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
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
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
    render(component) {
      for (let round = 0; round < 5; round += 1) {
        cursor = 0;
        scheduled = [];
        const tree = component();
        if (scheduled.length === 0) return tree;
        scheduled.forEach((effect) => effect());
      }
      throw new Error('effects did not settle');
    },
  };
}

const status = compile('src/lib/readingStatus.ts', {});
const shelfBook = (overrides = {}) => ({
  id: 5, title: 'Book', author: null, total_pages: 200, current_page: 20, google_books_id: 'g1',
  latest_iteration: 1, reading_status: 'reading', started_at: at(20), completed_at: null, ...overrides,
});

test('shelf status label covers first reads and re-reads', () => {
  assert.equal(status.shelfStatusLabel(shelfBook()), '2026/10/20 追加・読書中');
  assert.equal(status.shelfStatusLabel(shelfBook({ reading_status: 'completed', completed_at: at(24) })), '2026/10/24 読了');
  assert.equal(status.shelfStatusLabel(shelfBook({ latest_iteration: 2 })), '2回目を読書中（これまで1回読了）');
  assert.equal(
    status.shelfStatusLabel(shelfBook({ latest_iteration: 3, reading_status: 'completed', completed_at: at(5) })),
    '3回読了・最終 2026/10/05',
  );
  assert.equal(status.shelfStatusLabel(shelfBook({ started_at: null })), '本棚に追加済み・読書中');
});

test('iteration label shows the reading period', () => {
  assert.equal(status.iterationLabel({ status: 'completed', started_at: at(1), completed_at: at(20) }), '2026/10/01〜2026/10/20 読了');
  assert.equal(status.iterationLabel({ status: 'reading', started_at: at(21), completed_at: null }), '2026/10/21〜 読書中');
  assert.equal(status.formatDate('invalid'), null);
});

function searchHarness({ shelf, failShelf = false } = {}) {
  const h = hooks();
  const calls = [];
  let target;
  const { AddBookScreen } = compile('src/screens/books/AddBookScreen.tsx', {
    '../../theme/colors': { colors: { navAccent: '#C17AED', background: '#FFFFFF' } },
    react: h.react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': { StyleSheet: { create: (value) => value }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '../../lib/api': {
      searchGoogleBooks: async () => [
        { google_books_id: 'g1', title: 'Owned', author: 'A', total_pages: 200 },
        { google_books_id: 'g2', title: 'New', author: null, total_pages: 100 },
      ],
      importGoogleBook: async (id) => { calls.push(id); return shelfBook({ id: 9, google_books_id: id, started_at: at(25) }); },
    },
    '../../lib/readingBooks': {
      loadAllBooks: async () => { if (failShelf) throw new Error('offline'); return shelf; },
    },
    '../../lib/readingStatus': status,
    '../../lib/searchHistory': { useSearchHistory: () => ({
      items: [], error: null, loading: false, remember: async () => {}, remove: async () => {}, clear: async () => {},
    }) },
  });
  const render = () => h.render(() => AddBookScreen({ onNavigate: (value) => { target = value; } }));
  return {
    calls,
    get target() { return target; },
    render,
    async search() {
      render();
      await flush();
      let tree = render();
      nodes(tree).find((node) => node.props?.placeholder === '本のタイトルを検索').props.onChangeText('q');
      tree = render();
      nodes(tree).find((node) => node.props?.accessibilityLabel === '検索する').props.onPress();
      await flush();
      return render();
    },
  };
}

const card = (tree, title) => nodes(tree).find((node) => node.props?.accessibilityLabel === `${title}の検索結果`);
const detailButton = (tree, title) => nodes(tree).find((node) => node.props?.accessibilityLabel === `${title}の詳細を見る`);

const pressEvent = () => ({ stopPropagation() {} });

test('search results precede genres, rankings, recommendations and history and search returns to top', async () => {
  const h = searchHarness({ shelf: [] });
  let tree = h.render();
  const scroll = nodes(tree).find((node) => node.type === 'ScrollView');
  const positions = [];
  scroll.props.ref.current = { scrollTo: (value) => positions.push(value) };
  tree = await h.search();
  const all = nodes(tree);
  const firstResult = all.findIndex((node) => node.props?.accessibilityLabel === 'Ownedの検索結果');
  for (const type of ['PopularBooks', 'EmotionRecommendations', 'SearchHistory']) {
    assert.ok(all.findIndex((node) => node.type === type) > firstResult);
  }
  assert.ok(all.findIndex((node) => node.props?.accessibilityLabel === '小説の本を探す') > firstResult);
  assert.equal(positions.length, 1);
  assert.equal(positions[0].y, 0);
  assert.equal(positions[0].animated, false);
  nodes(tree).find((node) => node.props?.accessibilityLabel === '検索する').props.onPress();
  tree = h.render();
  assert.equal(card(tree, 'Owned'), undefined);
  assert.ok(texts(tree).includes('検索中…'));
  await flush();
});

test('search results show detail and add buttons for every book and status for owned books', async () => {
  const h = searchHarness({ shelf: [shelfBook({ reading_status: 'completed', completed_at: at(24) })] });
  let tree = await h.search();
  assert.ok(texts(tree).includes('2026/10/24 読了'));
  assert.equal(card(tree, 'Owned').type, 'View');
  assert.equal(card(tree, 'Owned').props.onPress, undefined);
  detailButton(tree, 'Owned').props.onPress(pressEvent());
  tree = h.render();
  assert.equal(tree.type, 'BookDetailScreen');
  assert.equal(tree.props.bookId, 5);
  tree.props.onBack();
  tree = h.render();
  assert.ok(detailButton(tree, 'New'));
  const additions = nodes(tree).filter((node) => node.props?.accessibilityLabel?.endsWith('を追加する'));
  assert.equal(additions.length, 2);
  assert.equal(additions[0].props.disabled, true);
  assert.equal(additions[1].props.disabled, false);
  assert.equal(additions[0].props.style({ pressed: false })[1].backgroundColor, '#C17AED');
  assert.equal(additions[0].props.children.props.style[1].color, '#FFFFFF');
  assert.ok(texts(tree).includes('タップして本棚に追加'));
});

test('only the add button adds a book, opens detail, and returns to preserved results', async () => {
  const h = searchHarness({ shelf: [] });
  let tree = await h.search();
  assert.equal(card(tree, 'New').props.onPress, undefined);
  nodes(tree).find((node) => node.props?.accessibilityLabel === 'Newを追加する').props.onPress();
  await flush();
  tree = h.render();
  assert.deepEqual([...h.calls], ['g2']);
  assert.equal(tree.type, 'BookDetailScreen');
  assert.equal(tree.props.bookId, 9);
  tree.props.onBack();
  tree = h.render();
  assert.ok(texts(tree).includes('2026/10/25 追加・読書中'));
  detailButton(tree, 'New').props.onPress(pressEvent());
  assert.equal(h.render().props.bookId, 9);
});

test('returning from detail refreshes owned cover preferences in preserved search results', async () => {
  const shelf = [shelfBook()];
  const h = searchHarness({ shelf });
  let tree = await h.search();
  detailButton(tree, 'Owned').props.onPress();
  tree = h.render();
  shelf[0] = shelfBook({ cover_style: { color_mode: 'palette', palette: 7, pattern: 3 } });
  tree.props.onBack();
  h.render();
  await flush();
  tree = h.render();
  const cover = nodes(card(tree, 'Owned')).find((node) => node.type === 'OwnedBookCover');
  assert.equal(cover.props.book.cover_style.palette, 7);
  assert.equal(cover.props.book.cover_style.pattern, 3);
});

test('if the shelf cannot be loaded, search and adding still work without status', async () => {
  const h = searchHarness({ failShelf: true });
  const tree = await h.search();
  assert.ok(detailButton(tree, 'Owned'));
  assert.equal(card(tree, 'Owned').props.onPress, undefined);
});

test('new book detail does not add implicitly, preserves results on back, and allows adding', async () => {
  const h = searchHarness({ shelf: [] });
  let tree = await h.search();
  detailButton(tree, 'New').props.onPress();
  tree = h.render();
  assert.equal(tree.type, 'BookPreviewScreen');
  assert.equal(tree.props.book.google_books_id, 'g2');
  assert.equal(h.calls.length, 0);
  tree.props.onBack();
  tree = h.render();
  assert.ok(detailButton(tree, 'New'));
  detailButton(tree, 'New').props.onPress(pressEvent());
  tree = h.render();
  tree.props.onAdd();
  await flush();
  tree = h.render();
  assert.deepEqual([...h.calls], ['g2']);
  assert.equal(tree.type, 'BookDetailScreen');
  tree.props.onBack();
  tree = h.render();
  assert.equal(tree.type, 'BookPreviewScreen');
  assert.equal(tree.props.owned.id, 9);
  tree.props.onBack();
  assert.ok(detailButton(h.render(), 'New'));
});

test('search actions have 16px separation and at least 48px touch height', async () => {
  const h = searchHarness({ shelf: [] });
  const tree = await h.search();
  const add = nodes(tree).find((node) => node.props?.accessibilityLabel === 'Newを追加する');
  const group = nodes(tree).find((node) => node.type === 'View' && node.props.style?.gap === 16 && node.props.children?.includes(add));
  assert.ok(group);
  assert.equal(add.props.style({ pressed: false })[0].minHeight, 48);
  assert.equal(detailButton(tree, 'New').props.style({ pressed: false })[0].minHeight, 48);
});

test('preview displays metadata, add and back controls without claiming review data exists', () => {
  const { BookPreviewScreen } = compile('src/screens/books/BookPreviewScreen.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { StyleSheet: { create: (value) => value }, ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '../../lib/readingStatus': status,
  });
  let added = false, backed = false;
  const tree = BookPreviewScreen({
    book: { title: 'New', author: null, total_pages: 100 },
    adding: false, message: null, activeRoute: 'search', onNavigate() {},
    onAdd() { added = true; }, onBack() { backed = true; },
  });
  assert.ok(texts(tree).includes('著者不明'));
  assert.ok(texts(tree).includes('100ページ'));
  nodes(tree).find((node) => node.props?.label === '本棚に追加する').props.onPress();
  nodes(tree).find((node) => node.type === 'BackButton').props.onPress();
  assert.equal(added, true);
  assert.equal(backed, true);
});

function detailHarness(iterationResult) {
  const h = hooks();
  const requests = [];
  let backs = 0;
  const targets = [];
  const { BookDetailScreen } = compile('src/screens/books/BookDetailScreen.tsx', {
    react: h.react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': {
      Alert: { alert() {} },
      StyleSheet: { create: (value) => value },
      Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    },
    '../../components/organisms/EmotionAnalysisCard': { EmotionAnalysisCard: 'EmotionAnalysisCard', getEmotionTint: () => '#fff' },
    '../../lib/api': {
      ApiError: Error,
      getBook: async () => shelfBook({ latest_iteration: 2 }),
      getBookmarkGradientSvg: () => new Promise(() => {}),
      getEmotionComparison: () => new Promise(() => {}),
      getBookReviews: () => new Promise(() => {}),
      getIterations: (id) => { requests.push(id); return iterationResult(requests.length); },
    },
    '../../lib/readingStatus': status,
  });
  const render = () => h.render(() => BookDetailScreen({ bookId: 5, onNavigate(target) { targets.push(target); }, onBack() { backs += 1; } }));
  return { requests, targets, render, get backs() { return backs; } };
}

test('detail pencil opens the private book memo, not a metadata editor', async () => {
  const h = detailHarness(async () => []);
  h.render();
  await flush();
  const tree = h.render();
  const pencil = nodes(tree).find((node) => node.props?.accessibilityLabel === '本のメモを開く');
  assert.ok(pencil);
  assert.equal(pencil.props.style.width, 44);
  const palette = nodes(tree).find((node) => node.props?.accessibilityLabel === '表紙をカスタマイズ');
  assert.ok(palette);
  assert.equal(palette.props.style.right, pencil.props.style.right);
  assert.ok(palette.props.style.top >= pencil.props.style.top + pencil.props.style.height);
  assert.equal(palette.props.style.width, 44);
  assert.equal(palette.props.children.props.name, 'color-palette');
  palette.props.onPress();
  const editor = nodes(h.render()).find((node) => node.type === 'BookCoverCustomizer');
  assert.equal(editor.props.open, true);
  editor.props.onOpenChange(false);
  assert.equal(nodes(h.render()).find((node) => node.type === 'BookCoverCustomizer').props.open, false);
  pencil.props.onPress();
  assert.equal(h.targets[0].name, 'book-memo');
  assert.equal(h.targets[0].bookId, 5);
});

test('book detail exposes a working header back arrow even while loading', () => {
  const h = detailHarness(async () => []);
  const tree = h.render();
  assert.equal(tree.props.headerLeading.type, 'BackButton');
  tree.props.headerLeading.props.onPress();
  assert.equal(h.backs, 1);
});

test('search -> add -> detail -> bookmark -> back returns to the same detail, then results', async () => {
  const h = searchHarness({ shelf: [] });
  let tree = await h.search();
  nodes(tree).find((node) => node.props?.accessibilityLabel === 'Newを追加する').props.onPress();
  await flush();
  tree = h.render();
  assert.equal(tree.type, 'BookDetailScreen');
  tree.props.onNavigate({ name: 'bookmark', bookId: 9, iteration: 2, page: 42 });
  tree = h.render();
  assert.equal(tree.type, 'BookmarkScreen');
  assert.equal(tree.props.bookId, 9);
  assert.equal(tree.props.iteration, 2);
  assert.equal(tree.props.initialPage, 42);
  tree.props.onBack();
  tree = h.render();
  assert.equal(tree.type, 'BookDetailScreen');
  assert.equal(tree.props.bookId, 9);
  tree.props.onBack();
  assert.ok(detailButton(h.render(), 'New'));
  assert.equal(h.target, undefined);
});

test('book detail shows the added date and every reading iteration', async () => {
  const h = detailHarness(async () => [
    { iteration_number: 1, status: 'completed', current_page: 200, started_at: at(1), completed_at: at(20) },
    { iteration_number: 2, status: 'reading', current_page: 20, started_at: at(21), completed_at: null },
  ]);
  h.render();
  await flush();
  h.render();
  await flush();
  const lines = texts(h.render());
  assert.ok(lines.includes('読書の記録'));
  assert.ok(lines.includes('2026/10/01 本棚に追加'));
  assert.ok(lines.includes('1回目　2026/10/01〜2026/10/20 読了'));
  assert.ok(lines.includes('2回目　2026/10/21〜 読書中'));
  assert.deepEqual([...h.requests], [5]);
});

test('reading history failure shows an error and retries', async () => {
  const h = detailHarness(async (attempt) => {
    if (attempt === 1) throw new Error('History failed');
    return [{ iteration_number: 1, status: 'reading', current_page: 0, started_at: at(3), completed_at: null }];
  });
  h.render();
  await flush();
  h.render();
  await flush();
  let tree = h.render();
  assert.ok(texts(tree).includes('History failed'));
  nodes(tree).find((node) => node.props?.label === '読書の記録を再試行').props.onPress();
  h.render();
  await flush();
  tree = h.render();
  assert.ok(texts(tree).includes('1回目　2026/10/03〜 読書中'));
});
