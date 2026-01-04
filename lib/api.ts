import { localApi } from "@/lib/local-api";

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, "");

const getStoredBaseUrl = () => {
  if (typeof window === "undefined") return "";
  const raw = localStorage.getItem("API_BASE_URL") || "";
  return normalizeBaseUrl(raw);
};

const getEnvBaseUrl = () => normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "");

const isSameOrigin = (url: string) => {
  if (typeof window === "undefined" || !url) return false;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

export const getBaseUrl = () => {
  const stored = getStoredBaseUrl();
  if (stored) return stored;
  const envBaseUrl = getEnvBaseUrl();
  return isSameOrigin(envBaseUrl) ? "" : envBaseUrl;
};

export const setBaseUrl = (url: string) => {
  if (typeof window !== "undefined") {
    const normalized = normalizeBaseUrl(url);
    if (normalized) {
      localStorage.setItem("API_BASE_URL", normalized);
    } else {
      localStorage.removeItem("API_BASE_URL");
    }
  }
};

export async function fetchClient(path: string, options: RequestInit = {}) {
  const storedBaseUrl = getStoredBaseUrl();
  const envBaseUrl = getEnvBaseUrl();
  const baseUrl = storedBaseUrl || envBaseUrl;

  if (!baseUrl || isSameOrigin(baseUrl)) {
    return localApi(path, options);
  }

  const url = `${baseUrl}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const fallbackToLocal = () => {
    if (storedBaseUrl && typeof window !== "undefined") {
      localStorage.removeItem("API_BASE_URL");
    }
    return localApi(path, options);
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      return fallbackToLocal();
    }

    return response.json();
  } catch {
    return fallbackToLocal();
  }
}
