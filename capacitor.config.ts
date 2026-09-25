import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.wattkind.homekind',
  appName: 'HomeKind',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: false,
    backgroundColor: '#FFF6EB',
  },
  // No `server.url`: the app is always served from the bundle, never from a remote host.
};

export default config;
