import { describe, expect, it } from 'vitest';
import { blockIssueText } from '../../src/components/public-page-builder/blockIssueText';

describe('blockIssueText', () => {
  it('names the fields a block still needs, once each', () => {
    expect(blockIssueText('en', ['heading is required', 'imageMediaId is required', 'items.0.title is required', 'items.1.title is required']))
      .toBe('Fill in: Headline, Photo, Title.');
    expect(blockIssueText('ru', ['url is not a YouTube or Vimeo video'])).toBe('Заполните: URL.');
  });

  it('falls back to the general message for issues without a field of their own', () => {
    expect(blockIssueText('en', ['serviceIds has an unknown service'])).toBe('Check the content of the selected block.');
  });
});
