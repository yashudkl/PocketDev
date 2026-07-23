import { create } from 'axios';

let baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || null;
const MISSING_API_URL_MESSAGE =
  'Missing EXPO_PUBLIC_API_URL. Add it to your .env before using the API client.';
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const apiClient = create({
  baseURL: baseUrl || undefined,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (!baseUrl) {
    throw new Error(MISSING_API_URL_MESSAGE);
  }

  config.baseURL = baseUrl;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 401
    ) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export function setApiAccessToken(token: string | null): void {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function getApiBaseUrl(): string | null {
  return baseUrl;
}

export function setApiBaseUrl(url: string | null): void {
  baseUrl = url?.trim().replace(/\/+$/, '') || null;
  apiClient.defaults.baseURL = baseUrl || undefined;
}
