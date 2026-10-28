# HollowScan — Frontend OTA (Over-The-Air) Update Guide

This guide explains how to push instant code, UI, and logic changes to all HollowScan users on **both iOS and Android** without rebuilding native binaries or submitting updates to Apple App Store and Google Play Store.

---

## ⚡ Quick Cheat Sheet (The 3-Step Process)

Whenever you make frontend changes (in `screens/`, `components/`, `context/`, `constants/`, etc.):

```bash
# 1. Stage and commit your changes
git add .
git commit -m "feat: your change description"
git push origin main

# 2. Push the Over-The-Air update to ALL users (iOS & Android)
eas update --branch production --message "describe what changed"
```

**That's it!** EAS will bundle your JavaScript and deploy it to all active users and any future downloads.

---

## 🟢 When You CAN Use OTA Updates (No App Store / Play Store Review)

You can use `eas update` whenever you touch pure JavaScript / TypeScript code:

| Type of Change | Examples | OTA Allowed? |
| :--- | :--- | :---: |
| **UI & Styling** | Colors, fonts, margins, animations, layouts, cards | ✅ YES |
| **Bug Fixes** | Fixing logic bugs, state errors, null pointer checks | ✅ YES |
| **Text & Copy** | Titles, descriptions, labels, button texts, toasts | ✅ YES |
| **Asset & Image URLs** | Cache-busting URLs (`?v=3`), changing remote image URLs | ✅ YES |
| **API & Data Logic** | Changing endpoints, filtering, parsing, data mapping | ✅ YES |
| **New JS Screens & Components** | Adding new React Native components, modals, sheets | ✅ YES |

---

## 🔴 When You MUST Rebuild & Submit to Apple / Google

You **cannot** use an OTA update if you make native code or configuration changes. You must do a full build (`eas build`) and store submission when:

| Change | Why a Full Rebuild is Required |
| :--- | :--- |
| **Installing a new native package** | Packages requiring native code (e.g., adding a new camera, biometric, or native payment SDK). |
| **Changing App Permissions** | Adding camera, contacts, or Bluetooth permissions in `app.config.js`. |
| **Changing App Icon or Splash** | App launcher icons and native splash screens are baked into the OS binary. |
| **Upgrading Expo SDK** | Upgrading from SDK 54 to a future SDK. |
| **Changing `version` or `runtimeVersion`** | Changing the app version string in `app.config.js` requires a new binary submission. |

---

## 📱 How Users Receive the OTA Update

1. **Existing Users (Already installed)**:
   - When a user opens the app, `expo-updates` checks EAS servers in the background.
   - The new bundle downloads automatically.
   - The changes are seamlessly applied without the user ever visiting the App Store or Google Play.

2. **Brand New Users (Downloading for the first time)**:
   - When a new user installs the app from the store, Expo checks EAS on the first launch and serves the latest `production` bundle immediately.

3. **Both iOS and Android**:
   - Running `eas update --branch production` updates **both platforms simultaneously** in a single execution.

---

## 💡 Pro Tips & Best Practices

### 1. Cache-Busting Remote Assets
If you update a static file hosted remotely (like `public/no_image.png` on GitHub), devices will cache the old image by its URL. Always bump the query parameter:
- Example in `constants/Assets.js`: `...no_image.png?v=2` $\to$ `...no_image.png?v=3`

### 2. Verify Your Update on the EAS Dashboard
After running `eas update`, the command output provides a URL:
`https://expo.dev/accounts/joshuatochinwachi/projects/hollowscan_app/updates/...`
Click that link to view the published update, deployment status, and fingerprint hashes.

### 3. Clear Local Testing Cache
When testing an OTA update on your personal test device, remember to fully force-close the app from the app switcher and reopen it twice so `expo-updates` applies the newly downloaded JS bundle.