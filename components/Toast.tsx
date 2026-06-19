"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSimStore } from "@/store/useSimStore";

export default function Toast() {
  const toast = useSimStore((s) => s.toast);
  const clearToast = useSimStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 3600);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 460, damping: 34 }}
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-float ring-1 ring-white/10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {toast}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
