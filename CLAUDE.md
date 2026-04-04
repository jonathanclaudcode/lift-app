# LIFT — AI messaging assistant for Swedish beauty clinics
Next.js 15 App Router, TypeScript strict, Supabase (Postgres + Auth + Realtime Broadcast + pgvector), Tailwind CSS v4, shadcn/ui (Base UI), Inngest workflows, Claude API (Sonnet 4.6 / Haiku 4.5), 46elks SMS, WhatsApp Cloud API, Motion v12, react-virtuoso, dnd-kit.

## Architecture
- /src/app/(auth)/ — Login, signup (no sidebar)
- /src/app/(app)/ — Authenticated app shell with sidebar
- /src/app/(app)/dashboard/ — Revenue impact metrics
- /src/app/(app)/conversations/ — Core messaging view (WhatsApp-style)
- /src/app/(app)/pipeline/ — CRM kanban board
- /src/app/(app)/assistant/ — Clinic owner's personal AI chat
- /src/app/api/webhooks/ — External webhooks (SMS, WhatsApp, Bokadirekt)
- /src/actions/ — Server Actions by domain
- /src/components/ui/ — shadcn/ui primitives
- /src/components/features/ — Feature components by domain
- /src/lib/supabase/ — server.ts (cookie-based SSR client), client.ts (browser singleton)
- /src/lib/native/ — Platform abstraction layer (haptics, push, camera)
- /src/lib/ai/ — Claude API client, prompt templates, skill cards
- /src/lib/channels/ — SMS (46elks), WhatsApp (Meta Cloud API), Messenger adapters
- /src/hooks/ — Custom React hooks
- /supabase/migrations/ — Database migrations (NEVER edit existing migrations)

## Commands
- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npm run typecheck` — TypeScript strict checking
- `npm test` — Run Vitest suite
- `npx supabase db push` — Apply migrations to remote
- `npx supabase gen types typescript --project-id $PROJECT_ID > src/lib/supabase/types.ts` — Regenerate types after schema changes

## Coding Conventions
- Server Components for data fetching, Client Components only for interactivity
- Server Actions for all UI mutations, Route Handlers only for external webhooks
- Zod validation on ALL inputs (Server Actions, Route Handlers, API responses)
- TanStack Query v5 for client state, staleTime: Infinity on realtime-managed queries
- Supabase Realtime Broadcast (NOT Postgres Changes) for all real-time UI updates
- Conventional commits: feat:, fix:, docs:, refactor:, test:
- Swedish for all user-facing text, English for code/comments

## CRITICAL RULES
- IMPORTANT: Every new table MUST have RLS enabled with clinic_id isolation
- IMPORTANT: Use (SELECT public.get_clinic_id()) pattern in ALL RLS policies for performance
- IMPORTANT: Store clinic_id in app_metadata (NOT user_metadata — user-writable = security hole)
- IMPORTANT: Denormalize clinic_id on EVERY table including messages — no cross-table RLS joins
- IMPORTANT: Never push directly to main — always use feature branches
- IMPORTANT: Never expose Supabase service_role key in client code
- IMPORTANT: Run typecheck and tests before every commit
- IMPORTANT: After every schema change, regenerate TypeScript types
- All environment variables in .env.local, never committed to git
- Responsive mobile-first design using Tailwind — h-dvh, safe-area-inset padding
- Use interactiveWidget: 'resizes-content' in viewport config for keyboard handling
