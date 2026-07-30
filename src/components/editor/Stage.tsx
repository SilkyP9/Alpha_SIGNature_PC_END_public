import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, type SlideObject } from "@/store/editor-store";
import { cn } from "@/lib/cn";

type DragMode =
  | { kind: "move"; id: string; startX: number; startY: number; ox: number; oy: number }
  | {
      kind: "resize";
      id: string;
      handle: string;
      startX: number;
      startY: number;
      ox: number;
      oy: number;
      ow: number;
      oh: number;
    }
  | null;

function StageObjectView({
  obj,
  selected,
  zoom,
  onPointerDown,
}: {
  obj: SlideObject;
  selected: boolean;
  zoom: number;
  onPointerDown: (e: React.PointerEvent, obj: SlideObject, handle?: string) => void;
}) {
  if (!obj.visible) return null;

  const style: React.CSSProperties = {
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.zIndex + 10,
    opacity: obj.opacity,
    transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
    pointerEvents: obj.locked ? "none" : "auto",
  };

  const textStyle: React.CSSProperties =
    obj.type === "text"
      ? {
          color: obj.color,
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
          padding: 4,
        }
      : {};

  const rectStyle: React.CSSProperties =
    obj.type === "rect"
      ? {
          background: obj.fill,
          border:
            obj.outlineWidth > 0
              ? `${obj.outlineWidth}px solid ${obj.outlineColor}`
              : undefined,
          width: "100%",
          height: "100%",
        }
      : {};

  const handles = selected && !obj.locked
    ? (["nw", "ne", "sw", "se"] as const)
    : [];

  const handlePos: Record<string, React.CSSProperties> = {
    nw: { left: -5, top: -5, cursor: "nwse-resize" },
    ne: { right: -5, top: -5, cursor: "nesw-resize" },
    sw: { left: -5, bottom: -5, cursor: "nesw-resize" },
    se: { right: -5, bottom: -5, cursor: "nwse-resize" },
  };

  return (
    <div
      className={cn("stage-object", selected && "selected")}
      style={style}
      data-object-id={obj.id}
      onPointerDown={(e) => onPointerDown(e, obj)}
    >
      {obj.type === "text" && (
        <div className="stage-text" style={textStyle}>
          {obj.text}
        </div>
      )}
      {obj.type === "rect" && <div style={rectStyle} />}
      {handles.map((h) => (
        <div
          key={h}
          className="stage-handle"
          style={{
            ...handlePos[h],
            width: 10 / Math.max(zoom, 0.4),
            height: 10 / Math.max(zoom, 0.4),
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, obj, h);
          }}
        />
      ))}
    </div>
  );
}

export function Stage() {
  const slides = useEditorStore((s) => s.slides);
  const currentSlideId = useEditorStore((s) => s.currentSlideId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const tool = useEditorStore((s) => s.tool);
  const select = useEditorStore((s) => s.select);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const moveObject = useEditorStore((s) => s.moveObject);
  const resizeObject = useEditorStore((s) => s.resizeObject);
  const addTextObject = useEditorStore((s) => s.addTextObject);
  const addRectObject = useEditorStore((s) => s.addRectObject);
  const setTool = useEditorStore((s) => s.setTool);
  const sizeProfile = useEditorStore((s) => s.sizeProfile);

  const slide = slides.find((s) => s.id === currentSlideId) ?? null;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragMode>(null);

  const onObjectPointerDown = useCallback(
    (e: React.PointerEvent, obj: SlideObject, handle?: string) => {
      if (obj.locked) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const ids = useEditorStore.getState().selectedIds;
      if (!ids.includes(obj.id)) {
        select(e.shiftKey ? [...ids, obj.id] : [obj.id]);
      } else if (e.shiftKey) {
        select([obj.id], true);
      }

      if (handle) {
        setDrag({
          kind: "resize",
          id: obj.id,
          handle,
          startX: e.clientX,
          startY: e.clientY,
          ox: obj.x,
          oy: obj.y,
          ow: obj.width,
          oh: obj.height,
        });
      } else {
        setDrag({
          kind: "move",
          id: obj.id,
          startX: e.clientX,
          startY: e.clientY,
          ox: obj.x,
          oy: obj.y,
        });
      }
    },
    [select],
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const z = useEditorStore.getState().zoom;
      const dx = (e.clientX - drag.startX) / z;
      const dy = (e.clientY - drag.startY) / z;

      if (drag.kind === "move") {
        moveObject(drag.id, drag.ox + dx, drag.oy + dy);
      } else {
        const { ox, oy, ow, oh } = drag;
        let x = ox;
        let y = oy;
        let w = ow;
        let h = oh;
        const hh = drag.handle;
        if (hh.includes("e")) w = Math.max(8, ow + dx);
        if (hh.includes("s")) h = Math.max(8, oh + dy);
        if (hh.includes("w")) {
          w = Math.max(8, ow - dx);
          x = ox + (ow - w);
        }
        if (hh.includes("n")) {
          h = Math.max(8, oh - dy);
          y = oy + (oh - h);
        }
        resizeObject(drag.id, w, h, x, y);
      }
    };

    const onUp = () => setDrag(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, moveObject, resizeObject]);

  const onStageClick = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.dataset.stageBg) return;

    if (tool === "text") {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const z = useEditorStore.getState().zoom;
      const x = (e.clientX - rect.left) / z;
      const y = (e.clientY - rect.top) / z;
      addTextObject({
        x: Math.round(x - 40),
        y: Math.round(y - 16),
        text: "New text",
      });
      setTool("select");
      return;
    }
    if (tool === "rect") {
      addRectObject();
      setTool("select");
      return;
    }
    clearSelection();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const store = useEditorStore.getState();

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        store.deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        store.duplicateSelected();
      }
      if (e.key === "]" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) store.bringToFront();
        else store.bringForward();
      }
      if (e.key === "[" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) store.sendToBack();
        else store.sendBackward();
      }
      if (e.key === "Escape") store.clearSelection();

      const nudge = e.shiftKey ? 10 : 1;
      const sel = store.getSelectedObjects();
      if (sel.length === 1 && !sel[0].locked) {
        const o = sel[0];
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          store.moveObject(o.id, o.x - nudge, o.y);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          store.moveObject(o.id, o.x + nudge, o.y);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          store.moveObject(o.id, o.x, o.y - nudge);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          store.moveObject(o.id, o.x, o.y + nudge);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!slide) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--color-muted)]">
        No slide selected
      </div>
    );
  }

  const sorted = [...slide.objects].sort((a, b) => a.zIndex - b.zIndex);
  const playLength = slide.playLength ?? 8;

  return (
    <div
      ref={viewportRef}
      className="relative flex flex-1 items-center justify-center overflow-auto bg-[var(--color-bg)] scrollbar-thin"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-border) 55%, transparent) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div
        className="relative shadow-[var(--shadow-panel)] my-8"
        style={{
          width: slide.width * zoom,
          height: slide.height * zoom,
        }}
      >
        <div
          className={cn(
            "origin-top-left absolute top-0 left-0",
            tool === "text" || tool === "rect" ? "cursor-crosshair" : "cursor-default",
          )}
          style={{
            width: slide.width,
            height: slide.height,
            transform: `scale(${zoom})`,
            background: slide.background,
            backgroundImage: showGrid
              ? `linear-gradient(to right, color-mix(in oklab, #fff 6%, transparent) 1px, transparent 1px),
                 linear-gradient(to bottom, color-mix(in oklab, #fff 6%, transparent) 1px, transparent 1px)`
              : undefined,
            backgroundSize: showGrid ? `${Math.max(4, 40 / Math.max(zoom, 1))}px ${Math.max(4, 40 / Math.max(zoom, 1))}px` : undefined,
          }}
          onPointerDown={onStageClick}
        >
          <div data-stage-bg="1" className="absolute inset-0" style={{ zIndex: 0 }} />
          {sorted.map((obj) => (
            <StageObjectView
              key={obj.id}
              obj={obj}
              selected={selectedIds.includes(obj.id)}
              zoom={zoom}
              onPointerDown={onObjectPointerDown}
            />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-xs text-[var(--color-muted)] backdrop-blur-sm">
        {slide.width}×{slide.height}
        {sizeProfile.mediaWidth !== slide.width
          ? ` · media ${sizeProfile.mediaWidth}×${sizeProfile.mediaHeight}`
          : ""}
        {" · "}
        {playLength}s · {Math.round(zoom * 100)}% ·{" "}
        {sizeProfile.locked ? "size locked" : "size free"} · drag / resize
      </div>
    </div>
  );
}
