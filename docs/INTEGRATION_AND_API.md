# Integration map and API contract

## Current data flow

```text
Browser profile / priority confirmation
  -> pathway-engine.ts deterministic eligibility and scoring
  -> pathway cards / recommendation / simulation
  -> selected pathway action plan
  -> user obstacle -> proposed revision -> user approval

Browser text input -> POST /api/guide -> Gemini stream -> transcript UI
Browser microphone -> POST /api/live-token -> ephemeral token -> Gemini Live WebSocket
Browser camera -> local preview only (no upload route)
```

## GET `/api/health`

Returns non-secret runtime availability.

```json
{
  "status": "ok",
  "services": {
    "liveGuide": true,
    "liveProvider": "Gemini Live",
    "syncedPersistence": false
  },
  "retention": "This starter stores no camera or microphone recording on the server."
}
```

`liveGuide` is true only when `GEMINI_API_KEY` is available and the current Live-token policy permits the environment. It is not proof of account persistence, opportunity research or payment processing.

## POST `/api/guide`

Server-side streamed text guidance.

Request:

```json
{
  "message": "I want a creative career but I need stable income.",
  "profile": { "goal": "..." },
  "history": [{ "role": "user", "content": "..." }]
}
```

- `message`: required, trimmed, 1–2000 characters.
- `history`: optional, maximum 12 short text turns.
- `profile`: optional limited context; it is not treated as automatically confirmed information.

Success is a `text/plain; charset=utf-8` stream. Failures:

- `400 INVALID_GUIDE_REQUEST` for invalid input.
- `503 GEMINI_NOT_CONFIGURED` when no server key exists.
- `502 GEMINI_UNAVAILABLE` for provider failure.

The route does not mutate the profile, pathways, tasks or conversation storage.

## POST `/api/live-token`

Issues a one-use, short-lived Gemini Live token constrained to PATHWISE's native-audio model configuration. It never returns the long-lived `GEMINI_API_KEY`.

Failures:

- `503 GEMINI_NOT_CONFIGURED` when the provider is unavailable.
- `403 LIVE_AUTH_REQUIRED` in production until authenticated identity is connected.
- `502 GEMINI_LIVE_UNAVAILABLE` when token issuance fails.

The browser can use the ephemeral token only to start its Live session. Camera frames are not part of this request or Gemini Live input.

## Deterministic engine contract

`src/lib/pathway-engine.ts` takes a `Profile` and starter/verified `Opportunity` records. It returns:

- hard eligibility: satisfied checks, blockers, assumptions and missing facts;
- priority compatibility only from explicitly confirmed priority weights;
- separate feasibility, evidence quality and coverage-based recommendation confidence;
- distinct Plan A–L labels only where distinct routes exist;
- a scenario result with before/after pathway snapshots;
- an initial 30-day action plan;
- an approval-gated replan proposal which preserves completed tasks.

No model response can override a hard eligibility blocker. A score is a ranking aid, not a predicted career-success probability.

## Production boundaries

Database writes, source ingestion, payment webhooks, entitlement checks, guardian collaboration and document OCR do not currently exist. They must remain server-side and owner-authorized when added; a frontend flag must never grant premium access.
