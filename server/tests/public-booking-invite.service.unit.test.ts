import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const findByClientMock = vi.hoisted(() => vi.fn());
const findByEmailAnyAccountMock = vi.hoisted(() => vi.fn());
const createWebUserMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const updateAuthStateMock = vi.hoisted(() => vi.fn());
const sendInviteEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/webUserRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  );
  return {
    ...actual,
    findWebUserByAccountAndClientId: findByClientMock,
    findWebUserByEmailAnyAccount: findByEmailAnyAccountMock,
    createWebUser: createWebUserMock,
    updateWebUserProfile: updateProfileMock,
    updateWebUserAuthState: updateAuthStateMock,
  };
});
vi.mock('../src/services/emailDeliveryService.js', () => ({
  sendManagedUserInviteEmail: sendInviteEmailMock,
}));

const { ensurePublicBookingClientInvite } = await import('../src/services/publicBookingInviteService.js');

const baseInput = {
  accountId: 7,
  clientId: 42,
  email: 'Guest@Example.com',
  firstName: 'Guest',
  lastName: 'User',
};

describe('ensurePublicBookingClientInvite', () => {
  beforeEach(() => {
    findByClientMock.mockReset().mockResolvedValue(null);
    findByEmailAnyAccountMock.mockReset().mockResolvedValue(null);
    createWebUserMock.mockReset().mockResolvedValue({ id: 500 });
    updateProfileMock.mockReset().mockResolvedValue(undefined);
    updateAuthStateMock.mockReset().mockResolvedValue(undefined);
    sendInviteEmailMock.mockReset().mockResolvedValue(true);
  });

  it('does nothing when a web user is already linked to this client', async () => {
    findByClientMock.mockResolvedValue({ id: 1, account_id: 7 });

    await ensurePublicBookingClientInvite(baseInput);

    expect(createWebUserMock).not.toHaveBeenCalled();
    expect(sendInviteEmailMock).not.toHaveBeenCalled();
  });

  it('does nothing when the email already belongs to a different account', async () => {
    findByEmailAnyAccountMock.mockResolvedValue({ id: 9, account_id: 999 });

    await ensurePublicBookingClientInvite(baseInput);

    expect(createWebUserMock).not.toHaveBeenCalled();
    expect(updateProfileMock).not.toHaveBeenCalled();
    expect(sendInviteEmailMock).not.toHaveBeenCalled();
  });

  it('links a verified same-account user without re-sending an invite', async () => {
    findByEmailAnyAccountMock.mockResolvedValue({
      id: 9, account_id: 7, client_id: null, email_verified_at: new Date(), password_salt: 'salt',
    });

    await ensurePublicBookingClientInvite(baseInput);

    expect(updateProfileMock).toHaveBeenCalledWith({ accountId: 7, id: 9, clientId: 42 });
    expect(sendInviteEmailMock).not.toHaveBeenCalled();
  });

  it('re-sends an invite to an unverified same-account user and links the client', async () => {
    findByEmailAnyAccountMock.mockResolvedValue({
      id: 9, account_id: 7, client_id: null, email_verified_at: null, password_salt: 'salt',
    });

    await ensurePublicBookingClientInvite(baseInput);

    expect(updateProfileMock).toHaveBeenCalledWith(expect.objectContaining({ accountId: 7, id: 9, clientId: 42 }));
    expect(updateAuthStateMock).toHaveBeenCalledWith(expect.objectContaining({ accountId: 7, id: 9 }));
    expect(sendInviteEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'guest@example.com' }));
  });

  it('creates a new inactive client web user and sends an invite', async () => {
    await ensurePublicBookingClientInvite(baseInput);

    expect(createWebUserMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7, email: 'guest@example.com', role: WebUserRole.Client, isActive: false,
    }));
    expect(updateProfileMock).toHaveBeenCalledWith({ accountId: 7, id: 500, clientId: 42 });
    expect(sendInviteEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'guest@example.com', firstName: 'Guest' }));
  });
});
