"use client";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
  get fieldErrors(): Record<string, string[]> {
    return (this.details.fieldErrors as Record<string, string[]>) ?? {};
  }
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh so parallel 401s trigger only one rotation. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; retry?: boolean };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = opts;
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && retry) {
    const payload = await res
      .clone()
      .json()
      .catch(() => null);
    if (payload?.error?.code === "TOKEN_EXPIRED" && (await refreshSession())) {
      return api<T>(path, { ...opts, retry: false });
    }
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const err = payload?.error ?? {};
    throw new ApiError(res.status, err.code ?? "HTTP_ERROR", err.message ?? res.statusText, err);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** PUT with upload progress (fetch has no upload progress events). */
export function uploadWithProgress(
  url: string,
  body: Blob,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}
