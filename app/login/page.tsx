"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Errors {
  email?: string;
  password?: string;
  general?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function validate(): boolean {
    const next: Errors = {};
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // 1. Supabase Auth (primary) — only if env vars are present
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          router.replace("/");
          return;
        }
      }

      // 2. Hardcoded credentials fallback
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.replace("/");
      } else {
        setErrors({ general: "Invalid email or password." });
      }
    } catch {
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="panel w-full max-w-[400px] rounded-2xl"
        style={{ padding: "40px" }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center text-center mb-8">
          <ShieldIcon />
          <h1
            className="font-display mt-4 text-[26px] font-extrabold tracking-[-0.03em]"
            style={{ color: "var(--color-ink)", lineHeight: 1.2 }}
          >
            ASTRaM Commander Portal
          </h1>
          <p className="eyebrow mt-2">Bengaluru Traffic Police · ParkIQ</p>
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--color-line)",
            marginBottom: "28px",
          }}
        />

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block text-[13px] font-medium mb-1.5"
              style={{ color: "var(--color-ink-soft)" }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (email && !EMAIL_RE.test(email)) {
                  setErrors((prev) => ({ ...prev, email: "Enter a valid email address." }));
                } else {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="you@gov.in"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: `1px solid ${errors.email ? "#b3261e" : "var(--color-line)"}`,
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                outline: "none",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-primary)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(27, 95, 176, 0.12)";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = errors.email
                  ? "#b3261e"
                  : "var(--color-line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <FieldError message={errors.email} />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-[13px] font-medium mb-1.5"
              style={{ color: "var(--color-ink-soft)" }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "10px 44px 10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${errors.password ? "#b3261e" : "var(--color-line)"}`,
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(27, 95, 176, 0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.password
                    ? "#b3261e"
                    : "var(--color-line)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  color: "var(--color-faint)",
                  display: "flex",
                  alignItems: "center",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-ink-soft)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-faint)")
                }
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <FieldError message={errors.password} />
          </div>

          {/* General error */}
          <AnimatePresence>
            {errors.general && (
              <motion.p
                key="general-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                style={{
                  color: "#b3261e",
                  fontSize: "13px",
                  marginBottom: "16px",
                  padding: "10px 12px",
                  background: "rgba(179, 38, 30, 0.06)",
                  borderRadius: "6px",
                  border: "1px solid rgba(179, 38, 30, 0.15)",
                }}
              >
                {errors.general}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: "8px",
              background: isSubmitting
                ? "var(--color-primary-wash)"
                : "var(--color-primary)",
              color: isSubmitting ? "var(--color-primary)" : "#ffffff",
              fontSize: "14px",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background 0.2s ease, transform 0.1s ease",
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting)
                e.currentTarget.style.background = "var(--color-primary-ink)";
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting)
                e.currentTarget.style.background = "var(--color-primary)";
            }}
            onMouseDown={(e) => {
              if (!isSubmitting) e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </motion.div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          style={{
            color: "#b3261e",
            fontSize: "12px",
            marginTop: "5px",
          }}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function ShieldIcon() {
  return (
    <svg width="44" height="50" viewBox="0 0 44 50" fill="none" aria-hidden="true">
      <path
        d="M22 2L3 9v16c0 10.5 8.2 20.3 19 22.9C32.8 45.3 41 35.5 41 25V9L22 2z"
        fill="var(--color-primary)"
        fillOpacity="0.12"
      />
      <path
        d="M22 2L3 9v16c0 10.5 8.2 20.3 19 22.9C32.8 45.3 41 35.5 41 25V9L22 2z"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 25l5.5 5.5L30 19"
        stroke="var(--color-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ animation: "spin 0.75s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
