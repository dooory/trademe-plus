# Trade Me Plus

A Chrome extension for Trade Me, built from the official WXT React template with TypeScript.

## Feature list

- Search expired listings from the Trade Me homepage, Marketplace, and regular search results.
- Switch homepage searches between current and expired listings.
- Search again from expired results with your keywords and filters.
- Keep filters and sorting when searching again; results start at page 1.
- Switch to current listings while keeping your search settings.
- Browse your 10 most recent unique expired searches, saved locally, or clear the history.
- Check whether the active tab is on Trade Me from the extension popup.

## Installation guide

1. Download the extension ZIP from the [latest GitHub release](https://github.com/dooory/trademe-plus/releases/latest).
2. Extract the ZIP to a folder on your computer.
3. In Chrome, open `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.

To update, extract the newer release and click **Reload** on the extension card. If you use a new folder, remove the old extension first and load the new folder.

## Running from source

Install Node.js 22.12+ and Google Chrome, then run from the repository root:

```sh
npm ci
npm run dev
```

WXT opens a development browser with the extension installed and a Trade Me tab. Keep the command running while you edit; WXT reloads changes. To create a production ZIP, run `npm run zip`; the package is written to `.output/`.
