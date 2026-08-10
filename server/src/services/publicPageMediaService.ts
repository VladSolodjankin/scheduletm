import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env.js';
import {
  createPublicPageMedia, deleteAccountMedia, findAccountMedia, findPublishedMedia, isMediaReferenced,
  type PublicPageMediaRecord,
} from '../repositories/publicPageMediaRepository.js';

export const PUBLIC_PAGE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export type SupportedMediaMime = 'image/jpeg' | 'image/png' | 'image/webp';
export class PublicPageMediaError extends Error {
  constructor(public readonly code: 'UNSUPPORTED_MEDIA' | 'MEDIA_IN_USE' | 'NOT_FOUND' | 'STORAGE_UNAVAILABLE') { super(code); }
}

function storageConfig() {
  const values = [env.AWS_ENDPOINT_URL, env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY, env.AWS_S3_BUCKET_NAME, env.AWS_DEFAULT_REGION];
  if (values.some((value) => !value.trim())) throw new PublicPageMediaError('STORAGE_UNAVAILABLE');
  return {
    bucket: env.AWS_S3_BUCKET_NAME,
    client: new S3Client({
      endpoint: env.AWS_ENDPOINT_URL,
      region: env.AWS_DEFAULT_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
    }),
  };
}

async function validateImage(data: Buffer, declaredMime: string): Promise<{
  mime: SupportedMediaMime;
  width: number;
  height: number;
}> {
  try {
    const image = sharp(data, { failOn: 'error', limitInputPixels: 144_000_000 });
    const metadata = await image.metadata();
    const mimeByFormat = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
    const mime = metadata.format && metadata.format in mimeByFormat
      ? mimeByFormat[metadata.format as keyof typeof mimeByFormat]
      : null;
    if (!mime || mime !== declaredMime || !metadata.width || !metadata.height
      || metadata.width > 12_000 || metadata.height > 12_000) {
      throw new Error('Invalid image metadata');
    }
    await image.stats();
    return { mime, width: metadata.width, height: metadata.height };
  } catch {
    throw new PublicPageMediaError('UNSUPPORTED_MEDIA');
  }
}

export async function uploadPublicPageMedia(accountId: number, body: Buffer, declaredMime: string) {
  const image = await validateImage(body, declaredMime);
  const { client, bucket } = storageConfig();
  const id = randomUUID();
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.mime];
  const objectKey = `public-pages/${accountId}/${id}.${extension}`;
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: body, ContentType: image.mime }));
  } catch (error) {
    console.error(error);
    throw new PublicPageMediaError('STORAGE_UNAVAILABLE');
  }
  try {
    return await createPublicPageMedia({
      id, account_id: accountId, object_key: objectKey, mime: image.mime, bytes: body.length,
      width: image.width, height: image.height,
    });
  } catch (error) {
    console.error(error);
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    } catch (cleanupError) {
      console.error(cleanupError);
    }
    throw new PublicPageMediaError('STORAGE_UNAVAILABLE');
  }
}

export async function getPublishedPublicPageMedia(id: string): Promise<{ record: PublicPageMediaRecord; body: Uint8Array } | null> {
  const record = await findPublishedMedia(id);
  return record ? getStoredMedia(record) : null;
}

async function getStoredMedia(record: PublicPageMediaRecord): Promise<{ record: PublicPageMediaRecord; body: Uint8Array }> {
  const { client, bucket } = storageConfig();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: record.object_key }));
    if (!result.Body) throw new Error('Missing S3 body');
    return { record, body: await result.Body.transformToByteArray() };
  } catch (error) {
    console.error(error);
    throw new PublicPageMediaError('STORAGE_UNAVAILABLE');
  }
}

export async function getAccountPublicPageMedia(
  accountId: number,
  id: string,
): Promise<{ record: PublicPageMediaRecord; body: Uint8Array } | null> {
  const record = await findAccountMedia(accountId, id);
  return record ? getStoredMedia(record) : null;
}

export async function deletePublicPageMedia(accountId: number, id: string): Promise<void> {
  const record = await findAccountMedia(accountId, id);
  if (!record) throw new PublicPageMediaError('NOT_FOUND');
  if (await isMediaReferenced(accountId, id)) throw new PublicPageMediaError('MEDIA_IN_USE');
  const { client, bucket } = storageConfig();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: record.object_key }));
    await deleteAccountMedia(accountId, id);
  } catch (error) {
    console.error(error);
    throw new PublicPageMediaError('STORAGE_UNAVAILABLE');
  }
}
