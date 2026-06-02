# CareCircle — AI Engineering Agent Instructions
## Project: CareCircle MVP v1.0 (Family Caregiving App)

> **Context:** This document serves as the high-level directive for AI coding agents (e.g., Cursor, GitHub Copilot, Replit Agent) to build the CareCircle app. It references `Gemini.md` as the source of truth for all business logic, UI constraints, and data models.

---

## 1. System Prompt for Agents

"You are an expert Full-Stack Mobile Developer specialized in React Native and Supabase. Your goal is to build 'CareCircle', a family caregiving app for the Indian market. You must strictly follow the technical stack and architectural constraints defined in the provided PRD v2.2. Use functional components with Hooks and prioritize modular, clean code."[cite: 3]

---

## 2. Core Directives

### A. Technical Stack Compliance
- **Frontend:** React Native (v0.74+), React Navigation v6, Zustand (State Management).[cite: 3]
- **Backend:** Node.js Express API hosted on Railway/Render.[cite: 3]
- **Database/Auth:** Supabase (PostgreSQL) with Row Level Security (RLS) enabled.[cite: 3]
- **Payments:** Razorpay Integration (India region).[cite: 3]
- **Ads:** Google AdMob (Banner ads only in v1).[cite: 3]

### B. The "No-Assumption" Rule
- If a feature is not in the "MVP Scope" (Section 20 of PRD), do NOT build it.[cite: 3]
- If a UI element's color or size is not specified, refer to the "UI/UX Constraints" (Section 16).[cite: 3]

---

## 3. Implementation Roadmap (Sequential Tasks)

### Phase 1: Infrastructure & Auth
1. **Supabase Setup:** Initialize the PostgreSQL schema according to the data models in Sections 5–9 of the PRD. Enable RLS.[cite: 3]
2. **Authentication:** Implement Google OAuth and Phone OTP.[cite: 3]
   - *Note:* Use generic environment variables for the SMS Gateway as per Section 22.[cite: 3]
3. **Onboarding:** Build the 'Create Circle' flow and the 'WhatsApp Invite' link generator.[cite: 3]

### Phase 2: Core Modules (The 'Big Four')
1. **Medicine Manager:** Build the CRUD for medicines and the daily `MedicineDoseLog` generator.[cite: 3]
2. **Task Board:** Implement real-time updates using Supabase Realtime for the kanban/tabbed task view.[cite: 3]
3. **Doctor Visit Log:** Build the timeline view and the Supabase Storage logic for prescription/report attachments.[cite: 3]
4. **Expense Tracker:** Implement the monthly spend view and budget progress bar (No individual splitting logic).[cite: 3]

### Phase 3: Dashboard & Role Logic
1. **Dashboard:** Aggregate data from all modules into a single `GET /dashboard` endpoint for high performance.[cite: 3]
2. **Patient Mode:** Implement the `Role-Based View Switcher`. If `user_role === 'Patient'`, bypass the main navigator and show the simplified Medicine Action screen only.[cite: 3]

### Phase 4: Monetization & Polish
1. **Razorpay:** Integrate the Family Plan subscription (₹149/mo).[cite: 3]
2. **AdMob:** Place banner ads in the Dashboard and List screens for Free users only.[cite: 3]
3. **Notifications:** Setup FCM for reminders and refill alerts.[cite: 3]

---

## 4. Key Agent Constraints

- **Security:** Do not expose API keys. Use `.env` files for everything (Supabase URL, Razorpay ID, AdMob IDs).[cite: 3]
- **Offline:** Use Zustand Persist to cache the Dashboard and Medicines for basic offline viewing.[cite: 3]
- **UI:** Ensure all touch targets are at least 48dp.[cite: 3] Use Google Blue (`#1A73E8`) for primary actions.[cite: 3]

---

## 5. File Manifest for Agents

Agents should expect/create the following key files:
- `src/navigation/AppNavigator.js` (Role-based logic)[cite: 3]
- `src/store/useStore.js` (Zustand state)[cite: 3]
- `src/services/supabase.js` (DB Client)[cite: 3]
- `src/services/api.js` (Centralized API calls)[cite: 3]
- `server/index.js` (Express entry point)[cite: 3]

---