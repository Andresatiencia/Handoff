"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "./firebase-client";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (firebaseConfigured()) {
    const auth = firebaseAuth();
    await auth.authStateReady();
    if (auth.currentUser) headers.set("Authorization", `Bearer ${await auth.currentUser.getIdToken()}`);
  }
  const response = await fetch(`/api/${path}`, { ...options, cache: "no-store", headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed. Please try again.");
  return data as T;
}

export function useRemote<T>(path: string | null, interval = 0) {
  const [state, setState] = useState<{ path: string; data?: T; error: string }>({ path: "", error: "" });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const data = await api<T>(path!, { signal: controller.signal });
        if (active) setState({ path: path!, data, error: "" });
      } catch (error) {
        if (active) setState(previous => ({ path: path!, data: previous.path === path ? previous.data : undefined, error: error instanceof Error ? error.message : "Connection failed." }));
      } finally { pending = false; }
    }
    void load();
    const timer = interval ? setInterval(load, interval) : undefined;
    window.addEventListener("focus", load);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [path, interval, version]);
  const current = state.path === path ? state : { data: undefined, error: "" };
  return { ...current, loading: Boolean(path && !current.data && !current.error), refresh };
}
