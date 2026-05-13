import privacyPolicyMarkdown from '../../../docs/compliance/privacy-policy.md?raw';
import securityPolicyMarkdown from '../../../docs/compliance/security-policy.md?raw';

export type LegalDocumentSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalDocumentSection[];
};

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function parseSectionBody(body: string): Pick<LegalDocumentSection, 'paragraphs' | 'bullets'> {
  const paragraphs: string[] = [];
  const bullets: string[] = [];

  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => line.startsWith('- '))) {
      bullets.push(...lines.map((line) => cleanInlineMarkdown(line.slice(2))));
      continue;
    }

    paragraphs.push(cleanInlineMarkdown(lines.join(' ')));
  }

  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : undefined,
    bullets: bullets.length > 0 ? bullets : undefined
  };
}

function parseLegalDocument(markdown: string): LegalDocument {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const sections = normalized.split(/\n(?=## )/);
  const headerLines = sections.shift()?.split('\n') ?? [];

  const title = headerLines[0]?.replace(/^# /, '').trim() ?? 'Legal Document';
  const effectiveDate = headerLines[2]?.replace(/^Effective date:\s*/, '').trim() ?? '';

  const intro = headerLines
    .slice(4)
    .join('\n')
    .split(/\n\s*\n/)
    .map((paragraph) => cleanInlineMarkdown(paragraph))
    .filter(Boolean);

  const parsedSections: LegalDocumentSection[] = sections.map((sectionBlock) => {
    const lines = sectionBlock.split('\n');
    const sectionTitle = lines[0].replace(/^## /, '').trim();
    const sectionBody = lines.slice(1).join('\n').trim();

    return {
      title: sectionTitle,
      ...parseSectionBody(sectionBody)
    };
  });

  return {
    title,
    effectiveDate,
    intro,
    sections: parsedSections
  };
}

export const privacyPolicyDocument = parseLegalDocument(privacyPolicyMarkdown);
export const securityPolicyDocument = parseLegalDocument(securityPolicyMarkdown);
