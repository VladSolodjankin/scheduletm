import {
  FormatAlignCenter,
  FormatAlignJustify,
  FormatAlignLeft,
  FormatAlignRight,
  FormatBold,
  FormatItalic,
  FormatStrikethrough,
  FormatUnderlined,
} from '@mui/icons-material';
import { Box, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type {
  RichTextAlignment,
  RichTextDocument,
  RichTextMarks,
  RichTextParagraph,
  RichTextSize,
} from '../../features/public-page-builder/types/publicPage';
import { splitRichTextParagraph, updateRichTextSelection } from '../../features/public-page-builder/model/richText';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

type InlineMark = Exclude<keyof RichTextMarks, 'color'>;
type SavedSelection = { paragraphIndex: number; start: number; end: number };

function selectionOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function captureSelection(): SavedSelection | null {
  const selection = window.getSelection();
  if (!selection?.anchorNode || !selection.focusNode) {return null;}
  const anchorElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode as Element
    : selection.anchorNode.parentElement;
  const focusElement = selection.focusNode.nodeType === Node.ELEMENT_NODE
    ? selection.focusNode as Element
    : selection.focusNode.parentElement;
  const anchorRoot = anchorElement?.closest<HTMLElement>('[data-rich-text-paragraph]');
  const focusRoot = focusElement?.closest<HTMLElement>('[data-rich-text-paragraph]');
  if (!anchorRoot || anchorRoot !== focusRoot) {return null;}
  const paragraphIndex = Number(anchorRoot.dataset.richTextParagraph);
  const anchor = selectionOffset(anchorRoot, selection.anchorNode, selection.anchorOffset);
  const focus = selectionOffset(anchorRoot, selection.focusNode, selection.focusOffset);
  return { paragraphIndex, start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

function marksAtSelection(paragraph: RichTextParagraph, start: number, end: number, mark: InlineMark): boolean {
  if (start >= end) {return false;}
  let offset = 0;
  let touched = false;
  for (const run of paragraph.runs) {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    if (end <= runStart || start >= runEnd) {continue;}
    touched = true;
    if (run.marks?.[mark] !== true) {return false;}
  }
  return touched;
}

const paragraphFonts = ['', 'Inter', 'Roboto', 'Arial', 'Georgia'] as const;
const paragraphSizes: RichTextSize[] = ['small', 'medium', 'large', 'h3', 'h2', 'h1'];

export function RichTextEditor({ locale, value, onChange }: {
  locale: Locale;
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
}) {
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<SavedSelection | null>(null);
  const [activeParagraph, setActiveParagraph] = useState(0);
  const [pendingCaretParagraph, setPendingCaretParagraph] = useState<number | null>(null);
  const paragraph = value.paragraphs[activeParagraph] ?? value.paragraphs[0];
  useLayoutEffect(() => {
    if (pendingCaretParagraph === null) {return;}
    const paragraphRoot = editorRootRef.current?.querySelector<HTMLElement>(
      `[data-rich-text-paragraph="${pendingCaretParagraph}"]`,
    );
    if (!paragraphRoot) {return;}
    paragraphRoot.focus();
    const range = document.createRange();
    range.selectNodeContents(paragraphRoot);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    selectionRef.current = { paragraphIndex: pendingCaretParagraph, start: 0, end: 0 };
    setPendingCaretParagraph(null);
  }, [pendingCaretParagraph, value.paragraphs]);
  const rememberSelection = () => {
    const saved = captureSelection();
    if (saved) {selectionRef.current = saved; setActiveParagraph(saved.paragraphIndex);}
  };
  const updateParagraph = (index: number, next: RichTextParagraph) => onChange({
    ...value,
    paragraphs: value.paragraphs.map((candidate, candidateIndex) => candidateIndex === index ? next : candidate),
  });
  const preserveSelection = (event: MouseEvent) => { event.preventDefault(); rememberSelection(); };
  const applyMark = (mark: InlineMark) => {
    const selection = selectionRef.current ?? captureSelection();
    if (!selection) {return;}
    const selectedParagraph = value.paragraphs[selection.paragraphIndex];
    const enabled = marksAtSelection(selectedParagraph, selection.start, selection.end, mark);
    updateParagraph(selection.paragraphIndex, updateRichTextSelection(selectedParagraph, selection.start, selection.end, (marks) => {
      if (enabled) {delete marks[mark];} else {marks[mark] = true;}
      return marks;
    }));
  };
  const applyColor = (color: string) => {
    const selection = selectionRef.current ?? captureSelection();
    if (!selection) {return;}
    updateParagraph(selection.paragraphIndex, updateRichTextSelection(value.paragraphs[selection.paragraphIndex], selection.start, selection.end, (marks) => ({ ...marks, color })));
  };
  const updateParagraphText = (index: number, event: FormEvent<HTMLElement>) => {
    const parseNode = (node: Node, inheritedMarks: RichTextMarks = {}): Array<{ text: string; marks?: RichTextMarks }> => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        return text ? [{ text, ...(Object.keys(inheritedMarks).length ? { marks: inheritedMarks } : {}) }] : [];
      }
      if (!(node instanceof HTMLElement)) {return [];}
      const marks: RichTextMarks = {
        ...inheritedMarks,
        ...(node.dataset.bold === 'true' ? { bold: true as const } : {}),
        ...(node.dataset.italic === 'true' ? { italic: true as const } : {}),
        ...(node.dataset.underline === 'true' ? { underline: true as const } : {}),
        ...(node.dataset.strike === 'true' ? { strike: true as const } : {}),
        ...(node.dataset.color ? { color: node.dataset.color } : {}),
      };
      return Array.from(node.childNodes).flatMap((child) => parseNode(child, marks));
    };
    const runs = Array.from(event.currentTarget.childNodes).flatMap((node) => parseNode(node));
    updateParagraph(index, { ...value.paragraphs[index], runs: runs.length ? runs : [{ text: '' }] });
  };
  const splitParagraph = (index: number, event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter') {return;}
    const selection = captureSelection();
    if (!selection || selection.paragraphIndex !== index) {return;}
    event.preventDefault();
    const [current, next] = splitRichTextParagraph(value.paragraphs[index], selection.start, selection.end);
    onChange({ ...value, paragraphs: [...value.paragraphs.slice(0, index), current, next, ...value.paragraphs.slice(index + 1)] });
    setActiveParagraph(index + 1);
    selectionRef.current = { paragraphIndex: index + 1, start: 0, end: 0 };
    setPendingCaretParagraph(index + 1);
  };
  const paragraphControl = (change: Partial<Pick<RichTextParagraph, 'size' | 'fontFamily' | 'alignment'>>) => {
    if (!paragraph) {return;}
    updateParagraph(activeParagraph, { ...paragraph, ...change });
  };
  const alignmentButtons: Array<{ value: RichTextAlignment; icon: typeof FormatAlignLeft; label: Parameters<typeof publicPageText>[1] }> = [
    { value: 'left', icon: FormatAlignLeft, label: 'alignLeft' },
    { value: 'center', icon: FormatAlignCenter, label: 'alignCenter' },
    { value: 'right', icon: FormatAlignRight, label: 'alignRight' },
    { value: 'justify', icon: FormatAlignJustify, label: 'alignJustify' },
  ];
  const markButtons: Array<{ mark: InlineMark; icon: typeof FormatBold; label: Parameters<typeof publicPageText>[1] }> = [
    { mark: 'bold', icon: FormatBold, label: 'bold' },
    { mark: 'italic', icon: FormatItalic, label: 'italic' },
    { mark: 'strike', icon: FormatStrikethrough, label: 'strike' },
    { mark: 'underline', icon: FormatUnderlined, label: 'underline' },
  ];

  return <Stack spacing={1}>
    <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <TextField select size="small" aria-label={publicPageText(locale, 'fontSize')} value={paragraph?.size ?? 'medium'}
        onChange={(event) => paragraphControl({ size: event.target.value as RichTextSize })} sx={{ minWidth: 130 }}>
        {paragraphSizes.map((size) => <MenuItem key={size} value={size}>{publicPageText(locale, `textSize${size[0].toUpperCase()}${size.slice(1)}` as Parameters<typeof publicPageText>[1])}</MenuItem>)}
      </TextField>
      <TextField select size="small" aria-label={publicPageText(locale, 'fontFamily')} value={paragraph?.fontFamily ?? ''}
        onChange={(event) => paragraphControl({ fontFamily: event.target.value || null })} sx={{ minWidth: 112 }}>
        {paragraphFonts.map((font) => <MenuItem key={font || 'theme'} value={font}>{font || publicPageText(locale, 'inherit')}</MenuItem>)}
      </TextField>
      {alignmentButtons.map(({ value: alignment, icon: Icon, label }) => <Tooltip key={alignment} title={publicPageText(locale, label)}>
        <IconButton aria-label={publicPageText(locale, label)} color={paragraph?.alignment === alignment ? 'primary' : 'default'}
          onMouseDown={preserveSelection} onClick={() => paragraphControl({ alignment })}><Icon /></IconButton>
      </Tooltip>)}
      {markButtons.map(({ mark, icon: Icon, label }) => <Tooltip key={mark} title={publicPageText(locale, label)}>
        <IconButton aria-label={publicPageText(locale, label)} onMouseDown={preserveSelection} onClick={() => applyMark(mark)}><Icon /></IconButton>
      </Tooltip>)}
      <Tooltip title={publicPageText(locale, 'textColor')}>
        <Box component="label" aria-label={publicPageText(locale, 'textColor')} sx={{ width: 38, height: 38, p: 0.75, cursor: 'pointer' }} onMouseDown={rememberSelection}>
          <Box component="input" type="color" defaultValue="#291d0a" onChange={(event) => applyColor(event.target.value)} sx={{ width: '100%', height: '100%', border: 0, p: 0 }} />
        </Box>
      </Tooltip>
    </Stack>
    <Box ref={editorRootRef} sx={{ minHeight: 260, p: 2, borderRadius: 1, bgcolor: 'var(--page-background)', color: 'var(--page-text)', border: 1, borderColor: 'divider' }}>
      {value.paragraphs.map((item, index) => <Box key={index} data-rich-text-paragraph={index} contentEditable suppressContentEditableWarning
        role="textbox" aria-multiline="true" aria-label={`${publicPageText(locale, 'fieldBody')} ${index + 1}`}
        onFocus={() => setActiveParagraph(index)} onMouseUp={rememberSelection} onKeyUp={rememberSelection}
        onInput={(event) => updateParagraphText(index, event)} onKeyDown={(event) => splitParagraph(index, event)}
        sx={{ minHeight: '1.45em', outline: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textAlign: item.alignment,
          fontFamily: item.fontFamily ?? richTextSizeVariables[item.size].fontFamily,
          fontSize: richTextSizeVariables[item.size].fontSize, fontWeight: richTextSizeVariables[item.size].fontWeight,
          lineHeight: richTextSizeVariables[item.size].lineHeight, letterSpacing: richTextSizeVariables[item.size].letterSpacing,
          '&:empty::before': { content: `"${publicPageText(locale, 'enterText')}"`, color: 'text.disabled' } }}>
        {item.runs.map((run, runIndex) => <Box key={runIndex} component="span"
          data-bold={run.marks?.bold || undefined} data-italic={run.marks?.italic || undefined}
          data-underline={run.marks?.underline || undefined} data-strike={run.marks?.strike || undefined}
          data-color={run.marks?.color || undefined} sx={{ fontWeight: run.marks?.bold ? 'var(--theme-font-weight-bold)' : 'inherit',
          fontStyle: run.marks?.italic ? 'italic' : 'inherit', textDecoration: [run.marks?.underline ? 'underline' : '', run.marks?.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
          color: run.marks?.color ?? 'inherit' }}>{run.text}</Box>)}
      </Box>)}
    </Box>
  </Stack>;
}

const richTextSizeVariables: Record<RichTextSize, { fontFamily: string; fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string }> = {
  small: { fontFamily: 'var(--theme-text-sm-font-family)', fontSize: 'var(--theme-text-sm-fontsize)', fontWeight: 'var(--theme-text-sm-font-weight)', lineHeight: 'var(--theme-text-sm-lineheight)', letterSpacing: 'var(--theme-text-sm-letterspacing)' },
  medium: { fontFamily: 'var(--theme-text-md-font-family)', fontSize: 'var(--theme-text-md-fontsize)', fontWeight: 'var(--theme-text-md-font-weight)', lineHeight: 'var(--theme-text-md-lineheight)', letterSpacing: 'var(--theme-text-md-letterspacing)' },
  large: { fontFamily: 'var(--theme-text-lg-font-family)', fontSize: 'var(--theme-text-lg-fontsize)', fontWeight: 'var(--theme-text-lg-font-weight)', lineHeight: 'var(--theme-text-lg-lineheight)', letterSpacing: 'var(--theme-text-lg-letterspacing)' },
  h1: { fontFamily: 'var(--theme-h1-font-family)', fontSize: 'var(--theme-h1-fontsize)', fontWeight: 'var(--theme-h1-font-weight)', lineHeight: 'var(--theme-h1-lineheight)', letterSpacing: 'var(--theme-h1-letterspacing)' },
  h2: { fontFamily: 'var(--theme-h2-font-family)', fontSize: 'var(--theme-h2-fontsize)', fontWeight: 'var(--theme-h2-font-weight)', lineHeight: 'var(--theme-h2-lineheight)', letterSpacing: 'var(--theme-h2-letterspacing)' },
  h3: { fontFamily: 'var(--theme-h3-font-family)', fontSize: 'var(--theme-h3-fontsize)', fontWeight: 'var(--theme-h3-font-weight)', lineHeight: 'var(--theme-h3-lineheight)', letterSpacing: 'var(--theme-h3-letterspacing)' },
};
