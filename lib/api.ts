import { localApi } from "@/lib/local-api";

const getStoredBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("API_BASE_URL") || "";
};

const getEnvBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const getBaseUrl = () => {
  const stored = getStoredBaseUrl();
  if (stored) return stored;
  return getEnvBaseUrl();
};

export const setBaseUrl = (url: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("API_BASE_URL", url);
  }
};

export async function fetchClient(path: string, options: RequestInit = {}) {
  const storedBaseUrl = getStoredBaseUrl();
  const baseUrl = storedBaseUrl || getEnvBaseUrl();

  if (!baseUrl) {
    return localApi(path, options);
  }

  const url = `${baseUrl}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      if (storedBaseUrl && typeof window !== "undefined") {
        localStorage.removeItem("API_BASE_URL");
        return localApi(path, options);
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (storedBaseUrl && typeof window !== "undefined") {
      localStorage.removeItem("API_BASE_URL");
      return localApi(path, options);
    }
    throw error;
  }
}
