const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const book = (id, reading_status = 'reading', latest_iteration = 1) => ({
  id, title: `Book ${id}`, author: null, total_pages: 200, current_page: 20,
  latest_iteration, reading_status,
});
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const stub = new Proxy({}, { get: (_, key) => String(key) });

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children, node.props?.headerAction].flat(Infinity).flatMap(nodes)];
}

function compile(relative, dependencies, dev = false) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', ...relative.split('/')), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Error, Promise, __DEV__: dev, require: (name) => dependencies[name] ?? stub });
  return exports;
}

function harness(file, component, dev = false) {
  const state = [], effects = [], requests = [];
  let cursor = 0, scheduled = [], target;
  const loader = compile('src/lib/readingBooks.ts', {
    './api': {
      getBooks(offset) {
        return new Promise((resolve, reject) => { requests.push({ offset, resolve, reject }); });
      },
    },
  });
  const exports = compile(file, {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => {
          state[index] = typeof value === 'function' ? value(state[index]) : value;
        }];
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
    'react/jsx-runtime': jsxRuntime,
    'react-native': {
      StyleSheet: { create: (value) => value },
      Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    },
    '../../lib/readingBooks': loader,
    '../../lib/readingStatus': compile('src/lib/readingStatus.ts', {}),
    '../../components/organisms/BookmarkListCard': { myBookmarks: [] },
    '../../components/organisms/EmotionAnalysisCard': { getEmotionTint: () => '#fff' },
  }, dev);
  return {
    requests,
    get target() { return target; },
    render() {
      cursor = 0;
      scheduled = [];
      const tree = exports[component]({ onNavigate: (value) => { target = value; } });
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

const reading = () => harness('src/screens/main/ReadingScreen.tsx', 'ReadingScreen');
const home = () => harness('src/screens/main/HomeScreen.tsx', 'HomeScreen');
const cards = (tree) => nodes(tree).filter((node) => node.type === 'ReadingBookCard');
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).flat().join('\n');
const button = (tree, label) => nodes(tree).find((node) => node.props?.label === label || node.props?.accessibilityLabel === label);

test('the card shows real book fields and separates detail and bookmark actions', () => {
  const { ReadingBookCard } = compile('src/components/molecules/ReadingBookCard.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { StyleSheet: { create: (value) => value }, Pressable: 'Pressable', Text: 'Text', View: 'View' },
  });
  const calls = [];
  const tree = ReadingBookCard({
    book: { ...book(3), current_page: 42, total_pages: 180 },
    onBookmark: () => calls.push('bookmark'),
    onPress: () => calls.push('detail'),
  });
  assert.ok(text(tree).includes('Book 3'));
  assert.ok(text(tree).includes('著者不明'));
  const progress = nodes(tree).find((node) => node.type === 'ReadingProgress');
  assert.equal(progress.props.currentPage, 42);
  assert.equal(progress.props.totalPages, 180);
  tree.props.onPress();
  button(tree, 'Book 3にしおりを追加').props.onPress();
  assert.deepEqual(calls, ['detail', 'bookmark']);
});

test('only reading books are listed; card opens detail and its button opens the bookmark input', async () => {
  const h = reading();
  assert.ok(text(h.render()).includes('読み込んでいます'));
  h.requests[0].resolve([book(4, 'reading', 2), book(5, 'completed'), book(6)]);
  await flush();
  const tree = h.render();
  assert.deepEqual(cards(tree).map((card) => card.props.book.id), [4, 6]);
  cards(tree)[0].props.onPress();
  assert.deepEqual({ ...h.target }, { name: 'book-detail', bookId: 4 });
  cards(tree)[0].props.onBookmark();
  assert.deepEqual({ ...h.target }, { name: 'bookmark', bookId: 4, iteration: 2 });
  button(tree, '本を追加').props.onPress();
  assert.equal(h.target, 'search');
});

test('all pages are loaded so reading books beyond the first 100 are included', async () => {
  const h = reading();
  h.render();
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id + 1, 'completed')));
  await flush();
  assert.equal(h.requests[1].offset, 100);
  assert.equal(cards(h.render()).length, 0);
  h.requests[1].resolve([book(101)]);
  await flush();
  assert.deepEqual(cards(h.render()).map((card) => card.props.book.id), [101]);
});

test('no reading books guides to adding a book', async () => {
  const h = reading();
  h.render();
  h.requests[0].resolve([book(1, 'completed')]);
  await flush();
  const tree = h.render();
  assert.ok(text(tree).includes('読書中の本はありません'));
  button(tree, '本を追加する').props.onPress();
  assert.equal(h.target, 'search');
});

test('failure shows the error and retries from the first page', async () => {
  const h = reading();
  h.render();
  h.requests[0].reject(new Error('Connection failed'));
  await flush();
  let tree = h.render();
  assert.ok(text(tree).includes('Connection failed'));
  assert.equal(cards(tree).length, 0);
  button(tree, '再試行').props.onPress();
  h.render();
  assert.equal(h.requests[1].offset, 0);
  h.requests[1].resolve([book(9)]);
  await flush();
  tree = h.render();
  assert.equal(button(tree, '再試行'), undefined);
  assert.equal(cards(tree).length, 1);
});

test('unmounting stops pagination after an in-flight request', async () => {
  const h = reading();
  h.render();
  h.unmount();
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id)));
  await flush();
  assert.equal(h.requests.length, 1);
});

const fab = (tree) => nodes(tree).find((node) => node.type === 'FloatingActionButton');

test('development preview switches tower counts without changing server data and restores real totals', async () => {
  const h = harness('src/screens/main/HomeScreen.tsx', 'HomeScreen', true);
  h.render();
  h.requests[0].resolve([book(1, 'completed', 3)]);
  await flush();
  for (const count of [0, 1, 10, 100, 1000]) {
    button(h.render(), `${count}冊のタワーを確認`).props.onPress();
    const tree = h.render();
    assert.equal(nodes(tree).find((node) => node.type === 'BookStack').props.count, count);
    assert.equal(button(tree, `${count}冊のタワーを確認`).props.accessibilityState.selected, true);
    assert.match(text(tree), /表示確認中・実データは変更されません/);
    assert.equal(h.requests.length, 1);
  }
  button(h.render(), '実際の冊数に戻す').props.onPress();
  assert.equal(nodes(h.render()).find((node) => node.type === 'BookStack').props.count, 3);
  assert.doesNotMatch(text(h.render()), /表示確認中/);
  const production = home();
  const tree = production.render();
  assert.equal(button(tree, '100冊のタワーを確認'), undefined);
  assert.doesNotMatch(text(tree), /開発用|表示確認/);
});

test('home bookmark button opens the input directly when exactly one book is being read', async () => {
  const h = home();
  fab(h.render()).props.onPress();
  h.requests[1].resolve([book(3, 'reading', 2), book(4, 'completed')]);
  await flush();
  assert.deepEqual({ ...h.target }, { name: 'bookmark', bookId: 3, iteration: 2 });
});

test('home bookmark button opens the reading list for zero or several books and on failure, ignoring double taps', async () => {
  for (const settle of [
    (request) => request.resolve([]),
    (request) => request.resolve([book(1), book(2)]),
    (request) => request.reject(new Error('offline')),
  ]) {
    const h = home();
    const button = fab(h.render());
    button.props.onPress();
    fab(h.render()).props.onPress();
    assert.equal(h.requests.length, 2);
    settle(h.requests[1]);
    await flush();
    assert.equal(h.target, 'reading');
  }
});

test('home uses all shelf pages and counts completed rereads during an ongoing reread', async () => {
  const h = home();
  let tree = h.render();
  assert.equal(nodes(tree).find((node) => node.type === 'BookStack'), undefined);
  assert.match(text(tree), /読了冊数を読み込み中/);
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id, 'completed', 2)));
  await flush();
  assert.equal(h.requests[1].offset, 100);
  h.requests[1].resolve([book(101, 'reading', 4), book(102)]);
  await flush();
  tree = h.render();
  assert.equal(nodes(tree).find((node) => node.type === 'BookStack').props.count, 203);
  assert.ok(nodes(tree).some((node) => node.type === 'ScrollView'));
});

test('home count failures never display zero and retry starts over; empty shelf is truly zero', async () => {
  const h = home();
  h.render();
  h.requests[0].reject(new Error('offline'));
  await flush();
  let tree = h.render();
  assert.match(text(tree), /offline/);
  assert.equal(nodes(tree).find((node) => node.type === 'BookStack'), undefined);
  button(tree, '読了冊数を再読み込み').props.onPress();
  h.render();
  assert.equal(h.requests[1].offset, 0);
  h.requests[1].resolve([]);
  await flush();
  tree = h.render();
  assert.equal(nodes(tree).find((node) => node.type === 'BookStack').props.count, 0);
});

test('home rejects malformed reading history instead of inventing completed counts', async () => {
  for (const value of [book(1, 'unknown'), book(1, 'reading', 0), book(1, 'completed', 1.5)]) {
    const h = home();
    h.render(); h.requests[0].resolve([value]); await flush();
    assert.match(text(h.render()), /読了冊数を確認できません/);
    assert.equal(nodes(h.render()).find((node) => node.type === 'BookStack'), undefined);
  }
});

test('leaving home ignores pending statistics, stops pagination and reopening fetches new totals', async () => {
  const h = home();
  h.render(); h.unmount();
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id, 'completed')));
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(nodes(h.render()).find((node) => node.type === 'BookStack'), undefined);
  const reopened = home();
  reopened.render(); reopened.requests[0].resolve([book(1, 'completed', 3)]); await flush();
  assert.equal(nodes(reopened.render()).find((node) => node.type === 'BookStack').props.count, 3);
});

test('tower grows monotonically, stays bounded and keeps exact large counts readable', () => {
  const { BookStack, bookStackLayers, bookTowerGeometry } = compile('src/components/molecules/BookStack.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View' },
  });
  for (let count = 0; count <= 10000; count++) {
    assert.ok(bookStackLayers(count) <= 32);
    assert.ok(bookStackLayers(count) >= bookStackLayers(Math.max(0, count - 1)));
  }
  assert.equal(bookStackLayers(0), 0);
  assert.ok(bookStackLayers(100) > bookStackLayers(10));
  assert.ok(bookStackLayers(1000) > bookStackLayers(100));
  for (const count of [0, 1, 12, 100, 1000, 1000000]) {
    const tree = BookStack({ count });
    assert.equal(tree.props.accessibilityLabel, `読んだ本 ${count}冊、再読を含む`);
    const books = nodes(tree).filter((node) => node.props?.id?.startsWith('tower-'));
    assert.equal(books.length, bookStackLayers(count));
    const tower = nodes(tree).find((node) => node.props?.style?.height === 300);
    for (const column of [0, 1, 2, 3]) {
      const geometry = bookTowerGeometry(count, column);
      geometry.forEach((item, index) => {
        assert.ok(item.bottom - item.thickness - 8 >= 0);
        assert.ok(item.left >= 0 && item.left + item.width + 12 <= 160);
        if (index === 0) assert.equal(item.bottom, tower.props.style.height);
        else assert.equal(item.bottom, geometry[index - 1].bottom - geometry[index - 1].thickness);
        const supported = geometry.slice(index);
        const weight = supported.reduce((sum, book) => sum + book.width * book.thickness, 0);
        const center = supported.reduce((sum, book) =>
          sum + (book.left + book.width / 2) * book.width * book.thickness, 0) / weight;
        assert.ok(center > item.left && center < item.left + item.width);
      });
      if (geometry.length > 2) {
        assert.ok(new Set(geometry.map((item) => item.thickness)).size > 1);
        assert.ok(new Set(geometry.map((item) => item.width)).size > 1);
      }
    }
    const number = nodes(tree).find((node) => node.props?.adjustsFontSizeToFit);
    assert.equal(number.props.numberOfLines, 1);
    assert.ok(text(tree).includes(count.toLocaleString('ja-JP')));
  }
  const front = bookTowerGeometry(100, 0);
  assert.ok(front.some((item, index) => index > 0 && item.width > front[index - 1].width));
  assert.equal(bookTowerGeometry(10, 2).length, 0);
  assert.ok(bookTowerGeometry(100, 2).length > 0);
  const largeTower = BookStack({ count: 1000 });
  const rearColumns = nodes(largeTower).filter((node) =>
    node.props?.style?.[1]?.height === 216);
  assert.equal(rearColumns.length, 2);
  assert.ok(rearColumns.every((node) => node.props.style[1].bottom === 30));
});
