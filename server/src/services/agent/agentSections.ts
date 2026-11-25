import { canManageAccountSettings, canManageFullUserDirectory, isClientRole } from '../../policies/rolePermissions.js';
import type { User } from '../../types/domain.js';
import { canManageSpecialistBookingPolicies } from '../settingsService.js';

/**
 * App sections the assistant can send the user to. Used for things the assistant must not do itself:
 * OAuth sign-ins, API keys and tokens, uploads. The guide tells the model what to explain to the user.
 */
export type AgentSection = { path: string; canUse: (actor: User) => boolean; guide: string };

const isManager = (actor: User) => canManageAccountSettings(actor.role);
const isStaff = (actor: User) => !isClientRole(actor.role);

export const agentSections: Record<string, AgentSection> = {
  integrations: {
    path: '/settings/integrations',
    canUse: isStaff,
    guide: 'Connections of the signed-in user. Google Calendar or Microsoft Outlook: sign in with the account; appointments are '
      + 'added to that calendar and busy events there block those times for booking. Apple Calendar: turn on the feed and '
      + 'subscribe to the link in Calendar on iPhone or Mac (read-only, updates with a delay). Zoom or Yandex Telemost: sign in; '
      + 'online appointments then get a meeting link automatically. Each person connects their own accounts.',
  },
  payments: {
    path: '/payments',
    canUse: isManager,
    guide: 'Online prepayment for appointments. Stripe: press connect and finish onboarding on Stripe. YooKassa: enter shop id '
      + 'and secret key from the YooKassa dashboard and add the shown webhook URL there. Bank of Georgia: enter client id and '
      + 'secret and add the shown callback URL. Then choose the active provider. Manual payment methods (bank details, '
      + 'payment link) can be set on the same page. Keys are entered by the user only.',
  },
  telegram_bot: {
    path: '/telegram-bot',
    canUse: isManager,
    guide: 'Telegram bot where clients book and get notifications. Simplest: enable the shared bot and choose a short name '
      + '(slug) for the booking link. Own branded bot: create a bot with @BotFather in Telegram, copy its token and paste it '
      + 'on this page. A welcome message can be set too.',
  },
  public_pages: {
    path: '/public-pages',
    canUse: isManager,
    guide: 'Public booking page of the business: about, services and prices, reviews, contacts, map. Create a page, add blocks '
      + 'in the builder, upload photos and publish it to get a link for clients.',
  },
  users: {
    path: '/users',
    canUse: (actor) => canManageFullUserDirectory(actor.role),
    guide: 'Everyone with access to the account: specialists and clients, their invitations and access.',
  },
  specialists: {
    path: '/specialists',
    canUse: isStaff,
    guide: 'Specialists clients book with, their prices and working hours.',
  },
  services: {
    path: '/services',
    canUse: isStaff,
    guide: 'Services with prices and durations, photos of services and which specialists provide them.',
  },
  schedule_exceptions: {
    path: '/days-off',
    canUse: isStaff,
    guide: 'Days off, vacations and breaks that close time for booking.',
  },
  account_settings: {
    path: '/settings/account',
    canUse: isManager,
    guide: 'Business address, default appointment length and other account-wide settings.',
  },
  notifications: {
    path: '/settings/notifications',
    canUse: isManager,
    guide: 'Which notifications are sent, through which channels and when.',
  },
  booking_policy: {
    path: '/settings/specialistPolicy',
    canUse: (actor) => canManageSpecialistBookingPolicies(actor.role),
    guide: 'Cancellation rules, refunds and automatic cancellation of unpaid appointments.',
  },
};

export function listAgentSections(actor: User) {
  return Object.entries(agentSections).filter(([, section]) => section.canUse(actor)).map(([name]) => name);
}
