import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_MESSAGE,
  updateRecentSearches,
} from '@/utils/recent-searches';

export default defineBackground(() => {
  // All tabs share this worker. Queue complete read/modify/write operations,
  // including clearing, so another tab cannot overwrite a newer history.
  let pending: Promise<void> = Promise.resolve();

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (
      sender.id !== browser.runtime.id ||
      !message ||
      typeof message !== 'object' ||
      !('type' in message) ||
      message.type !== RECENT_SEARCHES_MESSAGE ||
      !('action' in message)
    )
      return;

    const action = message.action;
    const keyword = 'keyword' in message ? message.keyword : undefined;
    if (action !== 'clear' && !(action === 'remember' && typeof keyword === 'string')) return;
    const searchTerm = typeof keyword === 'string' ? keyword : '';

    const operation = pending.then(async () => {
      if (action === 'clear') {
        await browser.storage.local.remove(RECENT_SEARCHES_KEY);
        return [];
      }
      const stored = await browser.storage.local.get(RECENT_SEARCHES_KEY);
      const searches = updateRecentSearches(stored[RECENT_SEARCHES_KEY], searchTerm);
      await browser.storage.local.set({ [RECENT_SEARCHES_KEY]: searches });
      return searches;
    });
    // A failed storage operation must not block later requests.
    pending = operation.then(
      () => {},
      () => {},
    );
    void operation.then(
      (searches) => sendResponse({ searches }),
      () => sendResponse({ error: 'Unable to update recent searches' }),
    );
    // Keep the message channel and worker alive until the operation completes.
    return true;
  });
});
