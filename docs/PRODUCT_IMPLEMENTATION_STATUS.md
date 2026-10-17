# PATHWISE product implementation status

Last verified locally: 2026-10-17.

## Current source of truth

The existing Next.js application is the source of truth for the working prototype. Confirmed profile data, priority settings, selected route, action state, conversation text and timeline events are stored under `pathwise-v1` in the current browser's local storage. Camera and microphone recordings are not stored by PATHWISE.

This is deliberately **not** described as account persistence or cross-device synchronization. Those need authenticated storage and ownership controls before they can be enabled.

## Implemented now

| Capability | Actual implementation | Status |
| --- | --- | --- |
| Voice conversation | Gemini Live native-audio session with short-lived browser token, transcription, interruption and typed fallback | Working locally when `GEMINI_API_KEY` is configured |
| Text conversation | Server-side Gemini streaming route with bounded history and profile context | Working when `GEMINI_API_KEY` is configured |
| Camera | Browser-permission camera or image preview, local in-memory only | Working; no vision/OCR upload or face inference |
| Priority profile | Explicit, editable importance and self-reported certainty for eight priority categories | Working locally; only confirmed priorities affect compatibility |
| Social-pressure context | Separate aspiration, family, peers and social-status fields with an explainable reflection | Working locally |
| Opportunity catalogue | Six clearly labelled starter routes with official discovery links | Working as sample/starter data only |
| Eligibility | Deterministic budget, time, relocation and income-window checks | Working; rules are not delegated to Gemini |
| Pathways | Up to Plan A–L labels; six genuinely distinct starter pathways are currently available | Working locally |
| Scoring | Separate profile-match, priority compatibility, feasibility, evidence-quality and coverage-based recommendation confidence | Working; no success probability is claimed |
| What-if | Structured scenario preserves the confirmed profile until the user applies it | Working locally |
| 30-day roadmap | Six evidence-oriented tasks across 30 days with task status controls | Working locally |
| Adaptive replanning | Obstacle classification for financial, family, time, motivation and qualification issues; preserves completed tasks and requires user approval | Working locally |
| Premium journey preview | Plan A is free; Plan B onward and the roadmap route through an explicitly labelled local demo-only unlock. A generated QR opens the app's Premium demo URL. | Working for local UX testing only; it accepts no payment and is disabled in production |

## Deliberately not represented as complete

| Capability | Current boundary | What is required before production enablement |
| --- | --- | --- |
| Live opportunity research | No search API or curator source workflow is configured | Approved source providers, source ingestion, expiry/review rules and source-backed records |
| Evidence verification | Starter records have low, explicit evidence quality | Primary-source extraction and human/automated verification policy |
| Account identity and sync | No authentication or database is configured | Auth provider, database, row-level policies, migrations, retention/deletion workflow |
| Premium subscription | A local demo unlock exists only to test the UX; it is not a checkout or entitlement system | Stripe account, price configuration, server webhook verification and entitlement storage |
| Cloud roadmap progress | Browser-local only | User-owned database records and authorization |
| OCR / document extraction | No configured vision/OCR provider | Consent flow, secure upload policy, retention policy and provider credentials |
| Production Gemini Live | The token route is intentionally blocked in production until identity is available | Authenticated user/session binding and rate limits |

## Integration map

```text
Interview UI -> /api/live-token -> Gemini ephemeral token -> Gemini Live
Interview text -> /api/guide -> Gemini streamed text
Profile + confirmed priorities -> pathway-engine.ts -> eligibility + scoring -> pathways
Scenario changes -> same pathway engine -> before/after simulation
Selected pathway -> action-plan generator -> task progress
Obstacle report -> replan proposal -> user approval -> revised future tasks
```

## Operation boundaries

- A priority affects route compatibility only after the user explicitly confirms it.
- A hard eligibility blocker remains a blocker regardless of a language-model explanation.
- A simulation does not overwrite the confirmed profile until **Apply scenario** is selected.
- A roadmap revision does not replace future tasks until **Apply approved revision** is selected.
- The camera preview is not sent to Gemini and does not infer emotion, disability, intelligence or personality.
- A displayed opportunity is starter data until a source-verification workflow exists; it is never represented as a current vacancy.

## Next implementation dependencies

1. Select and configure authentication plus a user-owned database.
2. Add a source-governed opportunity ingestion service before enabling live research claims.
3. Add a payment-provider account and webhook-backed entitlement records only after pricing and terms are chosen.
4. Add consented OCR/vision only after retention and deletion policies are approved.
