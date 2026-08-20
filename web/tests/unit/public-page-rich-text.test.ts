import { describe, expect, it } from 'vitest';
import { hasRichTextContent, splitRichTextParagraph, updateRichTextSelection } from '../../src/features/public-page-builder/model/richText';
import { normalizeDocument, normalizeRichTextDocument } from '../../src/features/public-page-builder/model/normalizeDocument';

describe('public page rich text', () => {
  it('normalizes legacy text content into a structured document', () => {
    const page = normalizeDocument({ sections: [{ blocks: [{ type: 'text', content: { title: 'Title', body: 'First\nSecond' } }] }] });
    const content = page.sections[0].blocks[0].content;
    expect(content).toEqual({ document: {
      type: 'rich-text-v1',
      paragraphs: [
        { size: 'large', fontFamily: null, alignment: 'left', runs: [{ text: 'Title', marks: { bold: true } }] },
        { size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: 'First' }] },
        { size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: 'Second' }] },
      ],
    } });
  });

  it('keeps only supported rich text fields', () => {
    expect(normalizeRichTextDocument({ type: 'rich-text-v1', paragraphs: [{
      size: 'huge', alignment: 'evil', fontFamily: 12,
      runs: [{ text: 'Safe', marks: { bold: true, script: true, color: '#123456' } }],
    }] })).toEqual({ type: 'rich-text-v1', paragraphs: [{
      size: 'medium', alignment: 'left', fontFamily: null,
      runs: [{ text: 'Safe', marks: { bold: true, color: '#123456' } }],
    }] });
  });

  it('requires visible non-whitespace rich text content', () => {
    expect(hasRichTextContent({ type: 'rich-text-v1', paragraphs: [{ runs: [{ text: '  ' }, { text: '\n' }] }] })).toBe(false);
    expect(hasRichTextContent({ paragraphs: [{ runs: [{ text: 'Visible' }] }] })).toBe(false);
    expect(hasRichTextContent({ type: 'rich-text-v1', paragraphs: [{ runs: [{ text: 'Visible' }] }] })).toBe(true);
  });

  it('applies inline formatting only to the current selection and merges compatible runs', () => {
    const paragraph = { size: 'medium', fontFamily: null, alignment: 'left', runs: [{ text: 'abcdef' }] } as const;
    const formatted = updateRichTextSelection(paragraph, 2, 4, (marks) => ({ ...marks, bold: true }));
    expect(formatted.runs).toEqual([
      { text: 'ab' },
      { text: 'cd', marks: { bold: true } },
      { text: 'ef' },
    ]);
  });

  it('preserves marks on both sides of an Enter split', () => {
    const paragraph = { size: 'medium', fontFamily: null, alignment: 'left', runs: [
      { text: 'bold', marks: { bold: true as const } },
      { text: 'plain' },
      { text: 'blue', marks: { color: '#123456' } },
    ] } as const;
    const [before, after] = splitRichTextParagraph(paragraph, 2, 6);
    expect(before.runs).toEqual([{ text: 'bo', marks: { bold: true } }]);
    expect(after.runs).toEqual([
      { text: 'ain' },
      { text: 'blue', marks: { color: '#123456' } },
    ]);
  });
});
