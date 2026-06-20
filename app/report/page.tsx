"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Phone, ShieldCheck, CheckCircle2, MapPin } from "lucide-react";
import SettingsMenu from "@/components/SettingsMenu";
import CameraCapture, { type CaptureValue } from "@/components/citizen/CameraCapture";
import { VIOLATION_TYPES } from "@/lib/citizen/violations";
import type { ViolationType } from "@/lib/types";
import { useTranslation } from "@/lib/hooks/useTranslation";

type Step = "phone" | "otp" | "capture" | "done";

export default function ReportPage() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [capture, setCapture] = useState<CaptureValue>({ blob: null, url: null, geo: null });
  const [type, setType] = useState<ViolationType>("wrong_parking");
  const [note, setNote] = useState("");
  const [doneRoad, setDoneRoad] = useState<string | null>(null);

  const fullPhone = `+91${digits}`;
  const stepIndex = step === "phone" ? 1 : step === "otp" ? 2 : 3;

  async function sendCode() {
    if (digits.length !== 10) return setError(t("report.errPhone"));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/citizen/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "");
      setMockCode(data.devCode ?? null);
      setCode(data.devCode ?? "");
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("report.errPhone"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (code.trim().length < 4) return setError(t("report.errOtp"));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/citizen/otp/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "");
      setStep("capture");
    } catch {
      setError(t("report.errOtp"));
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!capture.blob || !capture.geo) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", capture.blob, "violation.jpg");
      fd.append("lat", String(capture.geo.lat));
      fd.append("lng", String(capture.geo.lng));
      fd.append("accuracy", String(capture.geo.accuracy));
      fd.append("type", type);
      fd.append("note", note);
      const res = await fetch("/api/citizen/report", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Rejected note: keep the user on the capture step with their photo + note intact so
        // they can edit and resubmit, and show a localized reason.
        if (data.code === "note_rejected") {
          setError(
            data.reason === "irrelevant"
              ? t("report.noteRejectedIrrelevant")
              : t("report.noteRejectedProfanity"),
          );
          return;
        }
        if (data.code === "no_vehicle") {
          setError(t("report.noVehicle"));
          return;
        }
        throw new Error(data.error ?? "");
      }
      setDoneRoad(data.snappedRoadName ?? null);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("report.errSubmit"));
    } finally {
      setBusy(false);
    }
  }

  function reportAnother() {
    setCapture({ blob: null, url: null, geo: null });
    setType("wrong_parking");
    setNote("");
    setDoneRoad(null);
    setError(null);
    setStep("capture");
  }

  const canSubmit = Boolean(capture.blob && capture.geo) && !busy;
  const motionProps = reduce
    ? {}
    : { initial: false, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

  return (
    <main className="flex min-h-[100dvh] w-full flex-col items-center px-4 pb-12 pt-5">
      <div className="flex w-full max-w-[480px] flex-col">
        {/* Top bar */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-ink))" }}
            >
              <MapPin className="size-[18px]" />
            </span>
            <div className="leading-none">
              <div className="eyebrow !text-primary">{t("report.eyebrow")}</div>
              <div className="font-display text-[15px] font-bold tracking-tight text-ink">ParkIQ</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SettingsMenu />
          </div>
        </header>

        {/* Progress */}
        {step !== "done" && (
          <div className="mb-5 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{ background: n <= stepIndex ? "var(--color-primary)" : "var(--color-line-strong)" }}
              />
            ))}
            <span className="tnum ml-1 text-[11px] font-medium text-muted">
              {t("report.step", { n: stepIndex })}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Step 1: phone ───────────────────────────────────────── */}
          {step === "phone" && (
            <motion.section key="phone" {...motionProps} className="panel rounded-2xl p-5">
              <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">{t("report.title")}</h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{t("report.subtitle")}</p>

              <label htmlFor="phone" className="mt-5 block text-[13px] font-semibold text-ink">
                {t("report.phoneLabel")}
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-primary">
                <span className="tnum flex items-center gap-1.5 border-r border-line py-3 pr-3 text-sm font-semibold text-ink-soft">
                  <Phone className="size-4 text-muted" />
                  +91
                </span>
                <input
                  id="phone"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={digits}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder={t("report.phonePlaceholder")}
                  className="tnum h-12 w-full bg-transparent text-base tracking-wide text-ink placeholder:text-faint focus:outline-none"
                />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-faint">{t("report.phoneHint")}</p>

              <ErrorLine error={error} />

              <PrimaryButton onClick={sendCode} busy={busy} disabled={digits.length !== 10}>
                {busy ? t("report.sending") : t("report.sendCode")}
              </PrimaryButton>
            </motion.section>
          )}

          {/* ── Step 2: OTP ─────────────────────────────────────────── */}
          {step === "otp" && (
            <motion.section key="otp" {...motionProps} className="panel rounded-2xl p-5">
              <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">{t("report.otpStepTitle")}</h1>
              <p className="mt-1.5 text-[13px] text-muted">{t("report.otpSentTo", { phone: fullPhone })}</p>

              {mockCode && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-wash px-3 py-2 text-[12.5px] font-medium text-[#9a6a00]">
                  <ShieldCheck className="size-4 shrink-0" />
                  {t("report.mockNotice", { code: mockCode })}
                </div>
              )}

              <label htmlFor="otp" className="mt-5 block text-[13px] font-semibold text-ink">
                {t("report.otpLabel")}
              </label>
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="tnum mt-2 h-14 w-full rounded-xl border border-line bg-surface-2 text-center text-2xl font-bold tracking-[0.5em] text-ink focus:border-primary focus:outline-none"
              />

              <ErrorLine error={error} />

              <PrimaryButton onClick={verifyCode} busy={busy} disabled={code.trim().length < 4}>
                {busy ? t("report.verifying") : t("report.verify")}
              </PrimaryButton>

              <div className="mt-3 flex items-center justify-between text-[12.5px]">
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setError(null); }}
                  className="font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {t("report.changeNumber")}
                </button>
                <button
                  type="button"
                  onClick={sendCode}
                  className="font-semibold text-primary transition-colors hover:text-primary-ink focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {t("report.resend")}
                </button>
              </div>
            </motion.section>
          )}

          {/* ── Step 3: capture + details ───────────────────────────── */}
          {step === "capture" && (
            <motion.section key="capture" {...motionProps} className="panel rounded-2xl p-5">
              <h1 className="font-display text-[20px] font-bold tracking-tight text-ink">
                {t("report.captureStepTitle")}
              </h1>

              <div className="mt-4">
                <CameraCapture onChange={setCapture} />
              </div>

              {/* Violation type */}
              <label className="mt-5 block text-[13px] font-semibold text-ink">{t("report.typeLabel")}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {VIOLATION_TYPES.map(({ value, i18nKey }) => {
                  const active = type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      aria-pressed={active}
                      className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                      style={{
                        background: active ? "var(--color-primary)" : "var(--color-surface-2)",
                        color: active ? "#fff" : "var(--color-ink-soft)",
                        borderColor: active ? "var(--color-primary)" : "var(--color-line)",
                      }}
                    >
                      {t(i18nKey as Parameters<typeof t>[0])}
                    </button>
                  );
                })}
              </div>

              {/* Note */}
              <label htmlFor="note" className="mt-5 block text-[13px] font-semibold text-ink">
                {t("report.noteLabel")}
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 280))}
                placeholder={t("report.notePlaceholder")}
                rows={2}
                className="scroll-quiet mt-2 w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-primary focus:outline-none"
              />

              <ErrorLine error={error} />

              {!capture.blob && (
                <p className="mt-3 text-center text-[12px] text-faint">{t("report.needPhotoLocation")}</p>
              )}
              <PrimaryButton onClick={submitReport} busy={busy} disabled={!canSubmit}>
                {busy ? t("report.submitting") : t("report.submit")}
              </PrimaryButton>
            </motion.section>
          )}

          {/* ── Done ────────────────────────────────────────────────── */}
          {step === "done" && (
            <motion.section key="done" {...motionProps} className="panel rounded-2xl p-7 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-heat-low/12 text-heat-low">
                <CheckCircle2 className="size-9" />
              </span>
              <h1 className="mt-4 font-display text-[22px] font-bold tracking-tight text-ink">
                {t("report.doneTitle")}
              </h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{t("report.doneBody")}</p>
              {doneRoad && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-wash px-3 py-1.5 text-[12.5px] font-semibold text-primary">
                  <MapPin className="size-3.5" />
                  {t("report.doneNearRoad", { road: doneRoad })}
                </p>
              )}
              <PrimaryButton onClick={reportAnother} busy={false} disabled={false}>
                {t("report.another")}
              </PrimaryButton>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function PrimaryButton({
  children,
  onClick,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-[transform,background-color] active:scale-[0.98] hover:bg-primary-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
      style={{ boxShadow: "0 8px 20px -10px rgba(27,95,176,0.8)" }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
      {!busy && <ArrowRight className="size-4" />}
    </button>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-3 rounded-lg bg-heat-critical/10 px-3 py-2 text-[12.5px] font-medium text-heat-critical">
      {error}
    </p>
  );
}
