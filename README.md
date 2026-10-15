# Trade Me Plus

A Chrome extension for [Trade Me](https://www.trademe.co.nz), built from the official [WXT React template](https://wxt.dev/guide/installation) with TypeScript.

The popup reports whether the active tab is on `trademe.co.nz` or one of its subdomains. "Attached" currently means the tab URL matches Trade Me. The extension does not modify pages yet.

## Install and run

Install Node.js 22.12+ and Google Chrome, then run from the repository root:

```sh
npm ci
npm run dev
```

WXT opens a development browser with the extension installed and a Trade Me tab. Click Trade Me Plus in Chrome's extensions menu. Pin it for easier access. Keep the dev command running while you edit; WXT reloads changes.

To install a production build locally:

```sh
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `.output/chrome-mv3`. After rebuilding, click **Reload** on the extension card. `npm run zip` produces a ZIP in `.output/` for distribution.

## Check your work

```sh
npm run compile
npm run build
```

These commands check TypeScript and build the extension. Check browser behavior manually:

1. Open `https://www.trademe.co.nz` and open the popup. Expect **Attached to Trade Me**.
2. Open an unrelated website and reopen the popup. Expect **Not attached to Trade Me**.
3. Open a Chrome internal page such as `chrome://extensions` and reopen the popup. Expect **Not attached to Trade Me**.
4. Switch between the tabs and reopen the popup to confirm it checks the active tab each time.

For popup errors, right-click inside the popup and choose **Inspect**. Check the extension card at `chrome://extensions` for other errors. There is no automated browser test suite yet.

`npm audit` currently flags an unresolved `node-forge` advisory in WXT's `web-ext` development dependency chain. It is not bundled into the extension. A package override selects a patched `shell-quote` version for `fx-runner`; revisit it when upstream updates its dependency.

## Project structure

```text
src/
  entrypoints/popup/   React popup, HTML entrypoint, and styles
  utils/trademe.ts     Trade Me URL matching
wxt.config.ts         WXT configuration and manifest permissions
```

`package-lock.json` pins npm dependencies. `.wxt/`, `.output/`, and `node_modules/` are generated and ignored by Git.

Add future page integration as a WXT content script under `src/entrypoints/`, with matches limited to Trade Me. Keep shared logic in `src/utils/` and UI code with its entrypoint. WXT generates `manifest.json`; edit `wxt.config.ts` rather than the generated file.

The popup uses only `activeTab`, which allows reading the current tab URL when you open it. It does not request permanent access to your browsing history or page contents. See the [WXT guide](https://wxt.dev/guide/essentials/entrypoints) for entrypoint conventions.
