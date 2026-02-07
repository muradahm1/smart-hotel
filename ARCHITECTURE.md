# 🏗️ PWA Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RAMZ CASHIER PWA                         │
│                  (Progressive Web App)                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Desktop    │   │    Tablet    │   │    Mobile    │
│   (Chrome)   │   │   (Safari)   │   │  (Android)   │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│                   (cashier.html)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Orders  │  │ Payment  │  │  Manual  │  │  Print   │  │
│  │   List   │  │  Panel   │  │  Orders  │  │ Receipt  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Logic                          │
│                (cashier-simple.js)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Order Management    • Payment Processing          │  │
│  │  • Receipt Generation  • Real-time Updates           │  │
│  │  • Statistics Tracking • Notification System         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Service    │   │   Offline    │   │   Supabase   │
│   Worker     │   │    Cache     │   │   Database   │
│ (cashier-sw) │   │(offline-cache)│   │   (Cloud)    │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Data Flow - Online Mode

```
┌──────────┐
│   User   │
│  Action  │
└────┬─────┘
     │
     ▼
┌─────────────────┐
│  Application    │
│     Logic       │
└────┬────────────┘
     │
     ├─────────────────────┐
     │                     │
     ▼                     ▼
┌─────────────┐      ┌──────────────┐
│  Supabase   │      │    Cache     │
│  Database   │      │  (IndexedDB) │
│             │      │              │
│  • Orders   │◄────►│  • Orders    │
│  • Menu     │      │  • Menu      │
│  • Trans.   │      │  • Pending   │
└─────────────┘      └──────────────┘
     │
     ▼
┌─────────────┐
│   Display   │
│   Updated   │
└─────────────┘
```

## Data Flow - Offline Mode

```
┌──────────┐
│   User   │
│  Action  │
└────┬─────┘
     │
     ▼
┌─────────────────┐
│  Application    │
│     Logic       │
└────┬────────────┘
     │
     ▼
┌──────────────────┐
│  Offline Cache   │
│   (IndexedDB)    │
│                  │
│  ✓ Read Orders   │
│  ✓ Queue Trans.  │
│  ✓ Save Local    │
└────┬─────────────┘
     │
     ▼
┌─────────────┐
│   Display   │
│   Updated   │
└─────────────┘
     │
     ▼
┌─────────────────┐
│  Wait for       │
│  Connection     │
└────┬────────────┘
     │
     ▼ (When Online)
┌─────────────────┐
│  Auto-Sync to   │
│    Database     │
└─────────────────┘
```

## Service Worker Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Request                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │ Service Worker │
            │   Intercepts   │
            └────────┬───────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ Static Asset │          │  API Request │
│  (HTML/CSS)  │          │  (Supabase)  │
└──────┬───────┘          └──────┬───────┘
       │                         │
       ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ Cache First  │          │Network First │
│              │          │              │
│ 1. Check     │          │ 1. Try       │
│    Cache     │          │    Network   │
│ 2. Return or │          │ 2. Cache     │
│    Fetch     │          │    Response  │
│ 3. Cache New │          │ 3. Fallback  │
│              │          │    to Cache  │
└──────────────┘          └──────────────┘
```

## Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Storage                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Service Worker Cache                   │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │  ramz-cashier-v2.0.0                     │ │    │
│  │  │  • HTML, CSS, JavaScript                 │ │    │
│  │  │  • Static Assets                         │ │    │
│  │  │  • ~2MB                                   │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │  ramz-data-v2.0.0                        │ │    │
│  │  │  • API Responses                         │ │    │
│  │  │  • Dynamic Content                       │ │    │
│  │  │  • ~1MB                                   │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         IndexedDB (ramz-cashier-db)            │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │  orders (Object Store)                   │ │    │
│  │  │  • Cached orders                         │ │    │
│  │  │  • Status index                          │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │  pendingTransactions (Object Store)      │ │    │
│  │  │  • Offline payments                      │ │    │
│  │  │  • Queued for sync                       │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────┐ │    │
│  │  │  menuItems (Object Store)                │ │    │
│  │  │  • Menu cache                            │ │    │
│  │  │  • Offline access                        │ │    │
│  │  └──────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         LocalStorage                           │    │
│  │  • dailyStats (sales tracking)                 │    │
│  │  • pwa-installed (install status)              │    │
│  │  • lastTransaction (reprint)                   │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Sync Process Flow

```
┌─────────────┐
│  Offline    │
│  Payment    │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Queue in        │
│  IndexedDB       │
│  (pending)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Detect Online   │
│  Connection      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Auto-Sync       │
│  Triggered       │
└──────┬───────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐   ┌──────────────┐
│  Send to     │   │  Show        │
│  Supabase    │   │  Notification│
└──────┬───────┘   └──────────────┘
       │
       ▼
┌──────────────────┐
│  Success?        │
└──────┬───────────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌─────┐ ┌─────┐
│ Yes │ │ No  │
└──┬──┘ └──┬──┘
   │       │
   ▼       ▼
┌─────┐ ┌─────┐
│Clear│ │Retry│
│Queue│ │Later│
└─────┘ └─────┘
```

## Installation Flow

```
┌─────────────────┐
│  User Visits    │
│  Cashier Page   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Service Worker │
│  Registers      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cache Assets   │
│  (Background)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  "Install App"  │
│  Button Shows   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Clicks    │
│  Install        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Browser Prompt │
│  Appears        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Accepts   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  App Installed  │
│  Icon Created   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Opens in       │
│  Standalone     │
└─────────────────┘
```

## File Dependencies

```
cashier.html
    │
    ├─► config-public.js (Supabase config)
    │
    ├─► supabase.js (Database client)
    │
    ├─► offline-cache.js (IndexedDB manager)
    │       │
    │       └─► Creates: ramz-cashier-db
    │
    ├─► cashier-simple.js (Main logic)
    │       │
    │       ├─► Uses: offline-cache.js
    │       ├─► Uses: supabase.js
    │       └─► Manages: UI & Business Logic
    │
    └─► Registers: cashier-sw.js
            │
            ├─► Caches: All static assets
            ├─► Intercepts: Network requests
            └─► Handles: Offline mode
```

---

**Legend:**
- `┌─┐` = Component/Module
- `│` = Connection/Flow
- `▼` = Direction of flow
- `◄─►` = Bidirectional sync
- `✓` = Completed action

---

This architecture ensures:
✅ Fast performance
✅ Offline reliability
✅ Data integrity
✅ Seamless sync
✅ Native app experience
