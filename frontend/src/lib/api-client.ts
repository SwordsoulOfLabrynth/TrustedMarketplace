import { ProblemDetails } from "@/types/api";

export class ApiException extends Error {
  public readonly status: number;
  public readonly problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.problem = problem;
  }
}

interface RequestOptions extends RequestInit {
  _isRetry?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private sessionExpiredListeners: Array<() => void> = [];

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:5248";
  }

  public setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (typeof window !== "undefined") {
      if (token) {
        sessionStorage.setItem("tm_access_token", token);
      } else {
        sessionStorage.removeItem("tm_access_token");
      }
    }
  }

  public getAccessToken(): string | null {
    if (!this.accessToken && typeof window !== "undefined") {
      this.accessToken = sessionStorage.getItem("tm_access_token");
    }
    return this.accessToken;
  }

  public clearAccessToken(): void {
    this.accessToken = null;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("tm_access_token");
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Subscribe to session expiration events (e.g. refresh token failure).
   * Returns an unsubscribe function.
   */
  public onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.push(listener);
    return () => {
      this.sessionExpiredListeners = this.sessionExpiredListeners.filter((l) => l !== listener);
    };
  }

  private notifySessionExpired(): void {
    for (const listener of this.sessionExpiredListeners) {
      try {
        listener();
      } catch {
        // Ignore subscriber runtime exceptions
      }
    }
  }

  /**
   * Safe concurrent refresh lock.
   * Multiple simultaneous 401s share a single refresh call, preventing multiple token rotations.
   */
  public async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include", // Transmit HttpOnly refreshToken cookie
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          this.accessToken = null;
          this.notifySessionExpired();
          return null;
        }

        const data = await response.json();
        const newToken = data.accessToken as string;
        this.accessToken = newToken;
        return newToken;
      } catch {
        this.accessToken = null;
        this.notifySessionExpired();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = path.startsWith("http")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    const headers = new Headers(options.headers || {});

    // Automatically attach Bearer token if available and not already set
    const currentToken = this.getAccessToken();
    if (currentToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${currentToken}`);
    }

    // Set JSON Content-Type if body is stringified JSON and Content-Type is unset
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    // Ensure HttpOnly cookies (e.g. refreshToken) are sent with cross-origin requests
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: options.credentials || "include",
    };

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network request failed";
      throw new ApiException(0, `Network error: ${message}`);
    }

    // Safe 401 interceptor with concurrent refresh locking
    if (response.status === 401 && !options._isRetry) {
      const isAuthEndpoint =
        path.includes("/api/v1/auth/login") ||
        path.includes("/api/v1/auth/refresh") ||
        path.includes("/api/v1/auth/register");

      if (!isAuthEndpoint) {
        const refreshedToken = await this.refreshAccessToken();
        if (refreshedToken) {
          // Retry original request exactly once with new token
          return this.request<T>(path, {
            ...options,
            _isRetry: true,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${refreshedToken}`,
            },
          });
        }
      }
    }

    // Parse response body
    if (response.status === 204) {
      return null as T;
    }

    let responseBody: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }
    } else {
      try {
        responseBody = await response.text();
      } catch {
        responseBody = null;
      }
    }

    if (!response.ok) {
      let problem: ProblemDetails | undefined;
      let message = `API request failed with status ${response.status}`;

      if (responseBody && typeof responseBody === "object") {
        problem = responseBody as ProblemDetails;
        message = problem.detail || problem.title || message;
      }

      throw new ApiException(response.status, message, problem);
    }

    return responseBody as T;
  }

  public get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  public post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
