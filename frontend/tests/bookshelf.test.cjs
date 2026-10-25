const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const book = (id, reading_status) => ({ id, title: `Book ${id}`, reading_status });

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

function harness() {
  const state = [], effects = [], requests = [];
  let cursor = 0, scheduled = [], target;
  const code = ts.transpileModule(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'screens', 'main', 'BookshelfScreen.tsx'), 'utf8',
  ), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const dependencies = {
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
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'react-native': {
      StyleSheet: { create: (value) => value },
      Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    },
    '../../lib/api': {
      getBooks(offset) {
        return new Promise((resolve, reject) => { requests.push({ offset, resolve, reject }); });
      },
    },
  };
  vm.runInNewContext(code, {
    exports, Error,
    require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  return {
    requests,
    get target() { return target; },
    render() {
      cursor = 0;
      scheduled = [];
      const tree = exports.BookshelfScreen({ onNavigate: (value) => { target = value; } });
      scheduled.forEach((effect) => effect());
      return tree;
    },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

const covers = (tree) => nodes(tree).filter((node) => node.type === 'BookCover');
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).join('\n');
const tab = (tree, label) => nodes(tree).find((node) =>
  node.props?.accessibilityRole === 'tab' && node.props.children.props.children === label);
const retry = (tree) => nodes(tree).find((node) => node.props?.label === '再試行');

test('shelf plus opens the same search screen as the bottom tab', () => {
  const h = harness();
  const tree = h.render();
  assert.equal(tree.props.headerAction.props.accessibilityLabel, '本を追加');
  tree.props.headerAction.props.onPress();
  assert.equal(h.target, 'search');
});

test('tabs filter by reading status, restore all books, and preserve detail targets', async () => {
  const h = harness();
  h.render();
  h.requests[0].resolve([book(7, 'reading'), book(9, 'completed')]);
  await flush();
  let tree = h.render();
  assert.equal(covers(tree).length, 2);
  for (const [label, title] of [['読書中', 'Book 7'], ['読了', 'Book 9']]) {
    tab(tree, label).props.onPress();
    tree = h.render();
    assert.deepEqual(covers(tree).map((node) => node.props.title), [title]);
    assert.equal(tab(tree, label).props.accessibilityState.selected, true);
    assert.equal(tab(tree, 'すべて').props.accessibilityState.selected, false);
  }
  nodes(tree).find((node) => node.type === 'Pressable' && node.props.children?.[0]?.type === 'BookCover').props.onPress();
  assert.equal(h.target.name, 'book-detail');
  assert.equal(h.target.bookId, 9);
  tab(tree, 'すべて').props.onPress();
  assert.equal(covers(h.render()).length, 2);
  assert.equal(h.requests.length, 1);
});

test('all pages are loaded before filtering, including a book beyond the first 100', async () => {
  const h = harness();
  let tree = h.render();
  tab(tree, '読了').props.onPress();
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id + 1, 'reading')));
  await flush();
  assert.equal(h.requests[0].offset, 0);
  assert.equal(h.requests[1].offset, 100);
  tree = h.render();
  assert.equal(covers(tree).length, 0);
  assert.ok(text(tree).includes('本棚を読み込んでいます'));
  assert.ok(!text(tree).includes('読了した本はありません'));
  h.requests[1].resolve([book(101, 'completed')]);
  await flush();
  tree = h.render();
  assert.deepEqual(covers(tree).map((node) => node.props.title), ['Book 101']);
});

test('empty shelf and empty filters have distinct messages', async () => {
  for (const [items, label, message] of [
    [[], 'すべて', '本棚にはまだ本がありません。'],
    [[book(1, 'completed')], '読書中', '読書中の本はありません。'],
    [[book(1, 'reading')], '読了', '読了した本はありません。'],
  ]) {
    const h = harness();
    h.render();
    h.requests[0].resolve(items);
    await flush();
    tab(h.render(), label).props.onPress();
    assert.ok(text(h.render()).includes(message));
    assert.equal(covers(h.render()).length, 0);
  }
});

test('later-page failure shows an error without partial results and retries from zero', async () => {
  const h = harness();
  h.render();
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id + 1, 'reading')));
  await flush();
  h.requests[1].reject(new Error('Connection failed'));
  await flush();
  let tree = h.render();
  assert.ok(text(tree).includes('Connection failed'));
  assert.ok(!text(tree).includes('本棚にはまだ本がありません'));
  assert.equal(covers(tree).length, 0);
  retry(tree).props.onPress();
  h.render();
  assert.equal(h.requests[2].offset, 0);
  h.requests[2].resolve([book(9, 'reading')]);
  await flush();
  tree = h.render();
  assert.equal(retry(tree), undefined);
  assert.equal(covers(tree).length, 1);
});

test('unmounting stops pagination after an in-flight request', async () => {
  const h = harness();
  h.render();
  h.unmount();
  h.requests[0].resolve(Array.from({ length: 100 }, (_, id) => book(id, 'reading')));
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(covers(h.render()).length, 0);
});
