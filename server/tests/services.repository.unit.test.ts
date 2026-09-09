import { describe, expect, it, vi } from 'vitest';

const where = vi.hoisted(() => vi.fn());

vi.mock('../src/db/knex.js', () => {
  const builder = {
    join: vi.fn().mockReturnThis(),
    where: where.mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue([]),
  };
  return { db: vi.fn(() => builder) };
});

import { listAssignments } from '../src/repositories/serviceRepository.js';
import {
  down as rollbackServiceImageMedia,
  up as addServiceImageMedia,
} from '../src/db/migrations/20260827120000_add_service_image_media.js';

describe('service repository', () => {
  it('returns assignments only for active specialists in the same account query', async () => {
    await listAssignments(7, [2, 3]);

    expect(where).toHaveBeenCalledWith('ss.account_id', 7);
    expect(where).toHaveBeenCalledWith('sp.is_active', true);
  });

  it('replaces legacy image_url with tenant-scoped image_media_id and restores it on rollback', async () => {
    const operations: string[] = [];
    const table = {
      unique: () => { operations.push('unique media account/id'); },
      uuid: () => { operations.push('add image_media_id'); },
      index: () => { operations.push('index image_media_id'); },
      foreign: () => ({
        references: () => ({
          inTable: () => ({ onDelete: () => { operations.push('foreign image_media_id'); } }),
        }),
      }),
      dropColumn: (column: string) => { operations.push(`drop ${column}`); },
      text: (column: string) => { operations.push(`add ${column}`); },
      dropForeign: () => { operations.push('drop foreign image_media_id'); },
      dropIndex: () => { operations.push('drop index image_media_id'); },
      dropUnique: () => { operations.push('drop unique media account/id'); },
    };
    const knex = {
      schema: {
        alterTable: async (_name: string, callback: (value: typeof table) => void) => callback(table),
      },
    } as never;

    await addServiceImageMedia(knex);
    expect(operations).toEqual([
      'unique media account/id',
      'add image_media_id',
      'index image_media_id',
      'foreign image_media_id',
      'drop image_url',
    ]);

    operations.length = 0;
    await rollbackServiceImageMedia(knex);
    expect(operations).toEqual([
      'add image_url',
      'drop foreign image_media_id',
      'drop index image_media_id',
      'drop image_media_id',
      'drop unique media account/id',
    ]);
  });
});
