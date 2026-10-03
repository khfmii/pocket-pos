import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pocketpos.app',
  appName: 'Pocket POS',
  webDir: 'dist',
  android: {
    // The app is fully offline and loads only bundled files, so block mixed content and remote debugging in release.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
  },
};

export default config;
