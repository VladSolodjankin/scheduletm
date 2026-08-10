import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  createPublicPageMedia: vi.fn(),
  deleteAccountMedia: vi.fn(),
  findAccountMedia: vi.fn(),
  findPublishedMedia: vi.fn(),
  isMediaReferenced: vi.fn(),
}));
const s3Send = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/publicPageMediaRepository.js', () => repository);
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = s3Send; },
  PutObjectCommand: class { kind = 'put'; constructor(public input: unknown) {} },
  GetObjectCommand: class {},
  DeleteObjectCommand: class { kind = 'delete'; constructor(public input: unknown) {} },
}));

import { env } from '../src/config/env.js';
import {
  deletePublicPageMedia,
  getAccountPublicPageMedia,
  PublicPageMediaError,
  uploadPublicPageMedia,
} from '../src/services/publicPageMediaService.js';

describe('public page media service', () => {
  beforeEach(() => {
    Object.values(repository).forEach((mock) => mock.mockReset());
    s3Send.mockReset().mockResolvedValue({});
    env.AWS_ENDPOINT_URL = '';
    env.AWS_ACCESS_KEY_ID = '';
    env.AWS_SECRET_ACCESS_KEY = '';
    env.AWS_S3_BUCKET_NAME = '';
    env.AWS_DEFAULT_REGION = '';
  });

  it('rejects a declared MIME that does not match image magic bytes', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await expect(uploadPublicPageMedia(7, png, 'image/jpeg')).rejects.toMatchObject({
      code: 'UNSUPPORTED_MEDIA',
    });
    expect(repository.createPublicPageMedia).not.toHaveBeenCalled();
  });

  it('reports storage unavailable when bucket configuration is incomplete', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await expect(uploadPublicPageMedia(7, png, 'image/png')).rejects.toBeInstanceOf(PublicPageMediaError);
    await expect(uploadPublicPageMedia(7, png, 'image/png')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('does not delete bucket data while media is referenced by a draft or published page', async () => {
    repository.findAccountMedia.mockResolvedValue({ id: 'media-id', account_id: 7, object_key: 'key' });
    repository.isMediaReferenced.mockResolvedValue(true);
    await expect(deletePublicPageMedia(7, 'media-id')).rejects.toMatchObject({ code: 'MEDIA_IN_USE' });
    expect(repository.deleteAccountMedia).not.toHaveBeenCalled();
  });

  it('does not expose media outside the requested account scope', async () => {
    repository.findAccountMedia.mockResolvedValue(null);
    await expect(getAccountPublicPageMedia(7, 'media-id')).resolves.toBeNull();
    expect(repository.findAccountMedia).toHaveBeenCalledWith(7, 'media-id');
  });

  it('rejects a truncated image that still has valid magic bytes', async () => {
    const truncatedPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    await expect(uploadPublicPageMedia(7, truncatedPng, 'image/png')).rejects.toMatchObject({
      code: 'UNSUPPORTED_MEDIA',
    });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('best-effort deletes the S3 object when metadata persistence fails', async () => {
    env.AWS_ENDPOINT_URL = 'https://bucket.example.com';
    env.AWS_ACCESS_KEY_ID = 'access';
    env.AWS_SECRET_ACCESS_KEY = 'secret';
    env.AWS_S3_BUCKET_NAME = 'media';
    env.AWS_DEFAULT_REGION = 'auto';
    repository.createPublicPageMedia.mockRejectedValue(new Error('database unavailable'));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

    await expect(uploadPublicPageMedia(7, png, 'image/png')).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
    expect(s3Send).toHaveBeenCalledTimes(2);
    expect(s3Send.mock.calls[0]?.[0]).toMatchObject({ kind: 'put' });
    expect(s3Send.mock.calls[1]?.[0]).toMatchObject({ kind: 'delete' });
  });
});
