import { isAxiosError } from 'axios';
import { useCallback } from 'react';
import { useI18n } from '../i18n/I18nContext';

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

// Every container repeated `resolveApiError(err, { fallbackMessage, networkMessage:
// t('common.errors.network') })` by hand; this fills in the network message from the
// current locale so call sites only need to say what the fallback is.
export function useApiErrorResolver() {
  const { t } = useI18n();

  return useCallback(
    (error: unknown, fallbackMessage: string): ResolvedApiError =>
      resolveApiError(error, { fallbackMessage, networkMessage: t('common.errors.network') }),
    [t],
  );
}
