import { useCallback } from "react";
import { getIdToken } from "firebase/auth";
import { auth } from "../firebase";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function useAPI() {
  const request = useCallback(async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Non authentifié");

    // Récupère le Firebase ID token (renouvelé automatiquement)
    const token = await getIdToken(user);

    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.detail ?? err;
      throw new Error(
        typeof detail === "object" ? (detail.message ?? JSON.stringify(detail)) : detail
      );
    }

    return res.json() as Promise<T>;
  }, []);

  return { request };
}
