"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live count of citizen reports still in the `new` state. Backs the header badge so the
 *  commander sees fresh public reports arrive without leaving the dashboard. */
export function useNewReportsCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const refresh = () => {
      supabase
        .from("citizen_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "new")
        .then(({ count }) => {
          if (active) setCount(count ?? 0);
        });
    };

    refresh();
    const channel = supabase
      .channel("reports_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "citizen_reports" }, refresh)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
