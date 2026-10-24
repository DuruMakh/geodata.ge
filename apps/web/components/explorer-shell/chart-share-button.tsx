"use client";

import { Copy, Download, Share, Share2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { canCopyPicture, canSharePicture, copyPicture, downloadPicture, renderPicture, sharePicture } from "../../lib/explorer/chartPicture.client";
import { pictureFilename, pictureStem } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ShareCard, type ShareCardProps } from "./share-card";

type ChartShareButtonProps = ShareCardProps & {
  /** The years shown, for the file name: `1995-2025`, or `2024` for a single year. */
  period: string;
  testId?: string;
};

type Action = "download" | "copy" | "native";
type Status = "idle" | "working" | "copied" | "error";

const ICONS: Record<Action, ReactNode> = {
  download: <Download aria-hidden size={16} strokeWidth={1.5} />,
  copy: <Copy aria-hidden size={16} strokeWidth={1.5} />,
  native: <Share aria-hidden size={16} strokeWidth={1.5} />,
};

/** Two frames: the off-screen card has mounted, its chart has measured and drawn. */
const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

// The chart's share button (DESIGN.md §7.17): under the chart, at the right of the source line.
// Its menu downloads, copies or device-shares a picture of the chart as selected. Opening the menu
// starts the picture, from a ShareCard mounted off-screen until it is drawn, so that by the time an
// item is chosen it is usually ready: Safari copies and shares only close to the reader's tap.
export function ChartShareButton({ period, testId = "chart-share", ...card }: ChartShareButtonProps) {
  const { locale, messages } = useI18n();
  const t = (key: string) => message(messages, `controls.share.${key}`);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const picture = useRef<Promise<Blob> | null>(null);
  const renders = useRef(0);
  const [open, setOpen] = useState(false);
  // Whether the latest picture is finished, and whether Share… was chosen before it was.
  const [ready, setReady] = useState(false);
  const [shareWaiting, setShareWaiting] = useState(false);
  const [actions, setActions] = useState<Action[]>(["download"]);
  const [cardShown, setCardShown] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector("button")?.focus();
  }, [open]);

  const show = () => {
    setActions(["download", ...(canCopyPicture() ? ["copy" as const] : []), ...(canSharePicture() ? ["native" as const] : [])]);
    setOpen(true);
    setCardShown(true);
    setReady(false);
    setShareWaiting(false);
    const render = ++renders.current;
    const made = (async () => {
      await settle();
      return renderPicture(cardRef.current!.firstElementChild as HTMLElement);
    })();
    // A menu reopened before the last picture finished starts a newer one, which still needs the card.
    made.catch(() => {}).finally(() => {
      if (renders.current !== render) return;
      setCardShown(false);
      setReady(true);
    });
    picture.current = made;
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const run = async (action: Action) => {
    // Safari opens the share sheet only close to the tap, so Share… waits in the menu for the picture
    // and the next tap shares it.
    if (action === "native" && !ready) {
      setShareWaiting(true);
      return;
    }
    const blob = picture.current;
    if (!blob || busy.current) return;
    busy.current = true;
    close();
    setStatus("working");
    const filename = pictureFilename(pictureStem(window.location.pathname, period), locale);
    try {
      if (action === "copy") {
        await copyPicture(blob);
        setStatus("copied");
      } else if (action === "native") {
        await sharePicture(await blob, filename, card.title);
        setStatus("idle");
      } else {
        downloadPicture(await blob, filename);
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
      picture.current = null;
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // Not `disabled`: a disabled button drops the keyboard focus the menu has just returned to it.
        aria-disabled={status === "working"}
        aria-busy={status === "working"}
        onClick={() => (status === "working" ? undefined : open ? close() : show())}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[2px] border border-[var(--control)] px-3 text-[12.5px] font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--tint)] aria-disabled:cursor-wait aria-disabled:opacity-55 max-[768px]:h-11"
      >
        <Share2 aria-hidden size={16} strokeWidth={1.5} />
        {t("button")}
      </button>
      {open ? (
        <>
          {/* An outside press closes the menu and goes no further, as on the year picker. */}
          <div aria-hidden className="fixed inset-0 z-30" onMouseDown={(event) => event.preventDefault()} onClick={close} />
          <div
            ref={menuRef}
            id={menuId}
            role="group"
            aria-label={t("menu")}
            data-testid={`${testId}-menu`}
            onKeyDown={onMenuKeyDown}
            className="absolute top-full right-0 z-40 mt-1.5 min-w-[236px] rounded-[2px] border border-[var(--hairline)] bg-[var(--tile)] py-1 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
          >
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                data-testid={`${testId}-${action}`}
                onClick={() => void run(action)}
                className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 px-3.5 text-left text-[13px] text-[var(--ink)] hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)] max-[768px]:min-h-11"
              >
                {ICONS[action]}
                {action === "native" && shareWaiting && !ready ? t("working") : t(action)}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <p data-testid={`${testId}-status`} role="status" aria-live="polite" aria-atomic="true" className="absolute top-full right-0 mt-1 text-[11px] whitespace-nowrap text-[var(--muted)]">
        {status === "working" ? t("working") : status === "copied" ? t("copied") : status === "error" ? <span className="text-[var(--negative)]">{t("error")}</span> : ""}
      </p>
      {cardShown
        ? createPortal(
            <div aria-hidden className="pointer-events-none fixed top-0 left-[-10000px]">
              <div ref={cardRef}><ShareCard {...card} /></div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
