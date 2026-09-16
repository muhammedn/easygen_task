import axios from 'axios';

type ApiErrorBody = {
  message?: string | string[];
};

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'Something went wrong';
  }

  if (!error.response) {
    return 'Cannot reach the server';
  }

  if (error.response.status === 429) {
    return 'Too many attempts, please try again in a minute';
  }

  const data = error.response.data as ApiErrorBody | undefined;
  const message = data?.message;

  if (Array.isArray(message)) {
    return message.filter(Boolean).join('. ') || 'Something went wrong';
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  return 'Something went wrong';
}
