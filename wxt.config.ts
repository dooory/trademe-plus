import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  webExt: {
    startUrls: ['https://trademe.co.nz'],
  },
  manifest: {
    name: 'Trade Me Plus',
    description: 'Extra features for Trade Me. Currently shows the active tab connection status.',
    permissions: ['activeTab'],
  },
});
