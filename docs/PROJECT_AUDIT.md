# PATHWISE implementation audit

## Repository and architecture

PATHWISE is a Next.js 16.4.2 App Router, React 19.3 and TypeScript application. The primary experience is the client component at `src/app/pathwise-experience.tsx`; it uses hash navigation to preserve the phone-first prototype journey in one responsive website. Styling is in `src/app/globals.css`. `src/lib/pathway-engine.ts` owns deterministic route evaluation, simulations, task generation and local replanning.

The Vercel prototype remains a visual-flow reference only. This repository is the implementation source of truth.

| Area | Existing implementation | Status | Required action |
| --- | --- | --- | --- |
| Frontend | `pathwise-experience.tsx`, shared CSS, responsive desktop/mobile navigation | Working | Preserve and refine |
| Navigation | Hash routes for landing, interview, camera, profile, discovery, comparison, recommendation, simulation, action plan and timeline | Working | Add server route guards after authentication exists |
| Conversational AI | `api/guide` uses `@google/genai` and `gemini-3.8-flash` by default | Working with key | Retain server boundary and add rate limits with identity |
| Live voice | `api/live-token` issues one-use constrained Gemini Live token for `gemini-3.8-live`; browser streams PCM audio | Working locally with key | Bind to authenticated identity before production |
| Camera | Permissioned local preview/capture and optional local image preview | Working | Add OCR only with a consented secure-upload service |
| Priority profile | Eight explicit preference dimensions, importance and self-reported certainty | Working locally | Persist versioned evidence after database is configured |
| Opportunity data | Six starter opportunities, official discovery URLs and explicit low evidence quality | Sample | Add governed source ingestion and verification |
| Eligibility | Budget, time, relocation and income-window deterministic checks | Working | Add versioned institution-specific eligibility rules |
| Pathway engine | Up to Plan A–L labels; returns six distinct starter routes when available | Working for starter data | Link to verified opportunities |
| What-if and replanning | Scenario snapshots; approval-gated obstacle response that preserves completed tasks | Working locally | Persist scenario/revision audit records |
| Authentication | None | Missing | Select provider and enforce server-side ownership |
| Persistence | Browser local storage key `pathwise-v1` | Working locally | Replace/augment with authenticated storage |
| Payments | No provider or entitlement layer found | Missing | Add only after pricing/provider decision |
| Deployment | Standard Next build; local dev uses supported Webpack fallback for a OneDrive lock | Working locally | Configure Vercel/project environment and auth |

## Model and service inventory

| Provider / model | Responsibility | Credentials | Current boundary |
| --- | --- | --- | --- |
| Google Gemini `gemini-3.8-live` | Native-audio Live interview | `GEMINI_API_KEY` on server only | Ephemeral token in `api/live-token`; production intentionally requires authentication |
| Google Gemini `gemini-3.8-flash` | Streamed typed guidance | `GEMINI_API_KEY` on server only | `api/guide`; profile facts remain unconfirmed until user action |
| Browser media APIs | Camera preview, microphone capture, local fallback speech | Browser permission | No raw media is stored by PATHWISE |

## Source of truth rules

- Confirmed profile and priority changes are local-browser state in the current build.
- A priority has no scoring weight until the user checks it as confirmed.
- Opportunity records are version-controlled starter data, not live recruitment information.
- Eligibility and numerical comparisons run in `pathway-engine.ts`; Gemini only assists conversation.
- A selected pathway, simulation result and roadmap revision require an explicit user action.

See [product implementation status](./PRODUCT_IMPLEMENTATION_STATUS.md) for operation boundaries and production blockers.
