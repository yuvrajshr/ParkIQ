import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { fetchReportData } from "@/lib/report/fetchReportData";
import { generateNarrative } from "@/lib/report/gemini";
import { ReportDocument } from "@/lib/report/pdf";
import type { ReportConfig, ReportData } from "@/lib/report/types";

// Gemini + PDF rendering can take longer than the serverless default; give it headroom.
export const maxDuration = 60;
// Force Node runtime — @react-pdf/renderer (fontkit/fs) cannot run on the Edge runtime.
export const runtime = "nodejs";

// Render the document to a PDF buffer. Kept outside the request handler's try/catch so the JSX
// isn't constructed inside a try block — renderToBuffer still rejects on failure, and that
// rejection is awaited and caught in POST.
function renderReportPdf(data: ReportData) {
  return renderToBuffer(<ReportDocument data={data} />);
}

// Controller-only (proxy.ts gates everything outside /api/citizen + /api/auth).
// Aggregates data → writes AI narrative → renders the PDF → streams it as a download.
export async function POST(req: Request) {
  let config: ReportConfig;
  try {
    config = (await req.json()) as ReportConfig;
  } catch {
    return NextResponse.json({ error: "Invalid config" }, { status: 400 });
  }

  try {
    const data = await fetchReportData(config);
    data.narrative = data.config.sections.executiveSummary || data.config.sections.aiRecommendations
      ? await generateNarrative(data) // fail-open: returns null on any error
      : null;

    const buffer = await renderReportPdf(data);

    const fromLabel = data.dateRange.from.slice(0, 10);
    const toLabel = data.dateRange.to.slice(0, 10);
    const filename = `ParkIQ_Report_${fromLabel}_to_${toLabel}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
