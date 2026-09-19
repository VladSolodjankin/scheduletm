import { beforeEach, describe, expect, it, vi } from 'vitest';

const purgeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/userManagementAuditRepository.js', () => ({
  purgeUserManagementEventsCreatedBefore: purgeMock,
}));
vi.mock('../src/services/errorTrackingService.js', () => ({
  trackServerError: vi.fn(),
}));

const { runUserManagementAuditRetentionJob } = await import(
  '../src/jobs/userManagementAuditRetention.job.js'
);

describe('user management audit retention job', () => {
  beforeEach(() => {
    purgeMock.mockReset().mockResolvedValue(3);
  });

  it('purges only events older than the 365-day cutoff', async () => {
    await expect(
      runUserManagementAuditRetentionJob(new Date('2026-07-30T12:00:00.000Z')),
    ).resolves.toBe(3);

    expect(purgeMock).toHaveBeenCalledWith(new Date('2025-07-30T12:00:00.000Z'));
  });

  it('prevents overlapping cleanup runs', async () => {
    let release: ((value: number) => void) | undefined;
    purgeMock.mockImplementationOnce(() => new Promise<number>((resolve) => {
      release = resolve;
    }));

    const first = runUserManagementAuditRetentionJob();
    await expect(runUserManagementAuditRetentionJob()).resolves.toBe(0);
    release?.(1);
    await expect(first).resolves.toBe(1);
  });
});
