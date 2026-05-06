import type { ReactNode } from "react";

export function AiSettingsTextField({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => unknown;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[13px] leading-5 font-[520] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-(--text-secondary) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

export function AiSettingsSelectField<TValue extends string>({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: TValue) => unknown;
  value: TValue;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">{label}</span>
      <select
        className="h-9 w-full rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[13px] leading-5 font-[520] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as TValue)}
      >
        {children}
      </select>
    </label>
  );
}

export function AiSettingsSection({ children, label }: { children: ReactNode; label: string }) {
  const sectionId = `ai-settings-section-${label.replace(/\s+/g, "-")}`;

  return (
    <section className="settings-section mb-8 last:mb-0" aria-labelledby={sectionId}>
      <h3 className="m-0 mb-3 text-[12px] leading-5 font-bold tracking-normal text-(--text-secondary)" id={sectionId}>
        {label}
      </h3>
      {children}
    </section>
  );
}

export function AiProviderSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: () => unknown;
}) {
  return (
    <button
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-(--border-strong) bg-(--bg-secondary) transition-colors duration-150 ease-out aria-checked:border-(--accent) aria-checked:bg-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span
        className="inline-block size-3.5 translate-x-0.75 rounded-full bg-(--text-secondary) transition-transform duration-150 ease-out aria-checked:translate-x-4.5 aria-checked:bg-(--bg-primary)"
        aria-checked={checked}
      />
    </button>
  );
}

export function AiSettingsActionButton({
  children,
  disabled,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => unknown;
}) {
  return (
    <button
      className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[650] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) disabled:cursor-default disabled:opacity-60 disabled:hover:bg-(--bg-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
