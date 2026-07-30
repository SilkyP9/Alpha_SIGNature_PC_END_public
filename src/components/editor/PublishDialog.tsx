import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { X, Send, MonitorSmartphone, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

export function PublishDialog({
  open,
  onClose,
  mode = "slide",
}: {
  open: boolean;
  onClose: () => void;
  mode?: "slide" | "playlist";
}) {
  const slide = useEditorStore((s) => s.getCurrentSlide());
  const signs = useEditorStore((s) => s.signs);
  const playlists = useEditorStore((s) => s.playlists);
  const addSign = useEditorStore((s) => s.addSign);
  const saveSlideToLibrary = useEditorStore((s) => s.saveSlideToLibrary);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playlistId, setPlaylistId] = useState("");
  const [sendMode, setSendMode] = useState<"slide" | "playlist">(mode);
  const [newName, setNewName] = useState("");
  const [newIp, setNewIp] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setSendMode(mode);
      setSelected(new Set(signs.filter((s) => s.online).map((s) => s.id)));
    }
  }, [open, mode, signs]);

  const allSelected = signs.length > 0 && selected.size === signs.length;

  const summary = useMemo(() => {
    if (sendMode === "playlist") {
      const pl = playlists.find((p) => p.id === playlistId);
      return pl
        ? `Playlist “${pl.name}” (${pl.slideIds.length} slides)`
        : "Select a playlist below";
    }
    return slide
      ? `Slide “${slide.name}” (${slide.width}×${slide.height})`
      : "No slide";
  }, [sendMode, playlistId, playlists, slide]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(signs.map((s) => s.id)));
  };

  const publish = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one sign");
      return;
    }
    if (sendMode === "playlist" && !playlistId) {
      toast.error("Select a playlist to send");
      return;
    }
    if (sendMode === "slide" && slide) {
      saveSlideToLibrary();
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 900));
    const names = signs
      .filter((s) => selected.has(s.id))
      .map((s) => s.alias || s.name)
      .join(", ");
    setSending(false);
    toast.success(
      `Queued for ${selected.size} sign(s): ${names}. Same content, no rework.`,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Send to signs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Send to sign(s)</div>
            <div className="text-xs text-[var(--color-muted)]">{summary}</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4 scrollbar-thin">
          <div className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-0.5">
            <button
              type="button"
              onClick={() => setSendMode("slide")}
              className={cn(
                "flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-medium transition-colors",
                sendMode === "slide"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              This slide
            </button>
            <button
              type="button"
              onClick={() => setSendMode("playlist")}
              className={cn(
                "flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs font-medium transition-colors",
                sendMode === "playlist"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              A playlist
            </button>
          </div>

          {sendMode === "playlist" && (
            <Field label="Playlist">
              <select
                value={playlistId}
                onChange={(e) => setPlaylistId(e.target.value)}
                className="flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 text-sm"
              >
                <option value="">Select playlist…</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slideIds.length} slides)
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Destination signs — check all that should receive this
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          {signs.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">
              No signs on this account yet. Add one below.
            </p>
          )}

          <ul className="space-y-1.5">
            {signs.map((sign) => {
              const checked = selected.has(sign.id);
              const sizeMismatch =
                slide &&
                sendMode === "slide" &&
                (sign.width !== slide.width || sign.height !== slide.height);
              return (
                <li key={sign.id}>
                  <button
                    type="button"
                    onClick={() => toggle(sign.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors",
                      checked
                        ? "border-[color-mix(in_oklab,var(--color-primary)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)]"
                        : "border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]",
                    )}
                  >
                    <span className="mt-0.5 text-[var(--color-primary)]">
                      {checked ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4 text-[var(--color-subtle)]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <MonitorSmartphone className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
                        <span className="truncate text-sm font-medium">
                          {sign.alias || sign.name}
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase",
                            sign.online
                              ? "bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-[var(--color-success)]"
                              : "bg-[color-mix(in_oklab,var(--color-danger)_18%,transparent)] text-[var(--color-danger)]",
                          )}
                        >
                          {sign.online ? "Online" : "Offline"}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                        {sign.width}×{sign.height} px · {sign.pitchMm}mm ·{" "}
                        {sign.controller}
                        {sign.ip ? ` · ${sign.ip}` : ""}
                      </span>
                      {sizeMismatch && (
                        <span className="mt-0.5 block text-[11px] text-[var(--color-warn)]">
                          Size differs from slide — content will scale to{" "}
                          {sign.width}×{sign.height}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Add sign to account
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Front sign"
                />
              </Field>
              <Field label="IP / Tailscale">
                <Input
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="100.x.x.x"
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => {
                if (!newName.trim()) {
                  toast.error("Name required");
                  return;
                }
                addSign({
                  name: newName.trim(),
                  ip: newIp.trim(),
                  width: slide?.width ?? 360,
                  height: slide?.height ?? 120,
                  online: false,
                  controller: "Novastar + MRV300",
                });
                setNewName("");
                setNewIp("");
                toast.success("Sign added");
              }}
            >
              Add sign
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex-1 text-xs text-[var(--color-subtle)]">
            {selected.size} selected · one build → many signs
          </div>
          <Button onClick={publish} disabled={sending || selected.size === 0}>
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send to selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}
