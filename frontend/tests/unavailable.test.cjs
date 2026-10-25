const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const jsx = (type, props) => ({ type, props });

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  return exports;
}

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

const native = {
  StyleSheet: { create: (value) => value },
  Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', Text: 'Text', View: 'View',
};
const runtime = { jsx, jsxs: jsx };
const text = (tree) => nodes(tree).filter((node) => node.type === 'Text').map((node) => node.props.children).flat().join('\n');

test('settings rows without an action are disabled and labelled as unavailable', () => {
  const { SettingsRow } = load('src/components/molecules/SettingsRow.tsx', {
    'react-native': native, 'react/jsx-runtime': runtime,
  });
  const unavailable = SettingsRow({ label: 'パスワード' });
  assert.equal(unavailable.props.disabled, true);
  assert.equal(unavailable.props.accessibilityState.disabled, true);
  assert.equal(unavailable.props.accessibilityLabel, 'パスワード（準備中）');
  assert.ok(text(unavailable).includes('準備中'));
  assert.ok(!text(unavailable).includes('›'));

  let pressed = false;
  const available = SettingsRow({ label: 'アカウント設定', onPress: () => { pressed = true; } });
  assert.equal(available.props.disabled, false);
  assert.equal(available.props.accessibilityLabel, 'アカウント設定');
  assert.ok(text(available).includes('›'));
  assert.ok(!text(available).includes('準備中'));
  available.props.onPress();
  assert.equal(pressed, true);
});

test('account settings explains sample values and disables reminder and logout', () => {
  const { AccountSettingsScreen } = load('src/screens/account/AccountSettingsScreen.tsx', {
    'react-native': native, 'react/jsx-runtime': runtime,
  });
  const tree = AccountSettingsScreen({ onNavigate() {} });
  const all = nodes(tree);
  assert.ok(text(tree).includes('設定の変更は準備中です'));
  assert.ok(!text(tree).includes('アカウント情報を変更できます'));
  const reminder = all.find((node) => node.type === 'Switch');
  assert.equal(reminder.props.disabled, true);
  assert.equal(reminder.props.value, false);
  assert.equal(reminder.props.onValueChange, undefined);
  const logout = all.find((node) => node.type === 'Text' && String(node.props.children).includes('ログアウト'));
  assert.ok(logout.props.children.includes('準備中'));
  assert.equal(logout.props.onPress, undefined);
  for (const row of all.filter((node) => node.type === 'SettingsRow')) {
    assert.equal(row.props.onPress, undefined);
  }
});

test('book edit shows an unavailable notice without editable fields and returns to the same book', () => {
  const { BookEditScreen } = load('src/screens/books/BookEditScreen.tsx', {
    'react-native': native, 'react/jsx-runtime': runtime,
  });
  let target;
  const tree = BookEditScreen({ bookId: 12, onNavigate: (value) => { target = value; } });
  const all = nodes(tree);
  assert.ok(text(tree).includes('本の編集は準備中です'));
  assert.equal(all.some((node) => node.type === 'ShadowInput'), false);
  assert.equal(all.some((node) => node.props?.label === '保存する'), false);
  all.find((node) => node.props?.label === '本の詳細へ戻る').props.onPress();
  assert.deepEqual({ ...target }, { name: 'book-detail', bookId: 12 });
});
