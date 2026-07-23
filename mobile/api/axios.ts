import { create } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const MISSING_API_URL_MESSAGE =
  'Missing EXPO_PUBLIC_API_URL. Add it to your .env before using the API client.';

export const apiClient = create({
  baseURL: BASE_URL || undefined,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (!BASE_URL) {
    throw new Error(MISSING_API_URL_MESSAGE);
  }

  return config;
});
