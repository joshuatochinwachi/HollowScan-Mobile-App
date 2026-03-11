# HollowScan — Google Play Billing: Full Diagnostic Audit

## Directive

You are being tasked with a **comprehensive, non-destructive diagnostic audit** of the HollowScan Google Play Billing integration. This is not a feature build session. This is a **verification and diagnosis session only.**

You have full access to the codebase. Your primary objective is to **read, analyse, and report** — not to rewrite, refactor, or modify anything unless explicitly instructed to do so after the diagnosis is complete.

> **Critical instruction:** This codebase has been under active development and has recently reached a functional milestone. Treat every existing implementation with care. Do not change, overwrite, or suggest destructive edits to anything that is already working. Your job right now is to **observe, diagnose, and report.**

---

## Background

A test purchase was executed on a **licensed Google Play internal tester account** *(specifically, a tester whose email address was added to the internal testing email list via Google Play Console — this is a closed internal test track, not an open or production user)*. The Google Play billing sheet rendered correctly, the user confirmed the subscription, and the UI reflected a success state. However:

- The **FastAPI backend endpoint was never reached**
- The **user's subscription was not activated** in the database
- **No purchase token was delivered to the backend**
- **No premium access was granted**

This must be fully diagnosed and confirmed as resolved before any real-money transactions are tested or before the app is shipped to production.

---

## Important Context to Factor Into Your Analysis

### 1. Pricing — Do Not Hardcode or Assume
Subscription pricing is **set in GBP (£) in Google Play Console** and is **automatically converted to the user's local currency** by Google Play based on their country/region. The app is already correctly displaying localised pricing (this has been confirmed working). Do not reference, hardcode, or flag any specific currency amounts. Detect the actual product IDs and pricing configuration directly from what is already set in the codebase and Play Console integration.

### 2. The Codebase Has a Working Foundation
Large portions of this integration are already implemented and partially working. Your analysis must begin by **mapping what already exists** before identifying gaps. Do not assume things are missing — verify first.

### 3. Test Purchases vs. Real Purchases
Licensed internal testers make **simulated purchases** — no real money is charged. However, the purchase token generated is **real and fully verifiable** via the Google Play Developer API. The backend should handle test purchase tokens identically to real ones. The fact that it did not is the core problem being investigated.

---

## Step 0 — Codebase Self-Mapping (Do This First, Before Any Diagnosis)

Before running any diagnostic check, you must first **independently locate and map every file in this codebase that is relevant to payments, subscriptions, and billing.** Do not rely on being told where things are. Navigate the codebase yourself.

For each file you identify, document:
- **Full file path**
- **Its role in the payment flow** (e.g. billing client init, purchase token extraction, backend verification call, subscription state management, product ID constants, database write, etc.)
- **How it connects to other files in the flow** (e.g. "calls X", "imports from Y", "writes to Z")

This map becomes the foundation for every diagnostic check that follows. If a file's role is ambiguous, note that explicitly — do not guess. Only proceed to the diagnostic modules once this map is complete and you are confident you have identified every payment-related file across both the **mobile app** and the **backend**.

---

## Diagnostic Scope — Audit Every Item Below

### Module 1 — Android Billing Client

- [ ] What **Google Play Billing Library version** is declared in the project dependencies (e.g. `billing:5.x` vs `billing:6.x`)? Confirm the implementation is consistent with that version — the API structure, method signatures, and subscription handling differ significantly between versions and a mismatch is a known source of silent failures.
- [ ] Is `BillingClient` initialised correctly and is the connection established **before** any purchase flow is triggered?
- [ ] Is `onPurchasesUpdated()` fully implemented with correct handling for all `BillingResponseCode` values: `OK`, `USER_CANCELED`, `ITEM_ALREADY_OWNED`, `SERVICE_DISCONNECTED`, and error states?
- [ ] Is the **purchase token** correctly extracted from the `Purchase` object upon a successful response?
- [ ] Is the extracted token being **transmitted to the FastAPI backend** via an authenticated HTTP POST request? Identify the exact file, function, and line where this call is made (or should be made).
- [ ] Is there any **conditional logic, null guard, feature flag, or environment check** that could silently prevent the backend call from executing during test mode?
- [ ] Is `queryPurchasesAsync()` invoked **on app startup** to recover and process any purchases that completed but were never acknowledged (e.g. due to app termination mid-flow)?
- [ ] Do the **product IDs** referenced in the billing flow **exactly match** those configured in Google Play Console for both subscription tiers? (Case-sensitive, no trailing spaces)
- [ ] If the app is using **Google Play Billing v5 or above**, are the `basePlanId` and `offerId` being correctly supplied when building the `BillingFlowParams`? These are required in newer billing versions — passing only the product ID without these will silently fail to launch the correct subscription offer.
- [ ] Is purchase **acknowledgement** being handled correctly after the backend confirms access? Unacknowledged purchases are auto-voided by Google — within minutes for test purchases.

---

### Module 2 — FastAPI Backend

- [ ] Does the **subscription verification endpoint** exist, is it correctly defined, and is it reachable from the app?
- [ ] Is the **backend base URL** configured correctly for the current environment? Confirm the app is not pointing to a dev/localhost URL in a build that runs on a real device — a wrong base URL will cause the HTTP call to fail silently with no visible error to the user.
- [ ] Is it invoking the correct **Google Play Developer API method** — `purchases.subscriptions.get` or `purchases.subscriptions.v2.get` — with the correct `packageName`, `subscriptionId`, and `purchaseToken` parameters?
- [ ] Is the **Google service account** credentials file present, correctly referenced in the environment, and does the account have the required Play Console permissions: **Financial data access** and **Order management**?
- [ ] Is the backend correctly resolving the **product ID to subscription duration**? Detect this mapping from what already exists in the codebase — do not impose new logic.
- [ ] Is the user's subscription record (expiry timestamp or equivalent) being **committed to the database** after a successful verification? Confirm the write is actually executing and not being skipped due to a conditional.
- [ ] Are there any **bare `except` blocks or swallowed exceptions** in the payment flow that could mask failures and return a false-positive response?
- [ ] Does the endpoint return a **structured, actionable response** to the app indicating success or failure with enough detail to debug?
- [ ] Is there any existing logic or planned support for **promotional or complimentary subscriptions** — where selected users receive a free monthly subscription as part of a marketing or giveaway campaign? If so, verify that: (a) this is handled via Google Play's **promotional codes** feature or a backend-side grant mechanism, (b) it does not bypass the standard verification flow, and (c) the granted access correctly sets the user's `premium_expiry` in the database just as a paid subscription would.

---

### Module 3 — Google Play Console & API Configuration

- [ ] Are both subscription products (monthly and yearly) in **Active** status in Play Console?
- [ ] Is the app linked to the correct **Google Cloud Project** that has the Play Developer API enabled?
- [ ] Has the **service account** been granted API access within Play Console under **Setup → API Access**, with the correct permission scopes?
- [ ] Do the **subscription product IDs** in Play Console exactly match what the app and backend are referencing?

---

### Module 3b — Real-Time Developer Notifications (RTDN / Webhook)

If Google Play Pub/Sub webhook notifications are configured for this app, the following must also be checked:

- [ ] Is a **Pub/Sub topic** correctly set up in Google Cloud and linked to the app in Play Console under **Monetisation setup → Real-time developer notifications**?
- [ ] Is the backend correctly **subscribed to and processing** these push notifications for subscription lifecycle events (e.g. `SUBSCRIPTION_PURCHASED`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELED`)?
- [ ] If RTDN is configured, is there a **conflict or race condition** between the in-app token verification flow and the webhook handler both attempting to write subscription state to the database?
- [ ] If RTDN is **not yet configured**, flag this as a recommended addition — relying solely on in-app verification without a webhook means subscription renewals, cancellations, and expirations will not be reflected in the backend automatically.

---

### Module 4 — Firebase Configuration

- [ ] Is `google-services.json` present in the correct `/app` directory and does it match the **current package name and Firebase project**?
- [ ] If Firebase Authentication is part of the payment flow (e.g. user identity is passed to the backend for subscription linkage), are **auth tokens being correctly generated and attached** to the payment verification request?
- [ ] Are there any Firebase-related **silent failures or initialisation errors** that could be blocking the payment flow upstream?

---

### Module 5 — End-to-End Flow Trace

Trace the complete expected flow below and **identify exactly where it breaks**:

```
User taps Subscribe
        ↓
BillingClient launches billing flow
        ↓
Google Play sheet renders → user confirms
        ↓
onPurchasesUpdated() fires with BillingResponseCode.OK
        ↓
Purchase token extracted from Purchase object
        ↓
Authenticated HTTP POST → FastAPI verification endpoint
        ↓
Backend calls Google Play Developer API with token
        ↓
Google returns active subscription confirmation
        ↓
Backend resolves product ID → subscription duration
        ↓
Database updated: user premium_expiry set
        ↓
Purchase acknowledged (client or server side)
        ↓
App receives success response → UI reflects Premium status
```

Mark each step as ✅ Confirmed Working / ❌ Broken / ⚠️ Unverified — and provide file references for each.

---

## Output Format Required

Present your findings in the following structure:

### 1. Codebase Map
Present the full file map produced in **Step 0** — every payment-related file with its path, role, and connections. This must be completed before the issue register.

### 2. Issue Register
For every issue found, provide:

| # | Severity | File | Line | Description | Recommended Fix |
|---|----------|------|------|-------------|-----------------|
| 1 | 🔴 Critical | `file.kt` | 42 | Description | Fix |

Severity levels: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

### 3. Flow Trace Result
The annotated end-to-end flow with ✅ / ❌ / ⚠️ at each step.

### 4. Clarification Requests
If **anything is ambiguous** — particularly around Google Play Console configuration, service account setup, product IDs, or Firebase project linkage — **ask clearly and specifically**. Screenshots and config details can be provided on request. Do not assume or guess on configuration matters.

---

## Standing Instruction

> This diagnostic must be **fully complete and all critical issues resolved** before any real-money payment testing begins and before this build is submitted to the Google Play Store. Confirm explicitly when the payment flow is end-to-end verified.