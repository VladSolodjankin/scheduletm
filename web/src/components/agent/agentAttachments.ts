import type { AgentAttachmentInput, AgentAttachmentRef } from '../../shared/api/agent';

export const MAX_ATTACHMENTS = 3;
/** The server accepts chat requests up to 16 MB; keep all files of one message below that with room for the text. */
export const MAX_TOTAL_BASE64_LENGTH = 15 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** Long side the model reads images at; larger photos only cost upload time. */
const MAX_IMAGE_SIDE = 1568;
const JPEG_QUALITY = 0.8;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;

export type PreparedAttachment = AgentAttachmentInput & AgentAttachmentRef & { id: string };

export class AttachmentError extends Error {
  constructor(public code: 'attachment_too_large' | 'unsupported_attachment') { super(code); }
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

const isPdf = (file: File) => file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name));
/** Some browsers leave the type empty for HEIC and similar photos, so the extension decides. */
const looksLikeImage = (file: File) => file.type.startsWith('image/') || (!file.type && /\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name));

const trimName = (name: string) => (name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH) : name);
const jpegName = (name: string) => {
  const base = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base.slice(0, MAX_NAME_LENGTH - 4)}.jpg`;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to <img>, which decodes formats some browsers' createImageBitmap rejects.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new AttachmentError('unsupported_attachment');
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

/**
 * Re-encodes any image the browser can decode as a JPEG no larger than 1568px on the long side.
 * This keeps mobile uploads small and drops EXIF data such as the photo location.
 */
async function compressImage(file: File): Promise<string> {
  const decoded = await decodeImage(file);
  try {
    if (!decoded.width || !decoded.height) {throw new AttachmentError('unsupported_attachment');}
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {throw new AttachmentError('unsupported_attachment');}
    // JPEG has no transparency: paint white so transparent PNG areas do not turn black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (!dataUrl.startsWith('data:image/jpeg') || !data) {throw new AttachmentError('unsupported_attachment');}
    return data;
  } finally {
    decoded.release();
  }
}

const readAsBase64 = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result ?? '');
    resolve(result.slice(result.indexOf(',') + 1));
  };
  reader.onerror = () => reject(new AttachmentError('unsupported_attachment'));
  reader.readAsDataURL(file);
});

let nextId = 0;

export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  nextId += 1;
  const id = `attachment-${nextId}`;
  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) {throw new AttachmentError('attachment_too_large');}
    return { id, name: trimName(file.name || 'document.pdf'), kind: 'pdf', mimeType: 'application/pdf', data: await readAsBase64(file) };
  }
  if (!looksLikeImage(file)) {throw new AttachmentError('unsupported_attachment');}
  return { id, name: jpegName(file.name), kind: 'image', mimeType: 'image/jpeg', data: await compressImage(file) };
}
