# HollowScan IAP Payment & Recovery Workflow

This chart illustrates the end-to-end process for a successful purchase and the automatic recovery of interrupted payments.

## 1. Successful Purchase Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Mobile App (UserContext)
    participant Google as Google Play Billing
    participant Backend as FastAPI Backend
    participant DB as Supabase DB

    User->>App: Click "Unlock Premium"
    App->>App: setCurrentUserId(user.id)
    App->>Google: requestSubscription(sku)
    Google-->>User: Show Payment Sheet
    User->>Google: Confirm Payment
    Google-->>App: purchaseUpdatedListener fired
    
    rect rgb(230, 245, 255)
    Note over App,Backend: Start Verification (Fix 1 & 2)
    App->>App: Check currentUserId (AsyncStorage fallback)
    App->>Backend: verifyWithBackend(token) + apikey header
    Backend->>Google: Validate token with Play Developer API
    Backend->>DB: Update subscription_status = 'active'
    Backend-->>App: { success: true }
    end

    App->>Google: finishTransaction()
    App->>App: refreshUserStatus()
    App-->>User: Show Success Modal & Unlock Features
```

## 2. Startup Recovery Flow (Fix 3)
*Handles purchases that were paid for but the app/server crashed before verification.*

```mermaid
sequenceDiagram
    participant App as Mobile App (UserContext)
    participant Google as Google Play Billing
    participant Backend as FastAPI Backend

    App->>App: App Launch / init()
    App->>App: loadUserData() -> setCurrentUserId()
    
    rect rgb(255, 245, 230)
    Note over App,Backend: Recovery Sync
    App->>Google: getAvailablePurchases()
    Google-->>App: Returns unacknowledged purchases
    loop For each purchase
        App->>Backend: verifyWithBackend(token)
        Backend-->>App: { success: true }
        App->>Google: finishTransaction()
    end
    end
    
    App->>App: Unlock Features
```

## Diagnostic Final Verdict: READY ✅
The system is now structurally reinforced for production. The combination of **Authenticated Headers**, **Race Condition Safety Nets**, and **Startup Recovery** ensures no payment token is ever lost or ignored.
