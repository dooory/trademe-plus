import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual entrypoint with Chrome's document-load match decision.
const source = readFileSync(new URL('../src/entrypoints/expired-search.content/index.ts', import.meta.url), 'utf8');
const helpers = readFileSync(new URL('../src/utils/expired-search.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(
  helpers.replaceAll('export ', '') + '\n' + source.replace(/^import .*;\r?$/gm, '').replace('export default ', 'definition = '),
  { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None } },
).outputText;

function navigateFrom(startPath) {
  let definition;
  let onMutation;
  let mountedButton;
  const input = { value: 'Lego Blocks' };
  const original = {
    cloneNode: () => ({
      dataset: {}, isConnected: false,
      removeAttribute() {}, addEventListener() {},
      remove() { this.isConnected = false; mountedButton = undefined; },
    }),
    after(button) { button.isConnected = true; mountedButton = button; },
  };
  const host = {
    querySelector: (selector) => selector.startsWith('button') ? original : input,
    setAttribute() {}, removeAttribute() {},
  };
  const location = { pathname: startPath };
  const document = {
    documentElement: {},
    querySelector: () => location.pathname === '/a/marketplace' ? host : null,
  };
  const sandbox = {
    URL, URLSearchParams, location, document, window: {},
    defineContentScript(value) { definition = value; return value; },
    MutationObserver: class {
      constructor(callback) { onMutation = callback; }
      observe() {} disconnect() {}
    },
  };
  runInNewContext(javascript, sandbox);
  const initialUrl = `https://www.trademe.co.nz${startPath}`;
  const injected = definition.matches.some((pattern) =>
    new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`).test(initialUrl),
  );
  if (injected) definition.main({
    requestAnimationFrame(callback) { callback(); },
    addEventListener() {}, onInvalidated() {},
  });
  assert.equal(mountedButton, undefined, 'No button outside Marketplace');
  location.pathname = '/a/marketplace';
  onMutation?.();
  assert.equal(mountedButton?.textContent, 'Search expired listings',
    `Button should appear when navigating from ${startPath} without refreshing`);
  const firstButton = mountedButton;
  onMutation?.();
  assert.equal(mountedButton, firstButton, 'Do not duplicate the button');
  for (const section of ['property', 'motors', 'jobs', 'services']) {
    location.pathname = `/a/${section}`;
    onMutation?.();
    assert.equal(mountedButton, undefined, `No button in ${section}`);
    location.pathname = '/a/marketplace';
    onMutation?.();
    assert.ok(mountedButton, 'Button returns on Marketplace');
  }
}

for (const path of ['/', '/a', '/a/', '/a/property', '/Browse/SearchResults.aspx']) {
  navigateFrom(path);
}
console.log('Marketplace navigation, duplicate prevention, and section exclusion checks passed.');
