import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/entrypoints/expired-results.content/index.ts', import.meta.url), 'utf8');
const helpers = readFileSync(new URL('../src/utils/expired-search.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(
  helpers.replaceAll('export ', '') + '\n' + source.replace(/^import .*;\r?$/gm, '').replace('export default ', 'definition = '),
  { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None } },
).outputText;

function check(search, hasNoResults = false) {
  const element = () => ({
    attributes: [{ name: 'id' }, { name: 'onsubmit' }], handlers: {}, children: [],
    removeAttribute(name) { this.attributes = this.attributes.filter(attribute => attribute.name !== name); },
    setAttribute() {}, addEventListener(name, handler) { this.handlers[name] = handler; },
    append(child) { this.children.push(child); }, remove() { this.removed = true; },
  });
  const input = element();
  const button = element();
  const label = element();
  const category = element();
  category.options = ['all', '347', 'Help'].map(value => ({ value, text: value === 'all' ? 'All categories' : 'Toys & models',
    remove() { category.options = category.options.filter(option => option !== this); },
  }));
  Object.defineProperty(category, 'selectedOptions', { get: () => category.options.filter(option => option.value === category.value) });
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
  runInNewContext(javascript, {
    URL, URLSearchParams,
    location: { search, assign(url) { destination = new URL(url); } },
    document: {
      querySelector: selector => {
        if (selector === '#generalSearch') return { cloneNode: () => form };
        if (selector === '#FiltersContainer h1') return { before(value) { bar = value; } };
        if (selector === '#NoResults') return hasNoResults ? noResults : null;
        throw new Error(`Unexpected selector: ${selector}`);
      },
      createElement: element,
    },
    defineContentScript(value) { definition = value; },
  });
  definition.main({ onInvalidated(callback) { cleanup = callback; } });
  return { input, category, form, noResults, nativeCategoryTip, get bar() { return bar; }, get destination() { return destination; }, cleanup };
}

const result = check('?advanced=true&current=0&searchstring=LEGO+%2B+trains+%26+tracks&cid=347&searchregion=2&page=3');
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
result.cleanup();
assert.ok(result.bar.removed);
assert.equal(check('?current=1').bar, undefined);
assert.equal(check('?searchstring=test').bar, undefined);
const empty = check('?current=0&searchstring=');
empty.form.handlers.submit({ preventDefault() {}, stopPropagation() {} });
assert.equal(empty.destination.searchParams.get('searchstring'), '');
assert.equal(empty.destination.searchParams.has('cid'), false);
assert.equal(result.noResults.children.length, 0, 'No empty-results message on populated results');
const noMatches = check('?current=0&searchstring=LEGO+%26+trains&cid=347&searchregion=2&page=3', true);
assert.ok(noMatches.bar, 'Search bar remains available on empty results');
const panel = noMatches.noResults.children[0];
assert.match(panel.children[0].textContent, /No expired listings found/);
const categories = new URL(panel.children[1].href);
assert.equal(categories.searchParams.has('cid'), false);
assert.equal(categories.searchParams.get('searchregion'), '2');
const locations = new URL(panel.children[2].href);
assert.equal(locations.searchParams.get('cid'), '347');
assert.equal(locations.searchParams.get('searchregion'), '100');
for (const url of [categories, locations]) {
  assert.equal(url.searchParams.get('current'), '0');
  assert.equal(url.searchParams.get('searchstring'), 'LEGO & trains');
  assert.equal(url.searchParams.has('page'), false);
}
assert.equal(noMatches.nativeCategoryTip.hidden, true, 'Hide native shortcut to active listings');
noMatches.cleanup();
assert.equal(panel.removed, true);
assert.equal(noMatches.nativeCategoryTip.hidden, false);
const unfiltered = check('?current=0&searchstring=test&cid=0&searchregion=100', true);
assert.equal(unfiltered.noResults.children[0].children.length, 1, 'No shortcuts for filters already cleared');
assert.equal(check('?current=1', true).noResults.children.length, 0);
console.log('Expired results query, submission, empty-result shortcuts, scope, and cleanup checks passed.');
