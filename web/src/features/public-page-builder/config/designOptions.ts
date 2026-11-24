/** Fonts offered in the design panels. Serif entries use system stacks, so nothing extra is downloaded. */
export const PUBLIC_PAGE_FONT_OPTIONS = [
  ['Inter', 'Inter, system-ui, sans-serif'], ['Roboto', 'Roboto, sans-serif'], ['Open Sans', '"Open Sans", sans-serif'],
  ['Montserrat', 'Montserrat, sans-serif'], ['Lato', 'Lato, sans-serif'],
  ['Georgia', 'Georgia, "Times New Roman", serif'], ['Palatino', '"Palatino Linotype", Palatino, "Book Antiqua", serif'],
] as const;

/** Golden-ratio spacing scale in px (base 16, step x1.618), shared by block gap and section padding controls. */
export const PUBLIC_PAGE_SPACING_SCALE = [0, 10, 16, 26, 42, 68] as const;
export const PUBLIC_PAGE_BLOCK_GAPS = [10, 16, 26] as const;
