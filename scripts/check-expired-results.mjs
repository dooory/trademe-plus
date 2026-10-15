import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/entrypoints/expired-results.content/index.ts', import.meta.url), 'utf8');
const helpers = readFileSync(new URL('../src/utils/expired-search.ts', import.meta.url), 'utf8');
const recentHelpers = readFileSync(new URL('../src/utils/recent-searches.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(
  helpers.replaceAll('export ', '') + '\n' + recentHelpers.replaceAll('export ', '') + '\n' + source.replace(/^import .*;\r?$/gm, '').replace('export default ', 'definition = '),
  { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None } },
).outputText;
const backgroundSource = readFileSync(new URL('../src/entrypoints/background.ts', import.meta.url), 'utf8');
const backgroundJavascript = ts.transpileModule(
  recentHelpers.replaceAll('export ', '') + '\n' + backgroundSource.replace(/^import .*;\r?$/gm, '').replace('export default ', 'definition = '),
  { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None } },
).outputText;

function createHistoryBackground(storage, storageFails = false) {
  let listener;
  let failNextWrite = false;
  runInNewContext(backgroundJavascript, {
    defineBackground(main) { main(); },
    browser: {
      runtime: { id: 'test-extension', onMessage: { addListener(callback) { listener = callback; } } },
      storage: { local: {
        async get() {
          if (storageFails) throw new Error('Storage unavailable');
          // Yield after taking the snapshot, as real extension storage does.
          const snapshot = structuredClone(storage);
          await new Promise(setImmediate);
          return snapshot;
        },
        async set(values) {
          if (failNextWrite) { failNextWrite = false; throw new Error('Write failed'); }
          Object.assign(storage, structuredClone(values));
        },
        async remove(key) { delete storage[key]; },
      } },
    },
  });
  return {
    storage,
    failNextWrite() { failNextWrite = true; },
    sendMessage(message) {
      return new Promise(resolve => {
        const asynchronous = listener(message, { id: 'test-extension' }, resolve);
        if (asynchronous !== true) resolve(undefined);
      });
    },
  };
}

function check(search, hasNoResults = false, storedSearches = [], storageFails = false, sharedBackground) {
  const element = () => ({
    attributes: [{ name: 'id' }, { name: 'onsubmit' }], handlers: {}, children: [],
    removeAttribute(name) { this.attributes = this.attributes.filter(attribute => attribute.name !== name); },
    setAttribute() {}, addEventListener(name, handler) { this.handlers[name] = handler; },
    append(...children) { this.children.push(...children); }, remove() { this.removed = true; },
    replaceChildren(...children) { this.children = children; }, focus() { this.focused = true; },
  });
  const input = element();
  const button = element();
  const label = element();
  const category = element();
  category.options = ['all', '347', 'Help'].map(value => ({ value, text: value === 'all' ? 'All categories' : 'Toys & models',
    remove() { category.options = category.options.filter(option => option !== this); },
  }));
  Object.defineProperty(category, 'selectedOptions', { get: () => category.options.filter(option => option.value === category.value) });
  category.append = option => category.options.push({ ...option, text: option.textContent });
  const form = element();
  const nativeCategoryTip = element();
  nativeCategoryTip.hidden = false;
  const noResults = element();
  noResults.querySelector = () => nativeCategoryTip;
  noResults.prepend = child => noResults.children.unshift(child);
  form.querySelectorAll = () => [input, button, category, label];
  form.querySelector = selector => selector.startsWith('input') ? input : selector.startsWith('button') ? button : selector.startsWith('select') ? category : label;
  let bar;
  let cleanup;
  let destination;
  let definition;
  let recentControls;
  let currentSearch;
  const history = sharedBackground ?? createHistoryBackground({ expiredRecentSearches: storedSearches }, storageFails);
  const storage = history.storage;
  let historyRequest;
  runInNewContext(javascript, {
    URL, URLSearchParams,
    browser: { runtime: { sendMessage(message) { historyRequest = history.sendMessage(message); return historyRequest; } } },
    location: { search, assign(url) { destination = new URL(url); } },
    document: {
      querySelector: selector => {
        if (selector === '#generalSearch') return { cloneNode: () => form };
        if (selector === '#FiltersContainer h1') return { before(value) {
          if (value.className === 'search-bar trademe-plus-expired-results') bar = value;
          if (value.className === 'trademe-plus-recent-searches') recentControls = value;
          if (value.className === 'trademe-plus-current-search') currentSearch = value;
        } };
        if (selector === '#NoResults') return hasNoResults ? noResults : null;
        throw new Error(`Unexpected selector: ${selector}`);
      },
      createElement: element,
    },
    defineContentScript(value) { definition = value; },
  });
  definition.main({ onInvalidated(callback) { cleanup = callback; } });
  return { input, category, form, noResults, nativeCategoryTip, storage, get historyRequest() { return historyRequest; }, get currentSearch() { return currentSearch; }, get recentControls() { return recentControls; }, get bar() { return bar; }, get destination() { return destination; }, cleanup };
}

const result = check('?advanced=true&current=0&searchstring=LEGO+%2B+trains+%26+tracks&cid=347&searchregion=2&page=3&sort_order=price_asc&price_min=10&searchdistrict=7');
assert.ok(result.bar);
assert.equal(result.input.value, 'LEGO + trains & tracks');
assert.equal(result.category.value, '347');
assert.equal(result.category.options.length, 2);
assert.ok(result.form.attributes.every(attribute => attribute.name !== 'id' && !attribute.name.startsWith('on')));
result.input.value = '  other & new  ';
result.form.handlers.submit({ preventDefault() {}, stopPropagation() {} });
assert.equal(result.destination.searchParams.get('searchstring'), 'other & new');
assert.equal(result.destination.searchParams.get('current'), '0');
assert.equal(result.destination.searchParams.get('cid'), '347');
assert.equal(result.destination.searchParams.get('searchregion'), '2');
assert.equal(result.destination.searchParams.has('page'), false);
assert.equal(result.destination.searchParams.get('sort_order'), 'price_asc');
assert.equal(result.destination.searchParams.get('price_min'), '10');
assert.equal(result.destination.searchParams.get('searchdistrict'), '7');
result.input.handlers.input();
const currentUrl = new URL(result.currentSearch.children[0].href);
assert.equal(currentUrl.searchParams.get('current'), '1');
assert.equal(currentUrl.searchParams.get('searchstring'), 'other & new');
assert.equal(currentUrl.searchParams.get('cid'), '347');
assert.equal(currentUrl.searchParams.get('searchregion'), '2');
assert.equal(currentUrl.searchParams.get('sort_order'), 'price_asc');
assert.equal(currentUrl.searchParams.has('page'), false);
result.cleanup();
assert.ok(result.bar.removed);
assert.ok(result.currentSearch.removed);
assert.equal(check('?current=1').bar, undefined);
assert.equal(check('?current=1').currentSearch, undefined);
assert.equal(check('?searchstring=test').bar, undefined);
const empty = check('?current=0&searchstring=');
empty.form.handlers.submit({ preventDefault() {}, stopPropagation() {} });
assert.equal(empty.destination.searchParams.get('searchstring'), '');
assert.equal(empty.destination.searchParams.has('cid'), false);
assert.equal(result.noResults.children.length, 0, 'No empty-results message on populated results');
const noMatches = check('?current=0&searchstring=LEGO+%26+trains&cid=347&searchregion=2&searchdistrict=7&sort_order=price_asc&page=3', true);
assert.ok(noMatches.bar, 'Search bar remains available on empty results');
assert.equal(new URL(noMatches.currentSearch.children[0].href).searchParams.get('current'), '1');
const panel = noMatches.noResults.children[0];
assert.match(panel.children[0].textContent, /No expired listings found/);
const categories = new URL(panel.children[1].href);
assert.equal(categories.searchParams.has('cid'), false);
assert.equal(categories.searchParams.get('searchregion'), '2');
const locations = new URL(panel.children[2].href);
assert.equal(locations.searchParams.get('cid'), '347');
assert.equal(locations.searchParams.get('searchregion'), '100');
assert.equal(locations.searchParams.has('searchdistrict'), false);
for (const url of [categories, locations]) {
  assert.equal(url.searchParams.get('current'), '0');
  assert.equal(url.searchParams.get('searchstring'), 'LEGO & trains');
  assert.equal(url.searchParams.has('page'), false);
  assert.equal(url.searchParams.get('sort_order'), 'price_asc');
}
assert.equal(noMatches.nativeCategoryTip.hidden, true, 'Hide native shortcut to active listings');
noMatches.cleanup();
assert.equal(panel.removed, true);
assert.equal(noMatches.nativeCategoryTip.hidden, false);
const unfiltered = check('?current=0&searchstring=test&cid=0&searchregion=100', true);
assert.equal(unfiltered.noResults.children[0].children.length, 1, 'No shortcuts for filters already cleared');
assert.equal(check('?current=1', true).noResults.children.length, 0);

const subcategory = check('?current=0&searchstring=test&cid=12345&SearchString=old&Page=5');
assert.equal(subcategory.category.value, '12345');
subcategory.form.handlers.submit({ preventDefault() {}, stopPropagation() {} });
assert.equal(subcategory.destination.searchParams.get('cid'), '12345');
assert.equal(subcategory.destination.searchParams.has('SearchString'), false);
assert.equal(subcategory.destination.searchParams.has('Page'), false);
subcategory.category.value = 'all';
subcategory.category.handlers.change();
assert.equal(new URL(subcategory.currentSearch.children[0].href).searchParams.has('cid'), false);
subcategory.form.handlers.submit({ preventDefault() {}, stopPropagation() {} });
assert.equal(subcategory.destination.searchParams.has('cid'), false);

const recent = check('?current=0&searchstring=LEGO', false, ['books', ' lego ', '', 42, ...Array.from({ length: 12 }, (_, i) => `term ${i}`)]);
await recent.historyRequest;
await new Promise(setImmediate);
assert.equal(recent.storage.expiredRecentSearches.length, 10);
assert.equal(recent.storage.expiredRecentSearches[0], 'LEGO');
assert.equal(recent.storage.expiredRecentSearches[1], 'books');
assert.equal(recent.storage.expiredRecentSearches.filter(term => term.toLowerCase() === 'lego').length, 1);
assert.equal(recent.recentControls.hidden, false);
const recentSelect = recent.recentControls.children[1];
assert.equal(recentSelect.children.length, 11);
recentSelect.value = 'books';
recentSelect.handlers.change();
assert.equal(recent.input.value, 'books');
assert.equal(new URL(recent.currentSearch.children[0].href).searchParams.get('searchstring'), 'books');
assert.equal(recent.input.focused, true);
assert.equal(recent.destination, undefined, 'Selecting a recent term allows editing before submission');
await recent.recentControls.children[2].handlers.click();
assert.equal(recent.storage.expiredRecentSearches, undefined);
assert.equal(recent.recentControls.hidden, true);
const unavailable = check('?current=0&searchstring=test', false, [], true);
await unavailable.historyRequest;
await new Promise(setImmediate);
assert.equal(unavailable.recentControls.hidden, true);
unavailable.form.handlers.submit({ preventDefault() {}, stopPropagation() {} });
assert.equal(unavailable.destination.searchParams.get('searchstring'), 'test');

// Run two real content-script instances against one real background listener.
const sharedHistory = createHistoryBackground({ expiredRecentSearches: ['older search'] });
const firstTab = check('?current=0&searchstring=first+tab', false, [], false, sharedHistory);
const secondTab = check('?current=0&searchstring=second+tab', false, [], false, sharedHistory);
await Promise.all([firstTab.historyRequest, secondTab.historyRequest]);
assert.deepEqual(sharedHistory.storage.expiredRecentSearches, ['second tab', 'first tab', 'older search']);

const pendingTab = check('?current=0&searchstring=pending+search', false, [], false, sharedHistory);
await secondTab.recentControls.children[2].handlers.click();
await pendingTab.historyRequest;
assert.equal(sharedHistory.storage.expiredRecentSearches, undefined, 'Clear runs after pending saves and does not resurrect history');

sharedHistory.failNextWrite();
const failedTab = check('?current=0&searchstring=failed+search', false, [], false, sharedHistory);
const recoveryTab = check('?current=0&searchstring=recovered+search', false, [], false, sharedHistory);
await Promise.all([failedTab.historyRequest, recoveryTab.historyRequest]);
await new Promise(setImmediate);
assert.equal(failedTab.recentControls.hidden, true);
assert.deepEqual(sharedHistory.storage.expiredRecentSearches, ['recovered search'], 'A failed write does not poison the queue');
console.log('Expired results filters, sorting, recent history, empty-result shortcuts, scope, and cleanup checks passed.');
