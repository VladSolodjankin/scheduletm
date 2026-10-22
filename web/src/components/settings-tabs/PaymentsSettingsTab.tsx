import { Box, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';

import { paymentsApi } from '../../shared/api/client';
import { useApiErrorResolver } from '../../shared/api/error';
import { rem } from '../../shared/theme/constants';
import type {
  PaymentManualSettings,
  PaymentProviderId,
  PaymentSettings,
} from '../../shared/types/api';
import { AppButton } from '../../shared/ui/AppButton';
import { AppCopyableField } from '../../shared/ui/AppCopyableField';
import { AppForm } from '../../shared/ui/AppForm';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppIntegrationPanel } from '../../shared/ui/AppIntegrationPanel';
import { AppRhfSecretKeyField } from '../../shared/ui/AppRhfSecretKeyField';
import { AppRhfTextField } from '../../shared/ui/AppRhfTextField';
import { AppEmptyState, AppLoadingState, AppStatusMessage } from '../../shared/ui/AppStatus';
import { AppSurface } from '../../shared/ui/AppSurface';
import type { PaymentsCopy } from './paymentsCopy';
import { PAYMENT_PROVIDER_ACCENT, PaymentProviderMonogram } from './PaymentProviderIcons';

export type PaymentsNotification = { severity: 'success' | 'error'; message: string };

type Props = {
  copy: PaymentsCopy;
  accessToken: string;
  onNotify: (notification: PaymentsNotification) => void;
};

type PendingAction =
  | 'manual'
  | 'stripe-connect'
  | 'active'
  | 'test'
  | `save:${PaymentProviderId}`
  | `disconnect:${PaymentProviderId}`;

type CredentialsFormValues = { id: string; secret: string };

const MAX_BANK_TEXT = 1000;
const MAX_LINK_TITLE = 60;
const MAX_LINK_URL = 500;
const MAX_CASH_COMMENT = 500;
const HTTPS_URL_PATTERN = /^https:\/\/\S+$/i;
const MANUAL_FIELD_PATHS: ReadonlyArray<FieldPath<PaymentManualSettings>> = [
  'bankTransfer.text',
  'customLink.title',
  'customLink.url',
  'cash.comment',
];

const EMPTY_MANUAL: PaymentManualSettings = {
  bankTransfer: { enabled: false, text: '' },
  customLink: { enabled: false, title: '', url: '' },
  cash: { enabled: false, comment: '' },
};

function isManualFieldPath(value: string): value is FieldPath<PaymentManualSettings> {
  return (MANUAL_FIELD_PATHS as readonly string[]).includes(value);
}

type ActiveSwitchProps = {
  providerName: string;
  label: string;
  hint: string;
  checked: boolean;
  isConnected: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

function ActiveProviderSwitch({ providerName, label, hint, checked, isConnected, disabled, onChange }: ActiveSwitchProps) {
  return (
    <Stack spacing={0.5}>
      <FormControlLabel
        sx={{ mr: 0 }}
        control={(
          <Switch
            checked={checked}
            disabled={disabled || !isConnected}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{ input: { 'aria-label': `${providerName}: ${label}` } }}
          />
        )}
        label={label}
      />
      {!isConnected ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Stack>
  );
}

type CredentialsProviderCardProps = {
  copy: PaymentsCopy;
  provider: 'yookassa' | 'bog';
  title: string;
  caption: string;
  description: string;
  idLabel: string;
  secretLabel: string;
  isConnected: boolean;
  savedId: string;
  hasSecret: boolean;
  urlLabel: string;
  url: string;
  urlHint: string;
  note?: string;
  isActive: boolean;
  pending: PendingAction | null;
  onSave: (values: CredentialsFormValues) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleActive: (checked: boolean) => void;
};

function CredentialsProviderCard({
  copy,
  provider,
  title,
  caption,
  description,
  idLabel,
  secretLabel,
  isConnected,
  savedId,
  hasSecret,
  urlLabel,
  url,
  urlHint,
  note,
  isActive,
  pending,
  onSave,
  onDisconnect,
  onToggleActive,
}: CredentialsProviderCardProps) {
  const { control, handleSubmit, reset } = useForm<CredentialsFormValues>({
    defaultValues: { id: savedId, secret: '' },
  });

  useEffect(() => {
    reset({ id: savedId, secret: '' });
  }, [reset, savedId, isConnected, hasSecret]);

  const isBusy = pending !== null;

  return (
    <AppIntegrationPanel
      accentColor={PAYMENT_PROVIDER_ACCENT[provider]}
      icon={<PaymentProviderMonogram provider={provider} />}
      statusLabel={isConnected ? copy.connected : copy.notConnected}
      isConnected={isConnected}
      title={title}
      caption={caption}
      description={description}
      actions={(
        <Stack
          component="form"
          spacing={1.5}
          noValidate
          onSubmit={(event) => {
            void handleSubmit(onSave)(event);
          }}
        >
          <Controller
            name="id"
            control={control}
            rules={{ required: copy.errRequired }}
            render={({ field, fieldState }) => (
              <AppRhfTextField
                field={field}
                size="small"
                label={idLabel}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
                autoComplete="off"
              />
            )}
          />
          <Controller
            name="secret"
            control={control}
            rules={{ validate: (value) => (hasSecret || value.trim() ? true : copy.errRequired) }}
            render={({ field, fieldState }) => (
              <AppRhfSecretKeyField
                field={field}
                size="small"
                label={secretLabel}
                placeholder={hasSecret ? '••••••••' : undefined}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message ?? (hasSecret ? copy.secretSaved : undefined)}
                autoComplete="off"
              />
            )}
          />
          <AppCopyableField
            label={urlLabel}
            value={url}
            helperText={urlHint}
            copyLabel={copy.copy}
            copiedLabel={copy.copied}
            copyFailedLabel={copy.copyFailed}
          />
          {note ? (
            <Typography variant="caption" color="text.secondary">
              {note}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', '& > *': { flex: { xs: '1 1 100%', sm: '0 0 auto' } } }}>
            <AppButton type="submit" isLoading={pending === `save:${provider}`} disabled={isBusy}>
              {copy.save}
            </AppButton>
            {isConnected ? (
              <AppButton
                variant="outlined"
                color="error"
                isLoading={pending === `disconnect:${provider}`}
                disabled={isBusy}
                onClick={() => void onDisconnect()}
              >
                {copy.disconnect}
              </AppButton>
            ) : null}
          </Stack>
          <ActiveProviderSwitch
            providerName={title}
            label={copy.useForPayments}
            hint={copy.useForPaymentsHint}
            checked={isActive}
            isConnected={isConnected}
            disabled={isBusy}
            onChange={onToggleActive}
          />
        </Stack>
      )}
    />
  );
}

type ManualRowProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  enabledLabel: string;
  enabledName: FieldPath<PaymentManualSettings>;
  control: Control<PaymentManualSettings>;
  children: ReactNode;
};

function ManualMethodRow({ icon, title, subtitle, enabledLabel, enabledName, control, children }: ManualRowProps) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
              bgcolor: 'action.hover',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
        </Stack>
        <Controller
          name={enabledName}
          control={control}
          render={({ field }) => (
            <FormControlLabel
              sx={{ mr: 0, flexShrink: 0 }}
              control={(
                <Switch
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                  slotProps={{ input: { 'aria-label': `${title}: ${enabledLabel}` } }}
                />
              )}
              label={enabledLabel}
            />
          )}
        />
      </Stack>
      {children}
    </Stack>
  );
}

export function PaymentsSettingsTab({ copy, accessToken, onNotify }: Props) {
  const resolveError = useApiErrorResolver();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [testResult, setTestResult] = useState<PaymentsNotification | null>(null);

  const {
    control: manualControl,
    handleSubmit: handleManualSubmit,
    reset: resetManual,
    setError: setManualError,
    formState: { isDirty: isManualDirty },
  } = useForm<PaymentManualSettings>({ defaultValues: EMPTY_MANUAL });

  const manualEnabled = useWatch({ control: manualControl });
  const bankEnabled = Boolean(manualEnabled.bankTransfer?.enabled);
  const linkEnabled = Boolean(manualEnabled.customLink?.enabled);
  const cashEnabled = Boolean(manualEnabled.cash?.enabled);

  useEffect(() => {
    let isCancelled = false;

    paymentsApi.get(accessToken)
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setSettings(response.data);
        resetManual(response.data.manual);
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accessToken, reloadKey, resetManual]);

  const applySettings = useCallback((next: PaymentSettings) => {
    setSettings(next);
  }, []);

  const describeError = useCallback((
    error: unknown,
    fallback: string,
    overrides: Partial<Record<string, string>> = {},
  ): string => {
    if (isAxiosError<{ code?: string; message?: string }>(error)) {
      const code = error.response?.data?.code;
      const status = error.response?.status;
      const byCode = code ? overrides[code] : undefined;
      if (byCode) {
        return byCode;
      }
      const byStatus = status ? overrides[String(status)] : undefined;
      if (byStatus) {
        return byStatus;
      }
    }
    return resolveError(error, fallback).message;
  }, [resolveError]);

  const runAction = async (
    action: PendingAction,
    request: () => Promise<PaymentSettings>,
    successMessage: string,
    fallbackError: string,
    overrides: Partial<Record<string, string>> = {},
    onFieldErrors?: (fieldErrors: Record<string, string>) => void,
  ): Promise<PaymentSettings | null> => {
    setPending(action);
    try {
      const next = await request();
      applySettings(next);
      onNotify({ severity: 'success', message: successMessage });
      return next;
    } catch (error) {
      if (onFieldErrors) {
        onFieldErrors(resolveError(error, fallbackError).fieldErrors);
      }
      onNotify({
        severity: 'error',
        message: describeError(error, fallbackError, {
          invalid_payload: copy.errInvalidPayload,
          invalid_credentials: copy.errInvalidCredentials,
          provider_unreachable: copy.errProviderUnreachable,
          provider_not_connected: copy.errNotConnected,
          ...overrides,
        }),
      });
      return null;
    } finally {
      setPending(null);
    }
  };

  const connectStripe = async () => {
    setPending('stripe-connect');
    try {
      const response = await paymentsApi.startStripeOAuth(accessToken);
      window.location.assign(response.data.authorizeUrl);
    } catch (error) {
      onNotify({
        severity: 'error',
        message: describeError(error, copy.stripeConnectError, { '503': copy.stripeNotConfigured }),
      });
      setPending(null);
    }
  };

  const saveCredentials = (provider: 'yookassa' | 'bog') => async (values: CredentialsFormValues) => {
    const secret = values.secret.trim();
    const payload = provider === 'yookassa'
      ? { shopId: values.id.trim(), ...(secret ? { secretKey: secret } : {}) }
      : { clientId: values.id.trim(), ...(secret ? { clientSecret: secret } : {}) };
    await runAction(`save:${provider}`, async () => (await paymentsApi.saveProvider(accessToken, provider, payload)).data, copy.saved, copy.errSave);
  };

  const disconnect = (provider: PaymentProviderId) => async () => {
    await runAction(`disconnect:${provider}`, async () => (await paymentsApi.disconnectProvider(accessToken, provider)).data, copy.disconnected, copy.errDisconnect);
  };

  const toggleActive = (provider: PaymentProviderId) => async (checked: boolean) => {
    await runAction('active', async () => (await paymentsApi.setActiveProvider(accessToken, checked ? provider : null)).data, copy.activeChanged, copy.errActive);
  };

  const saveManual = async (values: PaymentManualSettings) => {
    const saved = await runAction(
      'manual',
      async () => (await paymentsApi.updateManual(accessToken, values)).data,
      copy.saved,
      copy.errSave,
      {},
      (fieldErrors) => {
        Object.entries(fieldErrors).forEach(([field, message]) => {
          if (isManualFieldPath(field)) {
            setManualError(field, { type: 'server', message });
          }
        });
      },
    );
    if (saved) {
      resetManual(saved.manual);
    }
  };

  const sendTestReminder = async () => {
    setPending('test');
    setTestResult(null);
    try {
      const response = await paymentsApi.sendTestReminder(accessToken);
      setTestResult({ severity: 'success', message: copy.testReminderSent.replace('{email}', response.data.sentTo) });
    } catch (error) {
      setTestResult({
        severity: 'error',
        message: describeError(error, copy.testReminderFailed, {
          no_payment_method: copy.testReminderNoMethod,
          delivery_failed: copy.testReminderFailed,
          '429': copy.testReminderRateLimited,
        }),
      });
    } finally {
      setPending(null);
    }
  };

  const header = (
    <>
      <Typography variant="h5">{copy.title}</Typography>
      <Typography color="text.secondary" variant="body2">
        {copy.subtitle}
      </Typography>
    </>
  );

  if (isLoading) {
    return <AppLoadingState lines={5} />;
  }

  if (loadFailed || !settings) {
    return (
      <AppEmptyState
        title={copy.loadError}
        action={<AppButton onClick={() => {
          setLoadFailed(false);
          setIsLoading(true);
          setReloadKey((key) => key + 1);
        }}>{copy.retry}</AppButton>}
      />
    );
  }

  const { providers, activeProvider, hasAnyMethod } = settings;
  const isBusy = pending !== null;

  return (
    <Stack spacing={2.5}>
      <AppForm>
        {header}

        {!hasAnyMethod ? <AppStatusMessage severity="warning" message={copy.noMethodWarning} /> : null}

        <Stack spacing={0.5}>
          <Typography variant="h6">{copy.onlineTitle}</Typography>
          <Typography color="text.secondary" variant="body2">
            {copy.onlineSubtitle}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${rem(280)}), 1fr))`,
            alignItems: 'stretch',
          }}
        >
          <AppIntegrationPanel
            accentColor={PAYMENT_PROVIDER_ACCENT.stripe}
            icon={<PaymentProviderMonogram provider="stripe" />}
            statusLabel={providers.stripe.connected ? copy.connected : copy.notConnected}
            isConnected={providers.stripe.connected}
            title="Stripe"
            caption={copy.stripeRegion}
            description={copy.stripeDescription}
            actions={(
              <Stack spacing={1.5}>
                {providers.stripe.connected && providers.stripe.accountId ? (
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {copy.stripeAccount.replace('{id}', providers.stripe.accountId)}
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', '& > *': { flex: { xs: '1 1 100%', sm: '0 0 auto' } } }}>
                  {providers.stripe.connected ? (
                    <AppButton
                      variant="outlined"
                      color="error"
                      isLoading={pending === 'disconnect:stripe'}
                      disabled={isBusy}
                      onClick={() => void disconnect('stripe')()}
                    >
                      {copy.disconnect}
                    </AppButton>
                  ) : (
                    <AppButton isLoading={pending === 'stripe-connect'} disabled={isBusy} onClick={() => void connectStripe()}>
                      {pending === 'stripe-connect' ? copy.connectingStripe : copy.connectStripe}
                    </AppButton>
                  )}
                </Stack>
                <ActiveProviderSwitch
                  providerName="Stripe"
                  label={copy.useForPayments}
                  hint={copy.useForPaymentsHint}
                  checked={activeProvider === 'stripe'}
                  isConnected={providers.stripe.connected}
                  disabled={isBusy}
                  onChange={(checked) => void toggleActive('stripe')(checked)}
                />
              </Stack>
            )}
          />

          <CredentialsProviderCard
            copy={copy}
            provider="yookassa"
            title="YooKassa"
            caption={copy.yookassaRegion}
            description={copy.yookassaDescription}
            idLabel={copy.yookassaShopId}
            secretLabel={copy.yookassaSecretKey}
            isConnected={providers.yookassa.connected}
            savedId={providers.yookassa.shopId ?? ''}
            hasSecret={providers.yookassa.hasSecret}
            urlLabel={copy.webhookUrl}
            url={providers.yookassa.webhookUrl}
            urlHint={copy.webhookHint}
            note={copy.yookassaNoReceipts}
            isActive={activeProvider === 'yookassa'}
            pending={pending}
            onSave={saveCredentials('yookassa')}
            onDisconnect={disconnect('yookassa')}
            onToggleActive={(checked) => void toggleActive('yookassa')(checked)}
          />

          <CredentialsProviderCard
            copy={copy}
            provider="bog"
            title="Bank of Georgia"
            caption={copy.bogRegion}
            description={copy.bogDescription}
            idLabel={copy.bogClientId}
            secretLabel={copy.bogClientSecret}
            isConnected={providers.bog.connected}
            savedId={providers.bog.clientId ?? ''}
            hasSecret={providers.bog.hasSecret}
            urlLabel={copy.callbackUrl}
            url={providers.bog.callbackUrl}
            urlHint={copy.callbackHint}
            isActive={activeProvider === 'bog'}
            pending={pending}
            onSave={saveCredentials('bog')}
            onDisconnect={disconnect('bog')}
            onToggleActive={(checked) => void toggleActive('bog')(checked)}
          />
        </Box>
      </AppForm>

      <AppSurface title={copy.otherTitle} description={copy.otherSubtitle}>
        <Stack
          component="form"
          spacing={2.5}
          noValidate
          onSubmit={(event) => {
            void handleManualSubmit(saveManual)(event);
          }}
        >
          <ManualMethodRow
            icon={<AppIcons.bankTransfer />}
            title={copy.bankTitle}
            subtitle={copy.bankSubtitle}
            enabledLabel={copy.enabled}
            enabledName="bankTransfer.enabled"
            control={manualControl}
          >
            <Controller
              name="bankTransfer.text"
              control={manualControl}
              rules={{
                maxLength: { value: MAX_BANK_TEXT, message: copy.errMaxLength },
                validate: (value, formValues) => (formValues.bankTransfer.enabled && !value.trim() ? copy.errRequired : true),
              }}
              render={({ field, fieldState }) => (
                <AppRhfTextField
                  field={field}
                  label={copy.bankLabel}
                  multiline
                  minRows={3}
                  disabled={!bankEnabled}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message ?? copy.bankHelper}
                  slotProps={{ htmlInput: { maxLength: MAX_BANK_TEXT } }}
                />
              )}
            />
          </ManualMethodRow>

          <Divider />

          <ManualMethodRow
            icon={<AppIcons.paymentLink />}
            title={copy.linkTitle}
            subtitle={copy.linkSubtitle}
            enabledLabel={copy.enabled}
            enabledName="customLink.enabled"
            control={manualControl}
          >
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 2fr)' } }}>
              <Controller
                name="customLink.title"
                control={manualControl}
                rules={{
                  maxLength: { value: MAX_LINK_TITLE, message: copy.errMaxLength },
                  validate: (value, formValues) => (formValues.customLink.enabled && !value.trim() ? copy.errRequired : true),
                }}
                render={({ field, fieldState }) => (
                  <AppRhfTextField
                    field={field}
                    label={copy.linkNameLabel}
                    disabled={!linkEnabled}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message ?? copy.linkNameHelper}
                    slotProps={{ htmlInput: { maxLength: MAX_LINK_TITLE } }}
                  />
                )}
              />
              <Controller
                name="customLink.url"
                control={manualControl}
                rules={{
                  maxLength: { value: MAX_LINK_URL, message: copy.errMaxLength },
                  validate: (value, formValues) => {
                    if (!formValues.customLink.enabled) {
                      return true;
                    }
                    if (!value.trim()) {
                      return copy.errRequired;
                    }
                    return HTTPS_URL_PATTERN.test(value.trim()) ? true : copy.errHttps;
                  },
                }}
                render={({ field, fieldState }) => (
                  <AppRhfTextField
                    field={field}
                    type="url"
                    label={copy.linkUrlLabel}
                    disabled={!linkEnabled}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message ?? copy.linkUrlHelper}
                    slotProps={{ htmlInput: { maxLength: MAX_LINK_URL } }}
                  />
                )}
              />
            </Box>
          </ManualMethodRow>

          <Divider />

          <ManualMethodRow
            icon={<AppIcons.cash />}
            title={copy.cashTitle}
            subtitle={copy.cashSubtitle}
            enabledLabel={copy.enabled}
            enabledName="cash.enabled"
            control={manualControl}
          >
            <Controller
              name="cash.comment"
              control={manualControl}
              rules={{ maxLength: { value: MAX_CASH_COMMENT, message: copy.errMaxLength } }}
              render={({ field, fieldState }) => (
                <AppRhfTextField
                  field={field}
                  label={copy.cashLabel}
                  multiline
                  minRows={2}
                  disabled={!cashEnabled}
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message ?? copy.cashHelper}
                  slotProps={{ htmlInput: { maxLength: MAX_CASH_COMMENT } }}
                />
              )}
            />
          </ManualMethodRow>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <AppButton
              variant="text"
              disabled={isBusy || !isManualDirty}
              onClick={() => resetManual(settings.manual)}
            >
              {copy.cancel}
            </AppButton>
            <AppButton type="submit" isLoading={pending === 'manual'} disabled={isBusy}>
              {copy.saveManual}
            </AppButton>
          </Stack>
        </Stack>
      </AppSurface>

      <AppSurface>
        <Stack spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
          <AppButton
            variant="outlined"
            isLoading={pending === 'test'}
            disabled={isBusy || !hasAnyMethod}
            onClick={() => void sendTestReminder()}
          >
            {copy.testReminder}
          </AppButton>
          {!hasAnyMethod ? (
            <Typography variant="caption" color="text.secondary">
              {copy.testReminderHint}
            </Typography>
          ) : null}
          {testResult ? (
            <Box sx={{ alignSelf: 'stretch' }}>
              <AppStatusMessage severity={testResult.severity} message={testResult.message} />
            </Box>
          ) : null}
        </Stack>
      </AppSurface>
    </Stack>
  );
}
