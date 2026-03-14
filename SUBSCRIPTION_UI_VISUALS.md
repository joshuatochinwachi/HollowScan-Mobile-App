# Subscription UI Visual Layout Guide

This document illustrates the refined "Centered Block" layout and professional copy implemented across all subscription touchpoints.

---

## 1. Profile Screen
The primary subscription dashboard, designed for maximum authority and clarity.

### [ 🍏 iOS View ]
Everything centered, with mandatory compliance links.
```text
┌───────────────────────────────────────────┐
│          Unlock Premium for Full          │
│              Feature Access               │
│                                           │
│      ┌─────────────────────────────┐      │
│      │ • Unlimited Real-Time Deals │      │
│      │ • Market Coverage (US,UK,CA)│      │ <── Centered Block
│      │ • High-Profit Push Alerts   │      │     (Left-Aligned Bullets)
│      │ • Universal Account Sync    │      │
│      └─────────────────────────────┘      │
│                                           │
│      [ Monthly Premium • ₦10,000 ]        │ <── Dark Gradient
│      [ Yearly Premium  • ₦112,000 ]       │ <── Gold Gradient
│                                           │
│        Terms of Use  •  Privacy Policy    │ <── Compliant Links
└───────────────────────────────────────────┘
```

### [ 🤖 Android View ]
Premium and clean. No Apple-specific clutter.
```text
┌───────────────────────────────────────────┐
│          Unlock Premium for Full          │
│              Feature Access               │
│                                           │
│      ┌─────────────────────────────┐      │
│      │ • Unlimited Real-Time Deals │      │
│      │ • Market Coverage (US,UK,CA)│      │ <── Same formatting, 
│      │ • High-Profit Push Alerts   │      │     high-end feel.
│      │ • Universal Account Sync    │      │
│      └─────────────────────────────┘      │
│                                           │
│      [ Monthly Premium • ₦10,000 ]        │ <── Same buttons
│      [ Yearly Premium  • ₦112,000 ]       │
│                                           │
│                                           │ <── CLEAN (No links here)
└───────────────────────────────────────────┘
```

---

## 2. Home Screen (Compact Paywall)
The high-energy "hook" that appears in the feed.

### [ All Platforms ]
Balanced vertical spacing and the specific user-preferred "Lock" wording.
```text
┌───────────────────────────────────────────────┐
│           🔒 Unlock All 208+ Daily Deals      │ 
│                                               │
│    Get unlimited access to all regions, real- │ <── Centered Subtext
│    time alerts, and synced Premium status.    │
│                                               │
│   ┌───────────────┐       ┌────────────────┐  │
│   │   1 Month     │       │   1 Year 👑    │  │ <── Dual Options
│   └───────────────┘       └────────────────┘  │
│                                               │
│               [ Privacy & Terms ]             │ <── iOS ONLY
└───────────────────────────────────────────────┘
```

---

## 3. Daily Limit Modal
The prioritized popup for immediate conversion.

### [ All Platforms ]
Professional "Centered Block" layout with a clean timer.
```text
┌───────────────────────────────────────────┐
│            Daily Limit Reached            │
│                                           │
│               [ 10:56:52 ]                │ <── Centered Timer
│                                           │
│      Unlock Premium for Full Access       │
│                                           │
│     ┌───────────────────────────────┐     │
│     │ • Real-Time Marketplace Drops  │     │ <── Centered Block
│     │ • Full Global Coverage         │     │
│     │ • Priority Network Alerts      │     │
│     └───────────────────────────────┘     │
│                                           │
│       [ Monthly Premium • 1 Month ]       │
│       [ Yearly Premium  • 1 Year 👑 ]      │
│                                           │
│             [ Privacy & Terms ]           │ <── iOS ONLY
│                   [ Close ]               │
└───────────────────────────────────────────┘
```

---

## 📐 The "Centered Block" Logic
To ensure the app looks **Professional** and "not vibecoded," we used a specific layout algorithm:

1.  **Block Container:** A container that takes up the full width but aligns its children to the center.
2.  **Internal List:** A smaller box inside that is `align-self: center`.
3.  **Bullet Alignment:** The bullet points inside that small box are `text-align: left`.

**Result:** The bullets all line up perfectly under each other (very organized), but the entire "chunk" sits perfectly in the dead-center of the screen (very premium).
