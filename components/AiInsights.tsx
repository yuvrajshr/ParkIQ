"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SIM_START_MIN_OF_DAY } from "@/lib/sim/engine";
import type { Hotspot, PredictedHotspot, Warden, Dispatch } from "@/lib/types";
import type { ChatMessage, SimSnapshot } from "@/lib/ai/types";

interface Props {
  simMin: number;
  hotspots: Hotspot[];
  predictions: PredictedHotspot[];
  wardens: Warden[];
  dispatches: Dispatch[];
  kpis: { kmph: number; parked: number; rupees: number };
  eff: { totalRecovered: number; relapsed: { length: number } };
}

function buildWallClock(simMin: number): string {
  const total = (SIM_START_MIN_OF_DAY + Math.round(simMin)) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function buildSnapshot(props: Props): SimSnapshot {
  const { simMin, hotspots, predictions, wardens, dispatches, kpis, eff } = props;
  return {
    simMin,
    wallClock: buildWallClock(simMin),
    hotspots: hotspots.map((h) => ({
      roadId: h.roadId,
      name: h.name,
      zone: h.zone,
      nearLandmark: h.nearLandmark,
      cis: h.cis,
      level: h.level,
      kmphLost: h.kmphLost,
      parkedVehicles: h.parkedVehicles,
      observedKmph: h.observedKmph,
      freeFlowKmph: h.freeFlowKmph,
      rupeesPerMin: h.rupeesPerMin,
      chronic: h.chronic,
    })),
    predictions: predictions.map((p) => ({
      roadId: p.roadId,
      name: p.name,
      etaMin: p.etaMin,
      projectedCis: p.projectedCis,
      recurring: p.recurring,
      reason: p.reason,
    })),
    wardens: wardens.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      assignedRoadId: w.assignedRoadId,
    })),
    dispatches: dispatches.map((d) => ({
      roadId: d.roadId,
      roadName: d.roadName,
      wardenName: d.wardenName,
      dispatchedAtMin: d.dispatchedAtMin,
      etaMin: d.etaMin,
      cisBefore: d.cisBefore,
    })),
    kpis: {
      totalKmphLost: kpis.kmph,
      totalParkedVehicles: kpis.parked,
      totalRupeesPerMin: kpis.rupees,
    },
    effectiveness: {
      totalRecovered: eff.totalRecovered,
      relapsedCount: eff.relapsed.length,
    },
  };
}

export default function AiInsights(props: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const snapshot = buildSnapshot(props);
    const userMsg: ChatMessage = { role: "user", text };

    setMessages((prev) => [...prev, userMsg, { role: "model", text: "" }]);
    setInput("");
    setError(null);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages, // history before this turn
          snapshot,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "model",
            text: updated[updated.length - 1].text + chunk,
          };
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.slice(0, -1)); // remove empty placeholder
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI insights" : "Open AI insights"}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-ink text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        style={{
          boxShadow: "0 2px 6px rgba(27,95,176,0.25), 0 8px 24px -8px rgba(27,95,176,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="flex items-center justify-center"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5.5h14M3 10h10M3 14.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          )}
        </motion.span>
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass fixed bottom-[88px] right-6 z-40 flex w-[380px] max-h-[520px] flex-col overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" stroke="var(--color-primary)" strokeWidth="1.4" />
                    <path d="M5.5 6c.3-.7 1-.9 1.5-.5.6.4.5 1.1 0 1.5L7 8.5" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="7" cy="10" r=".7" fill="var(--color-primary)" />
                  </svg>
                </span>
                <span className="eyebrow">AI Insights</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Message list */}
            <div className="scroll-quiet flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {messages.length === 0 && (
                <p className="px-1 py-2 text-[12.5px] leading-relaxed text-muted italic">
                  Ask anything about the current situation — hotspots, dispatches, what to prioritise next.
                </p>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-white"
                        : "rounded-bl-sm bg-surface-2 text-ink"
                    }`}
                  >
                    {m.text || (
                      // Loading dots for empty streaming placeholder
                      <span className="flex items-center gap-1 py-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-muted"
                            style={{
                              animation: "ai-dot-pulse 1.2s ease-in-out infinite",
                              animationDelay: `${i * 0.18}s`,
                            }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {error && (
                <p className="text-[12px] text-heat-high px-1">{error}</p>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input footer */}
            <div className="border-t border-line px-3 py-2.5 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question…"
                rows={1}
                className="scroll-quiet flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-primary"
                style={{ maxHeight: 96 }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                style={{
                  boxShadow: "0 2px 8px -4px rgba(27,95,176,0.6)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M3 7.5h9M9 4l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading dot animation — only if motion is allowed */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ai-dot-pulse {
            0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
            40% { opacity: 1; transform: scale(1); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes ai-dot-pulse { 0%, 100% { opacity: 0.5; } }
        }
      `}</style>
    </>
  );
}
