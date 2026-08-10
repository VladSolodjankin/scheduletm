import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const legalDocuments = [
  {
    name: 'privacy policy',
    canonicalPath: 'docs/compliance/privacy-policy.md',
    webCopyPath: 'web/src/content/legal/privacy-policy.md',
    canonicalUrl: new URL('../../../docs/compliance/privacy-policy.md', import.meta.url),
    webCopyUrl: new URL('../../src/content/legal/privacy-policy.md', import.meta.url),
  },
  {
    name: 'security policy',
    canonicalPath: 'docs/compliance/security-policy.md',
    webCopyPath: 'web/src/content/legal/security-policy.md',
    canonicalUrl: new URL('../../../docs/compliance/security-policy.md', import.meta.url),
    webCopyUrl: new URL('../../src/content/legal/security-policy.md', import.meta.url),
  },
] as const;

function readNormalizedLineEndings(fileUrl: URL) {
  return readFileSync(fileUrl, 'utf8').replace(/\r\n/g, '\n');
}

describe('legal document copies', () => {
  for (const { name, canonicalPath, webCopyPath, canonicalUrl, webCopyUrl } of legalDocuments) {
    it(`keeps the web ${name} copy synchronized with its canonical document`, () => {
      const canonicalContent = readNormalizedLineEndings(canonicalUrl);
      const webCopyContent = readNormalizedLineEndings(webCopyUrl);

      expect(
        webCopyContent,
        `${webCopyPath} drifted from ${canonicalPath}. Copy the canonical file into the web package and rerun this test.`,
      ).toBe(canonicalContent);
    });
  }
});
