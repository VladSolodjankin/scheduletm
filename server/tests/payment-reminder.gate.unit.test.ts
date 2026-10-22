import { describe, expect, it, vi } from 'vitest';
import {
  buildTelegramPaymentText,
  buildPaymentReminderContent,
  evaluatePaymentReminderEligibility,
  resolveAppointmentAmount,
} from '../src/services/paymentReminderService.js';
import type { AccountPaymentMethods } from '../src/services/paymentSettingsService.js';
import type { AppointmentRecord } from '../src/repositories/appointmentRepository.js';

const appointment = (overrides: Partial<AppointmentRecord> = {}): AppointmentRecord => ({
  id: 1,
  account_id: 2,
  specialist_id: 3,
  appointment_at: new Date('2026-10-30T10:00:00.000Z'),
  status: 'new',
  comment: null,
  meeting_link: null,
  meeting_provider: 'offline',
  location_address: null,
  zoom_meeting_id: null,
  zoom_meeting_started_at: null,
  zoom_meeting_ended_at: null,
  duration_min: 60,
  is_paid: false,
  price: 1500,
  currency: 'RUB',
  user_id: 4,
  service_id: 5,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const noMethods: AccountPaymentMethods = { onlineProvider: null, manual: { bankTransfer: null, customLink: null, cash: null } };
const bankOnly: AccountPaymentMethods = { ...noMethods, manual: { ...noMethods.manual, bankTransfer: { text: 'IBAN 123' } } };
const yookassa: AccountPaymentMethods = { ...noMethods, onlineProvider: 'yookassa' };

const gate = (item: AppointmentRecord, methods: AccountPaymentMethods, servicePrice: number | null = null) =>
  evaluatePaymentReminderEligibility(item, {
    getMethods: async () => methods,
    getAmount: async (a) => resolveAppointmentAmount(a, async () => (servicePrice === null ? null : { price: servicePrice, currency: 'RUB' })),
  });

describe('payment reminder eligibility', () => {
  it('is not eligible when already paid or cancelled', async () => {
    expect(await gate(appointment({ is_paid: true }), bankOnly)).toEqual({ eligible: false, reason: 'paid' });
    expect(await gate(appointment({ status: 'cancelled' }), bankOnly)).toEqual({ eligible: false, reason: 'cancelled' });
  });

  it('is not eligible when the amount is 0 (snapshot and service price)', async () => {
    expect(await gate(appointment({ price: 0 }), bankOnly, 0)).toEqual({ eligible: false, reason: 'no_amount' });
    expect(await gate(appointment({ price: 0 }), bankOnly, null)).toEqual({ eligible: false, reason: 'no_amount' });
  });

  it('falls back to the current service price when the snapshot is 0', async () => {
    const result = await gate(appointment({ price: 0 }), bankOnly, 700);
    expect(result).toMatchObject({ eligible: true, amount: 700 });
  });

  it('requires at least one usable method', async () => {
    expect(await gate(appointment(), noMethods)).toEqual({ eligible: false, reason: 'no_method' });
    // active YooKassa cannot take GEL and there is nothing manual
    expect(await gate(appointment({ currency: 'GEL' }), yookassa)).toEqual({ eligible: false, reason: 'no_method' });
  });

  it('is eligible with an online provider (pay button) or manual methods only', async () => {
    expect(await gate(appointment(), yookassa)).toMatchObject({ eligible: true, payOnline: true });
    expect(await gate(appointment(), bankOnly)).toMatchObject({ eligible: true, payOnline: false });
    expect(await gate(appointment({ currency: 'GEL' }), { ...yookassa, manual: bankOnly.manual })).toMatchObject({ eligible: true, payOnline: false });
  });

  it('builds localized telegram text with pay link and manual details', () => {
    const content = buildPaymentReminderContent({
      locale: 'en',
      amount: 1500,
      currency: 'USD',
      methods: {
        onlineProvider: 'stripe',
        manual: { bankTransfer: { text: 'IBAN 123' }, customLink: { title: 'PayPal', url: 'https://paypal.me/x' }, cash: { comment: 'At the office' } },
      },
      payUrl: 'https://app.test/pay/tok',
    });
    const text = buildTelegramPaymentText(content, 'Dr. Who', 'Friday');
    expect(text).toContain('Payment reminder');
    expect(text).toContain('https://app.test/pay/tok');
    expect(text).toContain('IBAN 123');
    expect(text).toContain('PayPal: https://paypal.me/x');
    expect(text).toContain('At the office');
    expect(text).not.toMatch(/[А-Яа-я]/);

    const ru = buildTelegramPaymentText({ ...content, locale: 'ru', payUrl: null, bankTransferText: null, customLink: null, cashComment: null, hasManual: false }, 'Иван', 'пятница');
    expect(ru).toContain('Напоминание об оплате');
    expect(ru).not.toContain('http');
  });

  it('does not query the database for the snapshot price', async () => {
    const find = vi.fn();
    await resolveAppointmentAmount(appointment(), find);
    expect(find).not.toHaveBeenCalled();
  });
});
