# Google Play Billing Setup Guide
## Complete Guide for Enabling Subscriptions in Your Android App

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Google Play Console Account Setup](#phase-1-google-play-console-account-setup)
3. [Phase 2: Create and Configure Subscription Products](#phase-2-create-and-configure-subscription-products)
4. [Phase 3: Enable API Access for Backend](#phase-3-enable-api-access-for-backend)
5. [Phase 4: Set Up Testing Environment](#phase-4-set-up-testing-environment)
6. [Phase 5: Testing Your Implementation](#phase-5-testing-your-implementation)
7. [Important Limitations and Requirements](#important-limitations-and-requirements)
8. [Troubleshooting Common Issues](#troubleshooting-common-issues)
9. [Production Deployment Checklist](#production-deployment-checklist)

---

## Prerequisites

### What You Need Before Starting

- [ ] Google account (Gmail)
- [ ] $25 USD for one-time Google Play Developer registration fee
- [ ] Valid credit/debit card or bank account for registration
- [ ] Government-issued ID for account verification (may be required)
- [ ] Your app's compiled APK or AAB file (even if not final)
- [ ] Tax information (required for payouts)
- [ ] Bank account details (for receiving payments)

### Time Requirements

- **Account Setup:** 15-30 minutes
- **Merchant Account Verification:** 1-3 business days (Google's review)
- **Subscription Product Creation:** 15-30 minutes
- **API Access Setup:** 20-40 minutes
- **Testing Setup:** 10-20 minutes

**Total Initial Setup:** ~1 hour of your time + 1-3 days waiting for verification

---

## Phase 1: Google Play Console Account Setup

### Step 1: Create Google Play Developer Account

1. **Go to Google Play Console**
   - Visit: [https://play.google.com/console](https://play.google.com/console)
   - Click **"Sign In"** with your Google account
   - If you already have an account, skip to Step 2

2. **Register as a Developer**
   - Click **"Get Started"** or **"Create Developer Account"**
   - Choose account type:
     - **Personal Account:** For individual developers
     - **Organization Account:** For companies/businesses
   - Accept the Developer Distribution Agreement
   - Pay the **one-time $25 registration fee**
     - This fee is non-refundable
     - Payment methods: Credit/Debit card

3. **Complete Account Details**
   - **Developer Name:** This will be publicly visible on your apps
   - **Email Address:** For developer communications
   - **Phone Number:** For account verification and security
   - **Website:** (Optional but recommended)
   - **Developer Address:** Required for legal compliance

4. **Verify Your Identity** (May be required)
   - Google may ask for:
     - Government-issued ID (driver's license, passport)
     - Proof of address (utility bill, bank statement)
   - Upload requested documents
   - Wait for verification (usually 1-3 days)

5. **Set Up Two-Factor Authentication** (Recommended)
   - Go to your Google Account security settings
   - Enable 2-Step Verification
   - This protects your developer account

### Step 2: Create Your App Listing

1. **Create a New App**
   - In Play Console, click **"All apps"** → **"Create app"**
   - Fill in required information:
     - **App name:** Your app's public name
     - **Default language:** Primary language for your app
     - **App or game:** Select appropriate category
     - **Free or paid:** Choose "Free" (with in-app subscriptions)

2. **Complete Required Declarations**
   - Privacy Policy: (Required for apps with subscriptions)
     - Must be hosted on a publicly accessible URL
     - Must describe data collection and usage
   - App access: Describe any special access requirements
   - Ads: Declare if your app contains ads
   - Content rating: Complete the questionnaire
   - Target audience: Select age groups
   - News apps: Declare if applicable

3. **Set Up Store Listing** (Can be done later, but prepare)
   - App description (4000 characters)
   - Short description (80 characters)
   - Screenshots (at least 2, recommended 8)
   - Feature graphic (1024 x 500 px)
   - App icon (512 x 512 px)
   - Category
   - Tags

### Step 3: Set Up Payment Profile and Merchant Account

**This is CRITICAL for receiving payments from subscriptions**

1. **Access Payment Profile**
   - In Play Console sidebar, go to **"Setup"** → **"Payments profile"**
   - Click **"Set up a payments profile"** or **"Create payments profile"**

2. **Choose Account Type**
   - **Individual:** For personal accounts
   - **Business:** For companies
   - Select the appropriate type based on your registration

3. **Provide Business/Personal Information**
   - Legal name (must match ID)
   - Business name (if applicable)
   - Address (where you'll receive tax forms)
   - Phone number
   - Email for payment notifications

4. **Add Tax Information**
   - **US Developers:**
     - Provide SSN (individual) or EIN (business)
     - Complete W-9 form
   - **Non-US Developers:**
     - Complete W-8BEN (individual) or W-8BEN-E (business)
     - Provide tax ID from your country
   - This affects tax withholding on your earnings

5. **Add Bank Account for Payouts**
   - Navigate to **"Payments profile"** → **"Payments methods"**
   - Click **"Add payment method"**
   - Provide:
     - Bank name
     - Account holder name
     - Account number / IBAN
     - Routing number / SWIFT code
     - Bank address
   - **Important:** Account name must match your registered name

6. **Verify Merchant Account**
   - Google will review your information
   - **Verification time:** 1-3 business days (sometimes longer)
   - You'll receive an email when approved
   - **You cannot activate subscriptions until this is approved**

7. **Set Payment Threshold** (Optional)
   - Minimum balance before payout
   - Default: When balance reaches equivalent of $10 USD
   - Payouts occur monthly

---

## Phase 2: Create and Configure Subscription Products

### Step 1: Navigate to Subscriptions

1. In Play Console, select your app
2. In the left sidebar, go to **"Monetize"** → **"Subscriptions"**
3. Click **"Create subscription"**

### Step 2: Create Subscription Product

1. **Enter Product Details**
   - **Product ID:** 
     - Unique identifier (e.g., `premium_monthly`, `pro_yearly`)
     - Lowercase, alphanumeric and underscores only
     - **CANNOT BE CHANGED LATER** - choose carefully!
     - Must match the Product ID in your app code exactly
   - **Name:** 
     - Display name shown to users (e.g., "Premium Monthly")
     - Can be changed later
     - Can be localized for different languages
   - **Description:**
     - What's included in the subscription
     - Benefits and features
     - 80 characters maximum
     - Can be localized

2. **Save Product**
   - Click **"Create"** or **"Save"**
   - You'll now configure the base plans

### Step 3: Add Base Plan (Required)

Every subscription needs at least one base plan.

1. **Click "Add base plan"**

2. **Configure Base Plan Details**
   - **Base plan ID:**
     - Another unique identifier (e.g., `monthly-standard`)
     - Lowercase, alphanumeric and underscores
     - Cannot be changed later
   - **Billing period:**
     - Weekly
     - Monthly (most common)
     - Every 2 months
     - Every 3 months
     - Every 4 months
     - Every 6 months
     - Yearly
   - **Renewal type:**
     - **Auto-renewing:** Continues until user cancels (most common)
     - **Prepaid:** User pays upfront, no auto-renewal

3. **Set Pricing**
   - Click **"Set price"**
   - **Primary country:** Choose your main market (e.g., United States)
   - Enter price in local currency (e.g., $9.99)
   - Click **"Apply prices to other countries"**
     - Google auto-converts to local currencies
     - Uses current exchange rates
     - You can manually adjust per country if needed
   - Review pricing in all markets
   - Click **"Apply prices"**

4. **Configure Grace Period** (Recommended)
   - What it is: User keeps access even if payment fails
   - Duration options:
     - 3 days (recommended minimum)
     - 7 days (recommended for most apps)
     - 14 days
   - Google will retry payment during this period
   - After grace period: User loses access but subscription not canceled yet

5. **Configure Account Hold** (Recommended)
   - What it is: After grace period, if payment still fails
   - User loses access but subscription isn't canceled
   - Google continues payment retry for 30 days
   - Benefits: Recovers more payments than immediate cancellation
   - **Enable this** unless you have specific reasons not to

6. **Backward Compatibility**
   - **Eligibility for legacy pricing:** Usually leave as default
   - This affects users who subscribed before you changed pricing

7. **Save Base Plan**

### Step 4: Add Offers (Optional but Recommended)

Offers include free trials, introductory pricing, and promotional prices.

#### Creating a Free Trial Offer

1. **Under your base plan, click "Add offer"**

2. **Configure Offer Details**
   - **Offer ID:** Unique identifier (e.g., `trial-7day`)
   - **Offer name:** Internal name for your reference
   
3. **Set Up Phases**
   - **Phase 1: Free Trial**
     - Duration: 7 days (or 3, 14, 30 days)
     - Price: $0.00
     - Click **"Add phase"**
   - **Phase 2: Regular Price** (automatically inherits from base plan)
     - This starts after trial ends
     - Uses base plan pricing

4. **Set Eligibility**
   - **New customers only:** Only for first-time subscribers (recommended)
   - **All customers:** Anyone can use this offer
   - **Upgrade:** Only for users upgrading from another subscription
   - **Specific criteria:** Custom targeting

5. **Save Offer**

#### Creating an Introductory Price Offer

1. **Add another offer**
2. **Configure phases:**
   - **Phase 1: Intro Price**
     - Duration: 1 month, 3 months, etc.
     - Price: Discounted rate (e.g., $0.99 for first month)
   - **Phase 2: Regular Price**
     - Automatically uses base plan price
3. **Set eligibility** (usually new customers only)
4. **Save**

### Step 5: Create Additional Subscription Products

Repeat Steps 2-4 for each subscription tier:
- Monthly subscription
- Yearly subscription (with savings)
- Premium tier (if multiple tiers)
- Family plans (if applicable)

### Step 6: Activate Subscriptions

1. **Review All Configuration**
   - Check product IDs match your code
   - Verify pricing in all countries
   - Confirm offers are configured correctly
   - Review terms and policies

2. **Activate Products**
   - Click **"Activate"** (top right of each product)
   - Confirm activation
   - Products are now live for testing and production

**⚠️ IMPORTANT:** 
- You can deactivate products, but cannot delete them
- Product IDs are permanent
- Once activated and used, you cannot significantly change the base plan

---

## Phase 3: Enable API Access for Backend

Your backend needs API access to verify purchases and prevent fraud.

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: [https://console.cloud.google.com](https://console.cloud.google.com)
   - Sign in with the same Google account as Play Console

2. **Create New Project**
   - Click project dropdown (top left)
   - Click **"New Project"**
   - **Project name:** e.g., "MyApp Backend"
   - **Organization:** Your organization (if applicable)
   - Click **"Create"**
   - Wait for project creation (few seconds)

3. **Select Your Project**
   - Click project dropdown
   - Select your newly created project

### Step 2: Enable Google Play Developer API

1. **Navigate to API Library**
   - In Cloud Console, click **"Navigation menu"** (☰)
   - Go to **"APIs & Services"** → **"Library"**

2. **Find Google Play Developer API**
   - Search for "Google Play Android Developer API"
   - Click on it

3. **Enable the API**
   - Click **"Enable"**
   - Wait for activation (few seconds)

### Step 3: Create Service Account

Service accounts allow your backend to authenticate with Google's API.

1. **Navigate to Service Accounts**
   - In Cloud Console, go to **"Navigation menu"** (☰)
   - Select **"IAM & Admin"** → **"Service Accounts"**

2. **Create Service Account**
   - Click **"Create Service Account"**
   - **Service account name:** e.g., "play-billing-verifier"
   - **Service account ID:** Auto-generated (e.g., play-billing-verifier@...)
   - **Description:** "Verifies subscription purchases"
   - Click **"Create and Continue"**

3. **Grant Permissions** (Step 2 of wizard)
   - Skip this step (permissions granted in Play Console)
   - Click **"Continue"**

4. **Grant User Access** (Step 3 of wizard)
   - Skip this step
   - Click **"Done"**

### Step 4: Create and Download Service Account Key

1. **Find Your Service Account**
   - In the service accounts list, find the account you just created

2. **Create Key**
   - Click on the service account email
   - Go to **"Keys"** tab
   - Click **"Add Key"** → **"Create new key"**

3. **Choose Key Type**
   - Select **"JSON"**
   - Click **"Create"**

4. **Download Key File**
   - JSON key file automatically downloads
   - **CRITICAL:** Store this file securely
   - **Never commit to version control**
   - **Never expose publicly**
   - This file grants access to your Google Play account

5. **Rename File**
   - Rename to something meaningful
   - Example: `myapp-play-billing-key.json`

### Step 5: Link Service Account to Play Console

1. **Go to Play Console**
   - Navigate to [https://play.google.com/console](https://play.google.com/console)

2. **Access API Settings**
   - Click **"Setup"** → **"API access"**
   - You'll see your Cloud project

3. **Link Cloud Project** (if not already linked)
   - Click **"Link"** next to your Cloud project
   - Confirm linking

4. **Grant Permissions to Service Account**
   - Find your service account in the list
   - Click **"Manage Play Console permissions"** or **"Grant access"**

5. **Set Permissions**
   - **Financial data:** View financial reports (Required for purchase verification)
   - **Order management:** View and refund orders (Required)
   - **Release management:** Not required but useful for backend automation
   - Click **"Invite user"** or **"Save"**

6. **Accept Invitation**
   - Service account is now linked
   - Check your email for confirmation

### Step 6: Set Up Real-Time Developer Notifications (Recommended)

This allows Google to notify your backend of subscription events in real-time.

1. **Create Pub/Sub Topic in Cloud Console**
   - Go to Cloud Console
   - Navigate to **"Pub/Sub"** → **"Topics"**
   - Click **"Create Topic"**
   - **Topic ID:** e.g., `play-billing-notifications`
   - Leave other settings as default
   - Click **"Create"**

2. **Grant Google Play Permission to Publish**
   - Click on your newly created topic
   - Go to **"Permissions"** tab
   - Click **"Add Principal"**
   - **New principals:** `google-play-developer-notifications@system.gserviceaccount.com`
   - **Role:** Select "Pub/Sub Publisher"
   - Click **"Save"**

3. **Create Subscription** (to receive messages)
   - Click **"Subscriptions"** in Pub/Sub menu
   - Click **"Create Subscription"**
   - **Subscription ID:** e.g., `play-notifications-sub`
   - **Topic:** Select your topic
   - **Delivery type:** 
     - **Push:** If you have webhook endpoint (recommended)
     - **Pull:** If your backend polls for messages
   - **Endpoint URL:** Your backend webhook URL (e.g., `https://api.myapp.com/webhooks/play-billing`)
   - Click **"Create"**

4. **Configure in Play Console**
   - Go back to Play Console
   - Navigate to **"Monetize"** → **"Monetization setup"**
   - Under **"Real-time developer notifications"**
   - **Topic name:** Enter full topic path
     - Format: `projects/{project-id}/topics/{topic-name}`
     - Example: `projects/myapp-backend/topics/play-billing-notifications`
   - Click **"Send test notification"** to verify
   - Click **"Save"**

5. **Notification Events You'll Receive:**
   - `SUBSCRIPTION_PURCHASED`: New subscription
   - `SUBSCRIPTION_RENEWED`: Auto-renewal occurred
   - `SUBSCRIPTION_CANCELED`: User canceled
   - `SUBSCRIPTION_IN_GRACE_PERIOD`: Payment failed, grace period started
   - `SUBSCRIPTION_ON_HOLD`: Grace period ended, account on hold
   - `SUBSCRIPTION_REVOKED`: Subscription revoked (refund)
   - `SUBSCRIPTION_EXPIRED`: Subscription ended
   - `SUBSCRIPTION_PAUSED`: User paused subscription
   - `SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED`: Pause schedule modified
   - `SUBSCRIPTION_RESTARTED`: User resumed subscription
   - `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED`: User accepted price change

---

## Phase 4: Set Up Testing Environment

You cannot test Google Play Billing without uploading your app to Play Console.

### Step 1: Prepare Your App for Testing

1. **Build Release APK or AAB**
   
   For React Native:
   ```bash
   cd android
   ./gradlew assembleRelease
   # APK location: android/app/build/outputs/apk/release/app-release.apk
   
   # Or build AAB (recommended):
   ./gradlew bundleRelease
   # AAB location: android/app/build/outputs/bundle/release/app-release.aab
   ```

2. **Sign Your App** (if not already signed)
   - Generate keystore if you don't have one
   - Configure signing in `android/app/build.gradle`
   - Build should produce signed APK/AAB

3. **Verify Build**
   - Check file exists
   - Note the version code and version name
   - Ensure signing is configured

### Step 2: Create Internal Testing Track

1. **Navigate to Testing**
   - In Play Console, select your app
   - Go to **"Testing"** → **"Internal testing"**

2. **Create Release**
   - Click **"Create new release"**
   - If prompted about Play App Signing, choose to opt-in (recommended)

3. **Upload App Bundle**
   - Click **"Upload"**
   - Select your AAB or APK file
   - Wait for upload and processing (1-5 minutes)
   - Review any warnings or errors

4. **Release Notes**
   - Add release notes for testers
   - Example: "Initial version with Google Play Billing integration"

5. **Review and Rollout**
   - Review the release details
   - Click **"Save"**
   - Click **"Review release"**
   - Click **"Start rollout to Internal testing"**
   - Confirm rollout

### Step 3: Set Up License Testing

License testing lets you test purchases without being charged.

1. **Navigate to License Testing**
   - In Play Console, go to **"Setup"** → **"License testing"**

2. **Add License Testers**
   - Under **"License testers"**
   - Click **"Add email addresses"**
   - Add email addresses (one per line):
     - Your email
     - Your team members' emails
     - Test accounts
   - These must be Gmail accounts
   - Click **"Save changes"**

3. **Configure Test Response**
   - **LICENSED:** Simulate successful purchases (recommended)
   - **UNLICENSED:** Simulate license check failure
   - Choose **LICENSED** for subscription testing

4. **Important Notes:**
   - License testers are never charged
   - Their purchases work exactly like real ones
   - They can test all subscription features
   - Purchases are marked as test purchases in your backend

### Step 4: Add Testers to Internal Testing Track

1. **Create Testers List**
   - In **"Internal testing"**, go to **"Testers"** tab
   - Click **"Create email list"** or use existing list

2. **Add Tester Emails**
   - Add the same emails as license testers
   - Add any additional testers
   - Click **"Save changes"**

3. **Get Testing Link**
   - Copy the **"Opt-in URL"**
   - This is the link testers use to join
   - Example: `https://play.google.com/apps/internaltest/...`

4. **Send to Testers**
   - Email the opt-in URL to your testers
   - Include instructions:
     ```
     1. Click the link
     2. Accept to become a tester
     3. Install the app from Play Store
     4. Test subscription features
     ```

### Step 5: Accept Test Invitation (As Tester)

1. **Click Opt-in URL**
   - Opens Play Store page
   - Shows "You're a tester" message

2. **Accept Invitation**
   - Click **"Accept invitation"**
   - Confirm

3. **Download App**
   - Click **"Download it on Google Play"**
   - Install the app
   - App is now ready for testing

---

## Phase 5: Testing Your Implementation

### What You Can Test

✅ **Can Test:**
- Viewing subscription products
- Purchase flow
- Subscription activation
- Subscription status checking
- Restore purchases
- Grace periods
- Account holds
- Subscription cancellation
- Upgrade/downgrade flows
- Backend verification
- Real-Time Developer Notifications

❌ **Cannot Test:**
- Actual charges (license testers are never charged)
- Real payment methods (test cards only)
- Refunds from users
- Chargebacks

### Testing Checklist

#### Initial Setup Testing
- [ ] App installs from Play Store (internal testing link)
- [ ] App launches successfully
- [ ] Subscription products load and display correctly
- [ ] Prices show in correct local currency
- [ ] Free trial information displays (if applicable)

#### Purchase Flow Testing
- [ ] Tap purchase button opens Play Store billing sheet
- [ ] Subscription details are correct
- [ ] Can complete purchase flow
- [ ] Purchase success feedback works
- [ ] Subscription activates immediately
- [ ] Premium features unlock
- [ ] Receipt sent to backend for verification
- [ ] Backend successfully verifies purchase

#### Subscription Management Testing
- [ ] Current subscription status displays correctly
- [ ] Renewal date shows correctly
- [ ] "Manage subscription" button opens Play Store
- [ ] Can cancel subscription from Play Store
- [ ] After cancellation, subscription remains active until period ends
- [ ] App correctly shows "Cancels on [date]"

#### Edge Cases Testing
- [ ] Cancel purchase midway - app handles gracefully
- [ ] Airplane mode - app shows appropriate error
- [ ] Already subscribed - app prevents duplicate purchase
- [ ] Restore purchases works on new device/reinstall
- [ ] Network error during verification - app retries
- [ ] Backend verification fails - app handles properly

#### Backend Testing
- [ ] Purchase receipts received by backend
- [ ] Backend verifies with Google Play API successfully
- [ ] Subscription status stored in database
- [ ] Real-Time Notifications received for:
  - [ ] New purchase
  - [ ] Cancellation
  - [ ] Renewal
- [ ] Backend updates user subscription status
- [ ] Backend prevents duplicate processing of same purchase

### Testing Different Subscription States

#### Active Subscription
- Verify premium features work
- Check renewal date displays
- Confirm backend shows active status

#### Canceled (but still active)
- Cancel subscription
- Verify features still work
- Check "Expires on [date]" shows
- Wait for expiration date to pass
- Confirm features lock after expiration

#### Expired Subscription
- Wait for subscription to expire
- Verify premium features lock
- Check app shows upgrade prompts
- Confirm backend marks as expired
- Test re-subscription flow

#### Grace Period (Advanced)
You cannot easily test this without a real payment failure. In production:
- User's payment fails
- User keeps access for grace period
- Backend receives SUBSCRIPTION_IN_GRACE_PERIOD notification
- App should show warning to user

### Testing with Multiple Accounts

Test with at least 2-3 different Google accounts to ensure:
- Different users see correct subscription status
- One user's subscription doesn't affect others
- Restore purchases works correctly per account

### Performance Testing

- [ ] Products load in < 3 seconds
- [ ] Purchase flow completes smoothly
- [ ] No crashes during subscription operations
- [ ] App handles background/foreground transitions
- [ ] Network failures don't crash app

### Common Test Scenarios

**Scenario 1: First-Time User Journey**
1. Install app
2. Browse to premium feature
3. See paywall/upgrade prompt
4. View subscription options
5. Select plan with free trial
6. Complete purchase
7. Access premium features
8. Close and reopen app
9. Verify subscription persists

**Scenario 2: Returning User**
1. User previously subscribed
2. Uninstalled app
3. Reinstalls app
4. Opens app
5. Taps "Restore Purchases"
6. Subscription restored
7. Premium features unlock

**Scenario 3: Subscription Cancellation**
1. Active subscriber
2. Opens subscription management
3. Cancels subscription
4. Subscription remains active until period end
5. Features still accessible
6. App shows cancellation notice
7. After period ends, features lock
8. App shows re-subscribe option

---

## Important Limitations and Requirements

### Testing Limitations

#### ❌ Cannot Test with Standalone APK

**Google Play Billing will NOT work if:**
- You install APK directly from file
- You sideload the app
- You use ADB install
- App is not installed through Play Store

**Why:**
- Google Play Billing requires Play Store services
- Purchase verification checks app signature from Play Store
- Subscription status is tied to Play Store installation

#### ✅ Minimum Requirements for Testing

You MUST:
1. Upload app to Play Console (internal testing minimum)
2. Have app published in at least one testing track
3. Install app from Play Store via test link
4. Use Google account added as license tester
5. Have Play Store app installed and up to date
6. Be connected to internet

### Production Requirements

Before releasing to production:

#### App Requirements
- [ ] App must be signed with production keystore
- [ ] Version code must be higher than all previous versions
- [ ] Subscription code must be thoroughly tested
- [ ] Backend verification must be implemented
- [ ] Error handling must be comprehensive
- [ ] App must comply with Google Play policies

#### Google Play Console Requirements
- [ ] Merchant account verified and active
- [ ] All subscription products created and activated
- [ ] App content rating completed
- [ ] Privacy policy published and linked
- [ ] Store listing complete with all required assets
- [ ] Target API level meets Google's requirements
- [ ] App signing configured (Play App Signing recommended)

#### Legal and Policy Requirements
- [ ] Subscription terms clearly stated
- [ ] Auto-renewal clearly disclosed
- [ ] Cancellation process explained
- [ ] Refund policy defined
- [ ] Privacy policy covers subscription data
- [ ] Terms of service include subscription terms
- [ ] Compliance with Google Play policies:
  - No misleading claims
  - Clear pricing information
  - No deceptive free trial language
  - Proper content disclosure

### Subscription Policy Compliance

**Required Disclosures:**
- Auto-renewal: Must clearly state subscription auto-renews
- Pricing: Show price and billing cycle clearly
- Free trials: Must show when trial ends and billing begins
- Cancellation: Must be easy to find and execute
- Terms: Must link to subscription terms

**Example Acceptable Disclosure:**
> "Start your 7-day free trial. After trial, subscription auto-renews at $9.99/month until canceled. Cancel anytime in Google Play Store."

**Prohibited Practices:**
- ❌ Hidden subscription terms
- ❌ Unclear cancellation process
- ❌ Deceptive free trial terms
- ❌ Not honoring cancellations
- ❌ Charging before trial ends without clear notice

---

## Troubleshooting Common Issues

### Issue: Products Not Loading

**Symptoms:**
- App shows "No subscriptions available"
- Product query returns empty list
- Error: "Billing service unavailable"

**Solutions:**
1. **Verify products are activated in Play Console**
   - Go to Monetize > Subscriptions
   - Check each product shows "Active" status
   - If "Inactive", click Activate

2. **Check product IDs match exactly**
   - Product ID in code must match Play Console exactly
   - Case-sensitive
   - Check for typos, extra spaces

3. **Ensure app is installed from Play Store**
   - Not sideloaded APK
   - Installed via internal testing link
   - Play Store app is up to date

4. **Verify app version**
   - App uploaded to Play Console must match installed version
   - Check version code in Play Console vs. installed app
   - Upload latest version if needed

5. **Check billing library version**
   - Ensure using recent version (6.0+)
   - Update if using old version

6. **Wait for Play Store cache**
   - After activating products, wait 2-4 hours
   - Play Store needs to sync
   - Try again later

### Issue: "Item Not Available for Purchase"

**Symptoms:**
- Can see products but cannot purchase
- Error when tapping purchase button
- "Item not available in your country"

**Solutions:**
1. **Check account is license tester**
   - Email must be added in Setup > License testing
   - Must be Gmail account
   - Check spelling of email

2. **Verify pricing is set for user's country**
   - In Play Console, check subscription pricing
   - Ensure user's country has price configured
   - Add pricing if missing

3. **Check app is in testing track**
   - App must be uploaded and released
   - Internal testing track at minimum
   - Release must be rolled out

4. **Verify base plan exists**
   - Each subscription must have at least one base plan
   - Base plan must be active
   - Check offers are configured correctly

5. **Clear Play Store cache**
   - Settings > Apps > Play Store
   - Clear cache (not data)
   - Restart Play Store

### Issue: Purchase Succeeds but Not Verified

**Symptoms:**
- Purchase completes
- But app doesn't unlock features
- Backend doesn't receive verification request

**Solutions:**
1. **Check network connectivity**
   - App needs internet to send receipt to backend
   - Verify device is online
   - Check backend API is accessible

2. **Verify backend endpoint**
   - Correct URL configured in app
   - Endpoint is live and responding
   - Check firewall/security rules

3. **Check service account permissions**
   - Service account has correct permissions in Play Console
   - JSON key file is valid
   - API is enabled in Cloud Console

4. **Review backend logs**
   - Check for errors in backend logs
   - Verify Google Play API calls succeeding
   - Look for authentication issues

5. **Validate purchase token**
   - Purchase token must be sent to backend
   - Token must be valid and not expired
   - Check token is not already acknowledged

### Issue: "You Already Own This Item"

**Symptoms:**
- Cannot purchase subscription
- Error says already owned
- But app doesn't show active subscription

**Solutions:**
1. **Restore purchases**
   - Add "Restore Purchases" button in app
   - User taps it to sync subscriptions
   - App queries existing purchases

2. **Check subscription status**
   - May be canceled but still active
   - Check expiration date
   - Wait for expiration before re-purchasing

3. **Check different Google account**
   - Verify correct account is signed in
   - Previous purchase may be on different account
   - Switch accounts if needed

4. **Clear Play Store data** (last resort)
   - Settings > Apps > Play Store > Storage
   - Clear storage (will sign you out)
   - Sign back in
   - Try again

### Issue: Real-Time Notifications Not Received

**Symptoms:**
- No webhook calls to backend
- Subscription events not triggering
- Backend not receiving Pub/Sub messages

**Solutions:**
1. **Verify Pub/Sub topic configuration**
   - Topic name correct in Play Console
   - Format: `projects/{project}/topics/{topic}`
   - No typos or extra spaces

2. **Check Pub/Sub permissions**
   - Google Play has Publisher role on topic
   - Service account has Subscriber role
   - Verify in Cloud Console > Pub/Sub > Topic > Permissions

3. **Test notification**
   - In Play Console, click "Send test notification"
   - Check if received by backend
   - Review Cloud Console > Pub/Sub > Subscriptions

4. **Verify webhook endpoint**
   - Endpoint must be publicly accessible
   - Must return 200 OK response
   - Check SSL certificate valid
   - Review backend logs for incoming requests

5. **Check subscription configuration**
   - Subscription (not just topic) must be created
   - Push endpoint configured correctly
   - Subscription is active

### Issue: Transactions Taking Long Time

**Symptoms:**
- Purchase flow seems stuck
- Long delay before confirmation
- "Processing" message persists

**Solutions:**
1. **Check network speed**
   - Slow connection delays verification
   - Try on Wi-Fi instead of mobile data
   - Test on different network

2. **Verify backend performance**
   - Backend may be slow to respond
   - Check backend API latency
   - Optimize verification logic
   - Add timeouts and retries

3. **Review Google Play API quotas**
   - May have hit rate limits
   - Check Cloud Console > APIs > Quotas
   - Request quota increase if needed

4. **Check for app performance issues**
   - Main thread may be blocked
   - Move billing operations to background
   - Add loading indicators

---

## Production Deployment Checklist

### Pre-Launch

#### Technical Verification
- [ ] All subscription products tested in internal/closed testing
- [ ] Backend verification working correctly
- [ ] Real-Time Notifications configured and tested
- [ ] Purchase receipts validated by backend
- [ ] Error handling tested for all scenarios
- [ ] Subscription restoration works
- [ ] App handles network failures gracefully
- [ ] Loading and error states implemented
- [ ] Analytics tracking configured
- [ ] Crash reporting setup (e.g., Crashlytics)

#### Business Verification
- [ ] Merchant account verified and approved
- [ ] Bank account configured for payouts
- [ ] Tax information provided
- [ ] Pricing reviewed in all target countries
- [ ] Subscription terms finalized
- [ ] Privacy policy updated with subscription info
- [ ] Refund policy defined
- [ ] Customer support ready for subscription questions

#### Legal and Compliance
- [ ] App complies with Google Play subscription policies
- [ ] Auto-renewal clearly disclosed
- [ ] Cancellation process easy and clear
- [ ] Free trial terms transparent
- [ ] Pricing information visible before purchase
- [ ] Terms of service include subscription terms
- [ ] Privacy policy covers billing data
- [ ] GDPR compliance (if applicable)
- [ ] CCPA compliance (if applicable in California)

#### Play Console Configuration
- [ ] App signed with production keystore (not debug)
- [ ] Version code higher than all previous versions
- [ ] Target API level meets requirements
- [ ] App content rating completed
- [ ] Store listing complete (description, screenshots, etc.)
- [ ] All subscription products activated
- [ ] Pricing set for all target countries
- [ ] Production release created

### Launch

#### Internal Testing → Closed Testing
1. Upload to closed testing track
2. Invite larger group of testers (up to 100,000)
3. Gather feedback
4. Fix issues
5. Test for 1-2 weeks

#### Closed Testing → Open Testing (Optional)
1. Upload to open testing track
2. Public can opt-in
3. Gather broader feedback
4. Monitor crash reports
5. Test for 1-2 weeks

#### Open Testing → Production
1. Create production release
2. Upload final version
3. Complete release notes
4. Set rollout percentage (start with 5-20%)
5. Monitor for 24-48 hours
6. Increase rollout gradually
7. Reach 100% over 3-7 days

### Post-Launch

#### First 24 Hours
- [ ] Monitor crash reports
- [ ] Check backend logs for errors
- [ ] Verify purchases processing correctly
- [ ] Monitor Real-Time Notifications
- [ ] Check user reviews
- [ ] Respond to critical issues immediately

#### First Week
- [ ] Track subscription metrics (purchases, trials, cancellations)
- [ ] Monitor payment success rate
- [ ] Check grace period handling
- [ ] Review backend verification success rate
- [ ] Analyze user feedback
- [ ] Fix bugs promptly

#### Ongoing
- [ ] Monthly subscription reports
- [ ] Track renewal rates
- [ ] Monitor cancellation reasons
- [ ] Optimize pricing based on data
- [ ] A/B test subscription offers
- [ ] Update subscription features based on feedback
- [ ] Keep billing library updated
- [ ] Comply with policy updates from Google

---

## Additional Resources

### Official Documentation
- [Google Play Billing Overview](https://developer.android.com/google/play/billing/getting-ready)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)
- [Subscription Best Practices](https://developer.android.com/google/play/billing/best-practices)
- [Google Play Developer API](https://developers.google.com/android-publisher)

### React Native Libraries
- [react-native-iap GitHub](https://github.com/dooboolab-community/react-native-iap)
- [react-native-iap Documentation](https://react-native-iap.dooboolab.com/)

### Tools
- [Google Play Console](https://play.google.com/console)
- [Google Cloud Console](https://console.cloud.google.com)
- [Google Play Developer API Explorer](https://developers.google.com/android-publisher/api-ref/rest)

### Community Support
- [Stack Overflow - google-play-billing](https://stackoverflow.com/questions/tagged/google-play-billing)
- [Reddit - androiddev](https://www.reddit.com/r/androiddev/)
- [react-native-iap Discord/Discussions](https://github.com/dooboolab-community/react-native-iap/discussions)

---

## Support and Help

### Google Play Support

**For Play Console Issues:**
- [Play Console Help Center](https://support.google.com/googleplay/android-developer/)
- [Contact Developer Support](https://support.google.com/googleplay/android-developer/answer/7218994)

**Response Times:**
- Email: 24-48 hours
- Critical issues: Faster (but still slow)
- Policy violations: May take several days

### When to Contact Support

Contact Google Play Support for:
- Merchant account verification delays (>3 days)
- Account suspension or policy violations
- Payment processing issues
- API access problems
- Billing bugs in Play Store

Do NOT contact support for:
- Code implementation help (use Stack Overflow)
- General "how to" questions (use documentation)
- Library issues (use library's GitHub)

---

## Conclusion

You now have a complete guide to:
✅ Set up Google Play Developer account
✅ Configure subscription products
✅ Enable API access for backend
✅ Set up testing environment
✅ Test subscriptions thoroughly
✅ Launch to production
✅ Troubleshoot common issues

**Remember:**
- Testing requires uploading to Play Console
- Start with internal testing track
- Use license testers to avoid charges
- Implement backend verification (critical for security)
- Monitor subscriptions closely after launch

**Next Steps:**
1. Use the AI Implementation Prompt to build your subscription feature
2. Follow this guide to configure Play Console
3. Test thoroughly in internal testing
4. Deploy to production gradually
5. Monitor and optimize

Good luck with your subscription implementation! 🚀