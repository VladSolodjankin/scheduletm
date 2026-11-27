import { canManageAccountSettings } from '../../policies/rolePermissions.js';
import { findAccountSettingsByAccountId } from '../../repositories/accountSettingsRepository.js';
import { hasAnyAppointment } from '../../repositories/appointmentRepository.js';
import { hasPublishedPublicPage } from '../../repositories/publicPageRepository.js';
import { findSpecialistForUser, listAssignments, listServices } from '../../repositories/serviceRepository.js';
import { countSpecialistsByAccount } from '../../repositories/specialistRepository.js';
import type { User } from '../../types/domain.js';
import { getPaymentSettings } from '../paymentSettingsService.js';
import { getUserSettings } from '../settingsService.js';
import { getTelegramBotSettings } from '../telegramBotSettingsService.js';
import { agentSections } from './agentSections.js';

export type SetupStepKey = 'services' | 'service_assignments' | 'team' | 'business_address' | 'public_page'
  | 'telegram_bot' | 'payments' | 'calendar' | 'test_booking';
export type SetupStep = { key: SetupStepKey; done: boolean; optional: boolean; path: string | null };
export type SetupStatus = { steps: SetupStep[]; remaining: number };

const OPTIONAL_STEPS = new Set<SetupStepKey>(['team', 'payments', 'calendar']);
const SECTION_BY_STEP: Record<SetupStepKey, string | null> = {
  services: 'services',
  service_assignments: 'services',
  team: 'specialists',
  business_address: 'account_settings',
  public_page: 'public_pages',
  telegram_bot: 'telegram_bot',
  payments: 'payments',
  calendar: 'integrations',
  test_booking: null,
};

const calendarConnected = (settings: Awaited<ReturnType<typeof getUserSettings>>) =>
  settings.googleConnected || settings.microsoftConnected || settings.appleCalendarFeedEnabled;

/**
 * What is left to set up, derived from existing data of the actor's account. Owners see account-wide steps;
 * a specialist sees only the steps that concern them.
 */
export async function computeSetupStatus(actor: User): Promise<SetupStatus> {
  const accountId = actor.accountId;
  const done = new Map<SetupStepKey, boolean>();

  if (canManageAccountSettings(actor.role)) {
    const [services, activeSpecialists, accountSettings, pagePublished, bot, payments, userSettings, hasBooking] = await Promise.all([
      listServices(accountId),
      countSpecialistsByAccount(accountId, { activeOnly: true }),
      findAccountSettingsByAccountId(accountId),
      hasPublishedPublicPage(accountId),
      getTelegramBotSettings(accountId),
      getPaymentSettings(accountId),
      getUserSettings(actor),
      hasAnyAppointment(accountId),
    ]);
    const activeServiceIds = services.filter((service) => service.is_active).map((service) => service.id);
    const assignments = await listAssignments(accountId, activeServiceIds);
    const provided = new Set(assignments.filter((assignment) => assignment.isActive).map((assignment) => assignment.serviceId));
    done.set('services', activeServiceIds.length > 0);
    done.set('service_assignments', activeServiceIds.length > 0 && activeServiceIds.every((id) => provided.has(id)));
    done.set('team', activeSpecialists > 1);
    done.set('business_address', Boolean(accountSettings?.business_address?.trim()));
    done.set('public_page', pagePublished);
    done.set('telegram_bot', bot.enabled);
    done.set('payments', payments.hasAnyMethod);
    done.set('calendar', calendarConnected(userSettings));
    done.set('test_booking', hasBooking);
  } else {
    const specialist = await findSpecialistForUser(accountId, Number(actor.id));
    const [services, ownServices, userSettings] = await Promise.all([
      listServices(accountId),
      specialist ? listServices(accountId, specialist.id) : Promise.resolve([]),
      getUserSettings(actor),
    ]);
    done.set('services', services.some((service) => service.is_active));
    done.set('service_assignments', ownServices.some((service) => service.is_active));
    done.set('calendar', calendarConnected(userSettings));
  }

  const steps = [...done.entries()].map(([key, isDone]): SetupStep => {
    const sectionName = SECTION_BY_STEP[key];
    const section = sectionName ? agentSections[sectionName] : undefined;
    return { key, done: isDone, optional: OPTIONAL_STEPS.has(key), path: section?.canUse(actor) ? section.path : null };
  });
  return { steps, remaining: steps.filter((step) => !step.optional && !step.done).length };
}
