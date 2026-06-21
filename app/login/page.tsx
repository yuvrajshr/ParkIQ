"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Layers3,
} from "lucide-react";
import LanguageDropdown from "@/components/LanguageDropdown";
import { useTranslation } from "@/lib/hooks/useTranslation";

const BLOBS = [
  { color: "#1b5fb0", opacity: 0.30, size: 750, x: [-60, 80],  y: [-40, 60],  scale: [1, 1.15],   dur: 34, left: "10%",  top: "15%" },
  { color: "#3b82d4", opacity: 0.22, size: 600, x: [40, -90],  y: [60, -50],  scale: [1.1, 0.9],  dur: 46, left: "65%",  top: "65%" },
  { color: "#1b5fb0", opacity: 0.25, size: 850, x: [80, -40],  y: [-70, 30],  scale: [0.95, 1.1], dur: 28, left: "75%",  top: "10%" },
  { color: "#5a9be0", opacity: 0.18, size: 550, x: [-30, 70],  y: [50, -60],  scale: [1, 1.2],    dur: 52, left: "25%",  top: "75%" },
];

interface Errors {
  email?: string;
  password?: string;
  general?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const shouldReduce = useReducedMotion();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function validate(): boolean {
    const next: Errors = {};
    if (!EMAIL_RE.test(email)) next.email = t("login.errEmail");
    if (password.length < 6) next.password = t("login.errPassword");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          router.replace("/");
          return;
        }
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.replace("/");
      } else {
        setErrors({ general: t("login.errInvalid") });
      }
    } catch {
      setErrors({ general: t("login.errGeneral") });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-neutral-950 text-neutral-50 min-h-screen w-full">
      <div
        className="relative min-h-screen flex p-12 justify-center items-center w-full"
        style={{
          background:
            "radial-gradient(circle at top, oklch(0.205 0 0), transparent 30%), linear-gradient(180deg, oklch(0.145 0 0), oklch(0.12 0 0))",
        }}
      >
        {/* Ambient background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {BLOBS.map((b, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: b.size,
                height: b.size,
                left: b.left,
                top: b.top,
                translate: "-50% -50%",
                background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
                opacity: b.opacity,
                filter: "blur(60px)",
              }}
              animate={shouldReduce ? {} : { x: b.x, y: b.y, scale: b.scale }}
              transition={{
                duration: b.dur,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-[520px] w-full">
          {/* Logo + title */}
          <div className="flex mb-8 justify-center items-center">
            <div className="flex items-center gap-3">
              <div
                className="size-12 rounded-2xl bg-neutral-200 text-neutral-900 flex justify-center items-center flex-shrink-0"
                style={{ boxShadow: "0 20px 60px -24px rgba(250,250,250,0.45)" }}
              >
                <Layers3 className="size-6" />
              </div>
              <div className="space-y-1">
                <div className="font-medium uppercase text-[#a1a1a1] text-xs leading-4 tracking-[3.84px]">
                  ASTRaM
                </div>
                <div className="font-semibold text-neutral-50 text-2xl leading-8 tracking-tight">
                  {t("login.portal")}
                </div>
              </div>
            </div>
          </div>

          {/* Card */}
          <form
            id="tour-login-form"
            onSubmit={handleSubmit}
            noValidate
            className="rounded-3xl bg-neutral-900 border border-white/10 p-8 flex flex-col gap-6"
            style={{ boxShadow: "0 30px 100px -50px rgba(0,0,0,0.8)" }}
          >
            {/* Card header */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex font-medium rounded-full bg-neutral-800 text-[#a1a1a1] text-xs border border-white/10 px-3 py-1 items-center gap-2">
                  <ShieldCheck className="size-4 text-[#00bc7d]" />
                  {t("login.secureAccess")}
                </div>
                <LanguageDropdown isDark={true} />
              </div>
              <div className="space-y-2">
                <h1 className="font-semibold text-neutral-50 text-3xl leading-9 tracking-tight">
                  {t("login.heading")}
                </h1>
                <p className="max-w-md text-[#a1a1a1] text-sm leading-6">
                  {t("login.subheading")}
                </p>
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-4">
              {/* Email */}
              <div className="grid gap-2">
                <label
                  htmlFor="email"
                  className="font-medium text-neutral-50 text-sm leading-5"
                >
                  {t("login.emailLabel")}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a1a1a1]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("login.emailPlaceholder")}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-neutral-950 text-neutral-50 border border-white/15 pl-11 pr-4 h-12 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50"
                  />
                </div>
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      key="email-err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs"
                    >
                      {errors.email}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <label
                  htmlFor="password"
                  className="font-medium text-neutral-50 text-sm leading-5"
                >
                  {t("login.passwordLabel")}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a1a1a1]" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-neutral-950 text-neutral-50 border border-white/15 pl-11 pr-12 h-12 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a1a1a1] hover:text-neutral-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      key="pw-err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Remember me + forgot password */}
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-4 rounded border-white/10 bg-neutral-800 accent-neutral-200 cursor-pointer"
                  />
                  <span className="text-[#a1a1a1] text-sm leading-5">{t("login.rememberMe")}</span>
                </label>
                <button
                  type="button"
                  className="text-neutral-200 text-sm leading-5 hover:text-white transition-colors"
                >
                  {t("login.forgotPassword")}
                </button>
              </div>
            </div>

            {/* General error */}
            <AnimatePresence>
              {errors.general && (
                <motion.div
                  key="general-err"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm"
                >
                  {errors.general}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              id="tour-login-submit"
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-neutral-200 text-neutral-900 w-full h-12 flex items-center justify-center gap-2 font-medium text-sm hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("login.signingIn")}
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" />
                  {t("login.signIn")}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
