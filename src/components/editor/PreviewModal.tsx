import { useEffect, useMemo, useRef, useState } from "react";
import type { Slide, SlideObject } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/cn";

function phaseOf(
  obj: SlideObject,
  t: number,
  playLength: number,
): { phase: "enter" | "hold" | "exit" | "done"; local: number; progress: number } {
  const en = Math.max(0.05, obj.entranceDuration);
  const ho = Math.max(0.05, obj.holdDuration);
  const ex = Math.max(0.05, obj.exitDuration);
  const total = en + ho + ex;
  const scale = total > playLength ? playLength / total : 1;
  const enS = en * scale;
  const hoS = ho * scale;
  const exS = ex * scale;

  if (t < enS) {
    return { phase: "enter", local: t, progress: t / enS };
  }
  if (t < enS + hoS) {
    return { phase: "hold", local: t - enS, progress: (t - enS) / hoS };
  }
  if (t < enS + hoS + exS) {
    return { phase: "exit", local: t - enS - hoS, progress: (t - enS - hoS) / exS };
  }
  return { phase: "done", local: 0, progress: 1 };
}

function styleForObject(
  obj: SlideObject,
  t: number,
  playLength: number,
): React.CSSProperties {
  if (!obj.visible) return { display: "none" };

  const { phase, local, progress } = phaseOf(obj, t, playLength);
  let opacity = 1;
  let transform = obj.rotation ? `rotate(${obj.rotation}deg)` : "";
  let filter = "";
  let color = obj.color;
  let extra: React.CSSProperties = {};

  if (phase === "done") {
    return { display: "none" };
  }

  if (phase === "enter") {
    const p = progress;
    switch (obj.entrance) {
      case "none":
      case "appear":
        opacity = 1;
        break;
      case "fade-in":
        opacity = p;
        break;
      case "blur-in":
        opacity = p;
        filter = `blur(${(1 - p) * 8}px)`;
        break;
      case "slide-left":
        opacity = p;
        transform = `translateX(${(1 - p) * -40}px) ${transform}`;
        break;
      case "slide-right":
        opacity = p;
        transform = `translateX(${(1 - p) * 40}px) ${transform}`;
        break;
      case "slide-top":
      case "fall-in-top":
        opacity = p;
        transform = `translateY(${(1 - p) * -30}px) ${transform}`;
        break;
      case "scale-up":
        opacity = p;
        transform = `scale(${0.4 + 0.6 * p}) ${transform}`;
        break;
      case "bounce-in": {
        const bounce = Math.sin(p * Math.PI) * (1 - p) * 0.2;
        opacity = Math.min(1, p * 1.4);
        transform = `scale(${0.6 + 0.4 * p + bounce}) ${transform}`;
        break;
      }
      default:
        opacity = p;
    }
  }

  if (phase === "hold") {
    opacity = 1;
    switch (obj.hold) {
      case "shimmer": {
        const wave = 0.75 + 0.25 * Math.sin(local * Math.PI * 2 * 1.2);
        opacity = wave;
        filter = `brightness(${0.85 + 0.35 * wave})`;
        break;
      }
      case "pulse":
      case "scale-pulse": {
        const s = 1 + 0.06 * Math.sin(local * Math.PI * 2);
        transform = `scale(${s}) ${transform}`;
        break;
      }
      case "flash": {
        opacity = Math.sin(local * Math.PI * 6) > 0 ? 1 : 0.15;
        break;
      }
      case "sway": {
        transform = `rotate(${Math.sin(local * Math.PI * 2) * 3}deg) ${transform}`;
        break;
      }
      case "color-pulse": {
        const hue = (local * 80) % 360;
        color = `hsl(${hue} 90% 65%)`;
        break;
      }
      case "random-color": {
        const step = Math.floor(local * 4);
        const hue = (step * 97 + obj.zIndex * 41) % 360;
        color = `hsl(${hue} 95% 60%)`;
        filter = `drop-shadow(0 0 6px hsl(${hue} 95% 50%))`;
        break;
      }
      case "highlight-sweep": {
        const x = ((local * 0.6) % 1) * 200 - 50;
        extra = {
          backgroundImage: `linear-gradient(105deg, transparent ${x}%, color-mix(in oklab, white 35%, transparent) ${x + 12}%, transparent ${x + 24}%)`,
        };
        break;
      }
      default:
        break;
    }
  }

  if (phase === "exit") {
    const p = progress;
    switch (obj.exit) {
      case "none":
      case "disappear":
        opacity = p < 0.05 ? 1 : 0;
        break;
      case "fade-out":
      case "dissolve":
        opacity = 1 - p;
        if (obj.exit === "dissolve") filter = `blur(${p * 6}px)`;
        break;
      case "slide-left":
        opacity = 1 - p;
        transform = `translateX(${-p * 50}px) ${transform}`;
        break;
      case "slide-right":
        opacity = 1 - p;
        transform = `translateX(${p * 50}px) ${transform}`;
        break;
      case "slide-bottom":
        opacity = 1 - p;
        transform = `translateY(${p * 40}px) ${transform}`;
        break;
      case "scale-down":
        opacity = 1 - p;
        transform = `scale(${1 - p * 0.7}) ${transform}`;
        break;
      default:
        opacity = 1 - p;
    }
  }

  return {
    position: "absolute",
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.zIndex + 10,
    opacity,
    transform: transform || undefined,
    filter: filter || undefined,
    transformOrigin: "center center",
    ...extra,
    ["--preview-color" as string]: color,
  };
}

function PreviewObject({
  obj,
  t,
  playLength,
}: {
  obj: SlideObject;
  t: number;
  playLength: number;
}) {
  const style = styleForObject(obj, t, playLength);
  if (style.display === "none") return null;

  const color = (style as Record<string, string>)["--preview-color"] || obj.color;

  if (obj.type === "text") {
    return (
      <div style={style}>
        <div
          style={{
            color,
            fontFamily: `${obj.fontFamily}, Impact, Arial Black, sans-serif`,
            fontSize: obj.fontSize,
            fontWeight: obj.fontWeight,
            textAlign: obj.textAlign,
            WebkitTextStroke:
              obj.outlineWidth > 0
                ? `${obj.outlineWidth}px ${obj.outlineColor}`
                : undefined,
            paintOrder: "stroke fill",
            display: "flex",
            alignItems: "center",
            justifyContent:
              obj.textAlign === "left"
                ? "flex-start"
                : obj.textAlign === "right"
                  ? "flex-end"
                  : "center",
            width: "100%",
            height: "100%",
            padding: 2,
            lineHeight: 1.1,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {obj.text}
        </div>
      </div>
    );
  }

  if (obj.type === "rect") {
    return (
      <div style={style}>
        <div
          style={{
            width: "100%",
            height: "100%",
            background: obj.fill,
            border:
              obj.outlineWidth > 0
                ? `${obj.outlineWidth}px solid ${obj.outlineColor}`
                : undefined,
          }}
        />
      </div>
    );
  }

  return null;
}

export function PreviewModal({
  slide,
  open,
  onClose,
}: {
  slide: Slide;
  open: boolean;
  onClose: () => void;
}) {
  const playLength = Math.max(1, slide.playLength || 8);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  const sorted = useMemo(
    () => [...slide.objects].sort((a, b) => a.zIndex - b.zIndex),
    [slide.objects],
  );

  const maxW = Math.min(720, typeof window !== "undefined" ? window.innerWidth - 48 : 720);
  const maxH = Math.min(360, typeof window !== "undefined" ? window.innerHeight * 0.45 : 360);
  const scale = Math.min(maxW / slide.width, maxH / slide.height, 4);

  useEffect(() => {
    if (!open) return;
    setT(0);
    setPlaying(true);
    last.current = performance.now();
  }, [open, slide.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !playing) return;
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT((prev) => {
        const next = prev + dt;
        if (next >= playLength) return 0;
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    last.current = performance.now();
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [open, playing, playLength]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Slide preview"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">
              Preview — as on the sign
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {slide.name} · {slide.width}×{slide.height} · {playLength.toFixed(1)}s play
              length · enter / hold / exit
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-center bg-[var(--color-bg)] px-4 py-6">
          <div
            className="relative overflow-hidden rounded-sm shadow-[var(--shadow-glow)]"
            style={{
              width: slide.width * scale,
              height: slide.height * scale,
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: slide.width,
                height: slide.height,
                transform: `scale(${scale})`,
                background: slide.background,
              }}
            >
              {sorted.map((obj) => (
                <PreviewObject
                  key={obj.id}
                  obj={obj}
                  t={t}
                  playLength={playLength}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-75"
                style={{ width: `${(t / playLength) * 100}%` }}
              />
            </div>
            <span className="w-20 text-right text-xs tabular-nums text-[var(--color-muted)]">
              {t.toFixed(1)} / {playLength.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Play
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setT(0);
                setPlaying(true);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Replay
            </Button>
            <div className="flex-1" />
            <span className={cn("text-xs text-[var(--color-subtle)]")}>
              Effects play exactly as set on each layer
            </span>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
