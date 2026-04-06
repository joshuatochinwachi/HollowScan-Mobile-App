# 🍎 HollowScan iOS Submission Guide (Windows Edition)

This guide explains how to build and submit your app to Apple TestFlight using **GitHub Actions** and **EAS**, specifically for development on a Windows machine.

---

## 🏗️ Step 1: Trigger the Build (GitHub)
1. Go to your GitHub repository -> **Actions** tab.
2. Select **"Build iOS"** from the sidebar.
3. Click **"Run workflow"** -> **"Run workflow"** (on the main branch).
4. Wait ~10 minutes for the build to finish.
5. Once green, scroll to **Artifacts** at the bottom and download `ios-build.zip`.
6. Extract the zip to get your `.ipa` file (e.g., `build-12345.ipa`).

---

## 🚀 Step 2: Submit to TestFlight (Windows Terminal)
Open your VS Code terminal and run the following command. 

> [!IMPORTANT]
> Because your Windows username contains a `$`, you **MUST** use the backtick (`` ` ``) to escape it in PowerShell.

```powershell
# Replace the path with the actual location of your downloaded IPA
npx eas-cli submit --platform ios --path "C:\Users\Jo`$h\Desktop\Visual Studio Code\HollowScan-Mobile-App\YOUR_FILENAME.ipa"
```

### What to expect:
- **EAS** will ask for your Apple ID password (or use your saved session).
- It will upload the file to Apple's servers.
- **Success!** You will see "Submission successful."

---

## 🧪 Step 3: Manage in App Store Connect
1. Log in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Go to **My Apps** -> **HollowScan**.
3. Go to the **TestFlight** tab.
4. **Wait 15-30 minutes**: The build will first show as "Processing." 
5. Once processing is done, click the build and **Provide Export Compliance** (answer "No" to encryption unless you use custom crypto).
6. Add your **Internal Testers** or **External Groups** to start testing.

---

## 💳 Step 4: In-App Purchase (IAP) Checklist
Before testing subscriptions, ensure:
1. **Products**: You have created the Subscription IDs in App Store Connect (e.g., `hollowscan_premium_monthly`).
2. **Status**: Products must be in "Ready to Submit" or "Approved" state.
3. **Sandbox**: Use a **Sandbox Tester Account** on your iPhone. (Settings -> App Store -> Sandbox Account).
4. **Shared Secret**: Your `SubscriptionService.js` logic uses the correct Shared Secret from Apple.

---

## 🛠️ Troubleshooting

### Error: "Build number X already used"
- **Reason**: Apple requires every submission to have a unique number.
- **Fix**: Our GitHub Action now uses `--auto-increment`. If it still fails, check `app.config.js` and ensure `ios.buildNumber` isn't hardcoded to an old value.

### Error: "Missing GoogleService-Info.plist"
- **Fix**: Ensure your GitHub Secret `GOOGLE_SERVICES_IOS` contains the full XML content of your Firebase file. The `app.config.js` will handle the rest.

---

**Built with ❤️ for HollowScan by Antigravity.**
