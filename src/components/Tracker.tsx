"use client";

import { useEffect } from "react";

/** Avisa o servidor que a página foi aberta e, a cada minuto, que segue aberta. */
export default function Tracker({ path }: { path: string }) {
  useEffect(() => {
    const send = (view: boolean) =>
      fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, view }),
        keepalive: true,
      }).catch(() => {});
    send(true);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") send(false);
    }, 60_000);
    return () => clearInterval(id);
  }, [path]);
  return null;
}
