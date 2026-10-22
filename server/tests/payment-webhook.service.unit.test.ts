import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleWebhookMock = vi.hoisted(() => vi.fn());
const findByTokenHashMock = vi.hoisted(() => vi.fn());
const findProviderMock = vi.hoisted(() => vi.fn());
const findOrderMock = vi.hoisted(() => vi.fn());
const beginMock = vi.hoisted(() => vi.fn());
const settleMock = vi.hoisted(() => vi.fn());
const markProcessedMock = vi.hoisted(() => vi.fn());
const releaseMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/payments/registry.js', () => ({ getPaymentAdapter: () => ({ handleWebhook: handleWebhookMock }) }));
vi.mock('../src/repositories/accountPaymentRepository.js', () => ({
  findAccountPaymentProviderByWebhookTokenHash: findByTokenHashMock,
  findAccountPaymentProvider: findProviderMock,
}));
vi.mock('../src/repositories/paymentOrderRepository.js', () => ({
  findOrderByProviderOrderId: findOrderMock,
  beginProcessingPaymentWebhookEvent: beginMock,
  settleOrder: settleMock,
  markProcessedPaymentWebhookEvent: markProcessedMock,
  releaseProcessingPaymentWebhookEvent: releaseMock,
}));
vi.mock('../src/services/paymentSettingsService.js', () => ({
  toProviderCredentials: (record: { account_id: number }) => ({ accountId: record.account_id, config: {}, secret: 's' }),
}));

const { processPaymentWebhook } = await import('../src/services/paymentWebhookService.js');
const { InvalidSignatureError } = await import('../src/services/payments/types.js');

const rawBody = Buffer.from('{}');
const event = { eventId: 'e1', orderRef: 'o1', status: 'succeeded', amount: 1500, currency: 'RUB' };

describe('payment webhook pipeline', () => {
  beforeEach(() => {
    for (const mock of [handleWebhookMock, findByTokenHashMock, findProviderMock, findOrderMock, beginMock, settleMock, markProcessedMock, releaseMock]) {
      mock.mockReset();
    }
    findByTokenHashMock.mockResolvedValue({ account_id: 7 });
    handleWebhookMock.mockResolvedValue(event);
    findOrderMock.mockResolvedValue({ id: 3, account_id: 7 });
    beginMock.mockResolvedValue({ status: 'acquired', processingToken: 'lease' });
    settleMock.mockResolvedValue({ result: 'paid', order: { id: 3 } });
  });

  it('settles the order from our own row and marks the event processed', async () => {
    const outcome = await processPaymentWebhook({ provider: 'yookassa', rawBody, headers: {}, accountToken: 'tok' });
    expect(outcome).toEqual({ kind: 'processed', result: 'paid' });
    expect(settleMock).toHaveBeenCalledWith({ provider: 'yookassa', providerOrderId: 'o1', outcome: 'succeeded', amount: 1500, currency: 'RUB' });
    expect(markProcessedMock).toHaveBeenCalledWith('yookassa', 'e1', 'lease');
  });

  it('answers unknown tokens without touching anything', async () => {
    findByTokenHashMock.mockResolvedValue(null);
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'bad' })).toEqual({ kind: 'unknown_account' });
    expect(handleWebhookMock).not.toHaveBeenCalled();
    expect(settleMock).not.toHaveBeenCalled();
  });

  it('propagates an invalid signature and changes nothing', async () => {
    handleWebhookMock.mockRejectedValue(new InvalidSignatureError());
    await expect(processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).rejects.toBeInstanceOf(InvalidSignatureError);
    expect(beginMock).not.toHaveBeenCalled();
    expect(settleMock).not.toHaveBeenCalled();
  });

  it('ignores orders that belong to a different account than the URL token', async () => {
    findOrderMock.mockResolvedValue({ id: 3, account_id: 99 });
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).toEqual({ kind: 'ignored' });
    expect(settleMock).not.toHaveBeenCalled();
  });

  it('asks the provider to retry when a verified event references an order we do not have yet', async () => {
    findOrderMock.mockResolvedValue(null);
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).toEqual({ kind: 'order_not_found' });
    expect(beginMock).not.toHaveBeenCalled();
  });

  it('ignores irrelevant events', async () => {
    handleWebhookMock.mockResolvedValue(null);
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).toEqual({ kind: 'ignored' });
  });

  it('skips duplicate deliveries (processed or in flight)', async () => {
    beginMock.mockResolvedValue({ status: 'processed' });
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).toEqual({ kind: 'duplicate_event' });
    beginMock.mockResolvedValue({ status: 'active' });
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).toEqual({ kind: 'duplicate_event' });
    expect(settleMock).not.toHaveBeenCalled();
  });

  it('reports a mismatch outcome and releases the lease when settling throws', async () => {
    settleMock.mockResolvedValueOnce({ result: 'mismatch', order: { id: 3 } });
    expect(await processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).toEqual({ kind: 'processed', result: 'mismatch' });

    settleMock.mockRejectedValueOnce(new Error('db down'));
    await expect(processPaymentWebhook({ provider: 'bog', rawBody, headers: {}, accountToken: 'tok' })).rejects.toThrow('db down');
    expect(releaseMock).toHaveBeenCalledWith('bog', 'e1', 'lease');
  });

  it('requires the event account to match the connected Stripe account', async () => {
    handleWebhookMock.mockResolvedValue({ ...event, providerAccountId: 'acct_other' });
    findProviderMock.mockResolvedValue({ config_json: { accountId: 'acct_mine' } });
    expect(await processPaymentWebhook({ provider: 'stripe', rawBody, headers: {} })).toEqual({ kind: 'ignored' });
    expect(settleMock).not.toHaveBeenCalled();

    handleWebhookMock.mockResolvedValue({ ...event, providerAccountId: 'acct_mine' });
    expect(await processPaymentWebhook({ provider: 'stripe', rawBody, headers: {} })).toEqual({ kind: 'processed', result: 'paid' });
  });
});
