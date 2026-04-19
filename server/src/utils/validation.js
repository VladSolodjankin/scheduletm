export function formatZodError(error) {
  const fieldErrors = error.flatten().fieldErrors;

  const errors = Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      messages?.[0] ?? 'Некорректное значение'
    ])
  );

  return {
    message: 'Проверьте правильность заполнения формы',
    errors
  };
}
