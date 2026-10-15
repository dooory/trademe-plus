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
  let destination;
  const makeButton = () => ({
    dataset: {}, isConnected: false, children: [], attributes: {}, style: { marginLeft: '' },
    removeAttribute() {}, addEventListener(name, handler) { this[name] = handler; },
    removeEventListener(name, handler) { if (this[name] === handler) delete this[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    append(...children) { this.children.push(...children); },
    getBoundingClientRect() { return { left: 500, top: 100, width: 120, height: 20, bottom: 120 }; },
    remove() { this.isConnected = false; mountedButton = undefined; },
  });
  const input = { ...makeButton(), value: 'Lego Blocks' };
  const original = {
    ...makeButton(),
    isConnected: true,
    form: makeButton(),
    cloneNode: makeButton,
    after(button) { button.isConnected = true; mountedButton = button; },
    before() { assert.fail('Do not insert extension UI into the Angular-owned homepage form'); },
  };
  const host = {
    querySelector: (selector) => selector.startsWith('button') ? original : input,
    setAttribute() {}, removeAttribute() {},
  };
  const homepageHost = { ...host };
  const keywords = { after: original.after };
  const resultsRow = {
    querySelector: selector => selector.includes('input') ? input : selector === 'tm-refine-keywords' ? keywords : null,
    setAttribute() {}, removeAttribute() {},
  };
  const location = { pathname: startPath, assign(url) { destination = new URL(url); } };
  const document = {
    documentElement: {},
    body: { append(control) { control.isConnected = true; control.parentNode = this; mountedButton = control; } },
    querySelector: selector => {
      if (selector === 'tm-marketplace-search-form') return location.pathname === '/a/marketplace' ? host : null;
      if (selector === 'tm-homepage-search-header tm-global-search') return ['/', '/a', '/a/'].includes(location.pathname) ? homepageHost : null;
      if (selector.includes('tm-refine-header__refine-keywords-and-save-search')) {
        return ['/a/search', '/a/search/'].includes(location.pathname) ? resultsRow : null;
      }
      throw new Error(`Unexpected selector: ${selector}`);
    },
    createElement: tag => { assert.ok(['button', 'label', 'input', 'span'].includes(tag)); return makeButton(); },
  };
  const sandbox = {
    URL, URLSearchParams, location, document,
    window: { ...makeButton(), innerHeight: 900 },
    ResizeObserver: class { observe() {} disconnect() {} },
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
  if (['/', '/a', '/a/', '/a/search'].includes(startPath)) {
    assert.ok(mountedButton, `Button should appear when loading ${startPath} directly`);
    if (startPath !== '/a/search') assert.equal(mountedButton.className, 'trademe-plus-expired-toggle');
  } else {
    assert.equal(mountedButton, undefined, 'No button outside Marketplace');
  }
  location.pathname = '/a/marketplace';
  onMutation?.();
  assert.equal(mountedButton?.textContent, 'Search expired listings',
    `Button should appear when navigating from ${startPath} without refreshing`);
  const firstButton = mountedButton;
  onMutation?.();
  assert.equal(mountedButton, firstButton, 'Do not duplicate the button');
  for (const path of ['/', '/a', '/a/']) {
    location.pathname = path;
    input.value = 'homepage + search & more';
    onMutation?.();
    assert.equal(mountedButton?.className, 'trademe-plus-expired-toggle');
    const homepageButton = mountedButton;
    onMutation?.();
    assert.equal(mountedButton, homepageButton, 'Do not duplicate the homepage button');
    const toggle = mountedButton;
    assert.equal(toggle.parentNode, document.body, 'Keep the toggle outside Trade Me component and form markup');
    assert.equal(toggle.children.some(child => child.type === 'checkbox'), false, 'Do not add a native form input');
    assert.equal(toggle.getAttribute('role'), 'switch');
    assert.equal(toggle.getAttribute('aria-checked'), 'false', 'Homepage starts in normal search mode');
    assert.equal(toggle.style.visibility, 'visible');
    const event = (extra = {}) => ({
      prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      ...extra,
    });
    destination = undefined;
    const normalClick = event();
    original.click(normalClick);
    assert.equal(destination, undefined);
    assert.equal(normalClick.prevented, false, 'Off leaves native Search untouched');
    toggle.click();
    const expiredClick = event();
    original.click(expiredClick);
    assert.equal(expiredClick.prevented, true);
    assert.equal(expiredClick.stopped, true, 'Stop Trade Me from also running its normal search');
    assert.equal(destination.searchParams.get('searchstring'), 'homepage + search & more');
    assert.equal(destination.searchParams.get('current'), '0');
    destination = undefined;
    input.keydown(event({ key: 'Enter', isComposing: true }));
    assert.equal(destination, undefined, 'Do not interrupt IME composition');
    input.value = 'Enter + keywords';
    input.keydown(event({ key: 'Enter', isComposing: false }));
    assert.equal(destination.searchParams.get('searchstring'), 'Enter + keywords');
    input.value = 'form submit';
    original.form.submit(event());
    assert.equal(destination.searchParams.get('searchstring'), 'form submit');
    onMutation?.();
    assert.equal(mountedButton.getAttribute('aria-checked'), 'true', 'Mutations preserve the toggle setting');
    toggle.click();
    destination = undefined;
    const normalEnter = event({ key: 'Enter' });
    input.keydown(normalEnter);
    original.form.submit(event());
    assert.equal(destination, undefined);
    assert.equal(normalEnter.prevented, false, 'Turning off restores native Enter behavior');
  }
  for (const path of ['/a/search', '/a/search/']) {
    location.pathname = path;
    input.value = 'one piece';
    onMutation?.();
    assert.equal(original.click, undefined, 'Remove homepage interception after leaving');
    assert.equal(input.keydown, undefined);
    assert.equal(original.form.submit, undefined);
    assert.equal(original.style.marginLeft, '', 'Restore native layout after leaving the homepage');
    assert.ok(mountedButton, `Button should appear on ${path} without refreshing`);
    assert.equal(mountedButton.className, 'trademe-plus-results-expired-button');
    const resultsButton = mountedButton;
    onMutation?.();
    assert.equal(mountedButton, resultsButton, 'Results layout should not duplicate or recreate the button');
    mountedButton.click({ preventDefault() {}, stopPropagation() {} });
    assert.equal(destination.searchParams.get('searchstring'), 'one piece');
    assert.equal(destination.searchParams.get('current'), '0');
    input.value = 'edited + keywords & more';
    mountedButton.click({ preventDefault() {}, stopPropagation() {} });
    assert.equal(destination.searchParams.get('searchstring'), 'edited + keywords & more');
  }
  for (const section of ['property', 'motors', 'jobs', 'services']) {
    location.pathname = `/a/${section}`;
    onMutation?.();
    assert.equal(mountedButton, undefined, `No button in ${section}`);
    location.pathname = '/a/marketplace';
    onMutation?.();
    assert.ok(mountedButton, 'Button returns on Marketplace');
  }
}

for (const path of ['/', '/a', '/a/', '/a/property', '/Browse/SearchResults.aspx', '/a/search']) {
  navigateFrom(path);
}
console.log('Marketplace navigation, duplicate prevention, and section exclusion checks passed.');
