import { defineContentScript } from 'wxt/utils/define-content-script';
import { buildExpiredSearchUrl, isHomepagePath, isMarketplacePath } from '@/utils/expired-search';
import './style.css';

export default defineContentScript({
  // Start on the homepage too: SPA navigation does not inject new content scripts.
  matches: ['https://www.trademe.co.nz/*', 'https://trademe.co.nz/*'],
  main(ctx) {
    let mounted:
      | {
          host: HTMLElement;
          anchor: HTMLElement;
          input: HTMLInputElement;
          control: HTMLElement;
          cleanup?: () => void;
          updatePosition?: () => void;
        }
      | undefined;
    let scheduled = false;
    let homepageExpired = false;

    function removeButton() {
      mounted?.cleanup?.();
      mounted?.control.remove();
      mounted?.host.removeAttribute('data-trademe-plus-expired-search');
      mounted = undefined;
    }

    function syncButton() {
      const homepage = isHomepagePath(location.pathname);
      if (!homepage && !isMarketplacePath(location.pathname)) {
        removeButton();
        return;
      }

      let host = document.querySelector<HTMLElement>(
        homepage ? 'tm-homepage-search-header tm-global-search' : 'tm-marketplace-search-form',
      );
      const original = host?.querySelector<HTMLButtonElement>(
        homepage
          ? 'button.tm-global-search__search-form-submit-button[type="submit"]'
          : 'button.tm-marketplace-search-form__search-button[type="submit"]',
      );
      let input = host?.querySelector<HTMLInputElement>(
        homepage
          ? 'input.tm-global-search__search-input-box[name="search"]'
          : 'input[name="keyword"]',
      );
      let anchor: HTMLElement | null | undefined = original;
      if (!homepage && (!host || !original || !input)) {
        host = document.querySelector<HTMLElement>(
          'tm-search-header tm-refine-header .tm-refine-header__refine-keywords-and-save-search, ' +
            'tm-search-header tm-refine-header .tm-refine-header__refine-keywords-and-save-search-column',
        );
        input = host?.querySelector<HTMLInputElement>(
          'tm-refine-keywords input.tm-refine-keywords__search-input-box',
        );
        anchor = host?.querySelector<HTMLElement>('tm-refine-keywords');
      }
      if (!host || !anchor || !input) {
        removeButton();
        return;
      }
      if (
        mounted?.host === host &&
        mounted.anchor === anchor &&
        mounted.input === input &&
        mounted.control.isConnected
      ) {
        mounted.updatePosition?.();
        return;
      }

      removeButton();
      if (homepage && original) {
        const form = original.form;
        if (!form) return;
        // Keep extension UI out of Angular's component tree and native form.
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'trademe-plus-expired-toggle';
        toggle.setAttribute('role', 'switch');
        toggle.setAttribute('aria-checked', String(homepageExpired));
        const track = document.createElement('span');
        track.className = 'trademe-plus-expired-toggle__track';
        track.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.textContent = 'Expired listings';
        toggle.append(text, track);
        toggle.addEventListener('click', () => {
          homepageExpired = !homepageExpired;
          toggle.setAttribute('aria-checked', String(homepageExpired));
        });
        const keywordInput = input;
        const interceptSearch = (event: Event) => {
          if (!homepageExpired || !isHomepagePath(location.pathname)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          location.assign(buildExpiredSearchUrl(keywordInput.value));
        };
        const interceptEnter = (event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing) interceptSearch(event);
        };
        // Capture before Trade Me's Angular search handlers, including its Enter shortcut.
        original.addEventListener('click', interceptSearch, true);
        form.addEventListener('submit', interceptSearch, true);
        input.addEventListener('keydown', interceptEnter, true);
        host.setAttribute('data-trademe-plus-expired-search', '');
        toggle.style.visibility = 'hidden';
        document.body.append(toggle);
        const updatePosition = () => {
          const width = toggle.getBoundingClientRect().width;
          const bounds = original.getBoundingClientRect();
          toggle.style.left = `${bounds.left - width - 8}px`;
          toggle.style.top = `${bounds.top + (bounds.height - toggle.getBoundingClientRect().height) / 2}px`;
          toggle.style.visibility =
            original.isConnected &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.top < window.innerHeight
              ? 'visible'
              : 'hidden';
        };
        const resizeObserver = new ResizeObserver(updatePosition);
        resizeObserver.observe(host);
        resizeObserver.observe(original);
        resizeObserver.observe(toggle);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        updatePosition();
        mounted = {
          host,
          anchor,
          input,
          control: toggle,
          updatePosition,
          cleanup: () => {
            original.removeEventListener('click', interceptSearch, true);
            form.removeEventListener('submit', interceptSearch, true);
            keywordInput.removeEventListener('keydown', interceptEnter, true);
            resizeObserver.disconnect();
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
          },
        };
        return;
      }
      // Keep Trade Me's classes and Angular style attributes, without its handlers.
      const button =
        original && anchor === original
          ? (original.cloneNode(false) as HTMLButtonElement)
          : document.createElement('button');
      if (anchor !== original) button.className = 'trademe-plus-results-expired-button';
      button.removeAttribute('id');
      button.removeAttribute('name');
      button.removeAttribute('form');
      button.removeAttribute('aria-label');
      button.type = 'button';
      button.textContent = 'Search expired listings';
      button.dataset.trademePlusExpiredButton = '';
      const keywordInput = input;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isHomepagePath(location.pathname) || isMarketplacePath(location.pathname)) {
          location.assign(buildExpiredSearchUrl(keywordInput.value));
        }
      });
      host.setAttribute('data-trademe-plus-expired-search', '');
      anchor.after(button);
      mounted = { host, anchor, input, control: button };
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
