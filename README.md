# PATHWISE

PATHWISE is a phone-first decision companion for people at education and career crossroads. It converts a user-confirmed context into explainable pathways instead of treating a generic chat answer as a plan.

## What is running

- Complete mobile-first flow from landing through interview, optional camera activity, profile, opportunity discovery, distinct Plan A–L-capable pathways, What-if, action plan and timeline.
- Separate fields for personal aspiration, family expectations, peer influence and social-status pressure.
- Deterministic budget, location, time and income-window eligibility rules.
- Explicit priority importance and certainty controls, separate compatibility/feasibility/evidence measures, and approval-gated adaptive roadmap revisions.
- Local browser persistence and hash-route navigation with Back and Forward support.
- Gemini Live native-audio interview with a short-lived, constrained browser session token.
- Gemini streamed text fallback and optional in-memory camera preview.

The included opportunities are starter records, visibly labelled for verification. They are not presented as live listings. Camera media is not uploaded or analysed in this implementation. Cross-device sync is also not claimed until authenticated persistence is configured.

## Run locally

1. Copy .env.example to .env.local.
2. Leave GEMINI_API_KEY empty to explore in truthful guided mode, or supply a server-only Google AI Studio Gemini key.
3. Run npm run dev.
4. Open http://localhost:3000.

Never place a Gemini key in a NEXT_PUBLIC variable. Gemini Live receives a short-lived, one-use token from `/api/live-token`; the permanent Gemini key never enters browser code. The token endpoint is enabled locally only. Before a public production deployment, connect it to real user authentication. `PATHWISE_ALLOW_UNAUTHENTICATED_LIVE_DEMO=true` is an explicit temporary demo override and must not be used on a public site.

## Verification

- npm run test validates distinct pathway generation, hard budget and relocation blockers, scenario isolation, task status generation and completed-task preservation during replanning.
- npm run build runs the Next.js production build.

## Architecture

- src/app/pathwise-experience.tsx: client journey, browser permissions, local persistence and navigation.
- src/lib/pathway-engine.ts: structured profile, starter opportunity graph, eligibility, pathway, scenario and action planning rules.
- src/app/api/guide/route.ts: server-side streamed Gemini text boundary.
- src/app/api/live-token/route.ts: server-only Gemini ephemeral-token issuer for the native-audio Live API.
- src/app/api/health/route.ts: non-secret integration availability status.
- docs: audit, routes, data flow, API contract and production plan.

## Why this is not normal GPT chat

Conversation is only the input layer. PATHWISE separates user aspiration from external pressure, requires confirmation before profile changes, evaluates deterministic constraints rather than asking a model to guess formal eligibility, stores structured pathway snapshots, preserves What-if baselines and generates accountable next actions. A language model may explain and ask questions; it cannot overrule hard affordability, location or time checks.
