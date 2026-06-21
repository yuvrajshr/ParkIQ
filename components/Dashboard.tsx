"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useModeStore } from "@/store/useModeStore";
import DashboardHeader from "./DashboardHeader";
import SimDashboard from "./SimDashboard";
import VirsDashboard from "./VirsDashboard";
import Toast from "./Toast";
import NewReportAlert from "./reports/NewReportAlert";

// Mode router: VIRS (default, ML-driven) or Simulation (the original heuristic dashboard). The
// header (with the mode toggle), global Toast, and the citizen NewReportAlert are shared across both.
export default function Dashboard() {
  const mode = useModeStore((s) => s.mode);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <DashboardHeader aiOpen={aiOpen} onAiToggle={() => setAiOpen((v) => !v)} />
      <AnimatePresence mode="wait" initial={false}>
        {mode === "virs" ? (
          <motion.div
            key="virs"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <VirsDashboard aiOpen={aiOpen} onAiClose={() => setAiOpen(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="sim"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SimDashboard aiOpen={aiOpen} onAiClose={() => setAiOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <Toast />
      <NewReportAlert />
    </div>
  );
}
