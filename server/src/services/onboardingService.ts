import { dismissOnboarding, getOnboardingState, markOnboardingStepComplete } from '../repositories/accountRepository.js';
import { canManageAccountSettings } from '../policies/rolePermissions.js';
import type { User } from '../types/domain.js';

export const ONBOARDING_STEPS = [
  'account', 'specialist', 'schedule', 'service', 'meeting', 'publish', 'testBooking',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingStatus = {
  steps: Array<{ key: OnboardingStep; completed: boolean }>;
  dismissed: boolean;
};

const DISMISSED_STATUS: OnboardingStatus = {
  steps: ONBOARDING_STEPS.map((key) => ({ key, completed: true })),
  dismissed: true,
};

function toStatus(state: { onboarding_completed_steps: string | null; onboarding_dismissed_at: Date | null } | null): OnboardingStatus {
  const completed = new Set((state?.onboarding_completed_steps ?? '').split(',').filter(Boolean));
  return {
    steps: ONBOARDING_STEPS.map((key) => ({ key, completed: completed.has(key) })),
    dismissed: Boolean(state?.onboarding_dismissed_at),
  };
}

export async function getOnboardingStatusForActor(actor: User): Promise<OnboardingStatus> {
  if (!canManageAccountSettings(actor.role)) {
    return DISMISSED_STATUS;
  }

  const state = await getOnboardingState(actor.accountId);
  return toStatus(state);
}

export async function completeOnboardingStepForActor(actor: User, step: string): Promise<OnboardingStatus | null> {
  if (!canManageAccountSettings(actor.role)) {
    return null;
  }
  if (!ONBOARDING_STEPS.includes(step as OnboardingStep)) {
    return null;
  }

  await markOnboardingStepComplete(actor.accountId, step);
  return getOnboardingStatusForActor(actor);
}

export async function dismissOnboardingForActor(actor: User): Promise<OnboardingStatus | null> {
  if (!canManageAccountSettings(actor.role)) {
    return null;
  }

  await dismissOnboarding(actor.accountId);
  return getOnboardingStatusForActor(actor);
}
