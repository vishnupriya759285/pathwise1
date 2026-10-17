import { GoogleGenAI, Modality } from "@google/genai";

const liveModel = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
const liveInstructions = [
  "You are PATHWISE, a warm and concise voice-first decision companion for people navigating education and career crossroads in India.",
  "Listen carefully. Keep personal aspiration separate from family expectations, peer influence, social-status pressure and practical constraints.",
  "Ask one adaptive follow-up at a time and never save or present an inferred personal fact as confirmed.",
  "Do not judge appearance or voice, infer emotions, disability, intelligence or personality, diagnose anyone, or promise admission, jobs or funding.",
  "Speak in short, natural turns suitable for conversation. Explain uncertainty honestly.",
].join(" ");

function canIssueUnauthenticatedDevelopmentToken() {
  return process.env.NODE_ENV !== "production" || process.env.PATHWISE_ALLOW_UNAUTHENTICATED_LIVE_DEMO === "true";
}

export async function POST() {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { code: "GEMINI_NOT_CONFIGURED", message: "Add GEMINI_API_KEY on the server to enable Gemini Live." },
      { status: 503 },
    );
  }

  if (!canIssueUnauthenticatedDevelopmentToken()) {
    return Response.json(
      {
        code: "LIVE_AUTH_REQUIRED",
        message: "Gemini Live is protected in production until PATHWISE authentication is configured. The long-lived Gemini key is never sent to the browser.",
      },
      { status: 403 },
    );
  }

  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1beta" },
    });
    const now = Date.now();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 20 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: liveModel,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: liveInstructions,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
          },
        },
        lockAdditionalFields: [],
      },
    });

    if (!token.name) throw new Error("Gemini returned no ephemeral token.");

    return Response.json(
      {
        token: token.name,
        model: liveModel,
        expiresAt: new Date(now + 20 * 60 * 1000).toISOString(),
      },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    console.error("PATHWISE_GEMINI_LIVE_TOKEN_FAILED", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "GEMINI_LIVE_UNAVAILABLE", message: "A Gemini Live session could not be started. No profile data was changed." },
      { status: 502 },
    );
  }
}
