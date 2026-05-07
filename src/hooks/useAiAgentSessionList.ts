import { useCallback, useEffect, useState } from "react";
import { listStoredAiAgentSessions, type StoredAiAgentSessionSummary } from "../lib/settings/appSettings";

export function useAiAgentSessionList(workspaceKey: string | null, refreshKey: string) {
  const [sessions, setSessions] = useState<StoredAiAgentSessionSummary[]>([]);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listStoredAiAgentSessions(workspaceKey));
    } catch {
      setSessions([]);
    }
  }, [workspaceKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh().catch(() => {});
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh, refreshKey]);

  return {
    refresh,
    sessions
  };
}
