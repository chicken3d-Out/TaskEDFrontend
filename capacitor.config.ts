import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ph.gov.deped.leyte.tasked',
  appName: 'TaskEd',
  webDir: 'dist/frontend/browser',
  plugins: {
    SplashScreen: {
      // Matches the branded pulsing-seal loading screen used throughout
      // the web app - launchShowDuration keeps the native splash up just
      // long enough for Angular to bootstrap before app.component takes
      // over with the real loading indicator.
      launchShowDuration: 1500,
      backgroundColor: '#f3f5f7',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
