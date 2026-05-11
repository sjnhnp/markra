import type { MouseEvent } from "react";
import {
  closeNativeWindow,
  minimizeNativeWindow,
  toggleNativeWindowMaximized
} from "../lib/tauri/window";

type WindowControlAction = () => Promise<unknown> | unknown;

type MacWindowControlsProps = {
  className?: string;
  onClose?: WindowControlAction;
  onMinimize?: WindowControlAction;
  onZoom?: WindowControlAction;
};

type WindowControlButtonProps = {
  action: WindowControlAction;
  className: string;
  icon: "close" | "minimize" | "zoom";
  label: string;
};

const controlButtonBaseClassName =
  "mac-window-control group/control relative inline-flex size-[15px] shrink-0 cursor-default items-center justify-center rounded-full border p-0 transition-[box-shadow,filter] duration-150 ease-out hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary)";
const glyphClassName =
  "mac-window-control-glyph pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 text-[#2f2f2f] transition-opacity duration-100 group-hover/window-controls:opacity-70 group-focus-within/window-controls:opacity-70";

function runWindowControlAction(action: WindowControlAction) {
  try {
    Promise.resolve(action()).catch(() => {});
  } catch {
    // Native window actions can fail while a window is closing; the UI should stay inert.
  }
}

function WindowControlGlyph({ icon }: { icon: WindowControlButtonProps["icon"] }) {
  if (icon === "close") {
    return (
      <svg
        aria-hidden="true"
        className={glyphClassName}
        data-icon="macos-close"
        height="6"
        viewBox="0 0 16 18"
        width="6"
      >
        <path
          d="M15.7522 4.44381L11.1543 9.04165L15.7494 13.6368C16.0898 13.9771 16.078 14.5407 15.724 14.8947L13.8907 16.728C13.5358 17.0829 12.9731 17.0938 12.6328 16.7534L8.03766 12.1583L3.44437 16.7507C3.10402 17.091 2.54132 17.0801 2.18645 16.7253L0.273257 14.8121C-0.0807018 14.4572 -0.0925004 13.8945 0.247845 13.5542L4.84024 8.96087L0.32499 4.44653C-0.0153555 4.10619 -0.00355681 3.54258 0.350402 3.18862L2.18373 1.35529C2.53859 1.00042 3.1013 0.989533 3.44164 1.32988L7.95689 5.84422L12.5556 1.24638C12.8951 0.906035 13.4587 0.917833 13.8126 1.27179L15.7267 3.18589C16.0807 3.53985 16.0925 4.10346 15.7522 4.44381Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "minimize") {
    return (
      <svg
        aria-hidden="true"
        className={glyphClassName}
        data-icon="macos-minimize"
        height="8"
        viewBox="0 0 17 6"
        width="8"
      >
        <path
          clipRule="evenodd"
          d="M1.47211 1.18042H15.4197C15.8052 1.18042 16.1179 1.50551 16.1179 1.90769V3.73242C16.1179 4.13387 15.8052 4.80006 15.4197 4.80006H1.47211C1.08665 4.80006 0.773926 4.47497 0.773926 4.07278V1.90769C0.773926 1.50551 1.08665 1.18042 1.47211 1.18042Z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={glyphClassName}
      data-icon="macos-zoom"
      height="6"
      viewBox="0 0 16 16"
      width="6"
    >
      <g transform="translate(16 0) scale(-1 1)">
        <path
          clipRule="evenodd"
          d="M3.53068 0.433838L15.0933 12.0409C15.0933 12.0409 15.0658 5.35028 15.0658 4.01784C15.0658 1.32095 14.1813 0.433838 11.5378 0.433838C10.6462 0.433838 3.53068 0.433838 3.53068 0.433838Z"
          fill="currentColor"
          fillRule="evenodd"
        />
        <path
          clipRule="evenodd"
          d="M12.4409 15.5378L0.87735 3.93073C0.87735 3.93073 0.905794 10.6214 0.905794 11.9538C0.905794 14.6507 1.79024 15.5378 4.43291 15.5378C5.32535 15.5378 12.4409 15.5378 12.4409 15.5378Z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

function WindowControlButton({ action, className, icon, label }: WindowControlButtonProps) {
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    runWindowControlAction(action);
  };

  return (
    <button
      aria-label={label}
      className={`${controlButtonBaseClassName} ${className}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      type="button"
    >
      <WindowControlGlyph icon={icon} />
    </button>
  );
}

export function MacWindowControls({
  className = "",
  onClose = closeNativeWindow,
  onMinimize = minimizeNativeWindow,
  onZoom = toggleNativeWindowMaximized
}: MacWindowControlsProps) {
  return (
    <div
      className={`mac-window-controls group/window-controls flex h-10 select-none items-center gap-2 pl-4 pr-2 [-webkit-user-select:none] ${className}`}
      aria-hidden={false}
    >
      <WindowControlButton
        action={onClose}
        className="border-[#e0443e] bg-[#ff5f57]"
        icon="close"
        label="Close window"
      />
      <WindowControlButton
        action={onMinimize}
        className="border-[#dea123] bg-[#ffbd2e]"
        icon="minimize"
        label="Minimize window"
      />
      <WindowControlButton
        action={onZoom}
        className="border-[#1aab29] bg-[#28c840]"
        icon="zoom"
        label="Zoom window"
      />
    </div>
  );
}
