const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const book = (id, reading_status = 'completed', latest_iteration = 1) => ({
  id, title: `Book ${id}`, author: 'Author', reading_status, latest_iteration,
});
const iteration = (iteration_number, completed_at, status = 'completed') => ({ iteration_number, completed_at, status });
const date = (month, day) => `2026-${month}-${day}T12:00:00`;
const review = (text, n = 1) => ({ review_text: text, iteration_number: n, page_number: 42 });
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', ...file.split('/')), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Error, Date,
    require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  return exports;
}
function library(api) {
  const reading = load('src/lib/readingBooks.ts', { './api': api });
  return load('src/lib/bookshelf.ts', { './api': api, './readingBooks': reading });
}

test('loads every book page, retains re-reads, searches every iteration, sorts by last completion', async () => {
  const calls = [];
  const lib = library({
    getBooks: async (offset) => {
      calls.push(['books', offset]);
      return offset === 0
        ? Array.from({ length: 100 }, (_, i) => book(i + 1, 'reading'))
        : [book(101, 'reading', 2), book(102), book(103)];
    },
    getIterations: async (id) => {
      calls.push(['iterations', id]);
      if (id === 101) return [iteration(1, date('09', '15')), iteration(2, null, 'reading')];
      return [iteration(1, id === 102 ? date('10', '20') : null)];
    },
    getBookReviews: async (id, n) => {
      calls.push(['reviews', id, n]);
      return [review(n === 1 ? '宇宙の描写' : '再読で発見', n)];
    },
  });
  const entries = await lib.loadCompletedShelf(() => true);
  assert.deepEqual(Array.from(entries, (entry) => entry.book.id), [102, 101, 103]);
  assert.ok(calls.some((call) => call[0] === 'books' && call[1] === 100));
  assert.deepEqual(calls.filter((call) => call[0] === 'iterations').map((call) => call[1]), [101, 102, 103]);
  assert.ok(calls.some((call) => call[0] === 'reviews' && call[1] === 101 && call[2] === 2));
  assert.equal(lib.matchesKeyword(entries[1], '宇宙'), true);
  assert.equal(lib.matchingReview(entries[1], '宇宙').iteration_number, 1);
  assert.equal(lib.shelfMonth(entries[1].completedAt), '2026年9月');
  assert.equal(lib.shelfMonth(entries[2].completedAt), '読了日不明');
});

test('keyword supports title, author, old notes, width/case normalization and AND across fields', () => {
  const lib = library({});
  const entry = { book: { ...book(1), title: 'ＡＢＣの旅', author: '宮沢賢治' }, reviews: [review('宇宙の描写が印象的')] };
  for (const query of ['', 'abc', '宮沢', '宇宙', 'ABC　宇宙']) assert.equal(lib.matchesKeyword(entry, query), true);
  assert.equal(lib.matchesKeyword(entry, '宇宙 海'), false);
  assert.equal(lib.matchingReview(entry, 'abc'), undefined);
  assert.equal(lib.reviewExcerpt('あ'.repeat(90) + '宇宙' + 'い'.repeat(90), '宇宙').includes('宇宙'), true);
});

test('a completed re-read is one card in its latest completion month; invalid dates stay unknown', async () => {
  const lib = library({
    getBooks: async () => [book(1, 'completed', 3), book(2)],
    getIterations: async (id) => id === 1
      ? [iteration(1, date('08', '01')), iteration(2, date('09', '01')), iteration(3, date('10', '01'))]
      : [iteration(1, 'invalid')],
    getBookReviews: async () => [],
  });
  const entries = await lib.loadCompletedShelf(() => true);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].book.id, 1);
  assert.equal(lib.shelfMonth(entries[0].completedAt), '2026年10月');
  assert.equal(entries[1].completedAt, null);
});

test('history or review errors reject rather than returning partial results; unmount stops next requests', async () => {
  let active = true, reviewCalls = 0;
  const api = {
    getBooks: async () => [book(1)],
    getIterations: async () => { active = false; return [iteration(1, null)]; },
    getBookReviews: async () => { reviewCalls++; return []; },
  };
  assert.equal(await library(api).loadCompletedShelf(() => active), null);
  assert.equal(reviewCalls, 0);
  await assert.rejects(library({ ...api, getIterations: async () => { throw new Error('history failed'); } }).loadCompletedShelf(() => true), /history failed/);
  await assert.rejects(library({
    ...api, getIterations: async () => [iteration(1, null)],
    getBookReviews: async () => { throw new Error('reviews failed'); },
  }).loadCompletedShelf(() => true), /reviews failed/);
});

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children, node.props?.headerAction].flat(Infinity).flatMap(nodes)];
}
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => [node.props.children].flat().join('')).join('\n');
function harness() {
  const state = [], effects = [], requests = [];
  let cursor, scheduled, target;
  const lib = library({});
  const { BookshelfScreen } = load('src/screens/main/BookshelfScreen.tsx', {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!effects[index] || deps.some((value, i) => effects[index].deps[i] !== value)) {
          scheduled.push(() => { effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; });
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: (value) => value }, Pressable: 'Pressable', View: 'View', Text: 'Text', ScrollView: 'ScrollView' },
    '../../lib/bookshelf': { ...lib, loadCompletedShelf: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
    '../../lib/readingStatus': { formatDate: (value) => value ? value.slice(0, 10) : null },
  });
  return {
    requests, get target() { return target; },
    render() {
      cursor = 0; scheduled = [];
      const tree = BookshelfScreen({ onNavigate: (value) => { target = value; } });
      scheduled.forEach((effect) => effect());
      return tree;
    },
  };
}
const entry = (id, month, reviews = []) => ({ book: book(id), completedAt: date(month, '20'), reviews });
test('UI groups months, searches old notes with excerpt, keeps detail and plus targets', async () => {
  const h = harness();
  assert.ok(text(h.render()).includes('読み込んでいます'));
  h.requests[0].resolve([entry(2, '10'), { ...entry(1, '09', [review('宇宙が美しい')]), book: book(1, 'reading', 2) }]);
  await flush();
  let tree = h.render();
  assert.ok(text(tree).includes('2026年10月'));
  assert.ok(text(tree).includes('2回目を読書中'));
  nodes(tree).find((node) => node.type === 'ShadowInput').props.onChangeText('宇宙');
  tree = h.render();
  assert.ok(!text(tree).includes('2026年10月'));
  assert.ok(text(tree).includes('1回目・p.42：宇宙が美しい'));
  nodes(tree).find((node) => node.props?.accessibilityLabel === 'Book 1の詳細を見る').props.onPress();
  assert.equal(h.target.bookId, 1);
  tree.props.headerAction.props.onPress();
  assert.equal(h.target, 'search');
  nodes(tree).find((node) => node.type === 'ShadowInput').props.onChangeText('missing');
  assert.ok(text(h.render()).includes('キーワードに一致する本はありません'));
});

test('empty shelf differs from no matches, and failure exposes retry without partial books', async () => {
  const h = harness();
  h.render();
  h.requests[0].reject(new Error('取得失敗'));
  await flush();
  let tree = h.render();
  assert.ok(text(tree).includes('取得失敗'));
  nodes(tree).find((node) => node.props?.label === '再試行').props.onPress();
  h.render();
  h.requests[1].resolve([]);
  await flush();
  tree = h.render();
  assert.ok(text(tree).includes('読み終えた本はまだありません'));
  nodes(tree).find((node) => node.props?.label === '今読んでる本へ').props.onPress();
  assert.equal(h.target, 'reading');
});
