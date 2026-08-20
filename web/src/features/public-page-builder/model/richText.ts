import type { RichTextMarks, RichTextParagraph, RichTextRun } from '../types/publicPage';

export function hasRichTextContent(value: unknown): boolean {
  if (!value || typeof value !== 'object') {return false;}
  const document = value as Record<string, unknown>;
  if (document.type !== 'rich-text-v1') {return false;}
  const paragraphs = document.paragraphs;
  return Array.isArray(paragraphs) && paragraphs.some((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object') {return false;}
    const runs = (paragraph as Record<string, unknown>).runs;
    return Array.isArray(runs) && runs.some((run) => run && typeof run === 'object'
      && typeof (run as Record<string, unknown>).text === 'string'
      && Boolean(((run as Record<string, unknown>).text as string).trim()));
  });
}

function sameMarks(left?: RichTextMarks, right?: RichTextMarks): boolean {
  return left?.bold === right?.bold
    && left?.italic === right?.italic
    && left?.underline === right?.underline
    && left?.strike === right?.strike
    && left?.color === right?.color;
}

export function mergeRichTextRuns(runs: RichTextRun[]): RichTextRun[] {
  return runs.reduce<RichTextRun[]>((result, run) => {
    if (!run.text) {return result;}
    const previous = result[result.length - 1];
    if (previous && sameMarks(previous.marks, run.marks)) {
      previous.text += run.text;
      return result;
    }
    result.push({ text: run.text, ...(run.marks && Object.keys(run.marks).length ? { marks: run.marks } : {}) });
    return result;
  }, []);
}

export function updateRichTextSelection(
  paragraph: RichTextParagraph,
  start: number,
  end: number,
  updateMarks: (marks: RichTextMarks) => RichTextMarks,
): RichTextParagraph {
  if (start >= end) {return paragraph;}
  let offset = 0;
  const nextRuns = paragraph.runs.flatMap((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    if (end <= runStart || start >= runEnd) {return [run];}
    const selectedStart = Math.max(start, runStart) - runStart;
    const selectedEnd = Math.min(end, runEnd) - runStart;
    const before = run.text.slice(0, selectedStart);
    const selected = run.text.slice(selectedStart, selectedEnd);
    const after = run.text.slice(selectedEnd);
    const marks = updateMarks({ ...(run.marks ?? {}) });
    return [
      ...(before ? [{ text: before, ...(run.marks ? { marks: run.marks } : {}) }] : []),
      ...(selected ? [{ text: selected, ...(Object.keys(marks).length ? { marks } : {}) }] : []),
      ...(after ? [{ text: after, ...(run.marks ? { marks: run.marks } : {}) }] : []),
    ];
  });
  return { ...paragraph, runs: mergeRichTextRuns(nextRuns) };
}

function sliceRichTextRuns(runs: RichTextRun[], start: number, end: number): RichTextRun[] {
  let offset = 0;
  const sliced = runs.flatMap((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    const from = Math.max(start, runStart) - runStart;
    const to = Math.min(end, runEnd) - runStart;
    if (to <= from) {return [];}
    return [{ text: run.text.slice(from, to), ...(run.marks ? { marks: run.marks } : {}) }];
  });
  return mergeRichTextRuns(sliced);
}

export function splitRichTextParagraph(
  paragraph: RichTextParagraph,
  start: number,
  end: number,
): [RichTextParagraph, RichTextParagraph] {
  const totalLength = paragraph.runs.reduce((length, run) => length + run.text.length, 0);
  const safeStart = Math.max(0, Math.min(totalLength, start));
  const safeEnd = Math.max(safeStart, Math.min(totalLength, end));
  const before = sliceRichTextRuns(paragraph.runs, 0, safeStart);
  const after = sliceRichTextRuns(paragraph.runs, safeEnd, totalLength);
  return [
    { ...paragraph, runs: before.length ? before : [{ text: '' }] },
    { ...paragraph, runs: after.length ? after : [{ text: '' }] },
  ];
}
