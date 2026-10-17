"use client";

import {
  ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, ChevronRight, CircleAlert,
  Clock3, Compass, FileText, Home, Landmark, MapPin, Mic, MicOff, Radio, RefreshCcw,
  Route, ShieldCheck, SlidersHorizontal, Sparkles, Target, Users, Video, VideoOff, Volume2, VolumeX,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import Image from "next/image";
import QRCode from "qrcode";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionItem, Pathway, PriorityKey, PriorityPreference, Profile, ReplanProposal, Simulation, aspirationPressureSummary, buildPathways,
  compareSimulation, createActionPlan, defaultProfile, exampleProfile, opportunityCatalogue, priorityKeys,
  priorityLabels, proposeReplan,
} from "@/lib/pathway-engine";

type Screen = "home" | "interview" | "activity" | "review" | "profile" | "discover" | "compare" | "recommended" | "premium" | "simulate" | "recalculated" | "plan" | "timeline";
type ChatMessage = { id: string; role: "assistant" | "user"; content: string; source: "live" | "guided"; imageThumbnail?: string };
type TimelineEvent = { id: string; title: string; detail: string; at: string };
type GeminiLiveSession = {
  close: () => void;
  sendRealtimeInput: (params: { audio?: { data: string; mimeType: string }; text?: string; audioStreamEnd?: boolean }) => void;
};
type GeminiLiveMessage = {
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    interimInputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }> };
  };
};

const storageKey = "pathwise-v1";
let clientIdSequence = 0;

function createClientId(prefix: string) {
  clientIdSequence += 1;
  return `${prefix}-${Date.now()}-${clientIdSequence}`;
}

async function readTextResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (chunk: string) => void,
) {
  const decoder = new TextDecoder();
  let responseText = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const nextText = decoder.decode(chunk.value, { stream: true });
    if (nextText) {
      responseText += nextText;
      onChunk(nextText);
    }
  }

  const remainingText = decoder.decode();
  if (remainingText) {
    responseText += remainingText;
    onChunk(remainingText);
  }
  return responseText;
}
const routeByScreen: Record<Screen, string> = {
  home: "", interview: "interview", activity: "activity", review: "profile-review", profile: "profile",
  discover: "discover", compare: "pathways", recommended: "recommended", simulate: "what-if",
  premium: "premium", recalculated: "recalculated", plan: "action-plan", timeline: "my-path",
};
const screenByRoute = Object.fromEntries(Object.entries(routeByScreen).map(([screen, route]) => [route, screen])) as Record<string, Screen>;
const journey: Screen[] = ["home", "interview", "activity", "review", "profile", "discover", "compare", "recommended", "premium", "simulate", "recalculated", "plan", "timeline"];
const titleByScreen: Record<Screen, string> = {
  home: "PATHWISE", interview: "AI Interview", activity: "Camera activity", review: "Profile update",
  profile: "Your personal profile", discover: "Discover possibilities", compare: "Pathway comparison", premium: "PATHWISE Premium",
  recommended: "Recommended pathway", simulate: "What-if simulation", recalculated: "Recalculated pathway",
  plan: "30-day action plan", timeline: "My path",
};
const firstMessage: ChatMessage = {
  id: "welcome", role: "assistant", source: "guided",
  content: "I’m here to understand what matters to you, not to choose for you. What is one direction you would genuinely like to explore?",
};

function readScreenFromHash(): Screen {
  if (typeof window === "undefined") return "home";
  const route = window.location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
  return screenByRoute[route] ?? "home";
}
function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
}
function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
function guidedReply(profile: Profile) {
  if (!profile.goal) return "Thank you. Save your aspiration in the profile draft when it feels right. What would you want to protect while exploring it: income, time close to home, or creative freedom?";
  if (!profile.familyExpectation) return "I’ve kept your aspiration separate from other influences. What does your family hope or expect from your next step?";
  if (!profile.peerInfluence) return "That is useful context. Do friends or classmates pull you toward any particular course or career?";
  if (!profile.socialStatusExpectation) return "One final reflection: what kind of career do you feel society around you respects most?";
  return "You now have enough draft context to compare realistic options. You can correct any wording before PATHWISE evaluates constraints.";
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <span className="step-label">{children}</span>;
}

export default function PathwiseExperience() {
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [scenario, setScenario] = useState<Profile>(defaultProfile);
  const [selectedPathwayId, setSelectedPathwayId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([firstMessage]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [tasks, setTasks] = useState<ActionItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [guideState, setGuideState] = useState<"idle" | "thinking" | "error">("idle");
  const [guideNote, setGuideNote] = useState("Guided interview is ready");
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState("");
  const [activityChoice, setActivityChoice] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [search, setSearch] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveVoiceMode, setIsLiveVoiceMode] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [replanObstacle, setReplanObstacle] = useState("");
  const [replanProposal, setReplanProposal] = useState<ReplanProposal | null>(null);
  const [premiumAccess, setPremiumAccess] = useState<"free" | "demo">("free");
  const [pendingPremiumPathwayId, setPendingPremiumPathwayId] = useState("");
  const [premiumDemoQr, setPremiumDemoQr] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const interviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const autoSpeakRef = useRef(true);
  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const liveMicStreamRef = useRef<MediaStream | null>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const liveSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSinkRef = useRef<GainNode | null>(null);
  const livePlaybackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const livePlaybackCursorRef = useRef(0);
  const liveUserMessageIdRef = useRef("");
  const liveAssistantMessageIdRef = useRef("");
  const pathways = useMemo(() => buildPathways(profile), [profile]);
  const selectedPathway = useMemo(() => pathways.find((item) => item.id === selectedPathwayId) ?? pathways[0], [pathways, selectedPathwayId]);
  const pressure = useMemo(() => aspirationPressureSummary(profile), [profile]);
  const progressIndex = Math.max(0, journey.indexOf(screen));
  const demoPremiumAvailable = process.env.NODE_ENV !== "production";
  const hasPremiumAccess = premiumAccess === "demo";

  useEffect(() => { autoSpeakRef.current = autoSpeak; }, [autoSpeak]);
  useEffect(() => {
    const destination = `${window.location.origin}/#/premium`;
    let active = true;
    void QRCode.toDataURL(destination, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0d7666", light: "#ffffff" },
    }).then((dataUrl) => {
      if (active) setPremiumDemoQr(dataUrl);
    }).catch(() => {
      if (active) setPremiumDemoQr("");
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (cameraActive && cameraStreamRef.current) {
      if (interviewVideoRef.current && interviewVideoRef.current.srcObject !== cameraStreamRef.current) {
        interviewVideoRef.current.srcObject = cameraStreamRef.current;
      }
      if (videoRef.current && videoRef.current.srcObject !== cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current;
      }
    }
  }, [cameraActive, screen]);

  const addEvent = (title: string, detail: string) => {
    setEvents((current) => [{ id: createClientId("event"), title, detail, at: new Date().toISOString() }, ...current]);
  };
  const releaseCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraActive(false);
  };
  const goTo = (next: Screen, push = true) => {
    chatAbortRef.current?.abort();
    if (next !== "activity" && next !== "interview") releaseCamera();
    setGuideState("idle");
    setScreen(next);
    if (typeof window !== "undefined" && push) {
      window.history.pushState({}, "", routeByScreen[next] ? "#/" + routeByScreen[next] : "#/");
    }
  };
  const goBack = () => {
    const position = journey.indexOf(screen);
    goTo(position <= 0 ? "home" : journey[position - 1]);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setScreen(readScreenFromHash()));
    const updateScreen = () => setScreen(readScreenFromHash());
    window.addEventListener("hashchange", updateScreen);
    window.addEventListener("popstate", updateScreen);
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as { profile?: Profile; selectedPathwayId?: string; messages?: ChatMessage[]; tasks?: ActionItem[]; events?: TimelineEvent[]; premiumAccess?: "free" | "demo" };
          if (saved.profile) {
            const restoredProfile = { ...defaultProfile, ...saved.profile, priorities: saved.profile.priorities ?? {} };
            setProfile(restoredProfile);
            setScenario(restoredProfile);
          }
          if (saved.selectedPathwayId) setSelectedPathwayId(saved.selectedPathwayId);
          if (saved.messages?.length) setMessages(saved.messages);
          if (saved.tasks) setTasks(saved.tasks.map((task) => ({
            ...task,
            estimatedMinutes: task.estimatedMinutes ?? 30,
            status: task.status ?? (task.complete ? "completed" : "not-started"),
          })));
          if (saved.events) setEvents(saved.events);
          if (demoPremiumAvailable && saved.premiumAccess === "demo") setPremiumAccess("demo");
        }
      } catch {
        setGuideNote("Saved local data could not be restored. Nothing was sent to a server.");
      } finally {
        setHydrated(true);
      }
    });
    fetch("/api/health").then((response) => response.json()).then((payload) => {
      setAiAvailable(Boolean(payload.services?.liveGuide));
      setSyncAvailable(Boolean(payload.services?.syncedPersistence));
    }).catch(() => setGuideNote("Service status is unavailable; your browser data remains local."));
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("hashchange", updateScreen);
      window.removeEventListener("popstate", updateScreen);
    };
  }, [demoPremiumAvailable]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify({ profile, selectedPathwayId, messages, tasks, events, premiumAccess }));
  }, [events, hydrated, messages, premiumAccess, profile, selectedPathwayId, tasks]);
  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    chatAbortRef.current?.abort();
    try { liveSessionRef.current?.close(); } catch {}
    liveMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    void liveAudioContextRef.current?.close().catch(() => undefined);
    livePlaybackSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch {}
    });
  }, []);

  const updateList = (field: "interests" | "values" | "skills", value: string) => setProfile((current) => ({ ...current, [field]: parseList(value) }));
  const updatePriority = (key: PriorityKey, change: Partial<PriorityPreference>) => {
    setProfile((current) => {
      const currentPreference = current.priorities?.[key] ?? { importance: 50, confidence: 50, confirmed: false, evidence: [], conflicts: [] };
      return { ...current, priorities: { ...(current.priorities ?? {}), [key]: { ...currentPreference, ...change, updatedAt: new Date().toISOString() } } };
    });
  };
  const updateScenario = (field: "budget" | "hoursWeekly" | "incomeDeadlineMonths" | "location" | "canRelocate", value: number | string | boolean) => {
    setScenario((current) => ({ ...current, [field]: value } as Profile));
  };
  const loadExample = () => {
    setProfile(exampleProfile); setScenario(exampleProfile); setSelectedPathwayId(""); setTasks([]);
    addEvent("Example journey loaded", "Clearly labelled example data is available for a product walkthrough.");
    goTo("interview");
  };
  const clearLivePlayback = () => {
    livePlaybackSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch {}
    });
    livePlaybackSourcesRef.current.clear();
    livePlaybackCursorRef.current = 0;
    setIsSpeaking(false);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    clearLivePlayback();
  };

  const speak = (text: string) => {
    if (liveSessionRef.current || typeof window === "undefined" || !("speechSynthesis" in window) || !autoSpeakRef.current) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`~[\]()]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-IN";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const closeLiveSession = () => {
    try { liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
    try { liveSessionRef.current?.close(); } catch {}
    liveSessionRef.current = null;
    liveProcessorRef.current?.disconnect();
    liveSourceRef.current?.disconnect();
    liveSinkRef.current?.disconnect();
    liveProcessorRef.current = null;
    liveSourceRef.current = null;
    liveSinkRef.current = null;
    liveMicStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveMicStreamRef.current = null;
    void liveAudioContextRef.current?.close().catch(() => undefined);
    liveAudioContextRef.current = null;
    clearLivePlayback();
    setIsListening(false);
    setIsLiveVoiceMode(false);
    setLiveTranscript("");
    liveUserMessageIdRef.current = "";
    liveAssistantMessageIdRef.current = "";
  };

  const appendLiveMessage = (id: string, role: ChatMessage["role"], text: string) => {
    if (!text) return;
    setMessages((current) => {
      const existing = current.find((message) => message.id === id);
      if (!existing) return [...current, { id, role, content: text, source: "live" }];
      return current.map((message) => message.id === id ? { ...message, content: message.content + text, source: "live" } : message);
    });
  };

  const queueLiveAudio = (base64: string) => {
    if (!base64 || !autoSpeakRef.current || !liveAudioContextRef.current) return;
    try {
      const binary = window.atob(base64);
      const pcm = new Int16Array(binary.length / 2);
      for (let index = 0; index < pcm.length; index += 1) pcm[index] = (binary.charCodeAt(index * 2) | (binary.charCodeAt(index * 2 + 1) << 8));
      const context = liveAudioContextRef.current;
      const buffer = context.createBuffer(1, pcm.length, 24000);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 32768;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const when = Math.max(context.currentTime + 0.04, livePlaybackCursorRef.current);
      livePlaybackCursorRef.current = when + buffer.duration;
      livePlaybackSourcesRef.current.add(source);
      source.onended = () => {
        livePlaybackSourcesRef.current.delete(source);
        if (!livePlaybackSourcesRef.current.size) setIsSpeaking(false);
      };
      source.start(when);
      setIsSpeaking(true);
    } catch {
      setGuideNote("Gemini Live audio could not be played in this browser. The transcript remains available.");
    }
  };

  const startListening = async () => {
    if (liveSessionRef.current) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setGuideState("error");
      setGuideNote("Gemini Live needs a secure HTTPS page (or localhost) to use the microphone.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setGuideState("error");
      setGuideNote("This browser does not offer microphone access. You can continue by typing.");
      return;
    }

    setGuideState("thinking");
    setGuideNote("Starting a secure Gemini Live voice session...");
    try {
      const tokenResponse = await fetch("/api/live-token", { method: "POST", headers: { "Content-Type": "application/json" } });
      const tokenPayload = await tokenResponse.json().catch(() => null) as { token?: string; model?: string; message?: string } | null;
      if (!tokenResponse.ok || !tokenPayload?.token || !tokenPayload.model) throw new Error(tokenPayload?.message ?? "Gemini Live is unavailable.");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const context = new AudioContext();
      await context.resume();
      const client = new GoogleGenAI({ apiKey: tokenPayload.token, httpOptions: { apiVersion: "v1beta" } });
      const session = await client.live.connect({
        model: tokenPayload.model,
        config: {},
        callbacks: {
          onmessage: (message) => {
            const content = message as unknown as GeminiLiveMessage;
            const server = content.serverContent;
            if (!server) return;
            if (server.interrupted) clearLivePlayback();

            const inputText = server.interimInputTranscription?.text ?? server.inputTranscription?.text;
            if (inputText) {
              setLiveTranscript(inputText);
              if (!liveUserMessageIdRef.current) liveUserMessageIdRef.current = createClientId("live-user");
              appendLiveMessage(liveUserMessageIdRef.current, "user", inputText);
            }

            for (const part of server.modelTurn?.parts ?? []) {
              if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")) queueLiveAudio(part.inlineData.data);
              if (part.text) {
                if (!liveAssistantMessageIdRef.current) liveAssistantMessageIdRef.current = createClientId("live-assistant");
                appendLiveMessage(liveAssistantMessageIdRef.current, "assistant", part.text);
              }
            }
            if (server.outputTranscription?.text) {
              if (!liveAssistantMessageIdRef.current) liveAssistantMessageIdRef.current = createClientId("live-assistant");
              appendLiveMessage(liveAssistantMessageIdRef.current, "assistant", server.outputTranscription.text);
            }
            if (server.turnComplete) {
              setGuideState("idle");
              setGuideNote("Gemini Live is listening. You can interrupt naturally or type your next question.");
              setLiveTranscript("");
              liveUserMessageIdRef.current = "";
              liveAssistantMessageIdRef.current = "";
            }
          },
          onerror: () => {
            setGuideState("error");
            setGuideNote("Gemini Live disconnected. Your confirmed profile is unchanged; reconnect or use text.");
          },
          onclose: () => {
            if (liveSessionRef.current) {
              setIsListening(false);
              setIsLiveVoiceMode(false);
            }
          },
        },
      });

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      const silentSink = context.createGain();
      silentSink.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        const bytes = new Uint8Array(samples.length * 2);
        for (let index = 0; index < samples.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, samples[index]));
          const value = sample < 0 ? sample * 32768 : sample * 32767;
          bytes[index * 2] = value & 0xff;
          bytes[index * 2 + 1] = (value >> 8) & 0xff;
        }
        let binary = "";
        for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
        try {
          session.sendRealtimeInput({ audio: { data: window.btoa(binary), mimeType: `audio/pcm;rate=${context.sampleRate}` } });
        } catch {}
      };
      source.connect(processor);
      processor.connect(silentSink);
      silentSink.connect(context.destination);
      liveSessionRef.current = session;
      liveMicStreamRef.current = stream;
      liveAudioContextRef.current = context;
      liveSourceRef.current = source;
      liveProcessorRef.current = processor;
      liveSinkRef.current = silentSink;
      setIsListening(true);
      setIsLiveVoiceMode(true);
      setGuideState("idle");
      setGuideNote("Gemini Live is connected. Speak naturally; native audio and live transcripts are on.");
    } catch (error) {
      closeLiveSession();
      setGuideState("error");
      setGuideNote(error instanceof Error ? error.message : "Gemini Live could not start. You can continue by typing.");
    }
  };

  const stopListening = () => {
    closeLiveSession();
    setGuideNote("Gemini Live voice session ended. You can restart it or continue by typing.");
  };

  const toggleLiveVoiceMode = () => {
    if (liveSessionRef.current) stopListening();
    else void startListening();
  };

  const stopGuide = () => {
    chatAbortRef.current?.abort();
    stopSpeaking();
    stopListening();
    setGuideState("idle");
    setGuideNote("Response stopped. No profile fact was saved from this message.");
  };

  const executeSendMessage = async (messageText: string) => {
    const message = messageText.trim();
    if (!message || guideState === "thinking") return;
    setInput("");
    setLiveTranscript("");

    const userMessage: ChatMessage = {
      id: createClientId("user"),
      role: "user",
      content: message,
      source: "guided",
    };

    if (liveSessionRef.current) {
      liveUserMessageIdRef.current = userMessage.id;
      liveAssistantMessageIdRef.current = "";
      setMessages((current) => [...current, { ...userMessage, source: "live" }]);
      setGuideState("thinking");
      setGuideNote("Sent to Gemini Live. PATHWISE will respond in native audio and transcript form.");
      try {
        liveSessionRef.current.sendRealtimeInput({ text: message });
      } catch {
        setGuideState("error");
        setGuideNote("The Gemini Live session ended before that message could be sent. Reconnect or use text.");
      }
      return;
    }

    const responseId = createClientId("assistant");
    setMessages((current) => [...current, userMessage, { id: responseId, role: "assistant", content: "", source: "live" }]);
    setGuideState("thinking");
    setGuideNote("Gemini is responding. It will not save a profile fact without your confirmation.");

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const response = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          profile,
          history: messages.slice(-8).map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message ?? "Live guide unavailable");
      }

      const text = await readTextResponse(response.body.getReader(), (nextText) => {
        setMessages((current) => current.map((item) => (
          item.id === responseId ? { ...item, content: `${item.content}${nextText}`, source: "live" } : item
        )));
      });

      if (text) speak(text);
      setAiAvailable(true);
      setGuideNote("Live response received. You can speak again or review profile facts.");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setMessages((current) => current.filter((item) => item.id !== responseId));
      } else {
        const fallback = guidedReply(profile);
        setMessages((current) => current.map((item) => (item.id === responseId ? { ...item, content: fallback, source: "guided" } : item)));
        setGuideState("error");
        setGuideNote("Live guide is unavailable. The visible response is a local guided prompt.");
        if (fallback) speak(fallback);
      }
    } finally {
      chatAbortRef.current = null;
      setGuideState((current) => (current === "error" ? "error" : "idle"));
    }
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeSendMessage(input);
  };

  const startCamera = async () => {
    setCameraError("");
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setCameraError("Browsers allow camera access only on HTTPS pages (or localhost). Open PATHWISE securely, then try again.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not offer camera access. You can skip this optional activity.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      if (interviewVideoRef.current) interviewVideoRef.current.srcObject = stream;
      setCameraActive(true);
      addEvent("Camera activated", "Local camera preview opened on this device.");
    } catch {
      setCameraError("Camera permission was not granted. No camera data was collected.");
    }
  };
  const stopCamera = () => {
    releaseCamera();
  };
  const captureCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraError("Wait for the camera preview before capturing."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.75));
    stopCamera();
  };
  const chooseFile = () => fileInputRef.current?.click();
  const importPreview = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setCameraError("Choose an image file to create a local preview."); return; }
    if (file.size > 10 * 1024 * 1024) { setCameraError("Choose an image smaller than 10 MB. It is not uploaded to PATHWISE."); return; }
    setCameraError("");
    const reader = new FileReader();
    reader.onload = () => setCapturedImage(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setCameraError("The selected image could not be read in this browser.");
    reader.readAsDataURL(file);
  };
  const confirmActivity = () => {
    if (activityChoice.length) {
      setProfile((current) => ({ ...current, skills: Array.from(new Set([...current.skills, ...activityChoice])) }));
      addEvent("Activity observation confirmed", "You confirmed: " + activityChoice.join(", ") + ".");
    }
    setCapturedImage("");
    goTo("profile");
  };
  const saveProfile = () => {
    setScenario(profile);
    addEvent("Profile confirmed", "You confirmed the current profile details on this device.");
    goTo("discover");
  };
  const activatePathway = (pathway: Pathway, includeRoadmap: boolean) => {
    setSelectedPathwayId(pathway.id);
    setTasks(includeRoadmap ? createActionPlan(pathway) : []);
    addEvent("Pathway selected", pathway.plan + ": " + pathway.title);
    goTo("recommended");
  };
  const selectPathway = (pathway: Pathway) => {
    if (pathway.plan !== "Plan A" && !hasPremiumAccess) {
      setPendingPremiumPathwayId(pathway.id);
      goTo("premium");
      return;
    }
    activatePathway(pathway, hasPremiumAccess);
  };
  const enableDemoPremium = () => {
    if (!demoPremiumAvailable) return;
    setPremiumAccess("demo");
    addEvent("Premium preview enabled", "Local testing access only. No payment was requested or received.");
    const pendingPathway = pathways.find((pathway) => pathway.id === pendingPremiumPathwayId);
    setPendingPremiumPathwayId("");
    if (pendingPathway) {
      activatePathway(pendingPathway, true);
      return;
    }
    goTo("compare");
  };
  const runSimulation = () => {
    const result = compareSimulation(profile, scenario);
    setSimulation(result);
    addEvent("What-if scenario calculated", result.changed.length ? String(result.changed.length) + " confirmed constraints changed." : "No constraint changed; the same rules were re-evaluated.");
    goTo("recalculated");
  };
  const applyScenario = () => {
    setProfile(scenario); setSimulation(null);
    addEvent("Scenario applied to profile", "The confirmed profile now reflects the chosen scenario.");
    goTo("compare");
  };
  const toggleTask = (id: string) => {
    const target = tasks.find((task) => task.id === id);
    if (!target) return;
    const completed = !(target.complete || target.status === "completed");
    setTasks((current) => current.map((task) => task.id === id ? { ...task, complete: completed, status: completed ? "completed" : "not-started" } : task));
    addEvent(completed ? "Action completed" : "Action reopened", target.title);
  };
  const updateTaskStatus = (id: string, status: ActionItem["status"]) => {
    const target = tasks.find((task) => task.id === id);
    if (!target) return;
    const complete = status === "completed";
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status, complete } : task));
    addEvent("Action updated", `${target.title}: ${status.replace("-", " ")}.`);
  };
  const createReplanProposal = () => {
    if (!selectedPathway || !replanObstacle.trim()) return;
    setReplanProposal(proposeReplan(selectedPathway, tasks, replanObstacle.trim()));
  };
  const applyReplanProposal = () => {
    if (!replanProposal) return;
    setTasks(replanProposal.revisedTasks);
    addEvent("Roadmap revision approved", `Updated after: ${replanProposal.categories.join(", ")}. Completed tasks were preserved.`);
    setReplanProposal(null);
    setReplanObstacle("");
  };

  const landing = (
    <section className="website-landing">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">An AI decision companion for India</p>
          <h1>Build a path that respects your ambition and your reality.</h1>
          <p className="hero-lede">PATHWISE brings together your aspirations, family expectations, money, time, location and opportunities—then shows explainable routes you can adapt when life changes.</p>
          <div className="hero-pill-row"><span><ShieldCheck size={15} /> You confirm what matters</span><span><Compass size={15} /> Routes, not generic answers</span></div>
          <div className="hero-actions">
            <button className="button primary" onClick={() => goTo("interview")}>Start my PATHWISE interview <ArrowRight size={17} /></button>
            <button className="button secondary" onClick={() => goTo("activity")}><Camera size={17} /> Use camera activity <span className="optional-label">Optional</span></button>
          </div>
          <p className="privacy-line"><ShieldCheck size={15} /> Camera opens only after your browser permission. PATHWISE never judges faces or diagnoses anyone.</p>
        </div>
        <div className="hero-dashboard" aria-label="How PATHWISE turns a conversation into a pathway">
          <div className="dashboard-topline"><span><i className={aiAvailable ? "status-good" : ""} /> {aiAvailable ? "Live guide ready" : "Guide mode"}</span><span>Private by design</span></div>
          <div className="dashboard-title"><Sparkles size={21} /><div><span>PATHWISE decision canvas</span><strong>More than a chat reply.</strong></div></div>
          <div className="signal-stack">
            <div className="signal-card aspiration"><span>Your aspiration</span><strong>{profile.goal || "What do you genuinely want?"}</strong></div>
            <div className="signal-card influence"><span>Family & social context</span><strong>{profile.familyExpectation || "Kept separate from your voice"}</strong></div>
            <div className="signal-card reality"><span>Reality check</span><strong>Cost, time, location & eligibility</strong></div>
          </div>
          <div className="route-preview"><Route size={18} /><div><span>What the system creates</span><strong>Plan A, Plan B and Plan C—each with reasons, constraints and next actions.</strong></div></div>
        </div>
      </div>
      <section className="website-section how-it-works">
        <div><p className="eyebrow">A decision system, not a career quiz</p><h2>Turn uncertainty into an adaptable next step.</h2></div>
        <div className="feature-grid">
          <article><span className="feature-number">01</span><Mic size={22} /><h3>Talk naturally</h3><p>Use voice or text. PATHWISE asks only what is still missing, while keeping your view separate from outside pressure.</p><button className="text-button" onClick={() => goTo("interview")}>Start the conversation <ArrowRight size={14} /></button></article>
          <article><span className="feature-number">02</span><Route size={22} /><h3>Compare real routes</h3><p>Pathways use explicit cost, time, location and eligibility checks. Starter data is visibly labelled for verification.</p><button className="text-button" onClick={() => goTo("discover")}>Explore opportunities <ArrowRight size={14} /></button></article>
          <article><span className="feature-number">03</span><SlidersHorizontal size={22} /><h3>Adapt when life changes</h3><p>Change a budget, relocation option or income deadline and re-run the same transparent decision rules.</p><button className="text-button" onClick={() => { setScenario(profile); goTo("simulate"); }}>Try a What-if <ArrowRight size={14} /></button></article>
        </div>
      </section>
      <section className="category-card">
        <div><p className="eyebrow">Designed for life crossroads</p><h2>For students, learners, families and people changing direction.</h2></div>
        <p>Students in school or college, young job seekers, career changers, parents and guardian-supported learners aged 13+. A guardian can contribute context when invited; the learner’s voice stays central. PATHWISE does not diagnose, label or predict capability from camera, voice or touch.</p>
        <button className="button secondary" onClick={loadExample}>See a labelled example journey</button>
      </section>
    </section>
  );

  const interview = (
    <section className="flow-screen" style={{ maxWidth: "1220px", margin: "0 auto", padding: "16px clamp(16px, 3vw, 32px) 64px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes studioEq1 { 0% { height: 4px; } 50% { height: 18px; } 100% { height: 6px; } }
        @keyframes studioEq2 { 0% { height: 14px; } 50% { height: 6px; } 100% { height: 22px; } }
        @keyframes studioEq3 { 0% { height: 8px; } 50% { height: 20px; } 100% { height: 10px; } }
        @keyframes studioOrbPulse { 0% { transform: scale(0.95); opacity: 0.85; filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.4)); } 100% { transform: scale(1.06); opacity: 1; filter: drop-shadow(0 0 35px rgba(16, 185, 129, 0.7)); } }
        @keyframes studioMicPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
        @keyframes studioScanbeam { 0% { top: 0%; opacity: 0.7; } 50% { opacity: 1; } 100% { top: 96%; opacity: 0.7; } }
      `}</style>

      {/* Studio Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "22px", paddingBottom: "18px", borderBottom: "1px solid rgba(180, 220, 210, 0.5)" }}>
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content", padding: "5px 13px", borderRadius: "999px", background: aiAvailable ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)", border: aiAvailable ? "1px solid #10b981" : "1px solid #f59e0b", color: aiAvailable ? "#047857" : "#b45309", fontSize: "11px", fontWeight: "800", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: aiAvailable ? "#10b981" : "#f59e0b", boxShadow: aiAvailable ? "0 0 10px #10b981" : "none" }} />
            {aiAvailable ? "GEMINI LIVE VOICE READY" : "GUIDED ASSISTANT"}
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px, 3.2vw, 36px)", fontWeight: "900", letterSpacing: "-0.03em", color: "#0c3a34", lineHeight: "1.15" }}>
            Gemini Live voice interview
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#4f756e", maxWidth: "700px", lineHeight: "1.5" }}>
            Speak naturally with Gemini Live, discuss Indian education and career routes, or use the camera separately for a local-only preview.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={stopGuide}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "12px", border: "1px solid #bce6d9", background: "#f0fbf7", color: "#066a58", fontSize: "12px", fontWeight: "750", cursor: "pointer" }}
          >
            <VolumeX size={15} /> Stop audio
          </button>
          <button
            type="button"
            onClick={() => goTo("profile")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "12px", border: "1px solid #c8e0d9", background: "#ffffff", color: "#365c55", fontSize: "12px", fontWeight: "750", cursor: "pointer" }}
          >
            Manual Profile <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Studio 2-Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(330px, 460px) 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left Console: Vision & Audio Hub */}
        <div style={{ background: "linear-gradient(165deg, #0b131e 0%, #060910 100%)", borderRadius: "24px", padding: "20px", border: "1px solid rgba(56, 189, 248, 0.22)", boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4), 0 0 35px rgba(16, 185, 129, 0.08)", color: "#e2f1ec", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Camera Viewport */}
          <div style={{ position: "relative", width: "100%", height: "260px", borderRadius: "18px", overflow: "hidden", background: "#020617", border: cameraActive ? "2px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {cameraActive ? (
              <>
                <video
                  ref={interviewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }}
                />

                {/* HUD Top Overlay */}
                <div style={{ position: "absolute", top: "12px", left: "12px", display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "20px", background: "rgba(0, 0, 0, 0.78)", backdropFilter: "blur(8px)", border: "1px solid rgba(16, 185, 129, 0.5)", color: "#a7f3d0", fontSize: "11px", fontWeight: "800", letterSpacing: "0.04em" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
                  LOCAL CAMERA PREVIEW
                </div>

                <div style={{ position: "absolute", top: "12px", right: "12px", padding: "4px 10px", borderRadius: "10px", background: "rgba(0, 0, 0, 0.7)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#94a3b8", fontSize: "10px", fontWeight: "750" }}>
                  PREVIEW ONLY
                </div>

                {/* Subtle scanning beam line */}
                <div style={{ position: "absolute", left: "8px", right: "8px", height: "2px", background: "linear-gradient(90deg, transparent, #10b981, transparent)", animation: "studioScanbeam 3.5s linear infinite", pointerEvents: "none" }} />
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", padding: "20px", textAlign: "center" }}>
                <div style={{
                  width: "82px",
                  height: "82px",
                  borderRadius: "50%",
                  background: isListening
                    ? "radial-gradient(circle at 35% 35%, #38bdf8, #0284c7 50%, #082f49 90%)"
                    : isSpeaking
                    ? "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 50%, #431407 90%)"
                    : "radial-gradient(circle at 35% 35%, #34d399, #059669 50%, #042f2c 90%)",
                  boxShadow: isListening
                    ? "0 0 45px rgba(56, 189, 248, 0.65)"
                    : isSpeaking
                    ? "0 0 45px rgba(249, 115, 22, 0.65)"
                    : "0 0 40px rgba(16, 185, 129, 0.45)",
                  animation: "studioOrbPulse 2.8s ease-in-out infinite alternate",
                }} />

                <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "750", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {isListening ? "● Listening to Voice" : isSpeaking ? "● Speaking Aloud" : "PATHWISE Neural Core"}
                </span>

                <button
                  type="button"
                  onClick={startCamera}
                  style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 16px", borderRadius: "14px", background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#6ee7b7", fontSize: "12px", fontWeight: "750", cursor: "pointer" }}
                >
                  <Video size={15} /> Turn on camera preview
                </button>
              </div>
            )}
          </div>

          {/* Interactive Floating Control Deck */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 44px", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                minHeight: "42px",
                padding: "8px 12px",
                borderRadius: "14px",
                border: cameraActive ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.15)",
                background: cameraActive ? "rgba(16, 185, 129, 0.22)" : "rgba(255, 255, 255, 0.07)",
                color: cameraActive ? "#6ee7b7" : "#e2e8f0",
                fontSize: "12px",
                fontWeight: "750",
                cursor: "pointer",
              }}
            >
              {cameraActive ? <VideoOff size={15} /> : <Video size={15} />}
              <span>{cameraActive ? "Stop Camera" : "Enable Camera"}</span>
            </button>

            <button
              type="button"
              onClick={toggleLiveVoiceMode}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                minHeight: "42px",
                padding: "8px 12px",
                borderRadius: "14px",
                border: isLiveVoiceMode ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.15)",
                background: isLiveVoiceMode ? "rgba(56, 189, 248, 0.24)" : "rgba(255, 255, 255, 0.07)",
                color: isLiveVoiceMode ? "#7dd3fc" : "#e2e8f0",
                fontSize: "12px",
                fontWeight: "750",
                cursor: "pointer",
              }}
            >
              <Radio size={15} />
              <span>{isLiveVoiceMode ? "Live Talk: ON" : "Hands-Free Talk"}</span>
            </button>

            <button
              type="button"
              title={autoSpeak ? "Native Gemini audio active (click to mute playback)" : "Native Gemini audio muted (click to unmute)"}
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setAutoSpeak(!autoSpeak);
              }}
              style={{
                width: "44px",
                height: "42px",
                display: "grid",
                placeItems: "center",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                background: autoSpeak ? "rgba(255, 255, 255, 0.08)" : "rgba(239, 68, 68, 0.22)",
                color: autoSpeak ? "#38bdf8" : "#fca5a5",
                cursor: "pointer",
              }}
            >
              {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>

          {/* Equalizer & Real-Time Speech Subtitle HUD */}
          <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(0, 0, 0, 0.55)", border: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span>{isListening ? "🎙️ Voice Inbound" : isSpeaking ? "🔊 AI Speaking" : "⚡ Audio Status"}</span>

              {/* Equalizer Waveform */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "20px" }}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <span
                    key={index}
                    style={{
                      width: "3px",
                      borderRadius: "2px",
                      background: isListening ? "#38bdf8" : isSpeaking ? "#fb923c" : "#10b981",
                      height: isListening || isSpeaking ? "16px" : "4px",
                      animationName: isListening || isSpeaking
                        ? index % 3 === 0
                          ? "studioEq1"
                          : index % 3 === 1
                          ? "studioEq2"
                          : "studioEq3"
                        : "none",
                      animationDuration: index % 3 === 0 ? "0.7s" : index % 3 === 1 ? "0.85s" : "0.6s",
                      animationIterationCount: "infinite",
                      animationDirection: "alternate",
                      animationDelay: `${index * 0.12}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.45", minHeight: "38px", color: isListening && liveTranscript ? "#ffffff" : isListening ? "#38bdf8" : isSpeaking ? "#fb923c" : "#94a3b8" }}>
              {isListening && liveTranscript ? (
                <span style={{ color: "#ffffff", fontWeight: "600" }}>&ldquo;{liveTranscript}&rdquo;</span>
              ) : isListening ? (
                <span>Listening... Speak naturally into your microphone.</span>
              ) : isSpeaking ? (
                <span>PATHWISE speaking... Tap &ldquo;Stop audio&rdquo; above to interrupt.</span>
              ) : (
                <span>Microphone & AI Vision ready. Ask anything about courses, branches, or career dilemmas.</span>
              )}
            </p>
          </div>
        </div>

        {/* Right Console: Dialogue Stream & Composer */}
        <div style={{ background: "#ffffff", borderRadius: "24px", padding: "20px", border: "1px solid #cfe5de", boxShadow: "0 20px 50px rgba(11, 76, 66, 0.08)", display: "flex", flexDirection: "column", minHeight: "560px", justifyContent: "space-between", gap: "16px" }}>

          {/* Scrollable Conversation Feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "440px", overflowY: "auto", paddingRight: "6px" }} aria-live="polite">
            {messages.map((message) => (
              <article
                key={message.id}
                style={{
                  position: "relative",
                  maxWidth: message.role === "user" ? "86%" : "90%",
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  padding: "16px 18px",
                  borderRadius: message.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                  background: message.role === "user" ? "linear-gradient(135deg, #077965, #0a967f)" : "#f8fdfb",
                  border: message.role === "user" ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid #d4ece3",
                  color: message.role === "user" ? "#ffffff" : "#0f3630",
                  boxShadow: message.role === "user" ? "0 6px 20px rgba(7, 121, 101, 0.22)" : "0 6px 20px rgba(16, 75, 65, 0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "7px", fontSize: "10px", fontWeight: "850", letterSpacing: "0.08em", textTransform: "uppercase", color: message.role === "user" ? "#a7f3d0" : "#087965" }}>
                  <span>{message.role === "assistant" ? "PATHWISE Decision Companion" : "YOU"}</span>
                  {message.role === "assistant" && message.source === "guided" && (
                    <small style={{ color: "#749b92" }}>Guided prompt</small>
                  )}
                </div>

                {message.imageThumbnail && (
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginBottom: "4px", padding: "2px 8px", borderRadius: "8px", background: "rgba(0, 0, 0, 0.35)", color: "#e2f1ec", fontSize: "10px", fontWeight: "750" }}>
                      <Camera size={11} /> Local camera preview
                    </div>
                    <Image
                      src={message.imageThumbnail}
                      alt="Camera snapshot at time of asking"
                      width={200}
                      height={120}
                      unoptimized
                      style={{ display: "block", maxWidth: "200px", maxHeight: "120px", borderRadius: "10px", border: "2px solid rgba(255, 255, 255, 0.3)", objectFit: "cover" }}
                    />
                  </div>
                )}

                <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.55" }}>
                  {message.content || <i style={{ opacity: 0.7 }}>Analyzing your query and context...</i>}
                </p>

                {message.role === "assistant" && message.content && (
                  <button
                    type="button"
                    onClick={() => speak(message.content)}
                    aria-label="Listen to this response aloud"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "10px",
                      padding: "5px 12px",
                      borderRadius: "20px",
                      background: "#eef9f5",
                      border: "1px solid #bce6d9",
                      color: "#086b59",
                      fontSize: "11px",
                      fontWeight: "750",
                      cursor: "pointer",
                    }}
                  >
                    <Volume2 size={13} /> Listen Aloud
                  </button>
                )}
              </article>
            ))}
          </div>

          {/* Guide Processing Note */}
          <div style={{ padding: "8px 12px", borderRadius: "12px", background: guideState === "error" ? "#fee2e2" : "#f0fbf7", border: guideState === "error" ? "1px solid #fca5a5" : "1px solid #cce8de", color: guideState === "error" ? "#991b1b" : "#077965", fontSize: "11px", fontWeight: "650", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: guideState === "error" ? "#dc2626" : "#10b981" }} />
            {guideState === "thinking" ? "PATHWISE is processing your Gemini Live input..." : guideNote}
          </div>

          {/* Floating Composer Bar */}
          <form
            onSubmit={submitMessage}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "10px",
              alignItems: "center",
              padding: "7px 9px 7px 16px",
              background: "#ffffff",
              border: "1.5px solid #a8dbce",
              borderRadius: "20px",
              boxShadow: "0 8px 24px rgba(11, 76, 66, 0.08)",
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={isListening ? "Listening... Speak naturally" : "Ask PATHWISE anything, or tap microphone to speak…"}
              aria-label="Message PATHWISE"
              style={{
                border: "none",
                outline: "none",
                fontSize: "14px",
                color: "#113832",
                background: "transparent",
                width: "100%",
              }}
            />

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? "Stop microphone" : "Use microphone"}
              title={isListening ? "Stop listening" : "Click to speak"}
              style={{
                width: "42px",
                height: "42px",
                display: "grid",
                placeItems: "center",
                borderRadius: "12px",
                border: isListening ? "2px solid #ef4444" : "1px solid #cce8df",
                background: isListening ? "#ef4444" : "#f0fbf7",
                color: isListening ? "#ffffff" : "#087965",
                cursor: "pointer",
                animation: isListening ? "studioMicPulse 1.4s infinite" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {isListening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>

            <button
              type="submit"
              disabled={guideState === "thinking" || !input.trim()}
              title="Send message"
              style={{
                width: "42px",
                height: "42px",
                display: "grid",
                placeItems: "center",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #077965, #0d9488)",
                color: "#ffffff",
                cursor: guideState === "thinking" || !input.trim() ? "not-allowed" : "pointer",
                opacity: guideState === "thinking" || !input.trim() ? 0.45 : 1,
                boxShadow: "0 4px 14px rgba(7, 121, 101, 0.28)",
                transition: "all 0.15s ease",
              }}
            >
              <ArrowRight size={19} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );

  const activity = (
    <section className="flow-screen">
      <div className="screen-intro">
        <StepLabel>Optional camera input</StepLabel>
        <h1>Bring a document or activity into the conversation.</h1>
        <p>Open your device camera, take a local preview, or choose a photo or document image. You stay in control of what is kept.</p>
      </div>
      <div className="consent-card">
        <ShieldCheck size={19} />
        <div>
          <strong>Clear processing boundary</strong>
          <p>This build keeps the preview in your browser session only. It does not upload or permanently store camera media without confirmation. PATHWISE does not infer emotions, intelligence, or disability from appearance.</p>
        </div>
      </div>
      <div className="camera-stage">
        {capturedImage ? (
          <Image src={capturedImage} width={1200} height={675} unoptimized alt="Your local image preview; it remains in this browser session." />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className={cameraActive ? "" : "hidden-video"} />
        )}
        {!cameraActive && !capturedImage && (
          <div className="camera-placeholder">
            <Camera size={36} />
            <strong>Camera is ready when you are</strong>
            <span>Permission is requested only after you select Enable camera.</span>
          </div>
        )}
      </div>
      {cameraError && <div className="error-box"><CircleAlert size={17} />{cameraError}</div>}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={importPreview} className="visually-hidden" aria-label="Choose an image or document" />
      <div className="button-pair">
        {!cameraActive && !capturedImage && (
          <>
            <button className="button primary" onClick={startCamera}><Video size={17} /> Enable camera</button>
            <button className="button secondary" onClick={chooseFile}><FileText size={17} /> Choose image</button>
          </>
        )}
        {cameraActive && (
          <>
            <button className="button primary" onClick={() => goTo("interview")}>
              <Mic size={17} /> Continue to Gemini Live interview
            </button>
            <button className="button secondary" onClick={captureCamera}>Capture preview</button>
            <button className="button secondary" onClick={stopCamera}>Turn off</button>
          </>
        )}
        {capturedImage && (
          <>
            <button className="button secondary" onClick={() => setCapturedImage("")}>Remove preview</button>
            <button className="button primary" onClick={() => { setActivityChoice([]); goTo("review"); }}>Continue to review <ArrowRight size={16} /></button>
          </>
        )}
      </div>
      <button className="text-button centred" onClick={() => goTo("review")}>Skip this optional activity</button>
    </section>
  );

  const review = (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>Confirm before saving</StepLabel><h1>What should be added?</h1><p>{capturedImage ? "Choose only observations you want to record. This is not a diagnosis or camera inference." : "Review profile facts from your interview, forms or optional activities."}</p></div>
      <div className="choice-list">{["Enjoyed a structured task", "Preferred hands-on exploration", "Would like to develop creative skills"].map((item) => { const selected = activityChoice.includes(item); return <button key={item} className={"choice-row " + (selected ? "selected" : "")} onClick={() => setActivityChoice((current) => selected ? current.filter((value) => value !== item) : [...current, item])}><span>{selected ? <Check size={16} /> : null}</span>{item}</button>; })}</div>
      <div className="source-note"><FileText size={16} /> Source: your own confirmation. Camera media is not interpreted by PATHWISE.</div>
      <button className="button primary full" onClick={confirmActivity}>Confirm chosen observations <ArrowRight size={16} /></button><button className="text-button centred" onClick={() => goTo("profile")}>Continue without adding anything</button>
    </section>
  );

  const profileForm = (
    <section className="flow-screen profile-screen">
      <div className="screen-intro"><StepLabel>Your shared profile</StepLabel><h1>Make the context real.</h1><p>These fields drive deterministic eligibility and ranking. Keep statements separate where they come from different people.</p></div>
      <div className="form-grid">
        <label>First name or nickname<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Optional" /></label>
        <label>Education or career stage<input value={profile.stage} onChange={(event) => setProfile({ ...profile, stage: event.target.value })} placeholder="For example: Class 12" /></label>
        <label className="wide">What career or direction do <em>you</em> want?<textarea value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value })} placeholder="Use your own words" /></label>
        <label>Interests <small>Comma-separated</small><input value={profile.interests.join(", ")} onChange={(event) => updateList("interests", event.target.value)} placeholder="music, technology" /></label>
        <label>Strengths or demonstrated skills <small>Comma-separated</small><input value={profile.skills.join(", ")} onChange={(event) => updateList("skills", event.target.value)} placeholder="organising, problem solving" /></label>
        <label>Values <small>Comma-separated</small><input value={profile.values.join(", ")} onChange={(event) => updateList("values", event.target.value)} placeholder="creative freedom, stability" /></label>
        <label>Budget available now (₹)<input type="number" min="0" value={profile.budget || ""} onChange={(event) => setProfile({ ...profile, budget: Number(event.target.value) || 0 })} placeholder="0" /></label>
        <label>Location preference<input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} placeholder="Near home / city / state" /></label>
        <label>Time available each week<input type="number" min="0" value={profile.hoursWeekly || ""} onChange={(event) => setProfile({ ...profile, hoursWeekly: Number(event.target.value) || 0 })} placeholder="0" /></label>
        <label>Income needed within (months)<input type="number" min="0" value={profile.incomeDeadlineMonths || ""} onChange={(event) => setProfile({ ...profile, incomeDeadlineMonths: Number(event.target.value) || 0 })} placeholder="0" /></label>
        <label className="wide">What does your family expect?<textarea value={profile.familyExpectation} onChange={(event) => setProfile({ ...profile, familyExpectation: event.target.value })} placeholder="Reported expectation, not an assumption" /></label>
        <label className="wide">What do friends / classmates influence?<textarea value={profile.peerInfluence} onChange={(event) => setProfile({ ...profile, peerInfluence: event.target.value })} placeholder="Optional" /></label>
        <label className="wide">What career feels most respected by society around you?<textarea value={profile.socialStatusExpectation} onChange={(event) => setProfile({ ...profile, socialStatusExpectation: event.target.value })} placeholder="Optional reflection" /></label>
        <label className="wide">Voluntary access or support preferences<textarea value={profile.supports} onChange={(event) => setProfile({ ...profile, supports: event.target.value })} placeholder="Only share what helps PATHWISE make the experience more usable" /></label>
        <div className="priority-section wide">
          <div><strong>What matters most right now?</strong><p>Only priorities you explicitly confirm affect compatibility scores. Importance, confidence, feasibility and evidence remain separate.</p></div>
          <div className="priority-grid">
            {priorityKeys.map((key) => {
              const preference = profile.priorities?.[key];
              return <article key={key} className={preference?.confirmed ? "priority-card confirmed" : "priority-card"}>
                <label className="priority-confirm"><input type="checkbox" checked={Boolean(preference?.confirmed)} onChange={(event) => updatePriority(key, { confirmed: event.target.checked })} /><span>{priorityLabels[key]}</span></label>
                <label>Importance <output>{preference?.importance ?? 50}/100</output><input type="range" min="0" max="100" value={preference?.importance ?? 50} onChange={(event) => updatePriority(key, { importance: Number(event.target.value) })} /></label>
                <label>How sure are you? <output>{preference?.confidence ?? 50}/100</output><input type="range" min="0" max="100" value={preference?.confidence ?? 50} onChange={(event) => updatePriority(key, { confidence: Number(event.target.value) })} /></label>
              </article>;
            })}
          </div>
        </div>
      </div>
      <label className="toggle-row"><input type="checkbox" checked={profile.canRelocate} onChange={(event) => setProfile({ ...profile, canRelocate: event.target.checked })} /><span>Relocation is an option right now</span></label>
      <label className="toggle-row"><input type="checkbox" checked={profile.supportMode === "guardian-supported"} onChange={(event) => setProfile({ ...profile, supportMode: event.target.checked ? "guardian-supported" : "student" })} /><span>I want a guardian / trusted adult involved</span></label>
      <button className="button primary full" onClick={saveProfile}>Confirm profile & discover routes <ArrowRight size={16} /></button>
    </section>
  );

  const discover = (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>Opportunity graph starter</StepLabel><h1>Discover possibilities.</h1><p>These are labelled starter records, not live listings. Verify each fact with the linked official source.</p></div>
      <div className="search-shell"><Compass size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search routes, skills or interests" /></div>
      <div className="opportunity-list">{opportunityCatalogue.filter((item) => (item.title + item.focus + item.tags.join(" ")).toLowerCase().includes(search.toLowerCase())).map((opportunity) => <article className="opportunity-card" key={opportunity.id}><div className="card-icon"><Route size={20} /></div><div><span className="data-badge">{opportunity.dataStatus}</span><h3>{opportunity.title}</h3><p>{opportunity.route}</p><div className="card-meta"><span><Clock3 size={14} />{opportunity.durationMonths} months</span><span><Landmark size={14} />₹{opportunity.estimatedCost.toLocaleString("en-IN")}</span><span><MapPin size={14} />{opportunity.locationMode}</span></div></div><a href={opportunity.sources[0]?.url} target="_blank" rel="noreferrer" aria-label={"Open source for " + opportunity.title}><ChevronRight size={20} /></a></article>)}</div>
      <button className="button primary full" onClick={() => goTo("compare")}>Compare my pathways <ArrowRight size={16} /></button>
    </section>
  );

  const compare = (
    <section className="flow-screen comparison-screen">
      <div className="screen-intro"><StepLabel>Deterministic ranking</StepLabel><h1>Distinct routes, not one verdict.</h1><p>PATHWISE shows every meaningfully different starter route it can support, up to Plan L. Compatibility, feasibility and evidence are separate measures; hard constraints cannot be overridden by an explanation.</p></div>
      <div className="pathway-grid">{pathways.map((pathway) => <article key={pathway.id} className={"pathway-card " + (pathway.plan === "Plan A" ? "featured" : "")}><div className="pathway-top"><span>{pathway.plan}{pathway.plan !== "Plan A" && !hasPremiumAccess ? " · Premium" : ""}</span><strong>{pathway.score}</strong></div><h2>{pathway.focus}</h2><p>{pathway.title}</p><div className="score-bar"><span style={{ width: String(pathway.score) + "%" }} /></div><ul><li><Check size={15} />Priority fit: {pathway.compatibilityScore === null ? "Confirm priorities to calculate" : `${pathway.compatibilityScore}/100`}</li><li><Check size={15} />Feasibility: {pathway.feasibilityScore}/100</li><li><Check size={15} />Evidence quality: {pathway.evidenceQuality}/100 (starter data)</li><li><Check size={15} />Cost: ₹{pathway.opportunity.estimatedCost.toLocaleString("en-IN")}</li><li><Check size={15} />Time: {pathway.opportunity.durationMonths} months</li><li className={pathway.eligibility.feasible ? "" : "negative"}>{pathway.eligibility.feasible ? <BadgeCheck size={15} /> : <CircleAlert size={15} />}{pathway.eligibility.feasible ? "Currently feasible" : "Has constraint blockers"}</li></ul><button className="button secondary full" onClick={() => selectPathway(pathway)}>{pathway.plan !== "Plan A" && !hasPremiumAccess ? "Unlock this route" : "See this route"} <ArrowRight size={15} /></button></article>)}</div>
      <article className="pressure-summary"><Users size={20} /><div><span>Aspirations & influences reflection</span><p><strong>Your aspiration:</strong> {pressure.goal}</p><p><strong>Recorded family expectation:</strong> {pressure.family}</p><p>{pressure.conflict}</p></div></article>
    </section>
  );

  const recommended = selectedPathway ? (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>{selectedPathway.plan} selected</StepLabel><h1>{selectedPathway.title}</h1><p>{selectedPathway.rationale}</p></div>
      <div className="recommend-card"><Target size={23} /><div><strong>{selectedPathway.focus}</strong><p>Score {selectedPathway.score}/100 · ₹{selectedPathway.opportunity.estimatedCost.toLocaleString("en-IN")} estimated starter cost · {selectedPathway.opportunity.durationMonths} months</p></div></div>
      <div className="two-column"><div className="detail-panel"><h3>Requirements checked</h3>{selectedPathway.eligibility.satisfied.map((item) => <p key={item}><Check size={15} />{item}</p>)}{selectedPathway.eligibility.blockers.map((item) => <p className="negative" key={item}><CircleAlert size={15} />{item}</p>)}</div><div className="detail-panel"><h3>Evidence and uncertainty</h3><p><CircleAlert size={15} />Evidence quality: {selectedPathway.evidenceQuality}/100. This is starter data, not a live vacancy or verified admission result.</p><p><CircleAlert size={15} />Recommendation confidence: {selectedPathway.recommendationConfidence}/100, based on profile and evidence coverage; it is not a success probability.</p>{selectedPathway.eligibility.assumptions.map((item) => <p key={item}><CircleAlert size={15} />{item}</p>)}{selectedPathway.eligibility.missingInformation.map((item) => <p key={item}><CircleAlert size={15} />{item}</p>)}</div></div>
      <div className="milestone-list"><h3>Milestones and review conditions</h3>{selectedPathway.milestones.map((item) => <p key={item}><BadgeCheck size={16} />{item}</p>)}{selectedPathway.conditionsToReconsider.map((item) => <p key={item}><CircleAlert size={16} />Reconsider if: {item}</p>)}</div>
      <div className="button-pair"><button className="button secondary" onClick={() => goTo("compare")}>Compare alternatives</button><button className="button primary" onClick={() => { setScenario(profile); goTo("simulate"); }}>Try What-if <SlidersHorizontal size={16} /></button></div>
      <button className="button primary full" onClick={() => {
        if (!hasPremiumAccess) {
          setPendingPremiumPathwayId(selectedPathway.id);
          goTo("premium");
          return;
        }
        if (!tasks.length) setTasks(createActionPlan(selectedPathway));
        goTo("plan");
      }}>{hasPremiumAccess ? "Open 30-day plan" : "Unlock routes & 30-day plan"} <ArrowRight size={16} /></button>
    </section>
  ) : <section className="flow-screen"><div className="empty-state">Choose a pathway comparison first.</div><button className="button primary full" onClick={() => goTo("compare")}>View pathways</button></section>;

  const premium = (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>Premium preview</StepLabel><h1>More routes, deeper planning.</h1><p>Plan A remains free. Premium unlocks the detailed alternatives and the selected routeâ€™s 30-day action plan with mid-course replanning.</p></div>
      <section className="premium-preview">
        <div className="demo-qr">{premiumDemoQr ? <Image src={premiumDemoQr} width={280} height={280} unoptimized alt="Scan to open the PATHWISE Premium page." /> : <span>Preparing QR...</span>}</div>
        <div>
          <span className="data-badge">{demoPremiumAvailable ? "Local preview only" : "Checkout unavailable"}</span>
          <h2>{demoPremiumAvailable ? "Premium preview access" : "Payment setup is required"}</h2>
          <p>{demoPremiumAvailable ? "Scan this QR to open PATHWISE Premium. It does not collect a payment; use preview access only for a presentation or local testing." : "This production build does not accept manual payment confirmation. Connect Stripe and configure server-side verification before offering premium access."}</p>
          {demoPremiumAvailable && <p className="demo-scan-note">For a phone presentation, open PATHWISE using this computer&apos;s Wi-Fi address or a deployed URL before scanning. Do not use <code>localhost</code>.</p>}
          {demoPremiumAvailable ? <button className="button primary" onClick={enableDemoPremium}>Enable premium preview <ArrowRight size={16} /></button> : <button className="button secondary" onClick={() => goTo("compare")}>Return to pathways</button>}
        </div>
      </section>
      <div className="detail-panel"><h3>What premium would unlock</h3><p><Check size={15} />Detailed Plan B and onward, with comparison and selection.</p><p><Check size={15} />A 30-day plan tied to the selected route.</p><p><Check size={15} />Progress tracking and user-approved rerouting when circumstances change.</p></div>
    </section>
  );

  const simulate = (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>Scenario only</StepLabel><h1>What if life changes?</h1><p>Your confirmed profile stays intact until you deliberately apply a scenario. The same eligibility rules will be run again.</p></div>
      <div className="simulation-form"><label>Budget available (₹)<output>₹{scenario.budget.toLocaleString("en-IN")}</output><input type="range" min="0" max="150000" step="5000" value={scenario.budget} onChange={(event) => updateScenario("budget", Number(event.target.value))} /></label><label>Weekly study / preparation time<output>{scenario.hoursWeekly} hours</output><input type="range" min="0" max="40" value={scenario.hoursWeekly} onChange={(event) => updateScenario("hoursWeekly", Number(event.target.value))} /></label><label>Income needed within<output>{scenario.incomeDeadlineMonths} months</output><input type="range" min="0" max="36" value={scenario.incomeDeadlineMonths} onChange={(event) => updateScenario("incomeDeadlineMonths", Number(event.target.value))} /></label><label>Location<input value={scenario.location} onChange={(event) => updateScenario("location", event.target.value)} placeholder="Near home / city / state" /></label><label className="toggle-row"><input type="checkbox" checked={scenario.canRelocate} onChange={(event) => updateScenario("canRelocate", event.target.checked)} /><span>Relocation is available for this scenario</span></label></div>
      <div className="simulation-boundary"><RefreshCcw size={18} /> This will re-rank the local starter catalogue and deterministic eligibility checks. It does not pretend to query live vacancies.</div>
      <button className="button primary full" onClick={runSimulation}>Recalculate pathways <ArrowRight size={16} /></button>
    </section>
  );

  const result = simulation ?? compareSimulation(profile, scenario);
  const recalculated = (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>Scenario result</StepLabel><h1>Here’s what changed.</h1><p>Before and after use the same profile structure, catalogue and eligibility rules.</p></div>
      {!result.changed.length ? <div className="empty-state">No constraint changed. The result is the same check against the same information.</div> : <div className="change-list">{result.changed.map((change) => <p key={change.label}><span>{change.label}</span><del>{change.before}</del><strong>{change.after}</strong></p>)}</div>}
      <div className="before-after"><article><span>Before</span><h3>{result.previous[0]?.focus}</h3><p>Score {result.previous[0]?.score}</p><p>{result.previous[0]?.eligibility.feasible ? "Feasible with recorded facts" : "Constraint blockers"}</p></article><article><span>After</span><h3>{result.updated[0]?.focus}</h3><p>Score {result.updated[0]?.score}</p><p>{result.updated[0]?.eligibility.feasible ? "Feasible with scenario facts" : "Constraint blockers"}</p></article></div>
      <div className="detail-panel"><h3>Feasibility changes</h3>{result.newlyFeasible.length ? <p><Check size={15} />Newly feasible: {result.newlyFeasible.join(", ")}</p> : null}{result.newlyInfeasible.length ? <p className="negative"><CircleAlert size={15} />Newly infeasible: {result.newlyInfeasible.join(", ")}</p> : null}{!result.newlyFeasible.length && !result.newlyInfeasible.length && <p>No starter route changed hard feasibility. Scores or ordering may still have changed.</p>}</div>
      <div className="button-pair"><button className="button secondary" onClick={() => goTo("simulate")}>Revise scenario</button><button className="button primary" onClick={applyScenario}>Apply scenario <Check size={16} /></button></div><button className="text-button centred" onClick={() => goTo("recommended")}>Return to previous plan without applying</button>
    </section>
  );

  const plan = hasPremiumAccess ? (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>From your selected pathway</StepLabel><h1>Your next 30 days.</h1><p>Completed work stays visible if the pathway changes. Regenerate only after you review what remains relevant.</p></div>
      {!tasks.length ? <div className="empty-state">Select a pathway to create its evidence-based starter action plan.</div> : <div className="task-list">{tasks.map((task) => <article key={task.id} className={"task-card " + (task.complete ? "done" : "")}><button className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.complete ? "Mark incomplete" : "Mark complete"}>{task.complete && <Check size={16} />}</button><div><span>Week {Math.ceil(task.suggestedDay / 7)} · Day {task.suggestedDay} · {task.estimatedMinutes} min</span><h3>{task.title}</h3><p>{task.reason}</p><small>Documents: {task.documents.join(", ")}</small><select value={task.status} aria-label={`Status for ${task.title}`} onChange={(event) => updateTaskStatus(task.id, event.target.value as ActionItem["status"])}><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="blocked">Blocked</option><option value="postponed">Postponed</option><option value="skipped">Skipped</option></select>{task.sourceUrl && <a href={task.sourceUrl} target="_blank" rel="noreferrer">Official resource ↗</a>}</div></article>)}</div>}
      {selectedPathway && <section className="replan-panel"><h3>Hit an obstacle? Propose a careful revision.</h3><p>Tell PATHWISE what changed. It preserves completed tasks and proposes only future changes; nothing replaces your roadmap until you approve it.</p><textarea value={replanObstacle} onChange={(event) => setReplanObstacle(event.target.value)} placeholder="For example: the course fee is higher than expected and I am worried about my family’s reaction." /><button className="button secondary" disabled={!replanObstacle.trim()} onClick={createReplanProposal}>Review a proposed revision <RefreshCcw size={16} /></button>{replanProposal && <div className="detail-panel"><h3>Revision to review</h3><p>{replanProposal.explanation}</p><p>Detected context: {replanProposal.categories.join(", ")}.</p><ul>{replanProposal.changedAssumptions.map((item) => <li key={item}>{item}</li>)}</ul><div className="button-pair"><button className="button secondary" onClick={() => setReplanProposal(null)}>Keep current roadmap</button><button className="button primary" onClick={applyReplanProposal}>Apply approved revision <Check size={16} /></button></div></div>}</section>}
      <button className="button primary full" onClick={() => goTo("timeline")}>View my path <ArrowRight size={16} /></button>
    </section>
  ) : (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>Premium feature</StepLabel><h1>Your 30-day plan is ready to unlock.</h1><p>Choose a premium route, turn it into practical next steps, and revise future tasks without losing completed work.</p></div>
      <div className="empty-state">No payment is accepted from this screen. In local development, use the labelled preview-access flow to test it. A deployed app must use verified Stripe checkout before granting premium access.</div>
      <button className="button primary full" onClick={() => {
        if (selectedPathway) setPendingPremiumPathwayId(selectedPathway.id);
        goTo("premium");
      }}>View premium options <ArrowRight size={16} /></button>
    </section>
  );

  const timeline = (
    <section className="flow-screen">
      <div className="screen-intro"><StepLabel>{syncAvailable ? "Synced state" : "This browser only"}</StepLabel><h1>Your path, as it actually happened.</h1><p>{syncAvailable ? "Confirmed updates are eligible for cross-device sync." : "Cross-device sync needs a configured authenticated database. This starter has not claimed it is live."}</p></div>
      <div className="timeline">{events.length ? events.map((item) => <article className="timeline-event" key={item.id}><span /><div><time>{prettyDate(item.at)}</time><h3>{item.title}</h3><p>{item.detail}</p></div></article>) : <div className="empty-state">No confirmed milestones yet. Your interview and profile remain editable.</div>}</div>
      <div className="progress-card"><Sparkles size={21} /><div><strong>Current direction</strong><p>{selectedPathway ? selectedPathway.focus : "No pathway selected yet"}</p><div><span>{tasks.filter((task) => task.complete).length} actions complete</span><span>{profile.interests.length} interests recorded</span></div></div></div>
      <button className="button primary full" onClick={() => goTo("interview")}>Continue my interview <ArrowRight size={16} /></button>
    </section>
  );

  const content: Record<Screen, React.ReactNode> = { home: landing, interview, activity, review, profile: profileForm, discover, compare, recommended, premium, simulate, recalculated, plan, timeline };
  return (
    <main className="pathwise-app">
      <div className="ambient-glow one" /><div className="ambient-glow two" />
      <section className={"website-shell " + (screen === "home" ? "landing-shell" : "")}>
        <header className="website-header">
          <button className="site-brand" onClick={() => goTo("home")} aria-label="PATHWISE home"><span className="leaf-mark">✦</span><span>PATHWISE<small>From uncertainty to a way forward</small></span></button>
          <nav className="website-nav" aria-label="PATHWISE navigation">
            <button className={screen === "interview" ? "active" : ""} onClick={() => goTo("interview")}>Interview</button>
            <button className={screen === "discover" || screen === "compare" || screen === "recommended" || screen === "premium" ? "active" : ""} onClick={() => goTo("discover")}>Explore paths</button>
            <button className={screen === "simulate" || screen === "recalculated" ? "active" : ""} onClick={() => { setScenario(profile); goTo("simulate"); }}>What-if</button>
            <button className={screen === "timeline" || screen === "plan" ? "active" : ""} onClick={() => goTo("timeline")}>My path</button>
          </nav>
          <div className="header-actions"><button className="header-camera" onClick={() => goTo("activity")}><Camera size={16} /> Camera <span>optional</span></button>{screen !== "home" && <button className="icon-button profile-shortcut" onClick={() => goTo("profile")} aria-label="Open profile"><Target size={17} /></button>}</div>
        </header>
        {screen !== "home" && <header className="app-header"><button className="icon-button back" onClick={goBack} aria-label="Previous step"><ArrowLeft size={18} /></button><div><span>{titleByScreen[screen]}</span><small>{Math.min(progressIndex, 8) + 1} / 9</small></div><button className="icon-button" onClick={() => goTo("profile")} aria-label="Open profile"><Target size={17} /></button></header>}
        <div className="screen-content">{content[screen]}</div>
        {screen !== "home" && <nav className="bottom-nav" aria-label="Primary navigation"><button onClick={() => goTo("home")}><Home size={18} /><span>Home</span></button><button className={screen === "interview" ? "active" : ""} onClick={() => goTo("interview")}><Mic size={18} /><span>Interview</span></button><button className={screen === "timeline" ? "active" : ""} onClick={() => goTo("timeline")}><Route size={18} /><span>My path</span></button><button className={screen === "simulate" ? "active" : ""} onClick={() => { setScenario(profile); goTo("simulate"); }}><SlidersHorizontal size={18} /><span>What-if</span></button></nav>}
      </section>
    </main>
  );
}
