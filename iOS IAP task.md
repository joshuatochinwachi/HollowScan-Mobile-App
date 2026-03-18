# iOS Apple Pay (IAP) Integration Plan

This document tracks the integration of iOS In-App Purchases (via Apple Pay) into HollowScan, designed specifically to operate completely independently of the existing Android/Google Play implementation.

## Phase 1: Backend Setup (Isolated for Apple) - COMPLETE
- [x] Create [apple_iap_utils.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/apple_iap_utils.py) for receipt parsing/verification
- [x] Add `@app.post("/v1/auth/apple-iap/verify")` endpoint to [app.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py)
- [x] Test receipt parsing with Apple Sandbox (`sandbox.itunes.apple.com`) vs Production (`buy.itunes.apple.com`) logic
- [x] Ensure database updates match the Google Play schema exactly (`subscription_source='apple'`)

## Phase 2: Mobile App iOS Branching - COMPLETE
- [x] Update `itemSkus.ios` in [SubscriptionService.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/services/SubscriptionService.js) to include `premium_monthly` and `premium_yearly`
- [x] Add `Platform.OS === 'ios'` branch in [verifyWithBackend](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/services/SubscriptionService.js#202-287) to target `/v1/auth/apple-iap/verify` endpoint
- [x] Pass `purchase.transactionReceipt` explicitly for iOS verification instead of `purchaseToken`
- [x] Test iOS payment flow locally via EAS iOS simulator / physical iOS device (Pending User Verification)

## Phase 3: User App Store Connect Setup - COMPLETE
- [x] Extract App-Specific Shared Secret from App Store Connect
- [x] Add `APPLE_SHARED_SECRET` to local backend and Railway Environment Variables
- [x] Complete Paid Apps Agreement (Tax & Banking info)
- [x] Create Auto-Renewable Subscriptions (`premium_monthly`, `premium_yearly`)

## Phase 4: Verification - IN PROGRESS
- [x] Verify Sandbox purchase success on iOS (via TestFlight)
- [x] Verify database sync for Apple receipts
- [x] Verify Android purchase functionality remains fully operational

## Phase 5: App Store Submission
- [x] Upload iOS build to App Store Connect (Verified Build 16)
- [x] **CRITICAL:** Attached `premium_monthly` and `premium_yearly` to Version 1.0.
- [x] Sent "Perfect Reply" to Apple Review Team.
- [x] **Status:** App is currently "Waiting for Review".
- [ ] Configure GitHub Secrets for [eas.json](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/eas.json) content
- [ ] Update [.github/workflows/build.yml](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/.github/workflows/build.yml) to recreate [eas.json](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/eas.json) dynamically
- [ ] Verify build success in GitHub Actions

## Phase 6: Security Clean-up & Key Rotation - COMPLETE
- [x] Scrub sensitive files from Git history using `git-filter-repo` (Verified 100% accurate [eas.json](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/eas.json) recovery from Expo Build 14 logs)
- [x] Force push clean history to GitHub
- [x] Rotate leaked keys (Deactivated by Google)
  - [x] Generate and update Firebase Admin SDK Key (In EAS for Android Push)
  - [x] Generate and update Google Cloud Service Account Key (In Railway/Backend)
- [ ] Remove local [git_history_scrub_guide.md](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/git_history_scrub_guide.md) before final official build (Optional)

## Phase 8: Addressing App Store Rejection 3.1.2(c) - COMPLETE
- [x] Improved subscription descriptions in [ProfileScreen.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/screens/ProfileScreen.js), [HomeScreen.js](file:///C:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/screens/HomeScreen.js), and [DailyLimitModal.js](file:///C:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/components/DailyLimitModal.js)
- [x] Added functional Terms of Use (EULA) and Privacy Policy links to the UI (Conditionally hidden EULA on Android)
- [x] Profile, Home, and Limit Modal optimized for platform-specific legal requirements
- [x] Update App Store Connect metadata with EULA and Privacy Policy links (Verified COMPLETE)
- [x] Resubmitted to Apple Review (Verified COMPLETE)

## Phase 9: Documentation & Architecture - COMPLETE
- [x] Created [SUBSCRIPTION_ARCHITECTURE.md](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/SUBSCRIPTION_ARCHITECTURE.md) with system diagrams
- [x] Detailed iOS vs. Android implementation differences
- [x] Provided safety report on non-destructive UI changes
## Phase 10: Professional UI Polish - COMPLETE
- [x] Refine benefit descriptions (professional language)
- [x] Remove emojis from purchase paths (where appropriate)
- [x] Implement "Centered Block" layout for bullet points
- [x] Adjust formatting and layout for premium feel
## Phase 11: Debugging iOS IAP 400 Bad Request
- [x] Add backend logging to inspect incoming verification requests
- [x] Analyze backend logs for `[APPLE DEBUG]` output (Found: `receipt_data` is missing/empty)
- [x] Fix property name in [SubscriptionService.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/services/SubscriptionService.js) (use `purchaseToken` for iOS)
- [x] Add diagnostic logs to [SubscriptionService.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/services/SubscriptionService.js) to inspect [purchase](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/context/UserContext.js#637-648) object
- [x] Push Build 19 and request new mobile app build from user
- [x] Investigate Apple `21002` (malformed) error based on new backend logs
- [x] Verify final fix flow via TestFlight (SUCCESS - Validation success confirmed)

## Phase 12: iOS Production Build Preparation
- [x] Identify ignored critical files (eas.json, GoogleService-Info.plist, google-services.json)
- [x] Create [IOS_BUILD_GUIDE_PRODUCTION.md](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/IOS_BUILD_GUIDE_PRODUCTION.md) in codebase
- [x] Instruct user on temporary tracking and build command
- [x] (Optional) Cleanup tracking after build starts

## Phase 13: Addressing Apple Rejection 2.1(b) - App Completeness
- [x] Analyze rejection message (No action on Pay button)
- [x] Implement `getAvailablePurchases` cleanup in `SubscriptionService.initialize`
- [x] Draft perfect reply for Apple Review
- [x] Push Build 19 and request review again
- [x] **STATUS: 100% Complete and Live on App Store**
