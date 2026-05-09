export type DebugLogFactory = () => readonly [message: string, details?: unknown];

export function debug(factory: DebugLogFactory) {
  if (!__MARKRA_DEBUG__) return;

  const [message, details] = factory();
  if (details === undefined) {
    console.debug(message);
    return;
  }

  console.debug(message, details);
}
