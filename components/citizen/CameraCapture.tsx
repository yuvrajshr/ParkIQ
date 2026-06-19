"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, MapPin, RefreshCw, Loader2, CameraOff } from "lucide-react";
import { useTranslation } from "@/lib/hooks/useTranslation";

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface CaptureValue {
  blob: Blob | null;
  url: string | null;
  geo: GeoFix | null;
}

interface Props {
  /** Called whenever the captured photo or GPS fix changes. Parent enables submit when
   *  both blob and geo are present. */
  onChange: (value: CaptureValue) => void;
}

type Phase = "prompt" | "live" | "captured" | "error";
type GeoStatus = "idle" | "locating" | "ok" | "denied";

/**
 * Live-camera evidence capture. There is no file input anywhere — the only way to
 * produce a photo is the in-page shutter, which blocks gallery uploads outright. The
 * shutter stays disabled until a GPS fix lands, and the device's coordinates + time are
 * burned into the JPEG as a geo-stamp so the report is self-describing evidence.
 */
export default function CameraCapture({ onChange }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("prompt");
  const [errorKey, setErrorKey] = useState<"cameraDenied" | "cameraUnsupported">("cameraDenied");
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  // Captured still lives in state (it drives render); urlRef mirrors it only so the
  // unmount cleanup can revoke the latest object URL without touching a ref in render.
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopGeo = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  // Full teardown on unmount: release camera + GPS + any object URL.
  useEffect(() => {
    return () => {
      stopStream();
      stopGeo();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [stopStream, stopGeo]);

  function startGeo() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        // Keep the most accurate fix seen so far.
        setGeo((prev) => (prev && prev.accuracy < fix.accuracy ? prev : fix));
        setGeoStatus("ok");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorKey("cameraUnsupported");
      setPhase("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("live");
      startGeo();
    } catch {
      setErrorKey("cameraDenied");
      setPhase("error");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !geo) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    stampEvidence(ctx, w, h, geo);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setCapturedUrl(url);
        setPhase("captured");
        stopStream(); // free the camera once we have the frame
        onChange({ blob, url, geo });
      },
      "image/jpeg",
      0.85,
    );
  }

  function retake() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setCapturedUrl(null);
    onChange({ blob: null, url: null, geo });
    start();
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-ink/90"
        style={{ boxShadow: "var(--shadow-rest)" }}
      >
        {/* Live video (hidden once captured) */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ display: phase === "live" ? "block" : "none" }}
        />

        {/* Captured still */}
        {phase === "captured" && capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedUrl} alt="" className="h-full w-full object-cover" />
        )}

        {/* Evidence reticle — only over the live viewfinder */}
        {phase === "live" && <ViewfinderFrame />}

        {/* Prompt / error states */}
        {(phase === "prompt" || phase === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
              {phase === "error" ? <CameraOff className="size-7" /> : <Camera className="size-7" />}
            </span>
            {phase === "error" ? (
              <p className="text-[13px] leading-relaxed text-white/80">{t(`report.${errorKey}`)}</p>
            ) : (
              <p className="text-[13px] leading-relaxed text-white/80">{t("report.cameraHint")}</p>
            )}
            {phase === "prompt" && (
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-[transform,background-color] active:scale-[0.97] hover:bg-primary-ink focus-visible:outline-2 focus-visible:outline-white"
              >
                <Camera className="size-4" />
                {t("report.startCamera")}
              </button>
            )}
            {phase === "error" && errorKey === "cameraDenied" && (
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
              >
                <RefreshCw className="size-4" />
                {t("report.startCamera")}
              </button>
            )}
          </div>
        )}

        {/* GPS status pill */}
        {(phase === "live" || phase === "captured") && (
          <div className="absolute left-3 top-3">
            <GeoPill status={geoStatus} geo={geo} />
          </div>
        )}
      </div>

      {/* Shutter / retake controls */}
      {phase === "live" && (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={capture}
            disabled={geoStatus !== "ok"}
            aria-label={t("report.capture")}
            className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-surface ring-2 ring-line transition-[transform] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="h-12 w-12 rounded-full bg-primary transition-colors group-hover:bg-primary-ink group-disabled:bg-faint" />
          </button>
          {geoStatus !== "ok" && (
            <span className="text-[11px] font-medium text-muted">
              {geoStatus === "denied" ? t("report.locationDenied") : t("report.locating")}
            </span>
          )}
        </div>
      )}

      {phase === "captured" && (
        <button
          type="button"
          onClick={retake}
          className="inline-flex items-center justify-center gap-2 self-center rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <RefreshCw className="size-4" />
          {t("report.retake")}
        </button>
      )}
    </div>
  );
}

/** Corner brackets — reads as an evidence-camera reticle, not a generic frame. */
function ViewfinderFrame() {
  const corners = [
    "left-3 top-3 border-l-2 border-t-2 rounded-tl-lg",
    "right-3 top-3 border-r-2 border-t-2 rounded-tr-lg",
    "left-3 bottom-3 border-l-2 border-b-2 rounded-bl-lg",
    "right-3 bottom-3 border-r-2 border-b-2 rounded-br-lg",
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {corners.map((c) => (
        <span key={c} className={`absolute h-7 w-7 border-white/85 ${c}`} />
      ))}
    </div>
  );
}

function GeoPill({ status, geo }: { status: GeoStatus; geo: GeoFix | null }) {
  const { t } = useTranslation();
  const base =
    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm";
  if (status === "ok" && geo) {
    return (
      <span className={`${base} bg-heat-low/90 text-white`}>
        <MapPin className="size-3" />
        {t("report.locationOk", { m: Math.round(geo.accuracy) })}
      </span>
    );
  }
  if (status === "denied") {
    return (
      <span className={`${base} bg-heat-critical/90 text-white`}>
        <MapPin className="size-3" />
        {t("report.locationDenied")}
      </span>
    );
  }
  return (
    <span className={`${base} bg-ink/70 text-white`}>
      <Loader2 className="size-3 animate-spin" />
      {t("report.locating")}
    </span>
  );
}

/** Burn coordinates, accuracy, time and a verified mark into the bottom of the frame. */
function stampEvidence(ctx: CanvasRenderingContext2D, w: number, h: number, geo: GeoFix) {
  const barH = Math.max(56, Math.round(h * 0.12));
  const grad = ctx.createLinearGradient(0, h - barH, 0, h);
  grad.addColorStop(0, "rgba(10,15,25,0)");
  grad.addColorStop(1, "rgba(10,15,25,0.82)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - barH, w, barH);

  const fs = Math.max(15, Math.round(w * 0.022));
  const pad = fs;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fs}px ui-monospace, monospace`;
  ctx.fillText(`${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`, pad, h - barH + fs * 1.5);

  const time = new Date().toLocaleString("en-IN", { hour12: true });
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 ${Math.round(fs * 0.8)}px ui-monospace, monospace`;
  ctx.fillText(`±${Math.round(geo.accuracy)} m · ${time} · ParkIQ VERIFIED`, pad, h - barH + fs * 2.7);
}
