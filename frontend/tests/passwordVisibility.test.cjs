const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

test('passwords start hidden, toggle independently without changing values, and disable while submitting', async () => {
  const state = [];
  let cursor = 0, submitted, finish;
  const code = ts.transpileModule(fs.readFileSync(
    path.join(__dirname, '..', 'src', 'screens', 'auth', 'AuthForm.tsx'), 'utf8',
  ), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react: { useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      Platform: { OS: 'android' }, StyleSheet: { create: (value) => value },
      View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
    },
  };
  vm.runInNewContext(code, {
    exports, require: (name) => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
  });
  const render = () => {
    cursor = 0;
    return exports.AuthForm({
      title: '登録', submitLabel: '登録する',
      fields: [
        { key: 'email', label: 'メールアドレス', email: true },
        { key: 'password', label: 'パスワード', password: true },
        { key: 'confirmation', label: 'パスワード（確認）', password: true },
      ],
      submit: (values) => { submitted = values; return new Promise((resolve) => { finish = resolve; }); },
    });
  };
  const input = (tree, label) => nodes(tree).find((node) => node.type === 'ShadowInput' && node.props.accessibilityLabel === label);
  const toggle = (tree, label) => nodes(tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === label);
  let tree = render();
  assert.equal(input(tree, 'パスワード').props.secureTextEntry, true);
  assert.equal(input(tree, 'パスワード（確認）').props.secureTextEntry, true);
  assert.equal(toggle(tree, 'メールアドレスを表示する'), undefined);
  input(tree, 'メールアドレス').props.onChangeText('reader@example.com');
  input(tree, 'パスワード').props.onChangeText('example-password');
  input(tree, 'パスワード（確認）').props.onChangeText('example-password');
  toggle(tree, 'パスワードを表示する').props.onPress();
  tree = render();
  assert.equal(input(tree, 'パスワード').props.secureTextEntry, false);
  assert.equal(input(tree, 'パスワード').props.value, 'example-password');
  assert.equal(input(tree, 'パスワード（確認）').props.secureTextEntry, true);
  assert.equal(toggle(tree, 'パスワードを隠す').props.style({ pressed: false })[0].width, 48);
  toggle(tree, 'パスワードを隠す').props.onPress();
  tree = render();
  assert.equal(input(tree, 'パスワード').props.secureTextEntry, true);
  nodes(tree).find((node) => node.props?.label === '登録する').props.onPress();
  tree = render();
  assert.equal(submitted.password, 'example-password');
  assert.equal(submitted.confirmation, 'example-password');
  assert.equal(toggle(tree, 'パスワードを表示する').props.disabled, true);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(toggle(render(), 'パスワードを表示する').props.disabled, false);
});
