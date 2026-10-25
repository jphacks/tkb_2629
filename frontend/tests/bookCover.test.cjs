const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const native = { StyleSheet: { create: (x) => x }, Text: 'Text', View: 'View', Pressable: 'Pressable' };
const nodes = (node) => !node || typeof node !== 'object' ? [] :
  [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const button = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label || node.props?.label === label);
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).join('\n');
const AUTO = { color_mode: 'auto', palette: null, pattern: null };
function load(file, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, process, Error, SyntaxError, __DEV__: false,
    require: (name) => deps[name] ?? new Proxy({}, { get: (_, key) => String(key) }) });
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
      useRef(initial) { return state[cursor++] ??= { current: initial }; },
      useEffect(effect, deps) {
        const i = cursor++, prior = effects[i];
        if (!prior || deps.some((x, j) => x !== prior.deps[j])) scheduled.push(() => {
          prior?.cleanup?.();
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
const runtime = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native };
const covers = load('src/components/molecules/BookCover.tsx', runtime);
const book = { id: 10, title: '星の旅', author: '著者', cover_style: AUTO };
const summary = {
  mine: { review_count: 2, color_code: '#102030' },
  others: { review_count: 1, color_code: '#BBDDFF' },
};

test('all eight palettes and four patterns are selectable with readable dynamic text', () => {
  assert.equal(covers.coverPalettes.length, 8);
  assert.equal(covers.coverPatterns.length, 4);
  for (let paletteIndex = 0; paletteIndex < 8; paletteIndex += 1) {
    for (let patternIndex = 0; patternIndex < 4; patternIndex += 1) {
      const tree = covers.BookCover({ title: 'same book', paletteIndex, patternIndex });
      assert.equal(tree.props.style[1].backgroundColor, covers.coverPalettes[paletteIndex].base);
      assert.equal(JSON.stringify(tree), JSON.stringify(covers.BookCover({ title: 'same book', paletteIndex, patternIndex })));
    }
  }
  assert.equal(covers.coverTextColor('#000000'), '#FFFFFF');
  assert.equal(covers.coverTextColor('#FFFFFF'), '#000000');
  assert.equal(covers.coverTextColor('#C17AED'), '#000000');
});

test('owned covers use private settings and latest emotion colors, including empty, errors and retry', async () => {
  const h = hooks(), requests = [];
  const { OwnedBookCover } = load('src/components/molecules/OwnedBookCover.tsx', {
    ...runtime, react: h.react, '../../lib/api': {
      AUTO_COVER: AUTO,
      getEmotionComparison: (id) => new Promise((resolve, reject) => requests.push({ id, resolve, reject })),
    },
  });
  let current = { ...book, cover_style: { color_mode: 'palette', palette: 7, pattern: 3 } };
  const render = (extra = {}) => h.render(() => OwnedBookCover({ book: current, ...extra }));
  let tree = render();
  let cover = nodes(tree).find((node) => node.type === 'BookCover');
  assert.equal(cover.props.paletteIndex, 7);
  assert.equal(cover.props.patternIndex, 3);
  assert.equal(requests.length, 0);
  current = { ...book, cover_style: { color_mode: 'mine', palette: null, pattern: 1 } };
  render();
  assert.match(text(render()), /読込中/);
  requests[0].resolve(summary);
  await flush();
  assert.equal(nodes(render()).find((node) => node.type === 'BookCover').props.color, '#102030');
  const changed = { ...summary, mine: { review_count: 3, color_code: '#FF7788' } };
  assert.equal(nodes(render({ summary: changed })).find((node) => node.type === 'BookCover').props.color, '#FF7788');
  current = { ...current, cover_style: { ...current.cover_style, color_mode: 'others' } };
  assert.equal(nodes(render({ summary })).find((node) => node.type === 'BookCover').props.color, '#BBDDFF');
  assert.match(text(render({ summary: { ...summary, others: { review_count: 0, color_code: '#000000' } } })), /感情未記録/);
  render();
  requests.at(-1).reject(new Error('offline'));
  await flush();
  tree = render();
  assert.match(text(tree), /offline/);
  let stopped = false;
  button(tree, '「星の旅」の表紙の感情色を再試行').props.onPress({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  render();
  requests.at(-1).resolve(summary);
  await flush();
  assert.equal(nodes(render()).find((node) => node.type === 'BookCover').props.color, '#BBDDFF');
  current = { ...current, id: 20 };
  render();
  h.unmount();
  requests.at(-1).resolve(changed);
  await flush();
  assert.match(text(render()), /読込中/);
});

function customizerHarness(initialSummary = summary) {
  const h = hooks(), requests = [], saved = [];
  let current = book, emotions = initialSummary, open = false;
  const { BookCoverCustomizer } = load('src/components/organisms/BookCoverCustomizer.tsx', {
    ...runtime, react: h.react, '../molecules/BookCover': covers,
    '../../lib/api': { AUTO_COVER: AUTO, saveBookCover: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })) },
  });
  return {
    requests, saved,
    setBook(value) { current = value; },
    setSummary(value) { emotions = value; },
    open() { open = true; this.render(); },
    render() {
      return h.render(() => BookCoverCustomizer({ book: current, summary: emotions, emotionError: null,
        open, onOpenChange(value) { open = value; },
        onRetryEmotions() {}, onSaved(style) { saved.push(style); current = { ...current, cover_style: style }; } }));
    },
    unmount: h.unmount,
  };
}

test('editor previews all options, saves source not snapshot, locks saves and supports cancel and reset', async () => {
  const h = customizerHarness();
  h.open();
  let tree = h.render();
  for (const palette of covers.coverPalettes) assert.ok(button(tree, palette.name));
  for (const pattern of covers.coverPatterns) assert.ok(button(tree, pattern));
  button(tree, '自分の感情').props.onPress();
  button(h.render(), 'ダイヤ').props.onPress();
  tree = h.render();
  const preview = nodes(tree).find((node) => node.type === 'OwnedBookCover');
  assert.equal(preview.props.book.cover_style.color_mode, 'mine');
  assert.equal(preview.props.book.cover_style.pattern, 3);
  const save = button(tree, '表紙を保存').props.onPress;
  save(); save();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0].args)), [10, { color_mode: 'mine', palette: null, pattern: 3 }]);
  h.requests[0].reject(new Error('save error'));
  await flush();
  assert.match(text(h.render()), /save error/);
  assert.equal(button(h.render(), '自分の感情').props.accessibilityState.selected, true);
  button(h.render(), '表紙を保存').props.onPress();
  h.requests[1].resolve(h.requests[1].args[1]);
  await flush();
  assert.equal(h.saved.length, 1);
  assert.match(text(h.render()), /表紙を保存しました/);
  h.open();
  button(h.render(), '自動に戻す').props.onPress();
  button(h.render(), '表紙を保存').props.onPress();
  h.requests[2].resolve(AUTO);
  await flush();
  assert.equal(h.saved[1].color_mode, 'auto');
  assert.equal(h.saved[1].pattern, null);
  h.open();
  button(h.render(), 'キャンセル').props.onPress();
  assert.equal(button(h.render(), '表紙を保存'), undefined);
});

test('missing emotion data disables choices and old-book save cannot affect another book', async () => {
  const h = customizerHarness({ mine: { review_count: 0 }, others: { review_count: 0 } });
  h.open();
  let tree = h.render();
  assert.equal(button(tree, '自分の感情').props.disabled, true);
  assert.equal(button(tree, 'みんなの感情').props.disabled, true);
  assert.match(text(tree), /解析済みのしおりがありません/);
  button(tree, 'ブルー').props.onPress();
  button(h.render(), '表紙を保存').props.onPress();
  h.setBook({ ...book, id: 20 });
  h.render();
  h.requests[0].resolve(h.requests[0].args[1]);
  await flush();
  assert.equal(h.saved.length, 0);
  h.unmount();
});

test('cover API validates selections and server response without silently substituting defaults', async () => {
  let payload = { color_mode: 'palette', palette: 7, pattern: 3 }, fail = false;
  const calls = [];
  const api = load('src/lib/api.ts', { './auth': { authenticatedFetch: async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(fail ? { detail: 'no access' } : payload),
      { status: fail ? 403 : 200, headers: { 'Content-Type': 'application/json' } });
  } } });
  await api.saveBookCover(10, payload);
  assert.match(calls[0][0], /\/books\/10\/cover$/);
  assert.deepEqual(JSON.parse(calls[0][1].body), payload);
  for (const invalid of [null, {}, { color_mode: 'palette', palette: 8, pattern: 0 },
    { color_mode: ['auto'], palette: null, pattern: null },
    { color_mode: 'mine', palette: 1, pattern: null }, { color_mode: 'auto', palette: null, pattern: 4 }]) {
    assert.equal(api.isCoverStyle(invalid), false);
  }
  const valid = { ...payload };
  payload = { ...payload, palette: 1 };
  await assert.rejects(api.saveBookCover(10, valid), /応答形式/);
  payload = null;
  await assert.rejects(api.saveBookCover(10, valid), /応答形式/);
  fail = true;
  await assert.rejects(api.saveBookCover(10, valid), /no access/);
});

test('invalid cover data from book detail or shelf fails explicitly instead of crashing the renderer', async () => {
  let payload = { ...book, cover_style: { color_mode: 'palette', palette: 20, pattern: 0 } };
  const api = load('src/lib/api.ts', { './auth': { authenticatedFetch: async () =>
    new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }),
  } });
  await assert.rejects(api.getBook(10), /表紙の応答形式/);
  payload = { items: [payload] };
  await assert.rejects(api.getBooks(), /表紙の応答形式/);
  payload = { ...book, cover_style: null };
  assert.equal((await api.getBook(10)).cover_style, null);
});
