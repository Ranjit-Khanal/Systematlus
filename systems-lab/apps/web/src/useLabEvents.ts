import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { LabEvent } from "./types";

export function useLabEvents() {
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    api
      .recent()
      .then((r) => {
        if (!alive) return;
        for (const e of r.events) seen.current.add(e.id);
        setEvents(r.events);
      })
      .catch(() => undefined);

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const urls = [`${proto}://${location.host}/api/ws`, `${proto}://127.0.0.1:8080/api/ws`];
    let ws: WebSocket | null = null;
    let idx = 0;
    let closed = false;
    let retryTimer: number | undefined;

    const attach = (url: string) => {
      ws = new WebSocket(url);
      ws.onopen = () => {
        if (alive) setConnected(true);
      };
      ws.onmessage = (msg) => {
        try {
          const e = JSON.parse(String(msg.data)) as LabEvent;
          if (seen.current.has(e.id)) return;
          seen.current.add(e.id);
          setEvents((prev) => [...prev, e].slice(-500));
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (!alive || closed) return;
        setConnected(false);
        idx = (idx + 1) % urls.length;
        retryTimer = window.setTimeout(() => attach(urls[idx]), 1200);
      };
    };
    attach(urls[0]);

    return () => {
      alive = false;
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const clear = async () => {
    await api.clear();
    seen.current.clear();
    setEvents([]);
  };

  return { events, connected, clear };
}
