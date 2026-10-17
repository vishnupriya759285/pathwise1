# Deployment guide

## Local run

1. Copy `.env.example` to `.env.local`.
2. Add a server-only `GEMINI_API_KEY` if Gemini text and Live voice are required.
3. Run `npm run dev` and open `http://localhost:3000`.

For a same-Wi-Fi phone presentation, open the app on the laptop through its LAN address (for example, `http://192.168.x.x:3000`) before showing the Premium QR. The generated QR then contains that LAN URL. Both devices must be on the same trusted Wi-Fi network. A public presentation should use the deployed HTTPS URL instead.

`npm run dev` uses Next's supported Webpack fallback because this OneDrive workspace can lock Turbopack's generated development cache. Production `npm run build` continues to use the standard Next/Turbopack build.

## Environment variables

| Variable | Purpose | Required |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server-side Gemini text and Live-token provider credential | For AI features |
| `GEMINI_TEXT_MODEL` | Typed guide model; defaults to `gemini-3.8-flash` | Optional |
| `GEMINI_LIVE_MODEL` | Live voice model; defaults to `gemini-3.8-live` | Optional |
| `PATHWISE_ALLOW_UNAUTHENTICATED_LIVE_DEMO` | Explicit demo-only production override | Must remain false for a public deployment without auth |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reserved future sync configuration | Not sufficient to enable persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Reserved future server-side persistence credential | Never expose to the browser |

Do not place any permanent provider key in a `NEXT_PUBLIC_*` variable or in browser source.

## Production checks

Run `npm run lint`, `npm test` and `npm run build` before deployment.

- Confirm `GET /api/health` reports only features actually configured.
- Verify `/api/guide` streams only with a server-side Gemini key.
- Keep Gemini Live authentication-protected. The current token route intentionally returns `LIVE_AUTH_REQUIRED` in production until identity is implemented.
- Test microphone and camera denial, network loss and provider failure on a phone.
- Do not classify starter opportunities as live research data.
- Add authentication, row-level policies, retention/deletion controls, source verification and payment-webhook verification before enabling account sync, premium content or sensitive cloud storage.

## Current deployment boundary

This project is safe to deploy as a local-persistence prototype. It is not yet a multi-user production service: no cloud database, auth provider, payment account, source-ingestion service or production identity binding has been configured.
