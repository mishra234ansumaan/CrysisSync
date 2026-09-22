"use client";

/**
 * FEATURE 1 — Panic-Proof Voice Triage button.
 * Giant hold-to-speak control using the Web Speech API (English + Hindi).
 * Falls back to manual text entry when the browser lacks speech recognition
 * (e.g. desktop Firefox) so the flow never dead-ends mid-demo.
 */
import * as React from "react";
import { Mic, Square, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  lang: "en-IN" | "hi-IN";
  disabled?: boolean;
  onListeningChange?: (listening: boolean) => void;
  onInterim?: (text: string) => void;
  onTranscript: (text: string) => void;
  onFallbackToText?: () => void;
}

export default function VoiceButton({
  lang,
  disabled,
  onListeningChange,
  onInterim,
  onTranscript,
  onFallbackToText,
}: VoiceButtonProps) {
  const [listening, setListening] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  const recogRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = React.useRef("");
  const interimRef = React.useRef("");

  React.useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  }, []);

  const setListeningBoth = (v: boolean) => {
    setListening(v);
    onListeningChange?.(v);
  };

  const start = () => {
    if (disabled || listening) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      onFallbackToText?.();
      return;
    }
    const rec = new Ctor();
    rec.lang = lang; // auto-detect between EN/HI via locale; server-side AI detects language too
    rec.continuous = false;
    rec.interimResults = true;
    finalRef.current = "";
    interimRef.current = "";

    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const chunk = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalRef.current += chunk + " ";
        else interim += chunk;
      }
      interimRef.current = interim;
      onInterim?.((finalRef.current + interim).trim());
    };
    rec.onend = () => {
      setListeningBoth(false);
      const text = (finalRef.current || interimRef.current).trim();
      if (text) onTranscript(text);
      else onInterim?.("");
    };
    rec.onerror = () => setListeningBoth(false);
    rec.onstart = () => setListeningBoth(true);

    recogRef.current = rec;
    try {
      rec.start();
    } catch {
      setListeningBoth(false);
    }
  };

  const stop = () => {
    recogRef.current?.stop();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        aria-label={listening ? "Release to send emergency voice message" : "Hold to speak your emergency"}
        aria-pressed={listening}
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          start();
        }}
        onPointerUp={stop}
        onPointerLeave={() => listening && stop()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) start();
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stop();
        }}
        className={cn(
          "relative flex h-44 w-44 touch-none items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-400/60 disabled:opacity-50 sm:h-52 sm:w-52",
          listening ? "scale-95" : "active:scale-95"
        )}
      >
        {/* expanding rings */}
        <span className={cn("voice-ring absolute inset-0 rounded-full border-2 border-red-500/60", listening && "listening")} aria-hidden />
        <span className={cn("voice-ring absolute inset-0 rounded-full border border-red-500/40 [animation-delay:0.5s]", listening && "listening")} aria-hidden />
        <span className={cn("voice-ring absolute inset-0 rounded-full border border-red-500/25 [animation-delay:1s]", listening && "listening")} aria-hidden />

        <span
          className={cn(
            "relative z-10 flex h-36 w-36 items-center justify-center rounded-full sm:h-44 sm:w-44",
            "bg-gradient-to-b from-red-500 via-red-600 to-red-700 shadow-[0_20px_70px_-10px_rgba(239,68,68,.8),inset_0_2px_12px_rgba(255,255,255,.25)]"
          )}
        >
          {listening ? (
            <Square className="h-12 w-12 fill-white text-white" aria-hidden />
          ) : (
            <Mic className="h-14 w-14 text-white drop-shadow-lg" aria-hidden />
          )}
        </span>
      </button>

      <div className="text-center">
        <p className={cn("font-display text-sm font-bold tracking-[0.25em] uppercase", listening ? "text-red-400" : "text-slate-300")}>
          {listening ? "Listening… release to send" : "Hold to speak"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {supported
            ? "English + हिंदी auto-detected · AI triages your message instantly"
            : "Speech recognition unavailable here — use typed SOS below"}
        </p>
        {!supported && (
          <button
            onClick={onFallbackToText}
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            <Type className="h-3.5 w-3.5" /> Type message instead
          </button>
        )}
      </div>
    </div>
  );
}
