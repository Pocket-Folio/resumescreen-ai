/**
 * Typed client for the ResumeScreen AI server. UI components call these functions and never
 * talk to Claude directly — the server holds the API key and performs all Claude requests.
 */
import type {
  ApiKeyStatus,
  AppErrorBody,
  AppErrorCode,
  AppSettings,
  AuditEvent,
  Candidate,
  CandidateListItem,
  JobProfile,
  JobProfileInput,
  HRReview,
  ScreeningRecord,
  ScreeningStage,
  ScreeningStreamEvent,
  SystemInfo,
} from "../../shared/types";

/** Claude's suggested qualifications and criteria for a job description (see server/services/claude/draftJobProfile.ts). */
export interface JobDraft {
  department: string | null;
  location: string | null;
  employmentType: JobProfile["employmentType"] | null;
  required: JobProfile["required"];
  preferred: JobProfile["preferred"];
  criteria: { criterion: string; requirement: string; importance: JobProfile["criteria"][number]["importance"]; category: JobProfile["criteria"][number]["category"] }[];
  notes: string[];
}

export class ApiError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;
export const setUnauthorizedHandler = (fn: UnauthorizedListener | null) => {
  onUnauthorized = fn;
};

function networkError(): ApiError {
  return new ApiError(
    "NETWORK",
    "The ResumeScreen AI server could not be reached. Check your network connection and try again.",
    0,
  );
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { error?: AppErrorBody } | null = null;
  try {
    body = (await res.json()) as { error?: AppErrorBody };
  } catch {
    /* non-JSON error */
  }
  const e = body?.error;
  if (res.status === 401) onUnauthorized?.();
  return new ApiError(e?.code ?? "INTERNAL", e?.message ?? `The server returned an error (HTTP ${res.status}).`, res.status, e?.detail);
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError("CANCELLED", "Cancelled.", 0);
    throw networkError();
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

const get = <T>(url: string) => request<T>("GET", url);
const post = <T>(url: string, body?: unknown, init?: RequestInit) => request<T>("POST", url, body ?? {}, init);
const put = <T>(url: string, body: unknown) => request<T>("PUT", url, body);
const del = <T>(url: string) => request<T>("DELETE", url);

export interface SettingsResponse {
  settings: AppSettings;
  apiKey: ApiKeyStatus;
}

export const api = {
  auth: {
    status: () => get<{ authEnabled: boolean; authenticated: boolean }>("/api/auth/status"),
    login: (password: string) => post<{ ok: true }>("/api/auth/login", { password }),
    logout: () => post<{ ok: true }>("/api/auth/logout"),
  },
  jobProfiles: {
    list: () => get<JobProfile[]>("/api/job-profiles"),
    get: (id: string) => get<JobProfile>(`/api/job-profiles/${id}`),
    create: (p: JobProfileInput) => post<JobProfile>("/api/job-profiles", p),
    update: (id: string, p: JobProfileInput) => put<JobProfile>(`/api/job-profiles/${id}`, p),
    duplicate: (id: string) => post<JobProfile>(`/api/job-profiles/${id}/duplicate`),
    remove: (id: string) => del<{ ok: true }>(`/api/job-profiles/${id}`),
    extractDescription: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return post<{ text: string; method: "text" | "ocr"; warnings: string[] }>("/api/job-profiles/extract-description", fd);
    },
    draft: (title: string, description: string) => post<JobDraft>("/api/job-profiles/draft", { title, description }),
  },
  candidates: {
    list: () => get<CandidateListItem[]>("/api/candidates"),
    get: (id: string) => get<{ candidate: Candidate; screenings: ScreeningRecord[] }>(`/api/candidates/${id}`),
    upload: (file: File, jobProfileId: string | null, signal?: AbortSignal) => {
      const fd = new FormData();
      fd.append("file", file);
      if (jobProfileId) fd.append("jobProfileId", jobProfileId);
      return post<Candidate>("/api/candidates/upload", fd, { signal });
    },
    reextract: (id: string, file: File, method: "local" | "claude" = "local") => {
      const fd = new FormData();
      fd.append("method", method);
      fd.append("file", file);
      return post<Candidate>(`/api/candidates/${id}/reextract`, fd);
    },
    createFromText: (input: { name: string; jobProfileId: string | null; resumeText: string }) =>
      post<Candidate>("/api/candidates", input),
    update: (
      id: string,
      patch: Partial<Pick<Candidate, "name" | "email" | "phone" | "location" | "links" | "jobProfileId" | "resumeText">>,
    ) => put<Candidate>(`/api/candidates/${id}`, patch),
    saveReview: (id: string, review: Omit<HRReview, "updatedAt">) => put<Candidate>(`/api/candidates/${id}/review`, review),
    remove: (id: string) => del<{ ok: true }>(`/api/candidates/${id}`),
  },
  screenings: {
    list: (candidateId?: string) =>
      get<ScreeningRecord[]>(candidateId ? `/api/screenings?candidateId=${encodeURIComponent(candidateId)}` : "/api/screenings"),
    get: (id: string) => get<ScreeningRecord>(`/api/screenings/${id}`),
    prompt: () => get<{ version: string; systemPrompt: string }>("/api/screenings/prompt"),
  },
  settings: {
    get: () => get<SettingsResponse>("/api/settings"),
    save: (s: Omit<AppSettings, "privacyNoticeAcknowledgedAt">) => put<SettingsResponse>("/api/settings", s),
    saveApiKey: (apiKey: string) => put<{ apiKey: ApiKeyStatus }>("/api/settings/api-key", { apiKey }),
    removeApiKey: () => del<{ apiKey: ApiKeyStatus }>("/api/settings/api-key"),
    saveWorkspaceId: (workspaceId: string) => put<{ apiKey: ApiKeyStatus }>("/api/settings/workspace", { workspaceId }),
    testConnection: (model: string) =>
      post<{ ok: true; model: string; displayName: string }>("/api/settings/test-connection", { model }),
    acknowledgePrivacy: () => post<SettingsResponse>("/api/settings/privacy-acknowledge"),
  },
  system: {
    info: () => get<SystemInfo>("/api/system"),
    audit: (limit = 500) => get<AuditEvent[]>(`/api/audit?limit=${limit}`),
    loadDemo: () => post<{ jobProfiles: number; candidates: number; screenings: number }>("/api/demo"),
    deleteDemo: () => del<{ ok: true }>("/api/demo"),
    deleteAll: (resetSettings: boolean) => post<{ ok: true }>("/api/data/delete-all", { confirm: "DELETE", resetSettings }),
  },
};

/**
 * Starts a screening and reports real progress. Resolves with the stored screening record, or
 * rejects with an ApiError (including CANCELLED when `signal` aborts).
 */
export async function runScreening(
  candidateId: string,
  jobProfileId: string,
  onStage: (stage: ScreeningStage) => void,
  signal?: AbortSignal,
): Promise<{ screening: ScreeningRecord; candidate: Candidate }> {
  let res: Response;
  try {
    res = await fetch("/api/screenings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, jobProfileId }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError("CANCELLED", "Screening was cancelled. Your candidate information has not been deleted.", 0);
    throw networkError();
  }
  if (!res.ok) throw await toApiError(res);
  if (!res.body) throw new ApiError("INTERNAL", "The server returned an empty response.", res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const event = JSON.parse(line) as ScreeningStreamEvent;
        if (event.type === "stage") onStage(event.stage);
        else if (event.type === "complete") return { screening: event.screening, candidate: event.candidate };
        else if (event.type === "error") throw new ApiError(event.error.code, event.error.message, 200, event.error.detail);
      }
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError" || signal?.aborted)
      throw new ApiError("CANCELLED", "Screening was cancelled. Your candidate information has not been deleted.", 0);
    throw new ApiError("NETWORK", "The connection to the server was interrupted during screening. Your candidate information has not been deleted. Please try again.", 0);
  }
  throw new ApiError("NETWORK", "The screening ended unexpectedly. Your candidate information has not been deleted. Please try again.", 0);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Something went wrong. Please try again.";
}
