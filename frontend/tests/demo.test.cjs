const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function harness(demo = true) {
  const cache = new Map();
  const calls = [];
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Response, URL, URLSearchParams, Headers, Error, SyntaxError, __DEV__: false,
      process: { env: { EXPO_PUBLIC_DEMO_MODE: demo ? 'true' : 'false' } },
      fetch: async (...args) => { calls.push(args); return new Response('{}'); },
      require(name) {
        if (name === 'react-native') return { Platform: { OS: 'web' } };
        if (name === 'expo-secure-store') return {};
        if (name.startsWith('.')) return load(path.normalize(path.join(path.dirname(file), `${name}.ts`)));
        throw new Error(`Unexpected import ${name}`);
      },
    });
    return exports;
  }
  return { load, calls, api: load('src/lib/api.ts'), auth: load('src/lib/auth.ts') };
}

test('demo uses real API contracts without restoring auth or making network calls', async () => {
  const h = harness();
  await h.auth.restoreSession();
  assert.equal(h.auth.currentUser().name, '体験ユーザー');
  const books = await h.api.getBooks();
  assert.equal(books.length, 2);
  assert.equal((await h.api.getContinueReadingBooks())[0].id, 1);
  assert.equal((await h.api.getIterations(2))[0].status, 'completed');
  assert.equal((await h.api.getBookReviews(1, 1)).length, 2);
  assert.equal((await h.api.getPublicReviews('demo-library')).items.length, 3);
  assert.equal((await h.api.getPublicReviewDistribution('demo-library')).total_count, 3);
  assert.equal((await h.api.getEmotionComparison(1)).mine.review_count, 2);
  assert.equal(h.calls.length, 0);
});

test('free text bookmark save, settings, progress and detail reload use the same session data', async () => {
  const h = harness();
  assert.equal(await h.api.getPageReview(1, 120, 1), null);
  const saved = await h.api.savePageReview(1, 120, 1, '手紙の返事に心が動いた');
  assert.equal(saved.source, 'mock');
  assert.equal(saved.color_code, '#C17AED');
  await h.api.setReviewVisibility(1, 120, 1, 'public');
  await h.api.setReviewSpoilers(1, 120, 1, false);
  const reopened = await h.api.getPageReview(1, 120, 1);
  assert.equal(reopened.review_text, '手紙の返事に心が動いた');
  assert.equal(reopened.visibility, 'public');
  assert.equal(reopened.contains_spoilers, false);
  assert.equal((await h.api.getBook(1)).current_page, 120);
  assert.equal((await h.api.getBookReviews(1, 1)).length, 3);
  assert.equal((await h.api.getEmotionComparison(1)).mine.review_count, 3);
  await h.api.savePageReview(1, 120, 1, '感想を書き直した');
  assert.equal((await h.api.getBookReviews(1, 1)).length, 3);
  assert.equal(await harness().api.getPageReview(1, 120, 1), null);
  assert.equal(h.calls.length, 0);
});

test('memo, cover, reaction and reread work locally while unsupported/auth operations fail explicitly', async () => {
  const h = harness();
  await h.api.saveBookMemo(1, 'メモ\nそのまま');
  assert.equal((await h.api.getBookMemo(1)).content, 'メモ\nそのまま');
  await h.api.saveBookCover(1, { color_mode: 'mine', palette: null, pattern: 2 });
  assert.equal((await h.api.getBook(1)).cover_style.pattern, 2);
  assert.equal((await h.api.setReviewReaction('demo-library', 100, 'empathy')).counts.empathy, 1);
  assert.equal((await h.api.setReviewReaction('demo-library', 100, null)).my_reaction, null);
  await h.api.completeIteration(1, 1);
  await assert.rejects(h.api.savePageReview(1, 120, 1, '編集'), /読了/);
  assert.equal((await h.api.startIteration(1)).iteration_number, 2);
  assert.equal((await h.api.getBook(1)).current_page, 0);
  await assert.rejects(h.auth.authPost('forgot-password', {}), /利用できません/);
  const missing = await h.auth.authenticatedFetch('https://example.invalid/not-supported');
  assert.equal(missing.status, 501);
  assert.equal(h.calls.length, 0);
});

test('normal mode keeps real transport and never grants a demo user', async () => {
  const h = harness(false);
  assert.equal(h.auth.currentUser(), null);
  await h.auth.authenticatedFetch('https://example.invalid/books');
  assert.equal(h.calls.length, 1);
  await assert.rejects(h.load('src/lib/demoApi.ts').demoRequest('https://example.invalid/books'), /のみ利用/);
});

test('Pages config preserves normal settings and validates the demo base path', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'app.config.js'), 'utf8');
  function configure(env) {
    const module = { exports: {} };
    vm.runInNewContext(code, { module, process: { env } });
    return module.exports({ config: { name: 'Original' } });
  }
  assert.equal(configure({}).experiments, undefined);
  assert.equal(configure({ EXPO_PUBLIC_DEMO_MODE: 'true', DEMO_BASE_PATH: '/tkb_2629' }).experiments.baseUrl, '/tkb_2629');
  assert.throws(() => configure({ DEMO_BASE_PATH: '/tkb_2629' }), /requires/);
});
