export function GET() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const liveAvailable = geminiConfigured && (process.env.NODE_ENV !== "production" || process.env.PATHWISE_ALLOW_UNAUTHENTICATED_LIVE_DEMO === "true");
  return Response.json(
    {
      status: "ok",
      services: {
        liveGuide: liveAvailable,
        liveProvider: geminiConfigured ? "Live Voice" : "Live Voice needs GEMINI_API_KEY",
        syncedPersistence: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
      retention: "This starter stores no camera or microphone recording on the server.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
