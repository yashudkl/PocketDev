import { isAxiosError } from 'axios';

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) {
      return message.join('\n');
    }
    if (message) {
      return message;
    }
    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Check the server and try again.';
    }
    if (!error.response) {
      return 'Could not reach PocketDev. Check your connection and API URL.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
