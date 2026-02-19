# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Collaborative real estate investment partnership management app (French language UI). Built with React 19 frontend + Express 5 backend + PostgreSQL. Deployed on Render.

## Commands

- **`npm run dev`** — Start Vite dev server (frontend on :5173, proxies `/api` to :3001)
- **`npm run server`** — Start Express backend on port 3001
- **`npm run build`** — Production build (outputs to `dist/`)
- **`npm run lint`** — ESLint on all .js/.jsx files
- **No test framework configured**

Run both `npm run server` and `npm run dev` simultaneously for local development.

## Architecture

### Backend (`server/`)

- **`server/index.js`** — Single Express file with all API routes and middleware
- **`server/db.js`** — PostgreSQL connection pool (`pg` library, no ORM) and table initialization via `initDb()`
- Direct SQL with parameterized queries throughout (no ORM)
- Database tables: `users`, `groups`, `questionnaires`, `annonces`, `comments`, `search_prompts`
- Dev DB default: `postgres://investissement:investissement@localhost:5432/investissement`

### Frontend (`src/`)

- **`src/App.jsx`** — Root routing (React Router v7). Routes: `/`, `/questionnaire`, `/simulateur`, `/biens`, `/financement`, `/fiscalite`
- **`src/contexts/AuthContext.jsx`** — Auth state, Google OAuth login, group management, JWT handling via localStorage
- **`src/utils/api.js`** — `apiFetch()` helper that attaches Bearer token from localStorage
- **`src/components/Layout.jsx`** — Sidebar navigation with group info display
- **`src/pages/`** — Page components. `Biens.jsx` is the most feature-rich (property CRUD, comments, URL metadata extraction). `Simulateur`, `Financement`, `Fiscalite` are stubs.

### Auth Flow

Google OAuth 2.0 → backend verifies ID token → issues JWT (7-day expiry) with `{ id, name, email, avatar_url, group_id }` → frontend stores in localStorage → sent as `Authorization: Bearer` header.

### Data Access Pattern

All data routes require JWT auth + group membership. Users only see their group's data. Group joining is via 6-character invite codes.

## Key Conventions

- All UI text is in French
- CSS files are co-located with their components/pages
- Environment variables: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `NODE_ENV`
- Vite proxy config in `vite.config.js` forwards `/api` to Express in development
- ESLint flat config (v9) with React Hooks and React Refresh plugins
