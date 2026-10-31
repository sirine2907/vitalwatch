"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server rendering and the first paint, then true. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Shows a time in the viewer's own timezone. The server doesn't know that
 * timezone, so it renders the UTC date until the browser takes over.
 */
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  return (
    <time dateTime={iso}>
      {hydrated ? new Date(iso).toLocaleString() : iso.slice(0, 10)}
    </time>
  );
}
