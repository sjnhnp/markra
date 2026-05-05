import { useCallback, useEffect, useState } from "react";

export function useAiCommandUi() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const openAiCommand = useCallback(() => {
    setOpen(true);
  }, []);

  const closeAiCommand = useCallback(() => {
    setOpen(false);
  }, []);

  const updatePrompt = useCallback((nextPrompt: string) => {
    setPrompt(nextPrompt);
  }, []);

  const submitPrompt = useCallback(() => {
    if (!prompt.trim()) return;
    // Real AI execution will attach here; for now this is a UI-only command surface.
  }, [prompt]);

  useEffect(() => {
    const handleAiShortcut = (event: KeyboardEvent) => {
      const isModKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isModKey && !event.altKey && !event.shiftKey && key === "j") {
        event.preventDefault();
        openAiCommand();
        return;
      }

    };

    window.addEventListener("keydown", handleAiShortcut);
    return () => {
      window.removeEventListener("keydown", handleAiShortcut);
    };
  }, [openAiCommand]);

  return {
    closeAiCommand,
    open,
    prompt,
    submitPrompt,
    updatePrompt
  };
}
