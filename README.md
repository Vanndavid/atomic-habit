<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Atomic Habits Workbook

A production-style React + Firebase web app inspired by *Atomic Habits*.  
It helps users define an identity, design good habits, reduce bad habits, track daily consistency, and run an AI-assisted job-hunt routine.

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Data Model (Firestore)](#data-model-firestore)
- [Security Rules](#security-rules)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Available Scripts](#available-scripts)
- [Routing Map](#routing-map)
- [How the Main Workflows Operate](#how-the-main-workflows-operate)
- [Build & Deployment Notes](#build--deployment-notes)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)

---

## Overview

This app is designed as a personal behavior-change workbook with these key goals:

1. **Identity-first change** (who you want to become).
2. **Habit system design** based on the 4 laws:
   - Make it Obvious
   - Make it Attractive
   - Make it Easy
   - Make it Satisfying
3. **Daily execution and reflection** through trackers and scorecards.
4. **AI-generated job-hunt planning** for focused daily action.

The UI is organized into authenticated pages with a left-side navigation shell, plus a sign-in/sign-up screen for access control.

---

## Core Features

### 1) Authentication
- Email/password sign in and sign up.
- Google OAuth sign in.
- Auth-aware route protection (unauthenticated users are redirected to `/login`).

### 2) Dashboard
- Personalized welcome.
- Identity statement snapshot.
- At-a-glance list of good habits vs bad habits.
- Quick links to habit management.

### 3) Identity (Fundamentals)
- Users define and save a personal identity statement.
- This statement acts as the anchor for habit decisions.

### 4) Habit Scorecard
- Users log behaviors and rate each as:
  - `+` positive
  - `-` negative
  - `=` neutral
- Supports add/delete and ordered display.

### 5) Four Laws Workflow
- Separate pages guide users to design habit components aligned with each law.
- Habit records include foundational fields like cue, craving, response, reward, implementation intention, and habit stacking.

### 6) Habit Tracker
- Weekly table (last 7 days) for good-habit completion toggles.
- Current streak and longest streak calculations.
- Fast visual feedback for completed days.

### 7) Job Hunt Planner (Gemini-powered)
- Generates a structured daily plan using Gemini (`gemini-2.5-flash`).
- Produces:
  - one daily focus
  - three must-do tasks
  - one skill-improvement task
  - one job-application task
  - one reflection prompt
- Supports daily notes, completion status, reflection answer, and history view.
- Computes a completion streak across past days.

---

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS 4
- Lucide icons

### Backend / Data
- Firebase Authentication
- Cloud Firestore
- Firestore security rules (`firestore.rules`)

### AI Integration
- `@google/genai` for Gemini plan generation in the Job Hunt Planner.

---

## Architecture

- **SPA Client**: React routes rendered in-browser.
- **Auth Context Provider**: global auth/user-loading state.
- **Protected Layout**: all main app pages are nested under authenticated layout routes.
- **Firestore-centric state**:
  - `onSnapshot` for real-time reads in many screens.
  - direct document writes/updates for user-generated content.
- **Per-user data isolation**: each user’s data lives under `/users/{uid}/...` and rules enforce ownership.

---

## Project Structure

```text
.
├── src
│   ├── App.tsx                    # Router + protected routing
│   ├── main.tsx                   # React entrypoint
│   ├── firebase.ts                # Firebase app/auth/db setup
│   ├── contexts
│   │   └── AuthContext.tsx        # Auth state provider
│   ├── components
│   │   ├── Layout.tsx             # Sidebar/mobile shell + sign out
│   │   └── ErrorBoundary.tsx      # Global runtime error boundary
│   ├── pages
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Identity.tsx
│   │   ├── Scorecard.tsx
│   │   ├── Tracker.tsx
│   │   ├── Law1.tsx
│   │   ├── Law2.tsx
│   │   ├── Law3.tsx
│   │   ├── Law4.tsx
│   │   └── JobHuntPlanner.tsx
│   └── lib
│       ├── firestore-errors.ts    # Firestore error mapping helpers
│       └── utils.ts               # UI utility helpers
├── firestore.rules                # Firestore access and validation rules
├── firebase-blueprint.json        # Data model blueprint
├── firebase-applet-config.json    # Firebase project/app runtime config
├── package.json
└── README.md
```

---

## Data Model (Firestore)

All app data is user-scoped:

- `/users/{userId}`
  - Profile fields (`uid`, `email`, `displayName`, `identityStatement`, `createdAt`)
- `/users/{userId}/habits/{habitId}`
  - Habit definition and law-related fields
- `/users/{userId}/scorecards/{scorecardId}`
  - Scorecard line items with `rating`
- `/users/{userId}/dailyPlans/{planId}`
  - AI-generated daily plan + execution logs
- `/users/{userId}/completions/{completionId}`
  - Daily completion record per habit/date
- `/users/{userId}/reflections/{reflectionId}`
  - General reflection records

For schema references, see `firebase-blueprint.json`.

---

## Security Rules

Security is implemented in `firestore.rules` with:

- **Authentication checks** (`request.auth != null`)
- **Ownership checks** (only same `uid` can access their subtree)
- **Field validation**:
  - required keys
  - type checks
  - string length limits
  - enum restrictions (e.g. `good`/`bad`, `+`/`-`/`=`)
- **Immutability protections**:
  - `uid` cannot be changed after create
  - `createdAt` cannot be modified on updates

Before releasing changes, always test rules against expected client writes.

---

## Getting Started

### Prerequisites

- Node.js 18+ (recommended current LTS)
- npm 9+
- A Firebase project (if you are not using the pre-configured applet setup)
- Gemini API access for AI planner functionality

### Install dependencies

```bash
npm install
```

---

## Environment Variables

Create a local env file (for local development) and provide required values.

The repository includes `.env.example` with documented variables:

- `GEMINI_API_KEY`
- `APP_URL`

> Note: In AI Studio runtimes, secrets/URLs may be injected automatically.

---

## Running the App

Start local dev server:

```bash
npm run dev
```

By default this project runs Vite on:

- `http://localhost:3000`

---

## Available Scripts

- `npm run dev` — start local development server.
- `npm run build` — create production build in `dist/`.
- `npm run preview` — preview production build locally.
- `npm run clean` — remove `dist/` output.
- `npm run lint` — TypeScript type-check (`tsc --noEmit`).

---

## Routing Map

Public routes:

- `/login`

Protected routes:

- `/` — Dashboard
- `/identity` — Fundamentals / identity statement
- `/scorecard` — Habits scorecard
- `/law1` — 1st Law: Obvious
- `/law2` — 2nd Law: Attractive
- `/law3` — 3rd Law: Easy
- `/law4` — 4th Law: Satisfying
- `/tracker` — Habit tracker
- `/job-hunt` — AI job-hunt planner

---

## How the Main Workflows Operate

### Auth + User bootstrap
1. User authenticates.
2. Auth context receives session via Firebase auth listener.
3. If first login, a user profile document is created under `/users/{uid}`.

### Habit lifecycle
1. User creates habits (good/bad).
2. User enriches habits with four-law fields.
3. Good habits show up in tracker for daily completion logging.
4. Dashboard summarizes habit state.

### Daily planning lifecycle
1. On Job Hunt Planner page, user generates today’s plan.
2. App requests structured JSON output from Gemini.
3. Plan is stored to Firestore and shown immediately.
4. User logs reflection + notes and marks completion.
5. History view and streak update from stored records.

---

## Build & Deployment Notes

- This project is compatible with modern Vite deployment workflows.
- Ensure Firebase config values match your target project.
- Firestore rules must be deployed alongside schema evolution.
- AI feature reliability depends on valid Gemini API key and quota.

---

## Troubleshooting

### App shows login loop
- Verify Firebase auth domain/project config.
- Check browser console for auth initialization errors.

### Firestore permission denied
- Confirm rules were deployed correctly.
- Confirm user is authenticated and writing to their own path.
- Validate payload shape (required fields and allowed lengths).

### Job planner generation fails
- Confirm `GEMINI_API_KEY` is present at runtime.
- Check API quota/billing and model availability.
- Inspect browser console/log output for malformed JSON or network issues.

### Build/type-check errors
- Run `npm run lint` for TypeScript diagnostics.
- Ensure dependency lockfile is in sync (`npm install`).

---

## Future Improvements

- Add automated tests (unit + integration + e2e).
- Add optimistic UI and better error surfacing for async operations.
- Improve accessibility auditing (keyboard/focus/ARIA pass).
- Add analytics dashboard (weekly completion rate, trend lines).
- Add export/import for habits and plan history.
- Add locale/timezone-aware streak calculations.

---

## Original AI Studio Link

View this app in AI Studio:  
https://ai.studio/apps/c6a28f20-e56d-4df4-be67-95ee7e7010b9
