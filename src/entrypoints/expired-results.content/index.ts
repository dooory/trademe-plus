import { defineContentScript } from 'wxt/utils/define-content-script';
import { buildExpiredSearchUrl } from '@/utils/expired-search';
import './style.css';

export default defineContentScript({
  matches: ['https://www.trademe.co.nz/Browse/SearchResults.aspx*', 'https://trademe.co.nz/Browse/SearchResults.aspx*'],
  main(ctx) {
    const params = new URLSearchParams(location.search);
    if (params.get('current') !== '0') return;

    const original = document.querySelector<HTMLFormElement>('#generalSearch');
    const heading = document.querySelector<HTMLElement>('#FiltersContainer h1');
    if (!original || !heading) return;

    // Reuse the legacy search page's markup and styles, without its active-search handlers.
    const form = original.cloneNode(true) as HTMLFormElement;
    for (const element of [form, ...form.querySelectorAll('*')]) {
      element.removeAttribute('id');
      for (const attribute of [...element.attributes]) {
        if (attribute.name.startsWith('on')) element.removeAttribute(attribute.name);
      }
    }
    form.removeAttribute('name');
    const input = form.querySelector<HTMLInputElement>('input[name="searchString"]');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const category = form.querySelector<HTMLSelectElement>('select[name="searchType"]');
    if (!input || !button || !category) return;

    input.value = params.get('searchstring') ?? params.get('searchString') ?? '';
    input.id = 'trademe-plus-expired-keyword';
    input.setAttribute('aria-label', 'Search expired listings');
    button.setAttribute('aria-label', 'Search expired listings');
    // Help/member searches are separate destinations, not listing categories.
    for (const option of [...category.options]) {
      if (option.value !== 'all' && !/^\d+$/.test(option.value)) option.remove();
    }
    const cid = params.get('cid');
    category.value = cid && [...category.options].some(option => option.value === cid) ? cid : 'all';
    category.setAttribute('aria-label', 'Category');
    const updateCategoryLabel = () => {
      const label = form.querySelector('.drop-label');
      if (label) label.textContent = `in ${category.selectedOptions[0]?.text.toLowerCase() ?? 'all categories'}`;
    };
    updateCategoryLabel();
    category.addEventListener('change', updateCategoryLabel);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const url = new URL(buildExpiredSearchUrl(input.value));
      if (category.value !== 'all') url.searchParams.set('cid', category.value);
      if (params.has('searchregion')) url.searchParams.set('searchregion', params.get('searchregion')!);
      location.assign(url.href);
    });

    const bar = document.createElement('div');
    bar.className = 'search-bar trademe-plus-expired-results';
    const inner = document.createElement('div');
    inner.className = 'search-bar-inner';
    inner.append(form);
    bar.append(inner);
    const label = document.createElement('label');
    label.className = 'trademe-plus-expired-label';
    label.htmlFor = input.id;
    label.textContent = 'Search expired listings';
    heading.before(label);
    heading.before(bar);

    const noResults = document.querySelector<HTMLElement>('#NoResults');
    let emptyMessage: HTMLElement | undefined;
    const nativeCategoryTip = noResults?.querySelector<HTMLElement>('#AllCategorySearchListItem');
    const categoryTipWasHidden = nativeCategoryTip?.hidden;
    if (noResults) {
      emptyMessage = document.createElement('div');
      emptyMessage.className = 'trademe-plus-expired-empty';
      const message = document.createElement('p');
      message.textContent = 'No expired listings found. Try different keywords in the search bar above.';
      emptyMessage.append(message);

      const broaderSearch = () => {
        const url = new URL(buildExpiredSearchUrl(input.value));
        if (cid && cid !== '0') url.searchParams.set('cid', cid);
        if (params.has('searchregion')) url.searchParams.set('searchregion', params.get('searchregion')!);
        return url;
      };
      const addShortcut = (text: string, url: URL) => {
        const link = document.createElement('a');
        link.textContent = text;
        link.href = url.href;
        emptyMessage!.append(link);
      };
      if (cid && cid !== '0') {
        const url = broaderSearch();
        url.searchParams.delete('cid');
        addShortcut('Search all categories', url);
      }
      const region = params.get('searchregion');
      if (region && region !== '100' && region !== '0') {
        const url = broaderSearch();
        // Explicitly override the account's preferred region with all locations.
        url.searchParams.set('searchregion', '100');
        addShortcut('Search all locations', url);
      }
      noResults.prepend(emptyMessage);
      // Replace the native suggestion, which searches current listings.
      if (nativeCategoryTip) nativeCategoryTip.hidden = true;
    }
    ctx.onInvalidated(() => {
      label.remove();
      bar.remove();
      emptyMessage?.remove();
      if (nativeCategoryTip) nativeCategoryTip.hidden = categoryTipWasHidden ?? false;
    });
  },
});
