import { localApi } from "@/lib/local-api";

export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("API_BASE_URL") ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      ""
    );
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "";
};

export const setBaseUrl = (url: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("API_BASE_URL", url);
  }
};

export async function fetchClient(path: string, options: RequestInit = {}) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return localApi(path, options);
  }

  const url = `${baseUrl}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
