import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const resolveUserByAccessTokenMock = vi.hoisted(() => vi.fn());
const getOnboardingStatusForActorMock = vi.hoisted(() => vi.fn());
const completeOnboardingStepForActorMock = vi.hoisted(() => vi.fn());
const dismissOnboardingForActorMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/authService.js', () => ({
  resolveUserByAccessToken: resolveUserByAccessTokenMock,
}));

vi.mock('../src/services/onboardingService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/onboardingService.js')>('../src/services/onboardingService.js');
  return {
    ...actual,
    getOnboardingStatusForActor: getOnboardingStatusForActorMock,
    completeOnboardingStepForActor: completeOnboardingStepForActorMock,
    dismissOnboardingForActor: dismissOnboardingForActorMock,
  };
});

const ownerUser = {
  id: '1',
  accountId: 1,
  email: 'owner@example.com',
  role: WebUserRole.Owner,
  passwordSalt: 'salt',
  passwordHash: 'hash',
  createdAt: '2026-04-22T09:00:00.000Z',
};

describe('onboarding route-smoke scenarios (mocked service layer)', () => {
  const app = createApp();
  let baseUrl = '';
  let server: Awaited<ReturnType<typeof app.listen>>;

  beforeAll(async () => {
    server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    resolveUserByAccessTokenMock.mockReset();
    getOnboardingStatusForActorMock.mockReset();
    completeOnboardingStepForActorMock.mockReset();
    dismissOnboardingForActorMock.mockReset();

    resolveUserByAccessTokenMock.mockResolvedValue(ownerUser);
  });

  it('GET /api/onboarding returns the status', async () => {
    getOnboardingStatusForActorMock.mockResolvedValue({
      dismissed: false,
      steps: [{ key: 'account', completed: true }],
    });

    const response = await fetch(`${baseUrl}/api/onboarding`, {
      method: 'GET',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ dismissed: false });
  });

  it('POST /api/onboarding/steps/:step marks a step complete', async () => {
    completeOnboardingStepForActorMock.mockResolvedValue({
      dismissed: false,
      steps: [{ key: 'account', completed: true }],
    });

    const response = await fetch(`${baseUrl}/api/onboarding/steps/account`, {
      method: 'POST',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(completeOnboardingStepForActorMock).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), 'account');
  });

  it('POST /api/onboarding/steps/:step returns 400 for an unknown step', async () => {
    completeOnboardingStepForActorMock.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/onboarding/steps/not-a-step`, {
      method: 'POST',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/onboarding/dismiss dismisses onboarding', async () => {
    dismissOnboardingForActorMock.mockResolvedValue({ dismissed: true, steps: [] });

    const response = await fetch(`${baseUrl}/api/onboarding/dismiss`, {
      method: 'POST',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ dismissed: true });
  });

  it('POST /api/onboarding/dismiss returns 403 for a non-owner', async () => {
    dismissOnboardingForActorMock.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/onboarding/dismiss`, {
      method: 'POST',
      headers: { authorization: 'Bearer smoke-token' },
    });

    expect(response.status).toBe(403);
  });
});
