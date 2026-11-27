import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AGENT_IMAGE_MAX_BYTES, AGENT_PDF_MAX_BYTES, prepareAgentAttachments } from '../src/services/agent/agentAttachments.js';

const image = (width: number, height: number, format: 'png' | 'jpeg' = 'png') =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })[format]().toBuffer();
const base64 = (buffer: Buffer) => buffer.toString('base64');
const PDF = Buffer.from('%PDF-1.4\n%%EOF');

describe('agent attachments', () => {
  it('shrinks images to JPEG within 1568px and keeps PDFs as they are', async () => {
    const [photo, pdf] = await prepareAgentAttachments([
      { name: ' price\nlist.png ', mimeType: 'image/png', data: base64(await image(3000, 1000)) },
      { name: 'menu.pdf', mimeType: 'application/pdf', data: base64(PDF) },
    ]);
    expect(photo).toMatchObject({ name: 'price list.png', kind: 'image', mediaType: 'image/jpeg' });
    const metadata = await sharp(Buffer.from(photo!.data, 'base64')).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 1568, height: 523 });
    expect(pdf).toEqual({ name: 'menu.pdf', kind: 'pdf', mediaType: 'application/pdf', data: base64(PDF) });
  });

  it('does not enlarge small images', async () => {
    const [photo] = await prepareAgentAttachments([{ name: 'a.jpg', mimeType: 'image/jpeg', data: base64(await image(200, 100, 'jpeg')) }]);
    expect(await sharp(Buffer.from(photo!.data, 'base64')).metadata()).toMatchObject({ width: 200, height: 100 });
  });

  it.each([
    ['unsupported type', { name: 'a.gif', mimeType: 'image/gif', data: 'R0lGODlh' }, 'unsupported_attachment'],
    ['content not matching the type', { name: 'a.png', mimeType: 'image/png', data: base64(PDF) }, 'unsupported_attachment'],
    ['PDF without signature', { name: 'a.pdf', mimeType: 'application/pdf', data: base64(Buffer.from('hello')) }, 'unsupported_attachment'],
    ['broken base64', { name: 'a.png', mimeType: 'image/png', data: 'not base64!' }, 'invalid_attachment'],
    ['too large image', { name: 'a.png', mimeType: 'image/png', data: base64(Buffer.alloc(AGENT_IMAGE_MAX_BYTES + 1)) }, 'attachment_too_large'],
    ['too large PDF', { name: 'a.pdf', mimeType: 'application/pdf', data: base64(Buffer.alloc(AGENT_PDF_MAX_BYTES + 1)) }, 'attachment_too_large'],
  ])('rejects %s', async (_case, attachment, code) => {
    await expect(prepareAgentAttachments([attachment])).rejects.toMatchObject({ code });
  });
});
