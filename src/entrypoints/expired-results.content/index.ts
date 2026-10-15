import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { buildExpiredSearchUrl } from '@/utils/expired-search';
import { RECENT_SEARCHES_MESSAGE } from '@/utils/recent-searches';
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
    // Keep a selected subcategory even when the native dropdown lists only top-level categories.
    if (cid && cid !== '0' && ![...category.options].some(option => option.value === cid)) {
      const option = document.createElement('option');
      option.value = cid;
      option.textContent = 'Current category';
      category.append(option);
    }
    category.value = cid && [...category.options].some(option => option.value === cid) ? cid : 'all';
    category.setAttribute('aria-label', 'Category');
    const updateCategoryLabel = () => {
      const label = form.querySelector('.drop-label');
      if (label) label.textContent = `in ${category.selectedOptions[0]?.text.toLowerCase() ?? 'all categories'}`;
    };
    updateCategoryLabel();
    category.addEventListener('change', updateCategoryLabel);

    const formSearchUrl = () => {
      const url = new URL(buildExpiredSearchUrl(input.value, params));
      if (category.value !== 'all') url.searchParams.set('cid', category.value);
      else url.searchParams.delete('cid');
      return url;
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      location.assign(formSearchUrl().href);
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

    const currentSearch = document.createElement('p');
    currentSearch.className = 'trademe-plus-current-search';
    const currentLink = document.createElement('a');
    currentLink.textContent = 'Search current listings';
    const updateCurrentLink = () => {
      const url = formSearchUrl();
      url.searchParams.set('current', '1');
      currentLink.href = url.href;
    };
    updateCurrentLink();
    input.addEventListener('input', updateCurrentLink);
    category.addEventListener('change', updateCurrentLink);
    currentSearch.append(currentLink);
    heading.before(currentSearch);

    const recentControls = document.createElement('div');
    recentControls.className = 'trademe-plus-recent-searches';
    recentControls.hidden = true;
    const recentLabel = document.createElement('label');
    recentLabel.textContent = 'Recent searches';
    recentLabel.htmlFor = 'trademe-plus-recent-searches';
    const recentSelect = document.createElement('select');
    recentSelect.className = 'default-input';
    recentSelect.id = recentLabel.htmlFor;
    const clearRecent = document.createElement('button');
    clearRecent.className = 'btn';
    clearRecent.type = 'button';
    clearRecent.textContent = 'Clear history';
    recentControls.append(recentLabel, recentSelect, clearRecent);
    heading.before(recentControls);
    let disposed = false;

    function renderRecentSearches(searches: string[]) {
      recentSelect.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Choose a recent search';
      recentSelect.append(placeholder);
      for (const search of searches) {
        const option = document.createElement('option');
        option.value = search;
        option.textContent = search;
        recentSelect.append(option);
      }
      recentSelect.value = '';
      recentControls.hidden = searches.length === 0;
    }

    recentSelect.addEventListener('change', () => {
      if (!recentSelect.value) return;
      input.value = recentSelect.value;
      updateCurrentLink();
      recentSelect.value = '';
      input.focus();
    });
    clearRecent.addEventListener('click', async () => {
      try {
        const response = await browser.runtime.sendMessage({ type: RECENT_SEARCHES_MESSAGE, action: 'clear' });
        if (response?.error) throw new Error(response.error);
        if (!disposed) renderRecentSearches([]);
      } catch {
        clearRecent.textContent = 'Retry clearing history';
      }
    });
    async function loadRecentSearches() {
      try {
        const response = await browser.runtime.sendMessage({
          type: RECENT_SEARCHES_MESSAGE,
          action: 'remember',
          keyword: params.get('searchstring') ?? params.get('searchString') ?? '',
        });
        if (response?.error) throw new Error(response.error);
        if (!disposed) renderRecentSearches(response.searches);
      } catch {
        // Search remains usable when extension storage is unavailable.
      }
    }
    void loadRecentSearches();

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
        return new URL(buildExpiredSearchUrl(input.value, params));
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
        url.searchParams.delete('searchdistrict');
        addShortcut('Search all locations', url);
      }
      noResults.prepend(emptyMessage);
      // Replace the native suggestion, which searches current listings.
      if (nativeCategoryTip) nativeCategoryTip.hidden = true;
    }
    ctx.onInvalidated(() => {
      disposed = true;
      label.remove();
      bar.remove();
      currentSearch.remove();
      recentControls.remove();
      emptyMessage?.remove();
      if (nativeCategoryTip) nativeCategoryTip.hidden = categoryTipWasHidden ?? false;
    });
  },
});
