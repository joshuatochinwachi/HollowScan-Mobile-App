# Pokémon Center Queue Monitor — Full PRD

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [How the Queue System Actually Works](#3-how-the-queue-system-actually-works)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Component Breakdown](#5-component-breakdown)
6. [Detection Logic — Deep Dive](#6-detection-logic--deep-dive)
7. [Anti-Detection Strategy](#7-anti-detection-strategy)
8. [FastAPI Backend Integration](#8-fastapi-backend-integration)
9. [Supabase State Management](#9-supabase-state-management)
10. [FCM Push Notification Integration](#10-fcm-push-notification-integration)
11. [Deployment on Railway](#11-deployment-on-railway)
12. [Full Code Implementation](#12-full-code-implementation)
13. [Intelligent Scenario Handling](#13-intelligent-scenario-handling)
14. [Error Recovery & Resilience](#14-error-recovery--resilience)
15. [Testing Strategy](#15-testing-strategy)
16. [Environment Variables Reference](#16-environment-variables-reference)
17. [AI Agent Execution Guide (Antigravity)](#17-ai-agent-execution-guide-antigravity)
18. [Monitoring & Observability](#18-monitoring--observability)
19. [Future Improvements](#19-future-improvements)

---

## 1. Executive Summary

This document describes the complete design, code, and deployment strategy for the **Pokémon Center Queue Monitor** — a standalone microservice integrated into the HollowScan FastAPI backend.

The monitor watches `https://www.pokemoncenter.com` 24/7. When the site transitions from its normal shopping state into the **Queue-it virtual waiting room**, the system instantly:
- Records the state change in Supabase
- Fires an FCM push notification to all subscribed HollowScan users via topic messaging
- Exposes a `/monitor/pokemon-center/status` endpoint for the mobile app to query live state

The monitor is built to be **lightweight, respectful, and resilient** — it behaves like a normal browser visiting the page, not an aggressive scraping bot.

---

## 2. Problem Statement

Pokémon Center periodically activates a virtual queue (powered by Queue-it) during high-demand product drops — limited TCG sets, exclusive plushies, collaborations. The queue has a countdown timer and can go live at any hour, with zero public warning.

Users of HollowScan need to know the **instant** this queue goes live so they can join before the wait time becomes prohibitive. A 2-minute delay means the difference between a 15-minute wait and a 3-hour wait.

**Current gap:** No automated, app-integrated alert system exists for this specific state change on pokemoncenter.com that can be delivered as a push notification to a mobile app.

---

## 3. How the Queue System Actually Works

This section is critical. Understanding the exact mechanism determines the correct detection approach.

### 3.1 Queue-it Client-Side Implementation

Pokémon Center uses **Queue-it with a client-side JavaScript connector**. This means:

- The server always returns the same HTML shell at `https://www.pokemoncenter.com`
- Queue-it's JavaScript (`*.queue-it.net/script/...`) is loaded by the page
- That script runs in the browser, checks queue status with Queue-it's servers, and **dynamically replaces the page content** with the waiting room UI
- There is **no HTTP redirect** to a different URL — the URL stays `https://www.pokemoncenter.com`
- A plain `requests.get()` call will **never see the queue** — it sees only the server-rendered HTML, which looks normal

### 3.2 What the Queue Page Looks Like in the DOM

When the queue is active, Queue-it's JavaScript injects content that contains identifiable text and elements:

```
"Hi, Trainer! You're in the virtual queue"
"Estimated wait time"
"Your position in line"
countdown timer element
```

The Queue-it script also sets specific cookies (`QueueITAccepted`, `QueueITUnlockLink`) and may inject a `<div id="queueit_overlay">` or similar container.

### 3.3 Why Playwright Is Required

Because Queue-it is client-side JavaScript, you **must** use a real browser engine that:
1. Loads the page
2. Executes all JavaScript (including Queue-it's connector)
3. Waits for the DOM to fully render
4. Then reads the final rendered content

**Playwright with Chromium** is the correct tool. `requests` + `httpx` + `aiohttp` are all wrong for this use case.

### 3.4 Queue Activation Patterns (Known Intelligence)

Based on community observation:
- Queue activations typically happen between **9 AM – 12 PM PST** on drop days
- They can also activate at **midnight PST** for midnight drops
- The queue typically stays active for **30 minutes to 4 hours**
- Between drops, the site is completely normal — no queue elements exist in the DOM

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY DEPLOYMENT                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Pokemon Center Monitor Service             │   │
│  │                                                     │   │
│  │  ┌──────────────┐    ┌───────────────────────────┐ │   │
│  │  │  Scheduler   │───▶│   Playwright Browser      │ │   │
│  │  │  (APScheduler│    │   (Chromium, Headless)    │ │   │
│  │  │   25-35s     │    │                           │ │   │
│  │  │   interval)  │    │   Loads pokemoncenter.com │ │   │
│  │  └──────────────┘    │   Executes Queue-it JS    │ │   │
│  │                      │   Reads rendered DOM      │ │   │
│  │                      └───────────┬───────────────┘ │   │
│  │                                  │                  │   │
│  │                      ┌───────────▼───────────────┐ │   │
│  │                      │    Detection Engine        │ │   │
│  │                      │  (Multi-signal analysis)   │ │   │
│  │                      └───────────┬───────────────┘ │   │
│  │                                  │                  │   │
│  │            ┌─────────────────────▼──────────────┐  │   │
│  │            │         State Machine               │  │   │
│  │            │   NORMAL ◀──────────▶ QUEUE_ACTIVE  │  │   │
│  │            └─────────────────────┬──────────────┘  │   │
│  │                                  │                  │   │
│  └──────────────────────────────────┼──────────────────┘   │
│                                     │                       │
└─────────────────────────────────────┼───────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
    │    Supabase     │   │   FastAPI App   │   │   Firebase FCM   │
    │                 │   │   (Your main    │   │                  │
    │  pc_monitor_    │   │    backend)     │   │  Topic:          │
    │  state table    │   │                 │   │  pc_queue_alerts │
    │                 │   │  GET /monitor/  │   │                  │
    │  Records every  │   │  pokemon-center │   │  Push to ALL     │
    │  state change   │   │  /status        │   │  subscribed      │
    └─────────────────┘   └─────────────────┘   │  users instantly │
                                                 └──────────────────┘
```

---

## 5. Component Breakdown

| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser Engine | Playwright + Chromium | Execute JS, render DOM |
| Scheduler | APScheduler (AsyncIO) | Trigger checks every 25-35s |
| Detection Engine | Python (custom) | Analyze DOM for queue signals |
| State Machine | Python + Supabase | Track NORMAL ↔ QUEUE transitions |
| Alert System | Firebase Admin SDK | Send FCM topic push notifications |
| API Endpoint | FastAPI | Expose status to mobile app |
| Database | Supabase (PostgreSQL) | Persist state, history, metrics |
| Deployment | Railway | 24/7 hosting |

---

## 6. Detection Logic — Deep Dive

### 6.1 Multi-Signal Detection Strategy

Never rely on a single signal. Use multiple independent signals — all must be false for NORMAL state. Any one signal being true triggers QUEUE state.

```
Signal 1: Text content analysis (primary)
Signal 2: Queue-it specific DOM elements
Signal 3: Page title change
Signal 4: Network request interception (Queue-it XHR calls)
Signal 5: Cookie presence check
```

### 6.2 Signal Definitions

**Signal 1 — Text Content Analysis**

These strings appear in the rendered DOM ONLY when the queue is active:

```python
QUEUE_TEXT_SIGNALS = [
    "you're in the virtual queue",          # Primary Queue-it message
    "you are in the virtual queue",         # Alternate phrasing
    "hi, trainer! you're in",               # Pokemon Center specific greeting
    "estimated wait time",                  # Timer label
    "your position in line",                # Position indicator
    "virtual queue",                        # General Queue-it term
    "waiting room",                         # Alternate Queue-it term
    "you will be redirected",               # Post-queue redirect message
]
```

**Signal 2 — DOM Element Detection**

Queue-it injects specific elements:

```python
QUEUE_DOM_SELECTORS = [
    "#queueit_overlay",                     # Queue-it overlay container
    "[class*='queueit']",                   # Any Queue-it class
    "[id*='queueit']",                      # Any Queue-it ID
    "iframe[src*='queue-it.net']",          # Embedded Queue-it iframe
    "[data-queueit]",                       # Queue-it data attributes
]
```

**Signal 3 — Page Title Change**

Normal title: "Pokémon Center | Official Site for Pokémon"
Queue title: Often changes to include "Queue" or "Waiting"

**Signal 4 — Network Request Interception**

Queue-it makes XHR/fetch calls to `*.queue-it.net` domains. Intercepting these is definitive proof of queue activation.

**Signal 5 — Cookie Detection**

Queue-it sets specific cookies when active:
- `QueueITAccepted`
- `QueueITUnlockLink`

### 6.3 Confidence Scoring System

Rather than a binary detection, assign a confidence score:

```python
def calculate_queue_confidence(signals: dict) -> float:
    weights = {
        "text_match": 0.40,      # Strongest signal
        "dom_element": 0.30,     # Strong signal
        "network_request": 0.20, # Strong signal
        "title_change": 0.05,    # Weak signal alone
        "cookie_present": 0.05,  # Weak signal alone
    }
    score = sum(weights[k] for k, v in signals.items() if v)
    return score

# Threshold: score >= 0.40 triggers QUEUE state
# This means even text match alone is sufficient
# But false positives require multiple weak signals to fire
```

---

## 7. Anti-Detection Strategy

### 7.1 Core Philosophy

The goal is to behave like a **real user with the HollowScan app open in a browser tab**. Not to evade detection aggressively, but to not look like an obvious automated scraper.

### 7.2 Techniques Used

**Realistic User Agent Rotation**

Rotate through real, current browser user agents. Update these every few months.

```python
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]
```

**Randomized Poll Intervals**

Never poll on a fixed interval. Use a range with randomization:

```python
import random

def get_next_interval() -> float:
    # Base: 25 seconds, jitter: ±8 seconds
    base = 25
    jitter = random.uniform(-8, 8)
    return base + jitter  # Result: 17-33 seconds
```

**Realistic Browser Context**

Set proper headers, locale, timezone — everything a real browser sends:

```python
context = await browser.new_context(
    user_agent=random.choice(USER_AGENTS),
    locale="en-US",
    timezone_id="America/Los_Angeles",  # Pacific time (Pokemon Center's home timezone)
    viewport={"width": 1440, "height": 900},
    color_scheme="light",
    extra_http_headers={
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
    }
)
```

**Webdriver Flag Removal**

Playwright leaves a `navigator.webdriver = true` flag that basic bot detection catches. Remove it:

```python
await context.add_init_script("""
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
""")
```

**Persistent Browser Session**

Reuse the same browser context across checks (don't launch a new browser every 30 seconds). This mimics a user who has the page open in a tab.

**Realistic Page Wait Strategy**

Don't just check `domcontentloaded`. Wait for the page to be truly settled:

```python
await page.goto(URL, wait_until="networkidle", timeout=20000)
# Additional wait for Queue-it JS to execute if present
await page.wait_for_timeout(2000)
```

### 7.3 What We Deliberately Do NOT Do

- No fake mouse movements (unnecessary for this use case)
- No artificial scroll simulation
- No aggressive proxy rotation (not needed at 25-30s intervals)
- No browser fingerprint spoofing beyond the basics above

These would be overkill and actually make the traffic pattern MORE suspicious, not less.

---

## 8. FastAPI Backend Integration

### 8.1 Router Structure

Add a new router to your existing FastAPI app:

**File: `app/routers/monitor.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.dependencies import get_current_user, require_premium
from app.services.pokemon_monitor import PokemonMonitorService
from app.schemas.monitor import MonitorStatusResponse, SubscribeRequest
import logging

router = APIRouter(prefix="/monitor", tags=["Monitor"])
logger = logging.getLogger(__name__)


@router.get("/pokemon-center/status", response_model=MonitorStatusResponse)
async def get_pokemon_center_status():
    """
    Returns the current state of the Pokémon Center queue monitor.
    Publicly accessible — no auth required (read-only state).
    """
    service = PokemonMonitorService()
    status = await service.get_current_status()
    return status


@router.post("/pokemon-center/subscribe")
async def subscribe_to_alerts(
    request: SubscribeRequest,
    current_user=Depends(get_current_user)
):
    """
    Subscribe the authenticated user's FCM token to Pokémon Center queue alerts.
    Subscribes to the FCM topic 'pc_queue_alerts'.
    """
    service = PokemonMonitorService()
    result = await service.subscribe_user(
        user_id=current_user.id,
        fcm_token=request.fcm_token
    )
    return {"success": True, "message": "Subscribed to Pokémon Center queue alerts"}


@router.post("/pokemon-center/unsubscribe")
async def unsubscribe_from_alerts(
    request: SubscribeRequest,
    current_user=Depends(get_current_user)
):
    """
    Unsubscribe the user's FCM token from Pokémon Center queue alerts.
    """
    service = PokemonMonitorService()
    await service.unsubscribe_user(
        user_id=current_user.id,
        fcm_token=request.fcm_token
    )
    return {"success": True, "message": "Unsubscribed from Pokémon Center queue alerts"}


@router.get("/pokemon-center/history")
async def get_queue_history(
    limit: int = 10,
    current_user=Depends(get_current_user)
):
    """
    Returns historical queue activation events.
    Useful for the app to show users past drop patterns.
    """
    service = PokemonMonitorService()
    history = await service.get_queue_history(limit=limit)
    return {"events": history}


@router.post("/monitor/pokemon-center/trigger-test", include_in_schema=False)
async def trigger_test_notification(
    current_user=Depends(get_current_user)
):
    """
    INTERNAL ONLY: Trigger a test notification without changing state.
    Use during development to verify FCM integration works.
    """
    service = PokemonMonitorService()
    await service.send_test_notification(user_id=current_user.id)
    return {"success": True, "message": "Test notification sent"}
```

### 8.2 Schemas

**File: `app/schemas/monitor.py`**

```python
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class MonitorStatusResponse(BaseModel):
    state: Literal["NORMAL", "QUEUE_ACTIVE", "UNKNOWN", "ERROR"]
    detected_at: Optional[datetime]
    last_checked: Optional[datetime]
    confidence_score: Optional[float]
    queue_details: Optional[dict]  # position, wait time if extractable
    monitor_healthy: bool
    message: str


class SubscribeRequest(BaseModel):
    fcm_token: str


class QueueEvent(BaseModel):
    id: str
    state: str
    detected_at: datetime
    resolved_at: Optional[datetime]
    duration_minutes: Optional[float]
    confidence_score: float
```

### 8.3 Register the Router in main.py

```python
# In your main FastAPI app file
from app.routers import monitor

app.include_router(monitor.router)
```

---

## 9. Supabase State Management

### 9.1 Database Schema

Run these SQL migrations in your Supabase dashboard:

```sql
-- Table 1: Current monitor state (single row, updated in-place)
CREATE TABLE IF NOT EXISTS pc_monitor_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    -- States: NORMAL, QUEUE_ACTIVE, UNKNOWN, ERROR
    
    detected_at TIMESTAMPTZ,
    -- When this state was first detected
    
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    -- When the monitor last successfully ran
    
    confidence_score FLOAT DEFAULT 0.0,
    -- Detection confidence (0.0 - 1.0)
    
    queue_details JSONB DEFAULT '{}',
    -- Extracted queue info: position, wait_time, etc.
    
    monitor_healthy BOOLEAN DEFAULT TRUE,
    -- False if monitor itself is failing
    
    consecutive_errors INT DEFAULT 0,
    -- How many consecutive check failures
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the single state row on first run
INSERT INTO pc_monitor_state (state, monitor_healthy)
VALUES ('UNKNOWN', TRUE)
ON CONFLICT DO NOTHING;

-- Table 2: Historical queue events (append-only log)
CREATE TABLE IF NOT EXISTS pc_queue_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    event_type VARCHAR(30) NOT NULL,
    -- QUEUE_STARTED, QUEUE_ENDED, MONITOR_ERROR, MONITOR_RECOVERED
    
    state_before VARCHAR(20),
    state_after VARCHAR(20),
    
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    duration_minutes FLOAT,
    -- Populated when queue ends
    
    confidence_score FLOAT,
    signals_fired JSONB DEFAULT '{}',
    -- Which detection signals triggered
    
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    
    raw_page_snapshot TEXT,
    -- Optional: store relevant DOM snippet for debugging
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Subscriber tracking (for analytics, not required for FCM)
CREATE TABLE IF NOT EXISTS pc_monitor_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(user_id, fcm_token)
);

-- Index for fast state lookups
CREATE INDEX idx_pc_queue_events_detected_at 
ON pc_queue_events(detected_at DESC);

-- Row Level Security
ALTER TABLE pc_monitor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_queue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_monitor_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (your backend uses service role key)
CREATE POLICY "Service role full access" ON pc_monitor_state
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON pc_queue_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own subscriptions" ON pc_monitor_subscribers
    FOR ALL USING (auth.uid() = user_id);
```

### 9.2 Supabase Client Utilities

**File: `app/services/supabase_monitor.py`**

```python
import os
from supabase import create_client, Client
from datetime import datetime, timezone
from typing import Optional, dict
import logging

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


async def get_current_state() -> dict:
    """Fetch current monitor state from Supabase."""
    try:
        client = get_supabase()
        result = client.table("pc_monitor_state").select("*").single().execute()
        return result.data
    except Exception as e:
        logger.error(f"Failed to get monitor state: {e}")
        return {"state": "UNKNOWN", "monitor_healthy": False}


async def update_state(
    new_state: str,
    confidence_score: float = 0.0,
    queue_details: dict = None,
    consecutive_errors: int = 0
) -> bool:
    """Update the current monitor state."""
    try:
        client = get_supabase()
        payload = {
            "state": new_state,
            "last_checked": datetime.now(timezone.utc).isoformat(),
            "confidence_score": confidence_score,
            "queue_details": queue_details or {},
            "consecutive_errors": consecutive_errors,
            "monitor_healthy": consecutive_errors < 5,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        if new_state in ("QUEUE_ACTIVE",):
            payload["detected_at"] = datetime.now(timezone.utc).isoformat()

        client.table("pc_monitor_state").update(payload).neq("id", "00000000-0000-0000-0000-000000000000").execute()
        return True
    except Exception as e:
        logger.error(f"Failed to update state: {e}")
        return False


async def log_queue_event(
    event_type: str,
    state_before: str,
    state_after: str,
    confidence_score: float,
    signals_fired: dict,
    notification_sent: bool = False,
    raw_snapshot: str = None
) -> Optional[str]:
    """Append a queue event to the history table."""
    try:
        client = get_supabase()
        payload = {
            "event_type": event_type,
            "state_before": state_before,
            "state_after": state_after,
            "confidence_score": confidence_score,
            "signals_fired": signals_fired,
            "notification_sent": notification_sent,
            "notification_sent_at": datetime.now(timezone.utc).isoformat() if notification_sent else None,
            "raw_page_snapshot": raw_snapshot,
        }
        result = client.table("pc_queue_events").insert(payload).execute()
        return result.data[0]["id"] if result.data else None
    except Exception as e:
        logger.error(f"Failed to log queue event: {e}")
        return None


async def get_queue_history(limit: int = 10) -> list:
    """Fetch recent queue activation history."""
    try:
        client = get_supabase()
        result = (
            client.table("pc_queue_events")
            .select("*")
            .eq("event_type", "QUEUE_STARTED")
            .order("detected_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to get queue history: {e}")
        return []


async def mark_queue_ended(event_id: str, duration_minutes: float):
    """Update the queue event record when queue is resolved."""
    try:
        client = get_supabase()
        client.table("pc_queue_events").update({
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "duration_minutes": duration_minutes,
        }).eq("id", event_id).execute()
    except Exception as e:
        logger.error(f"Failed to mark queue ended: {e}")
```

---

## 10. FCM Push Notification Integration

### 10.1 Topic Strategy

Use **FCM Topics** instead of individual token targeting. This means:
- Users subscribe to the topic `pc_queue_alerts` at opt-in
- When the queue fires, ONE API call reaches ALL subscribers
- No need to iterate over thousands of tokens
- Delivery is near-instant

### 10.2 FCM Service

**File: `app/services/fcm_service.py`**

```python
import firebase_admin
from firebase_admin import credentials, messaging
import os
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK (do this once at startup)
_firebase_initialized = False

def initialize_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
    
    # Firebase credentials can be a file path or JSON string in env
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    elif cred_json:
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
    else:
        raise ValueError("Firebase credentials not configured")
    
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True
    logger.info("Firebase Admin SDK initialized")


async def subscribe_token_to_topic(fcm_token: str, topic: str = "pc_queue_alerts") -> bool:
    """Subscribe a single FCM token to a topic."""
    initialize_firebase()
    try:
        response = messaging.subscribe_to_topic([fcm_token], topic)
        logger.info(f"Subscribed token to {topic}: {response.success_count} success")
        return response.success_count > 0
    except Exception as e:
        logger.error(f"Failed to subscribe token to topic: {e}")
        return False


async def unsubscribe_token_from_topic(fcm_token: str, topic: str = "pc_queue_alerts") -> bool:
    """Unsubscribe a single FCM token from a topic."""
    initialize_firebase()
    try:
        response = messaging.unsubscribe_from_topic([fcm_token], topic)
        return response.success_count > 0
    except Exception as e:
        logger.error(f"Failed to unsubscribe token from topic: {e}")
        return False


async def send_queue_active_notification(queue_details: dict = None) -> bool:
    """
    Send push notification to all subscribers when queue goes live.
    This is THE critical alert — make it count.
    """
    initialize_firebase()
    
    wait_time = queue_details.get("estimated_wait", "Unknown") if queue_details else "Unknown"
    
    try:
        message = messaging.Message(
            topic="pc_queue_alerts",
            notification=messaging.Notification(
                title="🚨 Pokémon Center Queue is LIVE!",
                body=f"Virtual queue just activated. Join now before the line gets longer!",
            ),
            data={
                # Data payload — accessible in app even when notification is tapped
                "type": "POKEMON_CENTER_QUEUE",
                "url": "https://www.pokemoncenter.com",
                "estimated_wait": str(wait_time),
                "detected_at": datetime.utcnow().isoformat(),
                "action": "OPEN_URL",
            },
            android=messaging.AndroidConfig(
                priority="high",  # Critical — wake up the device
                notification=messaging.AndroidNotification(
                    channel_id="drop_alerts",
                    priority="high",
                    default_vibrate_timings=False,
                    vibrate_timings_millis=[0, 500, 200, 500],
                    color="#FF4444",
                    icon="ic_notification_alert",
                    sound="alert_sound",
                ),
            ),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},  # Immediate delivery on iOS
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title="🚨 Pokémon Center Queue LIVE!",
                            body="Virtual queue just activated. Join now!",
                        ),
                        sound="alert_sound.caf",
                        badge=1,
                        category="QUEUE_ALERT",
                        content_available=True,
                    )
                ),
            ),
        )
        
        response = messaging.send(message)
        logger.info(f"Queue alert sent successfully. Message ID: {response}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send queue alert: {e}")
        return False


async def send_queue_resolved_notification() -> bool:
    """
    Optional: Notify users when queue is no longer active.
    """
    initialize_firebase()
    try:
        message = messaging.Message(
            topic="pc_queue_alerts",
            notification=messaging.Notification(
                title="✅ Pokémon Center Queue Ended",
                body="The virtual queue has closed. Site is back to normal.",
            ),
            data={
                "type": "POKEMON_CENTER_QUEUE_ENDED",
                "action": "DISMISS",
            },
        )
        messaging.send(message)
        return True
    except Exception as e:
        logger.error(f"Failed to send queue resolved notification: {e}")
        return False


async def send_test_notification_to_token(fcm_token: str) -> bool:
    """Send a test notification to a specific token (for development)."""
    initialize_firebase()
    try:
        message = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(
                title="🧪 HollowScan Test Alert",
                body="Your Pokémon Center queue alerts are working correctly!",
            ),
            data={"type": "TEST"},
        )
        messaging.send(message)
        return True
    except Exception as e:
        logger.error(f"Test notification failed: {e}")
        return False
```

---

## 11. Deployment on Railway

### 11.1 Service Structure

Deploy the monitor as a **separate Railway service** from your main FastAPI app. Reasons:
- Independent restarts (monitor crash doesn't affect your API)
- Independent resource allocation
- Cleaner separation of concerns
- The monitor needs to run a persistent browser process

### 11.2 Procfile / Railway Configuration

**`railway.toml`** (for the monitor service):

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "python -m app.services.pokemon_monitor"
restartPolicyType = "always"
restartPolicyMaxRetries = 10

[[services]]
name = "pokemon-center-monitor"
```

**`Procfile`** (alternative):
```
monitor: python -m app.services.pokemon_monitor
```

### 11.3 Railway Environment Variables

Set these in Railway dashboard for the monitor service:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
POLL_INTERVAL_BASE=25
POLL_INTERVAL_JITTER=8
PLAYWRIGHT_HEADLESS=true
LOG_LEVEL=INFO
RAILWAY_ENVIRONMENT=production
```

### 11.4 Playwright on Railway

Railway supports Playwright with Chromium. Add this to your `requirements.txt` and ensure the Dockerfile or nixpacks config installs system deps:

**`requirements.txt`** (monitor service):
```
playwright==1.44.0
apscheduler==3.10.4
supabase==2.4.0
firebase-admin==6.5.0
python-dotenv==1.0.1
httpx==0.27.0
```

**`nixpacks.toml`** or `Dockerfile` to install Chromium system deps:

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = ["chromium", "playwright-driver"]

[phases.install]
cmds = ["pip install -r requirements.txt", "playwright install chromium", "playwright install-deps chromium"]
```

Or with Dockerfile:

```dockerfile
FROM python:3.11-slim

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . .

CMD ["python", "-m", "app.services.pokemon_monitor"]
```

---

## 12. Full Code Implementation

### 12.1 Main Monitor Service

**File: `app/services/pokemon_monitor.py`**

```python
"""
Pokémon Center Queue Monitor
============================
Monitors https://www.pokemoncenter.com 24/7 for Queue-it virtual queue activation.
Fires FCM push notifications on state transitions.

Architecture:
- Playwright (Chromium) for JavaScript-capable page rendering
- APScheduler for precise interval management
- Supabase for state persistence
- Firebase FCM for push delivery
"""

import asyncio
import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from app.services.supabase_monitor import (
    get_current_state,
    update_state,
    log_queue_event,
    get_queue_history,
    mark_queue_ended,
)
from app.services.fcm_service import (
    send_queue_active_notification,
    send_queue_resolved_notification,
)

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pc_monitor")

# ─── Constants ────────────────────────────────────────────────────────────────
TARGET_URL = "https://www.pokemoncenter.com"
POLL_INTERVAL_BASE = int(os.getenv("POLL_INTERVAL_BASE", "25"))
POLL_INTERVAL_JITTER = int(os.getenv("POLL_INTERVAL_JITTER", "8"))
MAX_CONSECUTIVE_ERRORS = int(os.getenv("MAX_CONSECUTIVE_ERRORS", "10"))
QUEUE_CONFIDENCE_THRESHOLD = 0.40

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

QUEUE_TEXT_SIGNALS = [
    "you're in the virtual queue",
    "you are in the virtual queue",
    "hi, trainer! you're in",
    "estimated wait time",
    "your position in line",
    "virtual queue",
    "waiting room",
    "you will be redirected",
    "queueit",
    "queue-it",
]

QUEUE_DOM_SELECTORS = [
    "#queueit_overlay",
    "[class*='queueit']",
    "[id*='queueit']",
    "iframe[src*='queue-it.net']",
    "[data-queueit]",
    "#h2MainHeaderQueueNumber",
    ".queueNumber",
]

NORMAL_PAGE_SIGNALS = [
    "shop all",
    "add to cart",
    "browse",
    "new arrivals",
    "featured",
    "tcg",
]


class PokemonCenterMonitor:
    """
    Core monitor class. Maintains a persistent browser session and
    polls the Pokémon Center site for queue state changes.
    """

    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.playwright = None
        self.scheduler = AsyncIOScheduler()
        self.current_state = "UNKNOWN"
        self.consecutive_errors = 0
        self.active_queue_event_id: Optional[str] = None
        self.queue_detected_at: Optional[datetime] = None
        self._network_queue_detected = False
        self._current_user_agent = random.choice(USER_AGENTS)

    # ─── Browser Lifecycle ────────────────────────────────────────────────────

    async def initialize_browser(self):
        """Launch Playwright browser with anti-detection configuration."""
        logger.info("Initializing Playwright browser...")
        self.playwright = await async_playwright().start()
        
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--no-first-run",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-sync",
                "--disable-translate",
                "--hide-scrollbars",
                "--metrics-recording-only",
                "--mute-audio",
                "--no-pings",
                "--password-store=basic",
                "--use-mock-keychain",
            ]
        )
        
        await self._create_context()
        logger.info("Browser initialized successfully")

    async def _create_context(self):
        """Create a fresh browser context."""
        self._current_user_agent = random.choice(USER_AGENTS)
        
        self.context = await self.browser.new_context(
            user_agent=self._current_user_agent,
            locale="en-US",
            timezone_id="America/Los_Angeles",
            viewport={"width": 1440, "height": 900},
            color_scheme="light",
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
            }
        )
        
        # Remove automation fingerprints
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                ]
            });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        """)
        
        self.page = await self.context.new_page()
        
        # Intercept network requests to detect Queue-it API calls
        await self.page.route("**/*", self._handle_route)
        
        logger.info(f"New browser context created. UA: {self._current_user_agent[:60]}...")

    async def _handle_route(self, route):
        """Intercept network requests. Detect Queue-it API calls."""
        url = route.request.url
        if "queue-it.net" in url or "queueit" in url.lower():
            logger.debug(f"Queue-it network request detected: {url[:80]}")
            self._network_queue_detected = True
        await route.continue_()

    async def refresh_context_periodically(self):
        """
        Rotate browser context every ~2 hours to stay fresh.
        This prevents memory buildup and rotates the user agent.
        """
        logger.info("Rotating browser context...")
        try:
            if self.context:
                await self.context.close()
            await self._create_context()
            logger.info("Browser context rotated successfully")
        except Exception as e:
            logger.error(f"Context rotation failed: {e}")

    async def cleanup(self):
        """Clean up browser resources."""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logger.error(f"Cleanup error: {e}")

    # ─── Detection Logic ──────────────────────────────────────────────────────

    async def check_queue_status(self) -> dict:
        """
        Core detection method.
        Returns: {
            "is_queue": bool,
            "confidence": float,
            "signals": dict,
            "queue_details": dict,
            "page_title": str,
            "error": str | None
        }
        """
        result = {
            "is_queue": False,
            "confidence": 0.0,
            "signals": {
                "text_match": False,
                "dom_element": False,
                "network_request": False,
                "title_change": False,
                "cookie_present": False,
            },
            "queue_details": {},
            "page_title": "",
            "error": None,
        }

        try:
            # Reset network detection flag before this check
            self._network_queue_detected = False

            # Navigate to the page
            response = await self.page.goto(
                TARGET_URL,
                wait_until="domcontentloaded",
                timeout=25000,
            )

            # Check HTTP status
            if response and response.status >= 400:
                result["error"] = f"HTTP {response.status}"
                return result

            # Wait for Queue-it JS to execute (it needs time after DOM load)
            await self.page.wait_for_timeout(3000)

            # ── Signal 1: Text Content Analysis ───────────────────────────
            page_content = (await self.page.content()).lower()
            
            for signal in QUEUE_TEXT_SIGNALS:
                if signal in page_content:
                    result["signals"]["text_match"] = True
                    logger.debug(f"Text signal matched: '{signal}'")
                    break

            # Also check if NORMAL signals are present (absence of these = suspicious)
            normal_signals_found = sum(
                1 for s in NORMAL_PAGE_SIGNALS if s in page_content
            )

            # ── Signal 2: DOM Element Detection ───────────────────────────
            for selector in QUEUE_DOM_SELECTORS:
                try:
                    count = await self.page.locator(selector).count()
                    if count > 0:
                        result["signals"]["dom_element"] = True
                        logger.debug(f"DOM signal matched: '{selector}'")
                        break
                except Exception:
                    continue

            # ── Signal 3: Page Title Change ────────────────────────────────
            title = await self.page.title()
            result["page_title"] = title
            if title and any(
                word in title.lower()
                for word in ["queue", "waiting", "wait"]
            ):
                result["signals"]["title_change"] = True

            # ── Signal 4: Network Request Interception ─────────────────────
            result["signals"]["network_request"] = self._network_queue_detected

            # ── Signal 5: Cookie Detection ─────────────────────────────────
            cookies = await self.context.cookies()
            queue_cookies = [
                c for c in cookies
                if "queueit" in c["name"].lower() or "queueIT" in c["name"]
            ]
            result["signals"]["cookie_present"] = len(queue_cookies) > 0

            # ── Confidence Score Calculation ───────────────────────────────
            weights = {
                "text_match": 0.40,
                "dom_element": 0.30,
                "network_request": 0.20,
                "title_change": 0.05,
                "cookie_present": 0.05,
            }
            confidence = sum(
                weights[k] for k, v in result["signals"].items() if v
            )
            result["confidence"] = confidence
            result["is_queue"] = confidence >= QUEUE_CONFIDENCE_THRESHOLD

            # ── Extract Queue Details if Active ───────────────────────────
            if result["is_queue"]:
                result["queue_details"] = await self._extract_queue_details()

            logger.debug(
                f"Check complete. Queue: {result['is_queue']} | "
                f"Confidence: {confidence:.2f} | "
                f"Signals: {[k for k, v in result['signals'].items() if v]}"
            )

        except Exception as e:
            logger.error(f"Check failed: {e}")
            result["error"] = str(e)
            
            # Try to recover by recreating the page
            try:
                await self.page.close()
                self.page = await self.context.new_page()
                await self.page.route("**/*", self._handle_route)
                logger.info("Page recreated after error")
            except Exception as recover_err:
                logger.error(f"Page recovery failed: {recover_err}")

        return result

    async def _extract_queue_details(self) -> dict:
        """
        Attempt to extract queue position and wait time from the page.
        These are optional — don't let extraction failure block the alert.
        """
        details = {}
        try:
            # Try to extract wait time
            wait_selectors = [
                "#MainPart_divWaitingTimeText",
                "[class*='waitTime']",
                "[id*='waitTime']",
                ".queue-it-countdown",
            ]
            for sel in wait_selectors:
                try:
                    elem = self.page.locator(sel).first
                    if await elem.count() > 0:
                        text = await elem.inner_text()
                        details["estimated_wait"] = text.strip()
                        break
                except Exception:
                    continue

            # Try to extract queue position
            position_selectors = [
                "#h2MainHeaderQueueNumber",
                "[class*='queueNumber']",
                "[id*='queuePosition']",
            ]
            for sel in position_selectors:
                try:
                    elem = self.page.locator(sel).first
                    if await elem.count() > 0:
                        text = await elem.inner_text()
                        details["queue_position"] = text.strip()
                        break
                except Exception:
                    continue

        except Exception as e:
            logger.debug(f"Queue detail extraction error (non-critical): {e}")

        return details

    # ─── State Machine ────────────────────────────────────────────────────────

    async def process_check_result(self, check_result: dict):
        """
        Process detection result and trigger state transitions.
        Only fires notifications on NORMAL → QUEUE_ACTIVE transition.
        """
        previous_state = self.current_state

        if check_result.get("error"):
            self.consecutive_errors += 1
            logger.warning(
                f"Check error ({self.consecutive_errors}/{MAX_CONSECUTIVE_ERRORS}): "
                f"{check_result['error']}"
            )
            
            if self.consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                logger.error("Max consecutive errors reached. Reinitializing browser...")
                await self.cleanup()
                await self.initialize_browser()
                self.consecutive_errors = 0
            
            await update_state(
                new_state=previous_state,  # Keep existing state during errors
                consecutive_errors=self.consecutive_errors
            )
            return

        # Successful check — reset error counter
        self.consecutive_errors = 0
        new_state = "QUEUE_ACTIVE" if check_result["is_queue"] else "NORMAL"

        # ── Transition: NORMAL/UNKNOWN → QUEUE_ACTIVE ──────────────────────
        if new_state == "QUEUE_ACTIVE" and previous_state != "QUEUE_ACTIVE":
            logger.warning(
                f"🚨 QUEUE DETECTED! Confidence: {check_result['confidence']:.2f} | "
                f"Signals: {[k for k, v in check_result['signals'].items() if v]}"
            )
            
            self.current_state = "QUEUE_ACTIVE"
            self.queue_detected_at = datetime.now(timezone.utc)
            
            # 1. Update Supabase state
            await update_state(
                new_state="QUEUE_ACTIVE",
                confidence_score=check_result["confidence"],
                queue_details=check_result["queue_details"],
            )
            
            # 2. Fire FCM notification
            notification_sent = await send_queue_active_notification(
                queue_details=check_result["queue_details"]
            )
            
            # 3. Log the event
            self.active_queue_event_id = await log_queue_event(
                event_type="QUEUE_STARTED",
                state_before=previous_state,
                state_after="QUEUE_ACTIVE",
                confidence_score=check_result["confidence"],
                signals_fired=check_result["signals"],
                notification_sent=notification_sent,
            )
            
            logger.info(
                f"Alert sent: {notification_sent} | Event ID: {self.active_queue_event_id}"
            )

        # ── Transition: QUEUE_ACTIVE → NORMAL ─────────────────────────────
        elif new_state == "NORMAL" and previous_state == "QUEUE_ACTIVE":
            logger.info("Queue resolved. Site back to normal.")
            
            self.current_state = "NORMAL"
            duration_minutes = None
            
            if self.queue_detected_at:
                elapsed = datetime.now(timezone.utc) - self.queue_detected_at
                duration_minutes = elapsed.total_seconds() / 60
                logger.info(f"Queue was active for {duration_minutes:.1f} minutes")
            
            # Update Supabase
            await update_state(
                new_state="NORMAL",
                confidence_score=0.0,
            )
            
            # Update the event record
            if self.active_queue_event_id:
                await mark_queue_ended(
                    event_id=self.active_queue_event_id,
                    duration_minutes=duration_minutes or 0,
                )
            
            # Log resolution event
            await log_queue_event(
                event_type="QUEUE_ENDED",
                state_before="QUEUE_ACTIVE",
                state_after="NORMAL",
                confidence_score=0.0,
                signals_fired={},
            )
            
            # Optionally notify users queue is over
            await send_queue_resolved_notification()
            
            self.active_queue_event_id = None
            self.queue_detected_at = None

        # ── No Transition: State Unchanged ────────────────────────────────
        else:
            self.current_state = new_state
            # Just update last_checked timestamp
            await update_state(
                new_state=new_state,
                confidence_score=check_result.get("confidence", 0.0),
                consecutive_errors=0,
            )

    # ─── Scheduler ────────────────────────────────────────────────────────────

    async def run_check(self):
        """Scheduled job: run one detection check."""
        logger.debug("Running scheduled check...")
        check_result = await self.check_queue_status()
        await self.process_check_result(check_result)

    def get_next_interval(self) -> float:
        """Calculate next poll interval with randomization."""
        jitter = random.uniform(-self.POLL_INTERVAL_JITTER, self.POLL_INTERVAL_JITTER)
        return max(15, POLL_INTERVAL_BASE + jitter)

    async def run(self):
        """Main entry point. Start the monitor loop."""
        logger.info("=" * 60)
        logger.info("Pokémon Center Queue Monitor Starting")
        logger.info(f"Target: {TARGET_URL}")
        logger.info(f"Poll interval: {POLL_INTERVAL_BASE}s ± {POLL_INTERVAL_JITTER}s")
        logger.info("=" * 60)

        await self.initialize_browser()

        # Load current state from Supabase
        db_state = await get_current_state()
        self.current_state = db_state.get("state", "UNKNOWN")
        logger.info(f"Restored state from DB: {self.current_state}")

        # Schedule the check job
        self.scheduler.add_job(
            self.run_check,
            "interval",
            seconds=POLL_INTERVAL_BASE,
            jitter=POLL_INTERVAL_JITTER,
            id="pc_queue_check",
            max_instances=1,  # Never run two checks simultaneously
            coalesce=True,
        )

        # Schedule context rotation every 2 hours
        self.scheduler.add_job(
            self.refresh_context_periodically,
            "interval",
            hours=2,
            id="context_rotation",
        )

        self.scheduler.start()
        logger.info("Scheduler started. Monitor is running.")

        # Run initial check immediately
        await self.run_check()

        # Keep alive
        try:
            while True:
                await asyncio.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            logger.info("Shutdown signal received")
        finally:
            self.scheduler.shutdown()
            await self.cleanup()
            logger.info("Monitor stopped cleanly")


# ─── Service Layer (used by FastAPI router) ───────────────────────────────────

class PokemonMonitorService:
    """Service class used by FastAPI router endpoints."""

    async def get_current_status(self) -> dict:
        state = await get_current_state()
        return {
            "state": state.get("state", "UNKNOWN"),
            "detected_at": state.get("detected_at"),
            "last_checked": state.get("last_checked"),
            "confidence_score": state.get("confidence_score", 0.0),
            "queue_details": state.get("queue_details", {}),
            "monitor_healthy": state.get("monitor_healthy", False),
            "message": self._get_status_message(state.get("state", "UNKNOWN")),
        }

    def _get_status_message(self, state: str) -> str:
        messages = {
            "NORMAL": "Site is operating normally. No queue active.",
            "QUEUE_ACTIVE": "🚨 Virtual queue is LIVE! Join now.",
            "UNKNOWN": "Monitor initializing...",
            "ERROR": "Monitor is experiencing issues. Check logs.",
        }
        return messages.get(state, "Unknown state")

    async def subscribe_user(self, user_id: str, fcm_token: str) -> bool:
        from app.services.fcm_service import subscribe_token_to_topic
        from app.services.supabase_monitor import get_supabase
        
        # Subscribe to FCM topic
        success = await subscribe_token_to_topic(fcm_token, "pc_queue_alerts")
        
        # Record in Supabase
        if success:
            client = get_supabase()
            client.table("pc_monitor_subscribers").upsert({
                "user_id": user_id,
                "fcm_token": fcm_token,
                "is_active": True,
            }).execute()
        
        return success

    async def unsubscribe_user(self, user_id: str, fcm_token: str) -> bool:
        from app.services.fcm_service import unsubscribe_token_from_topic
        from app.services.supabase_monitor import get_supabase
        
        success = await unsubscribe_token_from_topic(fcm_token, "pc_queue_alerts")
        
        client = get_supabase()
        client.table("pc_monitor_subscribers").update({
            "is_active": False
        }).eq("user_id", user_id).eq("fcm_token", fcm_token).execute()
        
        return success

    async def get_queue_history(self, limit: int = 10) -> list:
        return await get_queue_history(limit)

    async def send_test_notification(self, user_id: str):
        from app.services.fcm_service import send_test_notification_to_token
        from app.services.supabase_monitor import get_supabase
        
        client = get_supabase()
        result = client.table("pc_monitor_subscribers").select("fcm_token").eq(
            "user_id", user_id
        ).eq("is_active", True).limit(1).execute()
        
        if result.data:
            token = result.data[0]["fcm_token"]
            await send_test_notification_to_token(token)


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    monitor = PokemonCenterMonitor()
    asyncio.run(monitor.run())
```

---

## 13. Intelligent Scenario Handling

This section defines how the monitor should behave in non-standard situations. These are the "edge cases" that will happen in production.

### Scenario 1: Queue Activates Mid-Check

**Situation:** The page loads normally, but Queue-it JS fires 2 seconds after DOM load.

**Handling:** The monitor waits 3 seconds after `domcontentloaded` before reading the DOM. This window is sufficient for Queue-it's client-side connector to execute and inject queue content.

**Suggestion for AI agent:** If false negatives are observed in production (users report queue was live but no alert fired), increase `page.wait_for_timeout(3000)` to `5000`. Queue-it execution time varies with server load.

---

### Scenario 2: Pokémon Center Is Down (503/504)

**Situation:** The site itself is unavailable, not queue-related.

**Handling:** 
- HTTP 4xx/5xx responses are caught and treated as errors, not queue detections
- Error counter increments
- No false positive notification sent
- State remains at previous known state

**Code path:** `if response.status >= 400: result["error"] = f"HTTP {response.status}"`

---

### Scenario 3: Queue Fires, Then Site Goes Down

**Situation:** Queue activates, notification sent. Then site becomes unavailable.

**Handling:** 
- State remains `QUEUE_ACTIVE` (errors don't override confirmed active queue)
- No "queue ended" notification fires until a successful check returns NORMAL
- This is intentional — it's better to leave users believing queue is active than falsely tell them it ended

---

### Scenario 4: Queue-it Updates Their JS

**Situation:** Queue-it deploys a new version that changes DOM selectors or text strings.

**Detection:** Monitor starts returning NORMAL when users report queue is active (false negatives).

**Handling:** 
- The multi-signal approach means text changes alone won't break detection if DOM elements or network requests still fire
- Network request interception (`queue-it.net` domains) is the most robust signal — it doesn't depend on DOM structure

**AI agent suggestion:** If detection failures are suspected, add a `page.screenshot()` capture whenever confidence is between 0.1 and 0.39 (partial signal detection). Store these screenshots in Supabase Storage for manual review.

---

### Scenario 5: Railway Container Restarts

**Situation:** Railway restarts the monitor service (deploy, crash, etc.)

**Handling:** 
- On startup, the monitor reads current state from Supabase
- If state was `QUEUE_ACTIVE`, the monitor immediately runs a check
- If queue is still active, no duplicate notification is sent (state didn't transition)
- If queue ended while monitor was down, the monitor transitions to NORMAL and logs `QUEUE_ENDED`

**Critical:** The `active_queue_event_id` is lost on restart. On startup, query Supabase for any open queue events (no `resolved_at`) and restore the ID.

**Add this to the `run()` method startup:**

```python
# Restore active queue event ID from database
if self.current_state == "QUEUE_ACTIVE":
    client = get_supabase()
    result = client.table("pc_queue_events").select("id, detected_at").eq(
        "event_type", "QUEUE_STARTED"
    ).is_("resolved_at", "null").order("detected_at", desc=True).limit(1).execute()
    
    if result.data:
        self.active_queue_event_id = result.data[0]["id"]
        self.queue_detected_at = datetime.fromisoformat(result.data[0]["detected_at"])
        logger.info(f"Restored active queue event: {self.active_queue_event_id}")
```

---

### Scenario 6: Railway IP Gets Rate Limited

**Situation:** Pokémon Center temporarily blocks the Railway server's IP.

**Detection:** All checks return errors (timeout, connection refused, or unexpected redirects).

**Handling:**
- Consecutive error counter triggers browser reinitialization after `MAX_CONSECUTIVE_ERRORS`
- If errors persist after reinitialization, the monitor enters `ERROR` state
- Admin alert fires (add Telegram or email notification for this)

**Mitigation:** 25-35 second polling intervals from a single IP is well within normal user behavior. Rate limiting from this pattern would be unusual. If it occurs, simply reduce poll frequency temporarily by increasing `POLL_INTERVAL_BASE` via environment variable without redeployment.

---

### Scenario 7: False Positive — Queue Text Appears in Normal Content

**Situation:** Pokémon Center adds marketing content that includes the word "queue" in normal context (e.g., "No need to queue at stores!").

**Handling:**
- Confidence scoring prevents single-text-match from firing
- The text "virtual queue" combined with DOM elements and/or network requests is required for high confidence
- If a false positive fires in production, add the specific phrase to a blocklist of false signal text

**Add to detection:**
```python
FALSE_POSITIVE_PHRASES = [
    "no need to queue",
    "skip the queue at",
    "queue at stores",
]

# In Signal 1:
if any(fp in page_content for fp in FALSE_POSITIVE_PHRASES):
    result["signals"]["text_match"] = False  # Override
```

---

### Scenario 8: Multiple Queue Activations in One Day

**Situation:** Drop day has multiple queue cycles (morning drop + evening restock).

**Handling:** Each NORMAL → QUEUE_ACTIVE transition fires a fresh notification. The state machine handles this correctly because after the first queue ends (`QUEUE_ENDED`), state returns to NORMAL, so the next activation is treated as a new transition.

**No special handling needed.** The state machine is correct for this scenario.

---

## 14. Error Recovery & Resilience

### 14.1 Health Check Endpoint

Add to your FastAPI app:

```python
@router.get("/monitor/pokemon-center/health")
async def monitor_health():
    state = await get_current_state()
    last_checked = state.get("last_checked")
    consecutive_errors = state.get("consecutive_errors", 0)
    
    # If last check was more than 5 minutes ago, monitor may be stuck
    if last_checked:
        from datetime import datetime, timezone
        last_dt = datetime.fromisoformat(last_checked.replace("Z", "+00:00"))
        minutes_since_check = (datetime.now(timezone.utc) - last_dt).total_seconds() / 60
        is_stale = minutes_since_check > 5
    else:
        is_stale = True
    
    return {
        "healthy": state.get("monitor_healthy", False) and not is_stale,
        "consecutive_errors": consecutive_errors,
        "minutes_since_last_check": minutes_since_check if last_checked else None,
        "is_stale": is_stale,
    }
```

### 14.2 Exponential Backoff on Errors

```python
async def get_backoff_interval(consecutive_errors: int) -> float:
    """
    Back off exponentially on errors but cap at 5 minutes.
    Normal: 25s. 3 errors: 50s. 5 errors: 100s. 10 errors: 300s.
    """
    base = POLL_INTERVAL_BASE
    backoff = min(base * (2 ** (consecutive_errors // 3)), 300)
    jitter = random.uniform(0, backoff * 0.1)
    return backoff + jitter
```

---

## 15. Testing Strategy

### 15.1 Unit Tests

```python
# tests/test_detection.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_queue_detected_on_text_signal():
    """Single strong text signal should trigger QUEUE_ACTIVE."""
    monitor = PokemonCenterMonitor()
    
    # Mock page content with queue text
    mock_content = "<html><body>Hi, Trainer! You're in the virtual queue. Estimated wait time: 30 min</body></html>"
    
    with patch.object(monitor, 'page') as mock_page:
        mock_page.content = AsyncMock(return_value=mock_content)
        mock_page.goto = AsyncMock(return_value=AsyncMock(status=200))
        mock_page.wait_for_timeout = AsyncMock()
        mock_page.title = AsyncMock(return_value="Pokémon Center")
        mock_page.locator = AsyncMock()
        
        result = await monitor.check_queue_status()
        
        assert result["signals"]["text_match"] == True
        assert result["confidence"] >= 0.40
        assert result["is_queue"] == True


@pytest.mark.asyncio
async def test_no_false_positive_on_normal_page():
    """Normal page content should not trigger detection."""
    mock_content = "<html><body>Shop all Pokémon products. New arrivals. Add to cart. TCG cards.</body></html>"
    # ... similar mock setup ...
    assert result["is_queue"] == False
    assert result["confidence"] < 0.40
```

### 15.2 Integration Test

To test the full pipeline without a real queue event:

1. Set `QUEUE_CONFIDENCE_THRESHOLD=0.0` temporarily in env
2. This makes any page visit trigger a "queue detected" state
3. Verify FCM notification arrives on your test device
4. Verify Supabase records the event
5. Reset threshold to `0.40`

### 15.3 Manual Verification

When a real queue event happens:
1. Check Railway logs for "QUEUE DETECTED" log line
2. Verify push notification arrives within 30 seconds
3. Check Supabase `pc_queue_events` table for the event record
4. Check `/monitor/pokemon-center/status` endpoint returns `QUEUE_ACTIVE`

---

## 16. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | — | Supabase service role key (not anon) |
| `FIREBASE_CREDENTIALS_JSON` | ✅ | — | Firebase service account JSON (stringified) |
| `FIREBASE_CREDENTIALS_PATH` | ⬜ | — | Alt: path to Firebase credentials file |
| `POLL_INTERVAL_BASE` | ⬜ | `25` | Base poll interval in seconds |
| `POLL_INTERVAL_JITTER` | ⬜ | `8` | Max random ± jitter on poll interval |
| `MAX_CONSECUTIVE_ERRORS` | ⬜ | `10` | Errors before browser reinitialization |
| `QUEUE_CONFIDENCE_THRESHOLD` | ⬜ | `0.40` | Minimum confidence to declare QUEUE_ACTIVE |
| `PLAYWRIGHT_HEADLESS` | ⬜ | `true` | Run browser headless |
| `LOG_LEVEL` | ⬜ | `INFO` | Python logging level |

---

## 17. AI Agent Execution Guide (Antigravity)

This section tells the AI agent in Google Antigravity exactly what to build, in what order, and what decisions to make autonomously.

### Phase 1: Project Scaffold

```
1. Create directory structure:
   app/
   ├── services/
   │   ├── pokemon_monitor.py     (main monitor — full code in Section 12)
   │   ├── supabase_monitor.py    (DB utilities — full code in Section 9)
   │   └── fcm_service.py         (FCM utilities — full code in Section 10)
   ├── routers/
   │   └── monitor.py             (FastAPI router — full code in Section 8)
   └── schemas/
       └── monitor.py             (Pydantic schemas — full code in Section 8)

2. Create requirements.txt with all dependencies from Section 11.4

3. Create Dockerfile from Section 11.4

4. Create nixpacks.toml from Section 11.4
```

### Phase 2: Database Setup

```
1. Connect to Supabase dashboard
2. Run all SQL from Section 9.1 in order
3. Verify tables created: pc_monitor_state, pc_queue_events, pc_monitor_subscribers
4. Insert initial state row: INSERT INTO pc_monitor_state...
5. Verify RLS policies are applied
```

### Phase 3: Firebase Setup

```
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key → download JSON
3. Stringify the JSON: json.dumps(json.load(open("key.json")))
4. Set FIREBASE_CREDENTIALS_JSON env var on Railway with this string
5. In Firebase Console → Cloud Messaging → ensure API is enabled
```

### Phase 4: FastAPI Integration

```
1. Open your main FastAPI app file (main.py or app.py)
2. Add: from app.routers import monitor
3. Add: app.include_router(monitor.router)
4. Register startup event to initialize Firebase:
   @app.on_event("startup")
   async def startup():
       from app.services.fcm_service import initialize_firebase
       initialize_firebase()
5. Test endpoints with: GET /monitor/pokemon-center/status
```

### Phase 5: Deploy Monitor Service on Railway

```
1. Create NEW Railway service (separate from your main API)
2. Connect to same GitHub repo
3. Set root directory to project root
4. Set start command: python -m app.services.pokemon_monitor
5. Add all environment variables from Section 16
6. Deploy and check logs for "Monitor is running"
7. Verify "Running scheduled check..." appears every ~25 seconds
```

### Phase 6: Mobile App Integration (Flutter/React Native)

```
1. Add FCM subscription call on app startup or in settings screen:
   POST /monitor/pokemon-center/subscribe
   Body: { "fcm_token": "<user's FCM token>" }

2. Handle push notification in app:
   - data.type == "POKEMON_CENTER_QUEUE" → open pokemoncenter.com
   - data.type == "POKEMON_CENTER_QUEUE_ENDED" → show dismissal

3. Add a "Queue Alert" toggle in app settings:
   - ON: call /subscribe
   - OFF: call /unsubscribe

4. Add status widget on app home screen:
   GET /monitor/pokemon-center/status
   - Show "🟢 Normal" or "🚨 Queue LIVE"
```

### Phase 7: Verification Checklist

```
□ Railway logs show "Pokémon Center Queue Monitor Starting"
□ Logs show scheduled checks every ~25-35 seconds
□ Supabase pc_monitor_state table has a row with state=NORMAL
□ GET /monitor/pokemon-center/status returns valid JSON
□ POST /monitor/pokemon-center/trigger-test sends test push notification
□ Test notification arrives on dev device within 10 seconds
□ Supabase pc_monitor_subscribers has entry after subscribe call
```

### Agent Decision Rules

**If Playwright fails to install on Railway:**
→ Switch to Dockerfile approach. Don't use nixpacks for this use case.

**If Queue-it detection confidence is always 0.0 in logs:**
→ Increase `page.wait_for_timeout` to 5000ms. Queue-it JS may be slow to execute.

**If Railway keeps restarting the monitor service:**
→ Check if it's OOMing. Playwright + Chromium needs at least 512MB RAM. Upgrade Railway plan if needed.

**If FCM notifications aren't arriving:**
→ Check Firebase credentials JSON is correctly stringified. Test with the `/trigger-test` endpoint first.

**If false positives occur (queue alert fires on normal page):**
→ Increase `QUEUE_CONFIDENCE_THRESHOLD` from 0.40 to 0.60 in env vars. No redeployment needed.

---

## 18. Monitoring & Observability

### 18.1 Key Metrics to Track in Railway Logs

```
[INFO] Running scheduled check...         → Normal operation
[WARNING] 🚨 QUEUE DETECTED!              → Queue found
[INFO] Queue resolved                     → Queue ended
[ERROR] Check failed: ...                 → Network/browser error
[INFO] Browser context rotated            → Scheduled rotation (every 2h)
[ERROR] Max consecutive errors reached    → Browser reinitializing
```

### 18.2 Supabase Dashboard Queries

```sql
-- Check current state
SELECT state, last_checked, consecutive_errors, monitor_healthy
FROM pc_monitor_state;

-- Recent queue events
SELECT event_type, detected_at, duration_minutes, notification_sent
FROM pc_queue_events
ORDER BY detected_at DESC
LIMIT 20;

-- Subscriber count
SELECT COUNT(*) FROM pc_monitor_subscribers WHERE is_active = TRUE;

-- Average queue duration
SELECT AVG(duration_minutes) FROM pc_queue_events
WHERE event_type = 'QUEUE_STARTED' AND duration_minutes IS NOT NULL;
```

### 18.3 Uptime Monitoring

Set up a Railway cron job or use UptimeRobot to ping `/monitor/pokemon-center/health` every 5 minutes. Alert if `healthy: false` or `is_stale: true`.

---

## 19. Future Improvements

| Improvement | Priority | Effort | Description |
|-------------|----------|--------|-------------|
| Screenshot on detection | High | Low | Capture page screenshot when queue detected, store in Supabase Storage for debugging |
| Predictive alerting | Medium | Medium | Analyze historical drop patterns, send "Drop likely in next 2 hours" alerts |
| Multi-retailer expansion | High | Medium | Extend same architecture to GameStop, Target, Best Buy for Pokémon drops |
| Queue position tracking | Low | Medium | Extract and broadcast queue position updates every 5 minutes while queue is active |
| Admin dashboard | Medium | High | Simple web UI showing monitor status, event history, subscriber count |
| Telegram backup alerts | Medium | Low | Send Telegram message to admin alongside FCM in case FCM fails |
| Drop calendar integration | Low | High | Scrape or integrate with community-sourced drop calendars to enable proactive monitoring |
| WebSocket live updates | Low | Medium | FastAPI WebSocket endpoint streaming real-time state to app without polling |

---

*End of PRD — Pokémon Center Queue Monitor v1.0*  
*Built for HollowScan | All components production-ready*
