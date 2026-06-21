"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import type { ChatMessage, VirsChatRequest } from "@/lib/ai/types";
import type { VirsData } from "@/lib/hooks/useVirs";
import { useTranslation } from "@/lib/hooks/useTranslation";

interface Props {
  open: boolean;
  onClose: () => void;
  virsData: VirsData;
}

export default function VirsAiInsights({ open, onClose, virsData }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const body: VirsChatRequest = {
      message: text,
      history: messages,
      virsContext: {
        summary: virsData.summary,
        clusters: virsData.clusters,
        roi: virsData.roi,
        modelCard: virsData.modelCard,
      },
    };

    const userMsg: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg, { role: "model", text: "" }]);
    setInput("");
    setError(null);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/virs-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setError(err instanceof Error ? err.message : t("ai.error"));
      setMessages((prev) => prev.slice(0, -1));
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
      {/* Viewport boundary for drag constraints */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[9998]" />

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            drag
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={constraintsRef}
            dragMomentum={false}
            dragElastic={0.05}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass fixed top-[130px] right-6 z-[9999] flex w-[560px] max-h-[720px] flex-col overflow-hidden rounded-2xl"
          >
            {/* Header — drag handle */}
            <div
              className="flex items-center justify-between border-b border-line px-4 py-3 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" stroke="var(--color-primary)" strokeWidth="1.4" />
                    <path d="M5.5 6c.3-.7 1-.9 1.5-.5.6.4.5 1.1 0 1.5L7 8.5" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="7" cy="10" r=".7" fill="var(--color-primary)" />
                  </svg>
                </span>
                <span className="eyebrow">{t("ai.title")} · VIRS</span>
              </div>
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={t("ai.close")}
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
                  Ask about cluster risk scores, which zones to prioritise, dispatch ROI ranking, or what the VIRS model confidence means.
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
                      <span className="flex items-center gap-1 py-0.5">
                        {[0, 1, 2].map((j) => (
                          <span
                            key={j}
                            className="h-1.5 w-1.5 rounded-full bg-muted"
                            style={{
                              animation: "ai-dot-pulse 1.2s ease-in-out infinite",
                              animationDelay: `${j * 0.18}s`,
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
                placeholder={t("ai.inputPlaceholder")}
                rows={1}
                className="scroll-quiet flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-primary"
                style={{ maxHeight: 96 }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                aria-label={t("ai.send")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                style={{ boxShadow: "0 2px 8px -4px rgba(27,95,176,0.6)" }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M3 7.5h9M9 4l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
