const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  // 🛡️ Secret Injection Logic (Runs BEFORE the build starts)
  const iosSecret = process.env.GOOGLE_SERVICES_IOS;
  const androidSecret = process.env.GOOGLE_SERVICES_ANDROID;

  if (iosSecret) {
    const filePath = path.resolve(__dirname, 'GoogleService-Info.plist');
    try {
      fs.writeFileSync(filePath, iosSecret);
      console.log(`[Config] 🚀 Injected iOS Firebase Secret: ${filePath}`);
    } catch (err) {
      console.error(`[Config] ❌ Failed to inject iOS Secret: ${err.message}`);
    }
  }

  if (androidSecret) {
    const filePath = path.resolve(__dirname, 'google-services.json');
    try {
      fs.writeFileSync(filePath, androidSecret);
      console.log(`[Config] 🚀 Injected Android Firebase Secret: ${filePath}`);
    } catch (err) {
      console.error(`[Config] ❌ Failed to inject Android Secret: ${err.message}`);
    }
  }

  // Return the main Expo config
  return {
    ...config,
    name: "HollowScan",
    slug: "hollowscan_app",
    version: "1.0.2",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "hollowscan",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0B"
    },
    notification: {
      icon: "./assets/icon.png",
      color: "#0A0A0B",
      iosDisplayInForeground: true
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.kttylabs.app",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0A0A0B"
      },
      package: "com.kttylabs.app",
      googleServicesFile: "./google-services.json",
      permissions: ["NOTIFICATIONS", "VIBRATE", "RECEIVE_BOOT_COMPLETED"]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#0A0A0B",
          "defaultChannel": "default",
          "sounds": []
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "buildToolsVersion": "35.0.0"
          },
          "ios": {
            "useFrameworks": "static",
            "deploymentTarget": "15.1"
          }
        }
      ],
      [
        "react-native-iap",
        {
          "android": {
            "paymentLibrary": "play-billing"
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "7589d6ec-f110-43fc-8e06-ff5572a88bc5"
      }
    }
  };
};
