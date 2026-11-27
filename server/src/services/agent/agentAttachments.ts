import sharp from 'sharp';

/**
 * Files attached to an assistant message. They are only checked, shrunk and sent once to the model
 * for a text transcription; the files themselves are never stored.
 */

export const AGENT_ATTACHMENT_MAX_COUNT = 3;
export const AGENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AGENT_PDF_MAX_BYTES = 10 * 1024 * 1024;
/** Longest side sent to the model; larger photos only cost more tokens. */
const IMAGE_MAX_SIDE = 1568;
const IMAGE_QUALITY = 80;

export type AgentAttachmentInput = { name: string; mimeType: string; data: string };
export type AgentAttachmentKind = 'image' | 'pdf';
export type PreparedAgentAttachment = {
  name: string;
  kind: AgentAttachmentKind;
  mediaType: 'image/jpeg' | 'application/pdf';
  /** Base64 of the compressed image or the original PDF. */
  data: string;
};

export class AgentAttachmentError extends Error {
  constructor(public code: 'attachment_too_large' | 'unsupported_attachment' | 'invalid_attachment') { super(code); }
}

const IMAGE_FORMAT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const PDF_SIGNATURE = Buffer.from('%PDF-');

/** Names go into the prompt and the stored note header, so they are kept on one line. */
export const cleanAttachmentName = (name: string) => name.replace(/\s+/g, ' ').trim() || 'file';

function decodeBase64(data: string): Buffer {
  const compact = data.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0 || !BASE64_PATTERN.test(compact)) throw new AgentAttachmentError('invalid_attachment');
  return Buffer.from(compact, 'base64');
}

async function compressImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 144_000_000 }).metadata();
    if (metadata.format !== IMAGE_FORMAT_BY_MIME[mimeType] || !metadata.width || !metadata.height) throw new Error('mismatch');
    return await sharp(buffer, { failOn: 'error', limitInputPixels: 144_000_000 })
      .rotate()
      .resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: IMAGE_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new AgentAttachmentError('unsupported_attachment');
  }
}

/** Validates every attachment and shrinks images. Runs before the response stream is opened. */
export async function prepareAgentAttachments(attachments: AgentAttachmentInput[]): Promise<PreparedAgentAttachment[]> {
  const prepared: PreparedAgentAttachment[] = [];
  for (const attachment of attachments) {
    const isImage = Object.hasOwn(IMAGE_FORMAT_BY_MIME, attachment.mimeType);
    if (!isImage && attachment.mimeType !== 'application/pdf') throw new AgentAttachmentError('unsupported_attachment');
    const buffer = decodeBase64(attachment.data);
    if (buffer.length > (isImage ? AGENT_IMAGE_MAX_BYTES : AGENT_PDF_MAX_BYTES)) throw new AgentAttachmentError('attachment_too_large');
    const name = cleanAttachmentName(attachment.name);
    if (isImage) {
      const image = await compressImage(buffer, attachment.mimeType);
      prepared.push({ name, kind: 'image', mediaType: 'image/jpeg', data: image.toString('base64') });
      continue;
    }
    if (!buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) throw new AgentAttachmentError('unsupported_attachment');
    prepared.push({ name, kind: 'pdf', mediaType: 'application/pdf', data: buffer.toString('base64') });
  }
  return prepared;
}
