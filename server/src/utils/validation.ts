import type { ZodError } from 'zod';

export function formatZodError(error: ZodError) {
  const fieldErrors: Record<string, string[] | undefined> =
    error.flatten().fieldErrors;

  const errors = Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      messages?.[0] ?? 'Некорректное значение',
    ])
  );

  return {
    message: 'Проверьте правильность заполнения формы',
    errors,
  };
}
