import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  profile: z.record(z.string(), z.unknown()).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(12)
    .optional(),
});

const systemPrompt = [
  "You are PATHWISE, an empathetic, highly knowledgeable decision companion for learners, students, and professionals in India.",
  "Keep the user’s aspiration, family expectations, peer influence, social-status pressure and practical constraints separate; never decide their future for them.",
  "Give grounded guidance about Indian education and career routes. Be transparent where live opportunity evidence is unavailable.",
  "Use 2 to 4 crisp sentences, then ask one useful follow-up question only when it would reduce uncertainty.",
  "Never judge appearance, infer disability or personality, provide a diagnosis, or promise admission, employment or funding.",
].join(" ");

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      {
        code: "GEMINI_NOT_CONFIGURED",
        message: "The Gemini guide is not configured. Add GEMINI_API_KEY on the server; no browser key is accepted.",
      },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_GUIDE_REQUEST", message: "Send a short message and optional limited conversation context." },
      { status: 400 },
    );
  }

  const { message, profile, history = [] } = parsed.data;
  const profileContext = profile ? JSON.stringify(profile).slice(0, 6000) : "No profile facts are confirmed yet.";
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const stream = await client.models.generateContentStream({
      model: process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash",
      contents: [
        ...history.map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }],
        })),
        {
          role: "user",
          parts: [{ text: `Confirmed profile context: ${profileContext}\n\nUser input: ${message}` }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 280,
        temperature: 0.7,
      },
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          }
          controller.close();
        } catch (error) {
          console.error("PATHWISE_GEMINI_TEXT_STREAM_FAILED", error instanceof Error ? error.name : "unknown");
          controller.error(error);
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PATHWISE_GEMINI_TEXT_REQUEST_FAILED", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { code: "GEMINI_UNAVAILABLE", message: "The Gemini guide could not respond. Your saved profile has not changed." },
      { status: 502 },
    );
  }
}
