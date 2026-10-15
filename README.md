# Trade Me Plus

A Chrome extension for [Trade Me](https://www.trademe.co.nz), built from the official [WXT React template](https://wxt.dev/guide/installation) with TypeScript.

Included features:

- Search expired listings from the Trade Me homepage, Marketplace, and regular search results using your current keywords.
- Search again from expired results with a prefilled search bar styled like Trade Me's existing yellow search bar.
- Keep filters and sorting when searching again, starting from page 1.
- Choose from your last 10 unique expired searches, saved locally in the extension, or clear the history.
- Switch to current listings with the same keywords, selected category, filters, and sorting.

## Install the latest release

1. Download the extension ZIP from the [latest GitHub release](https://github.com/dooory/trademe-plus/releases/latest).
2. Extract the ZIP to a folder on your computer.
3. Open `chrome://extensions` in Chrome and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.

To update, download and extract the newer release, then click **Reload** on the extension card. If you extracted it to a new folder, remove the old extension first and load the new folder.

## Run from source

Install Node.js 22.12+ and Google Chrome, then run from the repository root:

```sh
npm ci
npm run dev
```

WXT opens a development browser with the extension installed and a Trade Me tab. Click Trade Me Plus in Chrome's extensions menu. Pin it for easier access. Keep the dev command running while you edit; WXT reloads changes. To create a production package, run `npm run zip`; WXT writes the extension ZIP to `.output/`.

## Check your work

```sh
npm run check
npm run compile
npm run build
node scripts/check-expired-navigation.mjs
node scripts/check-expired-results.mjs
```

Biome formats and lints the JavaScript, TypeScript, CSS, and JSON files it supports. Run `npm run format` to format files, `npm run lint` to report lint issues, or `npm run check:write` to apply formatting and safe fixes. `npm run compile` remains the TypeScript type check.

These commands check TypeScript and build the extension. Check browser behavior manually:

1. Open `https://www.trademe.co.nz` and open the popup. Expect **Attached to Trade Me**.
2. Open an unrelated website and reopen the popup. Expect **Not attached to Trade Me**.
3. Open a Chrome internal page such as `chrome://extensions` and reopen the popup. Expect **Not attached to Trade Me**.
4. Switch between the tabs and reopen the popup to confirm it checks the active tab each time.
5. Open `https://www.trademe.co.nz/a/marketplace`. Expect one **Search expired listings** button beside **Search Marketplace**, with matching styling. Enter `Lego Blocks` in **Search by keyword** and click the new button. Expect `https://www.trademe.co.nz/Browse/SearchResults.aspx?advanced=true&searchstring=Lego+Blocks&current=0`.
6. Repeat with special characters such as `LEGO + trains & tracks` to check URL encoding. An empty keyword opens expired results with an empty search string.
7. Check the layout at desktop and mobile widths. Confirm the original button and Enter still perform the normal Marketplace search.
8. Start at `https://www.trademe.co.nz/` and navigate into Marketplace without reloading. Expect the new button on both the homepage and Marketplace forms. Navigate between Marketplace and Property, Motors, Jobs, and Services, including without reloading. Expect no added button in those other sections, and no duplicates after returning or using Back/Forward.
   Also open `https://www.trademe.co.nz/a/search?search_string=one%20piece` directly and navigate there from Marketplace without reloading. Expect **Search expired listings** beside the Marketplace search button; clicking it searches expired listings for the keywords currently in the input.
   On regular results with a keyword field and **Save this search**, expect a separate **Search expired listings** button between them. Focus and blur the keyword field, edit its text, and check narrow widths. Expect one button that uses the current field value and wraps with the row when needed.
9. On expired results, expect a yellow search bar above the results with your current keywords. Change the keywords and submit using both Enter and the search button. Expect another expired search, retaining the selected category and region. Check desktop and mobile widths, and confirm current-listing results do not get this extra bar.
10. Search for a term with no expired results. Expect the search bar to remain visible with a message suggesting different keywords. With a category or region filter applied, expect shortcuts to search all categories or all locations. Each shortcut keeps the keywords and the other filter, stays on expired listings, and starts from page 1.
11. Apply filters and sorting, including a subcategory, then search for different keywords. Expect the filters and sort order to remain, with pagination reset to page 1. Choosing all categories explicitly clears the category filter.
12. Search for several terms and check the **Recent searches** dropdown. Selecting a term fills and focuses the search input without submitting. Expect the latest 10 unique nonempty terms, newest first, retained after reopening the browser. Click **Clear history** to remove them. History uses local extension storage and is not synced.
13. Click **Search current listings** below the yellow search bar. Expect current listings using the keywords and category currently in the form, retaining the filters and sort order and starting from page 1. Edit keywords, choose a recent search, and change the category to confirm the link updates. It also appears on empty expired results.
14. Open expired searches in multiple tabs at once. Expect both terms to be retained in history. History saves and clearing run in a single background queue, so pending saves cannot overwrite a later clear. The automated results check covers concurrent tabs, clearing during a pending save, and recovery after storage failure.
15. Open `https://www.trademe.co.nz/a/` or the root homepage. Expect an **Expired listings** toggle immediately left of **Search**, initially off. With it off, Search and Enter perform Trade Me's normal search. Turn it on and expect both Search and Enter to search expired listings using the current keywords. Turn it off to restore normal searching. Check keyboard access, narrow-width wrapping, and navigation away from the homepage.
    The homepage toggle mounts outside Trade Me's Angular component tree and native form, and follows the Search button on resize and scroll. Check that the homepage loads normally with the extension enabled and the toggle stays aligned after scrolling or resizing.

For popup errors, right-click inside the popup and choose **Inspect**. Check the extension card at `chrome://extensions` for other errors. There is no automated browser test suite yet.

`npm audit` currently flags an unresolved `node-forge` advisory in WXT's `web-ext` development dependency chain. It is not bundled into the extension. A package override selects a patched `shell-quote` version for `fx-runner`; revisit it when upstream updates its dependency.

## Project structure

```text
src/
  entrypoints/background.ts Shared queue for recent-search storage updates and clearing
  entrypoints/expired-results.content/ Prefilled expired-results search form and layout
  entrypoints/expired-search.content/  Marketplace button, layout, and navigation handling
  entrypoints/popup/   React popup, HTML entrypoint, and styles
  utils/expired-search.ts  Marketplace path matching and expired search URL
  utils/recent-searches.ts Recent-search normalization and limit
  utils/trademe.ts     Trade Me URL matching
wxt.config.ts         WXT configuration and manifest permissions
```

`package-lock.json` pins npm dependencies. `.wxt/`, `.output/`, and `node_modules/` are generated and ignored by Git.

Add future page integration as a WXT content script under `src/entrypoints/`, with matches limited to Trade Me. Keep shared logic in `src/utils/` and UI code with its entrypoint. WXT generates `manifest.json`; edit `wxt.config.ts` rather than the generated file.

The popup uses `activeTab` to read the current tab URL when opened. The `storage` permission saves recent expired searches in local extension storage. The Marketplace content script runs on `https://www.trademe.co.nz/*` and `https://trademe.co.nz/*` so it can handle navigation into Marketplace from the homepage or other sections, but only modifies Marketplace search forms. It reads the keyword when you click the new button and redirects directly to Trade Me. A separate content script adds a prefilled search form on legacy expired results pages with `current=0`, reusing Trade Me's native search markup and styles. See the [WXT guide](https://wxt.dev/guide/essentials/entrypoints) for entrypoint conventions.
