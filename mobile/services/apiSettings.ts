import AsyncStorage from '@react-native-async-storage/async-storage';

import { getApiBaseUrl, setApiBaseUrl } from '@/api/axios';

const API_URL_KEY = 'pocketdev.api-url.v1';

export async function hydrateApiUrl(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(API_URL_KEY);
  if (saved) setApiBaseUrl(saved);
  return getApiBaseUrl();
}

export async function saveApiUrl(url: string): Promise<string> {
  const normalized = url.trim().replace(/\/+$/, '');
  setApiBaseUrl(normalized);
  await AsyncStorage.setItem(API_URL_KEY, normalized);
  return normalized;
}
