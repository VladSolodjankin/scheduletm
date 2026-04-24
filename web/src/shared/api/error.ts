import { isAxiosError } from 'axios';

type ApiErrorResponse = {
  message?: string;
  errors?: Record<string, string | string[] | undefined>;
};

type ResolveApiErrorOptions = {
  fallbackMessage: string;
  networkMessage?: string;
};

type ResolvedApiError = {
  message: string;
  fieldErrors: Record<string, string>;
};

function normalizeFieldErrors(errors?: ApiErrorResponse['errors']): Record<string, string> {
  if (!errors) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(errors)
      .map(([field, value]) => [field, Array.isArray(value) ? value[0] : value] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

export function resolveApiError(error: unknown, options: ResolveApiErrorOptions): ResolvedApiError {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const backendMessage = error.response?.data?.message?.trim();
    const fieldErrors = normalizeFieldErrors(error.response?.data?.errors);

    if (backendMessage) {
      return {
        message: backendMessage,
        fieldErrors
      };
    }

    if (!error.response) {
      return {
        message: options.networkMessage ?? options.fallbackMessage,
        fieldErrors
      };
    }

    return {
      message: options.fallbackMessage,
      fieldErrors
    };
  }

  return {
    message: options.fallbackMessage,
    fieldErrors: {}
  };
}
