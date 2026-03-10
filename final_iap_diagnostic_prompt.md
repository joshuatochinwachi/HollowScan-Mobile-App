# Final IAP Diagnostic Prompt — Run Before Build

Before I build, I need you to do one final, completely exhaustive diagnostic check on the entire IAP/subscription payment system. Leave nothing unchecked.

---

## 1. Package & Dependencies
- Confirm the exact installed version of `react-native-iap` in `node_modules`
- Check `package.json` for any conflicting IAP libraries
- Check `app.json` / `app.config.js` for the `react-native-iap` plugin entry
- Check `eas.json` production profile is correct

---

## 2. Library Exports
Cross-check against: `C:\Users\Jo$h\Desktop\Visual Studio Code\HollowScan-Mobile-App\iap-exports.txt`

Confirm every single function we import actually exists and is exported:
- `initConnection`
- `fetchProducts`
- `requestPurchase`
- `finishTransaction`
- `purchaseUpdatedListener`
- `purchaseErrorListener`
- `getAvailablePurchases`
- `endConnection`

> Flag anything we import that does NOT exist in the exports file.

---

## 3. SubscriptionService.js — Line by Line
- Are all imports valid?
- Is `fetchProducts({ skus: itemSkus, type: 'subs' })` the correct call signature?
- Is `subscriptionOfferDetailsAndroid?.[0]?.offerToken` the correct field path?
- Is the `requestPurchase` call shape exactly correct for Android subscriptions in this version?
- Is `finishTransaction({ purchase, isConsumable: false })` the correct signature?
- Is `getAvailablePurchases()` called correctly?
- Are `purchaseUpdatedListener` and `purchaseErrorListener` used correctly?
- Is `purchase.transactionReceipt` the correct field to check?
- Are `purchase.purchaseToken` and `purchase.productId` correct for the backend verify call?

---

## 4. UserContext.js — Line by Line
- Is `SubscriptionService.initialize()` called correctly on app load?
- Is `SubscriptionService.setCurrentUserId(userData.id)` called in ALL the right places:
  - `loadUserData`
  - `updateUser`
  - `purchasePremium`
- Is `SubscriptionService.setupPurchaseListeners(...)` wired correctly?
- Is `SubscriptionService.removeListeners()` called on cleanup?
- Is `subscriptionOfferDetailsAndroid` used correctly in `getPlanPrice`?
- Is `purchasePremium` passing the correct SKU strings (`premium_monthly`, `premium_yearly`)?

---

## 5. Type Definitions Deep Check
Look inside `node_modules/react-native-iap/src/types/` or any `.d.ts` files and confirm:
- The exact shape of the purchase object returned in `purchaseUpdatedListener`
  - Does `purchase.transactionReceipt` exist?
  - Does `purchase.purchaseToken` exist?
  - Does `purchase.productId` exist?
- Confirm the exact signature of `finishTransaction`

---

## 6. Android-Specific
- Confirm `itemSkus` is correctly defined for Android
- Confirm the offerToken flow is complete and correct end-to-end:
  1. `fetchProducts` called with `{ skus: [sku], type: 'subs' }`
  2. `subscriptionOfferDetailsAndroid[0].offerToken` extracted
  3. `requestPurchase` called with `{ type: 'subs', request: { google: { skus: [sku], subscriptionOffers: [{ sku, offerToken }] } } }`
  4. Listener receives purchase → checks `transactionReceipt` → verifies with backend → calls `finishTransaction`

---

## 7. Directory & Import Path Check

Check every single import path in both files and confirm the file actually exists at that location.

### SubscriptionService.js
- Confirm this file lives at: `services/SubscriptionService.js`
- Confirm `../Constants` resolves to a real `Constants.js` file one level up
- Confirm `react-native-iap` resolves correctly inside `node_modules/react-native-iap/`

### UserContext.js
- Confirm this file lives at: `context/UserContext.js` (or wherever the app expects it)
- Confirm `../Constants` resolves to the same real `Constants.js`
- Confirm `../services/SubscriptionService` resolves to the actual `SubscriptionService.js` file
- Confirm `../services/PushNotificationService` resolves to a real file
- Confirm all other imports (`AsyncStorage`, `expo-notifications`, `react`) resolve correctly

### node_modules
- Confirm `react-native-iap` exists at `node_modules/react-native-iap/` and is NOT duplicated or nested inside another package's `node_modules`
- Confirm there is only ONE version of `react-native-iap` installed (no version conflicts)
- Confirm `@react-native-async-storage/async-storage` exists in `node_modules`
- Confirm `expo-notifications` exists in `node_modules`

> If any import path does not resolve to a real existing file, flag it immediately as a critical error.

---

## Final Verdict Required

After checking everything, give me:

1. **Final verdict:** `READY TO BUILD ✅` or `ISSUES FOUND ❌`
2. **A table** of every issue found with: File | Line | Wrong Value | Correct Value
3. **Explicit confirmation:** *"Every import exists, every field name is correct, every function signature is correct."*

> Do not skip any file, directory, package, or dependency. Check everything.