import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountRepository = vi.hoisted(() => ({
  getOnboardingState: vi.fn(),
  markOnboardingStepComplete: vi.fn(),
  dismissOnboarding: vi.fn(),
}));

vi.mock('../src/repositories/accountRepository.js', () => accountRepository);

import {
  ONBOARDING_STEPS,
  completeOnboardingStepForActor,
  dismissOnboardingForActor,
  getOnboardingStatusForActor,
} from '../src/services/onboardingService.js';
import { WebUserRole } from '../src/types/webUserRole.js';
import type { User } from '../src/types/domain.js';

const owner: User = {
  id: '1', accountId: 7, email: 'owner@example.com', role: WebUserRole.Owner,
  passwordHash: 'hash', passwordSalt: 'salt', createdAt: '2026-01-01T00:00:00.000Z',
};
const specialist: User = { ...owner, id: '2', role: WebUserRole.Specialist };

describe('onboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports every step incomplete and not dismissed for a fresh account', async () => {
    accountRepository.getOnboardingState.mockResolvedValue({ onboarding_completed_steps: null, onboarding_dismissed_at: null });

    const status = await getOnboardingStatusForActor(owner);

    expect(status.dismissed).toBe(false);
    expect(status.steps).toEqual(ONBOARDING_STEPS.map((key) => ({ key, completed: false })));
  });

  it('marks only the listed steps as completed', async () => {
    accountRepository.getOnboardingState.mockResolvedValue({
      onboarding_completed_steps: 'account,specialist', onboarding_dismissed_at: null,
    });

    const status = await getOnboardingStatusForActor(owner);

    expect(status.steps.find((item) => item.key === 'account')?.completed).toBe(true);
    expect(status.steps.find((item) => item.key === 'specialist')?.completed).toBe(true);
    expect(status.steps.find((item) => item.key === 'schedule')?.completed).toBe(false);
  });

  it('reports dismissed=true for a non-owner role without touching the repository', async () => {
    const status = await getOnboardingStatusForActor(specialist);

    expect(status.dismissed).toBe(true);
    expect(status.steps.every((item) => item.completed)).toBe(true);
    expect(accountRepository.getOnboardingState).not.toHaveBeenCalled();
  });

  it('completeOnboardingStepForActor rejects an unknown step', async () => {
    const result = await completeOnboardingStepForActor(owner, 'not-a-real-step');

    expect(result).toBeNull();
    expect(accountRepository.markOnboardingStepComplete).not.toHaveBeenCalled();
  });

  it('completeOnboardingStepForActor persists a valid step idempotently', async () => {
    accountRepository.getOnboardingState.mockResolvedValue({ onboarding_completed_steps: 'account', onboarding_dismissed_at: null });

    const result = await completeOnboardingStepForActor(owner, 'account');

    expect(accountRepository.markOnboardingStepComplete).toHaveBeenCalledWith(7, 'account');
    expect(result?.steps.find((item) => item.key === 'account')?.completed).toBe(true);
  });

  it('completeOnboardingStepForActor returns null for a non-owner', async () => {
    const result = await completeOnboardingStepForActor(specialist, 'account');

    expect(result).toBeNull();
    expect(accountRepository.markOnboardingStepComplete).not.toHaveBeenCalled();
  });

  it('dismissOnboardingForActor persists the dismissal for an owner', async () => {
    accountRepository.getOnboardingState.mockResolvedValue({ onboarding_completed_steps: null, onboarding_dismissed_at: new Date() });

    const result = await dismissOnboardingForActor(owner);

    expect(accountRepository.dismissOnboarding).toHaveBeenCalledWith(7);
    expect(result?.dismissed).toBe(true);
  });

  it('dismissOnboardingForActor returns null for a non-owner', async () => {
    const result = await dismissOnboardingForActor(specialist);

    expect(result).toBeNull();
    expect(accountRepository.dismissOnboarding).not.toHaveBeenCalled();
  });
});
