import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.soulsync.app",
  appName: "SoulSync",
  webDir: "dist",

  server: {
    // In development: point to local dev server
    // url: 'http://192.168.x.x:5173',
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    buildOptions: {
      keystorePath: "soulsync-release.keystore",
      keystoreAlias: "soulsync",
    },
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#060606",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },

    StatusBar: {
      style: "dark",
      backgroundColor: "#060606",
    },

    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#1db954",
    },

    Preferences: {
      group: "SoulSyncPreferences",
    },
  },
};

export default config;
