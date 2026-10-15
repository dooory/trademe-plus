import { defineContentScript } from 'wxt/utils/define-content-script';
import { buildExpiredSearchUrl, isMarketplacePath } from '@/utils/expired-search';
import './style.css';

export default defineContentScript({
  // Start on the homepage too: SPA navigation does not inject new content scripts.
  matches: ['https://www.trademe.co.nz/*', 'https://trademe.co.nz/*'],
  main(ctx) {
    let mounted: {
      host: HTMLElement;
      original: HTMLButtonElement;
      input: HTMLInputElement;
      button: HTMLButtonElement;
    } | undefined;
    let scheduled = false;

    function removeButton() {
      mounted?.button.remove();
      mounted?.host.removeAttribute('data-trademe-plus-expired-search');
      mounted = undefined;
    }

    function syncButton() {
      if (!isMarketplacePath(location.pathname)) {
        removeButton();
        return;
      }

      const host = document.querySelector<HTMLElement>('tm-marketplace-search-form');
      const original = host?.querySelector<HTMLButtonElement>(
        'button.tm-marketplace-search-form__search-button[type="submit"]',
      );
      const input = host?.querySelector<HTMLInputElement>('input[name="keyword"]');
      if (!host || !original || !input) {
        removeButton();
        return;
      }
      if (mounted?.host === host && mounted.original === original &&
          mounted.input === input && mounted.button.isConnected) return;

      removeButton();
      // Keep Trade Me's classes and Angular style attributes, without its handlers.
      const button = original.cloneNode(false) as HTMLButtonElement;
      button.removeAttribute('id');
      button.removeAttribute('name');
      button.removeAttribute('form');
      button.removeAttribute('aria-label');
      button.type = 'button';
      button.textContent = 'Search expired listings';
      button.dataset.trademePlusExpiredButton = '';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isMarketplacePath(location.pathname)) {
          location.assign(buildExpiredSearchUrl(input.value));
        }
      });
      host.setAttribute('data-trademe-plus-expired-search', '');
      original.after(button);
      mounted = { host, original, input, button };
    }

    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      ctx.requestAnimationFrame(() => {
        scheduled = false;
        syncButton();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.addEventListener(window, 'wxt:locationchange', syncButton);
    ctx.onInvalidated(() => {
      observer.disconnect();
      removeButton();
    });
    syncButton();
  },
});
