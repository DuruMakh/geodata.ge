"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { useState } from "react";

type ExcelDownloadButtonProps = {
  testId: string;
  disabled: boolean;
  onDownload: () => Promise<void>;
};

export function ExcelDownloadButton({ testId, disabled, onDownload }: ExcelDownloadButtonProps) {
  const { messages } = useI18n();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function start() {
    if (disabled || status === "working") return;
    setStatus("working");
    try {
      await onDownload();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-[18px]">
      <button
        type="button"
        data-testid={testId}
        disabled={disabled || status === "working"}
        aria-busy={status === "working"}
        onClick={start}
        className="h-[38px] w-full cursor-pointer rounded-[2px] bg-[var(--ink)] text-[12.5px] font-semibold text-[var(--paper)] transition-opacity duration-150 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {message(messages, status === "working" ? "controls.excelWorking" : "controls.download")}
      </button>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 min-h-4 text-[11px] text-[var(--negative)]">
        {status === "working" ? (
          <span className="sr-only">{message(messages, "controls.excelWorking")}</span>
        ) : status === "error" ? (
          message(messages, "controls.excelError")
        ) : (
          ""
        )}
      </p>
    </div>
  );
}
