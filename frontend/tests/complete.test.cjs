const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const stub = new Proxy({}, { get: (_, key) => String(key) });
const book = (overrides = {}) => ({
  id: 7, title: 'Book 7', author: null, total_pages: 200, current_page: 120,
  latest_iteration: 2, reading_status: 'reading', ...overrides,
});

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = (node) => [node?.props?.children].flat(Infinity)
  .map((child) => (child && typeof child === 'object' ? text(child) : child ?? '')).join('');
const button = (tree, label) => nodes(tree).find((node) => node.type === 'ActionButton' && node.props.label === label);
const alerts = (tree) => nodes(tree).filter((node) => node.props?.accessibilityRole === 'alert').map(text);

function compile(relative, dependencies, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', ...relative.split('/')), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Error, Promise, require: (name) => dependencies[name] ?? stub, ...globals });
  return exports;
}

test('progress is shown on one line as pages and percent read', () => {
  const { ReadingProgress } = compile('src/components/molecules/ReadingProgress.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-native': { StyleSheet: { create: (value) => value }, Text: 'Text', View: 'View' },
  });
  const tree = ReadingProgress({ currentPage: 42, totalPages: 180 });
  const lines = tree.props.children.filter((node) => node?.type === 'Text').map(text);
  assert.deepEqual([...lines], ['42 / 180 ページ（23% 読了）']);
  assert.equal(text(ReadingProgress({ currentPage: 0, totalPages: 0 }).props.children[0]), '0 / 0 ページ（0% 読了）');
});

test('completeIteration posts to the complete endpoint and surfaces API errors', async () => {
  const calls = [];
  let response;
  const api = compile('src/lib/api.ts', {}, {
    __DEV__: false,
    process: { env: { EXPO_PUBLIC_API_URL: 'http://api' } },
    fetch: async (url, init) => { calls.push([url, init?.method]); return response; },
  });
  response = new Response('{"iteration_number":2}', { status: 200, headers: { 'content-type': 'application/json' } });
  await api.completeIteration(7, 2);
  assert.deepEqual(calls, [['http://api/books/7/iterations/2/complete', 'POST']]);
  response = new Response('{"detail":"Reading iteration is already completed"}', { status: 409, headers: { 'content-type': 'application/json' } });
  await assert.rejects(api.completeIteration(7, 2), (error) => error.status === 409);
});

function detailHarness() {
  const state = [], effects = [], requests = [], dialogs = [];
  let cursor = 0, scheduled = [];
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const pending = (kind, args) => new Promise((resolve, reject) => { requests.push({ kind, args, resolve, reject }); });
  const { BookDetailScreen } = compile('src/screens/books/BookDetailScreen.tsx', {
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
      Alert: { alert: (...args) => dialogs.push(args) },
      StyleSheet: { create: (value) => value },
      Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    },
    '../../components/organisms/EmotionAnalysisCard': { EmotionAnalysisCard: 'EmotionAnalysisCard', getEmotionTint: () => '#fff' },
    '../../lib/api': {
      ApiError,
      completeIteration: (...args) => pending('complete', args),
      getBook: (...args) => pending('book', args),
      getBookEmotions: () => new Promise(() => {}),
      getBookReviews: () => new Promise(() => {}),
    },
  });
  const h = {
    ApiError, dialogs, requests,
    render() {
      for (let round = 0; round < 5; round += 1) {
        cursor = 0;
        scheduled = [];
        const tree = BookDetailScreen({ bookId: 7, onNavigate() {} });
        if (scheduled.length === 0) return tree;
        scheduled.forEach((effect) => effect());
      }
      throw new Error('effects did not settle');
    },
    last: (kind) => requests.filter((request) => request.kind === kind).at(-1),
    count: (kind) => requests.filter((request) => request.kind === kind).length,
    async open(value) {
      h.render();
      h.last('book').resolve(value);
      await flush();
      return h.render();
    },
    confirm() {
      const [, , actions] = dialogs.at(-1);
      actions.find((action) => action.text === '読了にする').onPress();
    },
  };
  return h;
}

test('reading book: confirming 読了にする completes the latest iteration and reloads the detail', async () => {
  const h = detailHarness();
  let tree = await h.open(book());
  button(tree, '読了にする').props.onPress();
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.dialogs[0][0], '読了にしますか？');
  assert.equal(h.count('complete'), 0);
  h.confirm();
  tree = h.render();
  assert.deepEqual(h.last('complete').args, [7, 2]);
  const busy = button(tree, '読了にしています…');
  assert.equal(busy.props.onPress, undefined);
  h.last('complete').resolve();
  await flush();
  h.render();
  assert.equal(h.count('book'), 2);
  h.last('book').resolve(book({ reading_status: 'completed', current_page: 200 }));
  await flush();
  tree = h.render();
  assert.equal(button(tree, '読了にする'), undefined);
  assert.ok(nodes(tree).some((node) => node.type === 'Text' && text(node) === '読了'));
  assert.equal(nodes(tree).find((node) => node.type === 'FloatingActionButton'), undefined);
});

test('cancelling the confirmation does nothing', async () => {
  const h = detailHarness();
  const tree = await h.open(book());
  button(tree, '読了にする').props.onPress();
  const [, , actions] = h.dialogs[0];
  assert.equal(actions.find((action) => action.text === 'キャンセル').style, 'cancel');
  assert.equal(h.count('complete'), 0);
});

test('a failed completion shows the error and allows retrying', async () => {
  const h = detailHarness();
  let tree = await h.open(book());
  button(tree, '読了にする').props.onPress();
  h.confirm();
  h.last('complete').reject(new h.ApiError('Server error', 500));
  await flush();
  tree = h.render();
  assert.deepEqual(alerts(tree), ['Server error']);
  assert.equal(h.count('book'), 1);
  button(tree, '読了にする').props.onPress();
  h.confirm();
  assert.equal(h.count('complete'), 2);
});

test('an already completed iteration (409) just reloads the detail', async () => {
  const h = detailHarness();
  const tree = await h.open(book());
  button(tree, '読了にする').props.onPress();
  h.confirm();
  h.last('complete').reject(new h.ApiError('Reading iteration is already completed', 409));
  await flush();
  h.render();
  assert.equal(h.count('book'), 2);
});

test('completed books have no 読了にする button', async () => {
  const h = detailHarness();
  const tree = await h.open(book({ reading_status: 'completed', current_page: 200 }));
  assert.equal(button(tree, '読了にする'), undefined);
});
