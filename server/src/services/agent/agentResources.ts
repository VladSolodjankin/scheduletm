import { z } from 'zod';
import {
  accountNotificationDefaultsBatchSchema,
  accountSettingsSchema,
  managedUserCreateSchema,
  scheduleExceptionCreateSchema,
  serviceAssignmentUpdateSchema,
  serviceCreateSchema,
  specialistBookingPolicySchema,
  specialistCreateSchema,
  specialistNotificationSettingsBatchSchema,
  specialistUpdateSchema,
} from '../../config/schemas.js';
import {
  canCreateUserRole,
  canManageAccountSettings,
  canManageServices,
  isClientRole,
} from '../../policies/rolePermissions.js';
import type { User } from '../../types/domain.js';
import { WebUserRole } from '../../types/webUserRole.js';
import { getPaymentSettings } from '../paymentSettingsService.js';
import { createServiceForActor, getServicesForActor, updateAssignmentForActor, updateServiceForActor } from '../serviceService.js';
import {
  canManageSpecialistBookingPolicies,
  createScheduleExceptionForActor,
  getAccountNotificationDefaults,
  getAccountSettings,
  getSpecialistBookingPolicy,
  getSpecialistNotificationSettings,
  getUserSettings,
  listScheduleExceptionsForActor,
  putAccountNotificationDefaults,
  putSpecialistNotificationSettings,
  updateAccountSettings,
  updateSpecialistBookingPolicy,
} from '../settingsService.js';
import {
  createSpecialistForActor,
  getAvailableSpecialistWebUsersForActor,
  getSpecialistsForActor,
  updateSpecialistForActor,
} from '../specialistService.js';
import { getTelegramBotSettings } from '../telegramBotSettingsService.js';
import { createManagedUser, listManagedUsers } from '../userManagementService.js';

/**
 * The only things the assistant can read or change. Every entry calls an existing service with the
 * signed-in user, so roles, account scoping and validation stay exactly as in the regular UI.
 * Deleting is intentionally not supported.
 */

export class AgentResourceError extends Error {
  constructor(public code: string, public details?: unknown) { super(code); }
}

type Data = Record<string, unknown>;
type ReadFn = (actor: User, id?: number) => Promise<unknown>;
type CreateOperation = { schema: z.ZodType; summary?: string; run: (actor: User, data: Data) => Promise<unknown> };
type UpdateOperation = {
  schema: z.ZodType;
  idRequired: boolean;
  run: (actor: User, id: number | undefined, data: Data) => Promise<unknown>;
  /** Current values, so the confirmation card can show "before → after". */
  current?: (actor: User, id: number | undefined) => Promise<Data | null>;
};

export type AgentResource = {
  description: string;
  idMeaning?: string;
  /** What `id` points to, so the confirmation card can show a name instead of a number. */
  idTarget?: 'specialist' | 'service';
  canUse: (actor: User) => boolean;
  read?: ReadFn;
  create?: CreateOperation;
  update?: UpdateOperation;
};

const nonEmpty = <T extends z.ZodType>(schema: T) =>
  schema.refine((value) => Object.keys(value as object).length > 0, { message: 'at_least_one_field_required' });

/** Services in this codebase signal a forbidden or invalid request by returning null. */
const required = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new AgentResourceError('rejected');
  return value;
};

const pick = (source: unknown, keys: string[]): Data =>
  Object.fromEntries(keys.map((key) => [key, (source as Data | null)?.[key]]));

const isManager = (actor: User) => canManageAccountSettings(actor.role);
const isStaff = (actor: User) => !isClientRole(actor.role);

const findById = async <T extends { id: number }>(items: Promise<T[]>, id: number | undefined) =>
  (await items).find((item) => item.id === id) ?? null;

const serviceFields = serviceCreateSchema.omit({ imageMediaId: true });

const scheduleExceptionFields = z.intersection(
  z.object({
    specialistId: z.number().int().positive().optional()
      .describe('Specialist id from the specialists resource. Owners must pass it; a specialist always adds to their own schedule'),
  }),
  scheduleExceptionCreateSchema,
);

/**
 * Yesterday in UTC as YYYY-MM-DD, so today is kept in every timezone; older days off only add noise
 * to the assistant's context.
 */
const upcomingFrom = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const agentResources: Record<string, AgentResource> = {
  account_settings: {
    description: 'Business-wide settings: address for offline visits, weekdays clients can book, default appointment length, '
      + 'week start, daily digest, appointment visibility for specialists',
    canUse: isManager,
    read: async (actor) => required(await getAccountSettings(actor)),
    update: {
      schema: nonEmpty(accountSettingsSchema),
      idRequired: false,
      run: async (actor, _id, data) => required(await updateAccountSettings(actor, data)),
      current: async (actor) => (await getAccountSettings(actor)) as Data | null,
    },
  },

  account_notification_defaults: {
    description: 'Default notifications for the whole business: which messages are sent, by which channel and when. Send only the items you change',
    canUse: isManager,
    read: async (actor) => ({ items: required(await getAccountNotificationDefaults(actor)) }),
    update: {
      schema: accountNotificationDefaultsBatchSchema,
      idRequired: false,
      run: async (actor, _id, data) => ({ items: required(await putAccountNotificationDefaults(actor, data)) }),
    },
  },

  specialist_notifications: {
    idTarget: 'specialist',
    description: 'Notification settings of one specialist that override the business defaults. Send only the items you change',
    idMeaning: 'Specialist id from the specialists resource. Owners must pass it; a specialist always works with their own settings',
    canUse: isStaff,
    read: async (actor, id) => ({ items: required(await getSpecialistNotificationSettings(actor, id)) }),
    update: {
      schema: specialistNotificationSettingsBatchSchema,
      idRequired: false,
      run: async (actor, id, data) => ({ items: required(await putSpecialistNotificationSettings(actor, id, data)) }),
    },
  },

  booking_policy: {
    idTarget: 'specialist',
    description: 'Booking rules of one specialist: free cancellation period, refunds, automatic cancellation of unpaid appointments, meeting formats',
    idMeaning: 'Specialist id from the specialists resource. Owners must pass it; a specialist always works with their own policy',
    canUse: (actor) => canManageSpecialistBookingPolicies(actor.role),
    read: async (actor, id) => required(await getSpecialistBookingPolicy(actor, id)),
    update: {
      schema: nonEmpty(specialistBookingPolicySchema),
      idRequired: false,
      run: async (actor, id, data) => required(await updateSpecialistBookingPolicy(actor, id, data)),
      current: async (actor, id) => (await getSpecialistBookingPolicy(actor, id)) as Data | null,
    },
  },

  schedule_exceptions: {
    idTarget: 'specialist',
    description: 'Days off, vacations, holidays and blocked hours of one specialist on specific dates. '
      + 'One entry covers one date: a vacation of several days needs one create per day. Existing entries cannot be changed here',
    idMeaning: 'Specialist id from the specialists resource, for read. Owners must pass it; a specialist always reads their own',
    canUse: (actor) => canManageSpecialistBookingPolicies(actor.role),
    read: async (actor, id) => {
      const from = upcomingFrom();
      return { upcoming: required(await listScheduleExceptionsForActor(actor, id)).filter((item) => item.date >= from) };
    },
    create: {
      schema: scheduleExceptionFields,
      run: async (actor, data) => {
        const { specialistId, ...exception } = data as { specialistId?: number } & Data;
        return required(await createScheduleExceptionForActor(actor, specialistId, exception));
      },
    },
  },

  specialists: {
    idTarget: 'specialist',
    description: 'People clients book with: name, prices, working hours and slot length. '
      + 'create turns an accepted invitation (availableWebUsers) into a bookable specialist. '
      + 'To add a new person, use specialist_invites first',
    idMeaning: 'Specialist id',
    canUse: isStaff,
    read: async (actor) => {
      const [specialists, availableWebUsers] = await Promise.all([
        getSpecialistsForActor(actor),
        getAvailableSpecialistWebUsersForActor(actor),
      ]);
      return { specialists, availableWebUsers };
    },
    create: {
      schema: specialistCreateSchema,
      run: (actor, data) => createSpecialistForActor(actor, data as z.infer<typeof specialistCreateSchema>),
    },
    update: {
      schema: specialistUpdateSchema,
      idRequired: true,
      run: async (actor, id, data) => required(await updateSpecialistForActor(actor, id!, data)),
      current: async (actor, id) => findById(getSpecialistsForActor(actor), id) as Promise<Data | null>,
    },
  },

  specialist_invites: {
    description: 'Invite a new specialist by email. The person receives an invitation email; '
      + 'after they accept it they appear in specialists.availableWebUsers and can be turned into a specialist',
    canUse: (actor) => canCreateUserRole(actor.role, WebUserRole.Specialist),
    read: async (actor) => ({
      pendingInvites: (await listManagedUsers(actor))
        .filter((user) => user.role === WebUserRole.Specialist && !user.isActive)
        .map((user) => pick(user, ['id', 'email', 'firstName', 'lastName', 'createdAt'])),
    }),
    create: {
      schema: managedUserCreateSchema.omit({ role: true }),
      summary: 'Sends an invitation email to this address',
      run: (actor, data) => createManagedUser(actor, {
        ...(data as Omit<z.infer<typeof managedUserCreateSchema>, 'role'>),
        role: WebUserRole.Specialist,
      }),
    },
  },

  services: {
    idTarget: 'service',
    description: 'Services clients can book, with price and duration. Together with service_prices this is the price list',
    idMeaning: 'Service id',
    canUse: (actor) => canManageServices(actor.role) || actor.role === WebUserRole.Specialist,
    read: (actor) => getServicesForActor(actor),
    create: {
      schema: serviceFields,
      run: (actor, data) => createServiceForActor(actor, data as z.infer<typeof serviceFields>),
    },
    update: {
      schema: nonEmpty(serviceFields.partial()),
      idRequired: true,
      run: (actor, id, data) => updateServiceForActor(actor, id!, data),
      current: async (actor, id) => findById(getServicesForActor(actor).then(({ services }) => services), id) as Promise<Data | null>,
    },
  },

  service_prices: {
    idTarget: 'service',
    description: 'Individual price or duration of a service for one specialist. Current values are in services[].assignments',
    idMeaning: 'Service id',
    canUse: (actor) => canManageServices(actor.role) || actor.role === WebUserRole.Specialist,
    read: async (actor) => (await getServicesForActor(actor)).services
      .map((service) => ({ serviceId: service.id, name: service.name, basePrice: service.basePrice, assignments: service.assignments })),
    update: {
      schema: z.object({
        specialistId: z.number().int().positive().describe('Specialist id'),
        changes: serviceAssignmentUpdateSchema,
      }),
      idRequired: true,
      run: (actor, id, data) => updateAssignmentForActor(actor, id!, data.specialistId as number, data.changes as Data),
    },
  },

  integrations: {
    description: 'What is connected: calendars and video meetings of the signed-in user, the Telegram bot and online payments. '
      + 'Read-only: connecting happens in the app (use open_section)',
    canUse: isStaff,
    read: async (actor) => {
      const user = await getUserSettings(actor);
      const bot = await getTelegramBotSettings(actor.accountId);
      const payments = isManager(actor) ? await getPaymentSettings(actor.accountId) : null;
      return {
        calendars: {
          google: user.googleConnected,
          microsoft: user.microsoftConnected,
          appleCalendarFeed: user.appleCalendarFeedEnabled,
        },
        videoMeetings: { zoom: user.zoomConnected, yandexTelemost: user.yandexConnected },
        telegramBot: { enabled: bot.enabled, mode: bot.mode, link: bot.botLink },
        payments: payments && {
          activeProvider: payments.activeProvider,
          stripe: payments.providers.stripe.connected,
          yookassa: payments.providers.yookassa.connected,
          bog: payments.providers.bog.connected,
        },
      };
    },
  },
};

export type AgentChange = {
  resource: string;
  operation: 'create' | 'update';
  id?: number;
  data: Data;
};

/** `names` maps `id` and `specialistId` to display names for the confirmation card. */
export type ValidatedChange = AgentChange & { before?: Data | null; note?: string; names?: Record<string, string> };

/** Validates one proposed change against the resource's schema; never writes anything. */
export async function validateAgentChange(actor: User, change: AgentChange): Promise<ValidatedChange> {
  const resource = agentResources[change.resource];
  if (!resource || !resource.canUse(actor)) throw new AgentResourceError('unknown_resource');
  const operation = resource[change.operation];
  if (!operation) throw new AgentResourceError('operation_not_supported');
  if (change.operation === 'update' && (operation as UpdateOperation).idRequired && !change.id) {
    throw new AgentResourceError('id_required');
  }
  const parsed = operation.schema.safeParse(change.data);
  if (!parsed.success) {
    throw new AgentResourceError('invalid_data', parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })));
  }
  const data = parsed.data as Data;
  if (change.operation === 'update') {
    const update = operation as UpdateOperation;
    const before = update.current ? pick(await update.current(actor, change.id), Object.keys(data)) : undefined;
    return { ...change, data, before };
  }
  return { ...change, data, note: (operation as CreateOperation).summary };
}

/** Adds specialist and service names to the changes, so the card does not show bare ids. */
export async function nameAgentChanges(actor: User, changes: ValidatedChange[]): Promise<ValidatedChange[]> {
  let names: Record<'specialist' | 'service', Map<number, string>>;
  try {
    const catalog = await getServicesForActor(actor);
    names = {
      specialist: new Map(catalog.specialists.map(({ id, name }) => [id, name])),
      service: new Map(catalog.services.map(({ id, name }) => [id, name])),
    };
  } catch {
    return changes;
  }
  return changes.map((change) => {
    const target = agentResources[change.resource]?.idTarget;
    const found: Record<string, string> = {};
    const idName = target && change.id ? names[target].get(change.id) : undefined;
    if (idName) found.id = idName;
    const specialistName = typeof change.data.specialistId === 'number' ? names.specialist.get(change.data.specialistId) : undefined;
    if (specialistName) found.specialistId = specialistName;
    return Object.keys(found).length > 0 ? { ...change, names: found } : change;
  });
}

/** Applies an already confirmed change through the resource's service. */
export async function applyAgentChange(actor: User, change: AgentChange): Promise<unknown> {
  const validated = await validateAgentChange(actor, change);
  const resource = agentResources[change.resource]!;
  if (validated.operation === 'create') return resource.create!.run(actor, validated.data);
  return resource.update!.run(actor, validated.id, validated.data);
}

export async function readAgentResource(actor: User, name: string, id?: number): Promise<unknown> {
  const resource = agentResources[name];
  if (!resource || !resource.canUse(actor) || !resource.read) throw new AgentResourceError('unknown_resource');
  return resource.read(actor, id);
}

const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { unrepresentable: 'any' });

/** What the assistant may work with, generated from the registry and the Zod schemas. */
export function buildAgentCatalog(actor: User) {
  return Object.fromEntries(Object.entries(agentResources)
    .filter(([, resource]) => resource.canUse(actor))
    .map(([name, resource]) => [name, {
      description: resource.description,
      ...(resource.idMeaning ? { id: resource.idMeaning } : {}),
      operations: (['read', 'create', 'update'] as const).filter((operation) => resource[operation]),
      ...(resource.create ? { createFields: jsonSchema(resource.create.schema) } : {}),
      ...(resource.update ? { updateFields: jsonSchema(resource.update.schema) } : {}),
    }]));
}
