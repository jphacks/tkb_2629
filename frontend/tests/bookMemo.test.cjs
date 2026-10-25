const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const native = { StyleSheet: { create: (x) => x }, Platform: { OS: 'web' }, Text: 'Text', View: 'View' };
const nodes = (node) => !node || typeof node !== 'object' ? [] :
  [node, ...[node.props?.children, node.props?.headerLeading].flat(Infinity).flatMap(nodes)];
const button = (tree, label) => nodes(tree).find((node) => node.props?.label === label);
const input = (tree) => nodes(tree).find((node) => node.type === 'ShadowInput');
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).join('\n');
function load(file, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, process, Error, SyntaxError, __DEV__: false,
    require: (name) => deps[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  return exports;
}
function harness() {
  const state = [], effects = [], requests = [];
  let cursor = 0, scheduled = [], target, backs = 0;
  const request = (kind, args) => new Promise((resolve, reject) => requests.push({ kind, args, resolve, reject }));
  const { BookMemoScreen } = load('src/screens/books/BookMemoScreen.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
      },
      useRef(initial) { return state[cursor++] ??= { current: initial }; },
      useEffect(effect, deps) {
        const i = cursor++, prior = effects[i];
        if (!prior || deps.some((x, j) => x !== prior.deps[j])) scheduled.push(() => {
          prior?.cleanup?.();
          effects[i] = { deps, cleanup: effect() };
        });
      },
    },
    '../../lib/api': { BOOK_MEMO_LIMIT: 10000,
      getBookMemo: (...args) => request('get', args), saveBookMemo: (...args) => request('put', args) },
  });
  return {
    requests, get target() { return target; }, get backs() { return backs; },
    render(bookId = 10, withBack = false) {
      cursor = 0; scheduled = [];
      const tree = BookMemoScreen({ bookId, onNavigate: (value) => { target = value; },
        onBack: withBack ? () => { backs += 1; } : undefined });
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}
async function ready(h, content = '') {
  h.render();
  h.requests[0].resolve({ book_id: 10, content });
  await flush();
  return h.render();
}

test('memo loading failure blocks editing, retries and preserves text and punctuation exactly', async () => {
  const h = harness();
  assert.equal(input(h.render()), undefined);
  h.requests[0].reject(new Error('offline'));
  await flush();
  let tree = h.render();
  assert.match(text(tree), /offline/);
  assert.equal(input(tree), undefined);
  button(tree, '読み込みを再試行').props.onPress();
  h.render();
  h.requests[1].resolve({ content: ' メモ。\n読点、😀 ' });
  await flush();
  tree = h.render();
  assert.equal(input(tree).props.value, ' メモ。\n読点、😀 ');
  assert.equal(button(tree, 'メモを保存').props.disabled, true);
});

test('save is locked against rapid presses; failures retain edits and retry, empty save deletes', async () => {
  const h = harness();
  let tree = await ready(h, 'old');
  input(tree).props.onChangeText('new。\n😀');
  tree = h.render();
  const save = button(tree, 'メモを保存').props.onPress;
  save(); save();
  assert.equal(h.requests.length, 2);
  tree = h.render();
  assert.equal(input(tree).props.editable, false);
  assert.equal(tree.props.showNavigation, false);
  h.requests[1].reject(new Error('save failed'));
  await flush();
  tree = h.render();
  assert.equal(input(tree).props.value, 'new。\n😀');
  assert.match(text(tree), /save failed/);
  button(tree, 'メモを保存').props.onPress();
  h.requests[2].resolve({ content: 'new。\n😀' });
  await flush();
  tree = h.render();
  assert.match(text(tree), /メモを保存しました/);
  assert.equal(button(tree, 'メモを保存').props.disabled, true);
  input(tree).props.onChangeText('');
  button(h.render(), 'メモを保存').props.onPress();
  assert.equal(h.requests[3].args[1], '');
  h.requests[3].resolve({ content: '' });
  await flush();
  assert.match(text(h.render()), /メモを削除しました/);
});

test('back uses caller or detail fallback and confirms discarding unsaved edits', async () => {
  const h = harness();
  let tree = await ready(h);
  input(tree).props.onChangeText('unsaved');
  tree = h.render(10, true);
  nodes(tree).find((node) => node.type === 'BackButton').props.onPress();
  assert.equal(h.backs, 0);
  tree = h.render(10, true);
  button(tree, '編集を続ける').props.onPress();
  assert.equal(button(h.render(), '保存せずに戻る'), undefined);
  nodes(h.render(10, true)).find((node) => node.type === 'BackButton').props.onPress();
  button(h.render(10, true), '保存せずに戻る').props.onPress();
  assert.equal(h.backs, 1);
  const clean = harness();
  tree = await ready(clean);
  nodes(tree).find((node) => node.type === 'BackButton').props.onPress();
  assert.equal(clean.target.name, 'book-detail');
  assert.equal(clean.target.bookId, 10);
});

test('Unicode limit counts codepoints and stale load or save responses cannot cross books', async () => {
  const h = harness();
  let tree = await ready(h);
  input(tree).props.onChangeText('😀'.repeat(10001));
  button(h.render(), 'メモを保存').props.onPress();
  assert.equal(h.requests.length, 1);
  assert.match(text(h.render()), /10,000文字以内/);
  input(h.render()).props.onChangeText('😀'.repeat(10000));
  button(h.render(), 'メモを保存').props.onPress();
  h.render(20);
  h.requests[2].resolve({ content: 'book twenty' });
  h.requests[1].resolve({ content: 'late old save' });
  await flush();
  assert.equal(input(h.render(20)).props.value, 'book twenty');
  h.unmount();
  const pending = harness();
  pending.render(10); pending.render(20);
  pending.requests[1].resolve({ content: 'new book' });
  pending.requests[0].resolve({ content: 'old book' });
  await flush();
  assert.equal(input(pending.render(20)).props.value, 'new book');
});

test('memo API authenticates, validates exact response and preserves payload data', async () => {
  const calls = [];
  let payload = { book_id: 10, content: ' 。、😀\n ' }, status = 200;
  const api = load('src/lib/api.ts', { './auth': { authenticatedFetch: async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  } } });
  await api.getBookMemo(10);
  assert.match(calls[0][0], /\/books\/10\/memo$/);
  await api.saveBookMemo(10, payload.content);
  assert.equal(calls[1][1].method, 'PUT');
  assert.equal(JSON.parse(calls[1][1].body).content, payload.content);
  for (const invalid of [null, {}, { book_id: 11, content: '' }, { book_id: 10, content: null },
    { book_id: 10, content: 'a'.repeat(10001) }]) {
    payload = invalid;
    await assert.rejects(api.getBookMemo(10), /応答形式/);
  }
  payload = { book_id: 10, content: 'different' };
  await assert.rejects(api.saveBookMemo(10, 'sent'), /応答形式/);
  await assert.rejects(api.saveBookMemo(10, '😀'.repeat(10001)), /10,000文字/);
  status = 403; payload = { detail: 'denied' };
  await assert.rejects(api.getBookMemo(10), /denied/);
});

test('generated covers vary by book, stay consistent across sizes and omit fake publishers', () => {
  const { BookCover } = load('src/components/molecules/BookCover.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
  });
  const signatures = new Set();
  const patterns = new Set();
  for (let i = 0; i < 100; i += 1) {
    const props = { title: `本 ${i}`, author: '著者' };
    const cover = BookCover(props);
    assert.doesNotMatch(text(cover), /出版社/);
    assert.equal(text(cover), `${props.title}\n著者`);
    assert.equal(cover.props.style[1].backgroundColor, BookCover({ ...props, large: true }).props.style[1].backgroundColor);
    assert.equal(cover.props.style[1].backgroundColor, BookCover({ ...props, grid: true }).props.style[1].backgroundColor);
    signatures.add(JSON.stringify(cover));
    const decoration = cover.props.children[0];
    patterns.add(JSON.stringify(nodes(decoration).map((node) =>
      [node.props?.style].flat().map((style) => style && Object.fromEntries(
        Object.entries(style).filter(([key]) => !['backgroundColor', 'borderColor'].includes(key)),
      )))));
  }
  assert.equal(signatures.size, 100);
  assert.equal(patterns.size, 4);
  const colors = new Set(Array.from({ length: 100 }, (_, i) =>
    BookCover({ title: `本 ${i}`, author: '著者' }).props.style[1].backgroundColor));
  assert.equal(colors.size, 8);
  assert.equal(BookCover({ color: '#AABBCC' }).props.style[1].backgroundColor, '#AABBCC');
});

test('bookmark add icon uses a Web image without calling native-only asset resolution', () => {
  const source = { uri: 'bookmark.svg' };
  const { BookmarkAddIcon } = load('src/components/atoms/BookmarkAddIcon.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../assets/addBookmark.svg': source,
    'react-native': { Platform: { OS: 'web' }, Image: 'Image' },
  });
  const icon = BookmarkAddIcon({ width: 35, height: 38 });
  assert.equal(icon.type, 'Image');
  assert.equal(icon.props.source, source);
  const nativeIcon = load('src/components/atoms/BookmarkAddIcon.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, '../../assets/addBookmark.svg': source,
    'react-native': { Platform: { OS: 'ios' }, Image: { resolveAssetSource: () => source } },
  }).BookmarkAddIcon({ width: 35, height: 38 });
  assert.equal(nativeIcon.type, 'SvgUri');
  assert.equal(nativeIcon.props.uri, source.uri);
});
