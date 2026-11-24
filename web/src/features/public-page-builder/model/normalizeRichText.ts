import type {
  RichTextAlignment,
  RichTextDocument,
  RichTextMarks,
  RichTextParagraph,
  RichTextSize,
} from '../types/publicPage';

const richTextSizes = new Set<RichTextSize>(['small', 'medium', 'large', 'h1', 'h2', 'h3']);
const richTextAlignments = new Set<RichTextAlignment>(['left', 'center', 'right', 'justify']);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeRichTextMarks(value: unknown): RichTextMarks | undefined {
  const marks = isRecord(value) ? value : {};
  const normalized: RichTextMarks = {};
  if (marks.bold === true) {normalized.bold = true;}
  if (marks.italic === true) {normalized.italic = true;}
  if (marks.underline === true) {normalized.underline = true;}
  if (marks.strike === true) {normalized.strike = true;}
  if (typeof marks.color === 'string' && marks.color.trim()) {normalized.color = marks.color.trim();}
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeRichTextParagraph(value: unknown): RichTextParagraph | null {
  if (!isRecord(value)) {return null;}
  const runs = Array.isArray(value.runs) ? value.runs.flatMap((run) => {
    if (!isRecord(run) || typeof run.text !== 'string') {return [];}
    const marks = normalizeRichTextMarks(run.marks);
    return [{ text: run.text, ...(marks ? { marks } : {}) }];
  }) : [];
  return {
    size: richTextSizes.has(value.size as RichTextSize) ? value.size as RichTextSize : 'medium',
    fontFamily: nullableString(value.fontFamily),
    alignment: richTextAlignments.has(value.alignment as RichTextAlignment) ? value.alignment as RichTextAlignment : 'left',
    runs: runs.length ? runs : [{ text: '' }],
  };
}

export function normalizeRichTextDocument(value: unknown): RichTextDocument {
  const document = isRecord(value) && value.type === 'rich-text-v1' ? value : {};
  const paragraphs = Array.isArray(document.paragraphs)
    ? document.paragraphs.map(normalizeRichTextParagraph).filter((item): item is RichTextParagraph => item !== null)
    : [];
  return { type: 'rich-text-v1', paragraphs: paragraphs.length ? paragraphs : [{ size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: '' }] }] };
}
