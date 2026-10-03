import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.wattkind.homekind',
  appName: 'HomeKind',
  webDir: 'dist',
  // Cream behind the web view on both platforms, so nothing flashes white while the bundle loads.
  backgroundColor: '#FFF6EB',
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  android: {
    allowMixedContent: false,
    // The web view's own back handling is replaced by src/platform/backButton.ts.
  },
  // No `server.url`: the app is always served from the bundle, never from a remote host.
};

export default config;
