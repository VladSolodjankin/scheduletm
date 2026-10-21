import { Chip, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { BotQrCode } from '../components/telegram-bot/BotQrCode';
import { telegramBotApi } from '../shared/api/client';
import { useApiErrorResolver } from '../shared/api/error';
import { useAuth } from '../shared/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import type {
  TelegramBotSettings,
  TelegramBotSettingsPayload,
  TelegramCustomBotPayload,
} from '../shared/types/api';
import { AppButton } from '../shared/ui/AppButton';
import { AppConfirmDialog } from '../shared/ui/AppDialog';
import { AppIcons } from '../shared/ui/AppIcons';
import { AppLoadingState, AppStatusMessage } from '../shared/ui/AppStatus';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';
import { AppTextField } from '../shared/ui/AppTextField';

const SLUG_PATTERN = /^[a-z0-9_-]{3,40}$/;
const WELCOME_MAX_LENGTH = 500;

function toDraft(settings: TelegramBotSettings): TelegramBotSettingsPayload {
  return { enabled: settings.enabled, slug: settings.slug, welcomeMessage: settings.welcomeMessage };
}

export function TelegramBotContainer() {
  const { accessToken } = useAuth();
  const { t } = useI18n();
  const resolveError = useApiErrorResolver();
  const [saved, setSaved] = useState<TelegramBotSettings | null>(null);
  const [draft, setDraft] = useState<TelegramBotSettingsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isTokenEditorOpen, setIsTokenEditorOpen] = useState(false);
  const [isUpdatingBot, setIsUpdatingBot] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;
    telegramBotApi.get<TelegramBotSettings>(accessToken)
      .then((response) => {
        if (!cancelled) {
          setSaved(response.data);
          setDraft(toDraft(response.data));
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(resolveError(caught, t('telegramBot.loadFailed')).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, resolveError, t]);

  if (isLoading) {
    return (
      <AppPage title={t('telegramBot.title')} subtitle={t('telegramBot.subtitle')} maxWidth={760}>
        <AppLoadingState />
      </AppPage>
    );
  }

  if (!saved || !draft) {
    return (
      <AppPage title={t('telegramBot.title')} subtitle={t('telegramBot.subtitle')} maxWidth={760}>
        {error && <AppStatusMessage severity="error" message={error} />}
      </AppPage>
    );
  }

  const isCustomBot = saved.mode === 'custom';
  const slugValid = SLUG_PATTERN.test(draft.slug);
  const isDirty = draft.enabled !== saved.enabled
    || draft.slug !== saved.slug
    || draft.welcomeMessage !== saved.welcomeMessage;

  const updateDraft = (patch: Partial<TelegramBotSettingsPayload>) => {
    setDraft({ ...draft, ...patch });
    setSuccess('');
  };

  const save = async () => {
    if (!accessToken || !slugValid) {
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await telegramBotApi.update<TelegramBotSettings, TelegramBotSettingsPayload>(
        accessToken,
        draft,
      );
      setSaved(response.data);
      setDraft(toDraft(response.data));
      setSuccess(t('telegramBot.saved'));
      setLinkCopied(false);
    } catch (caught) {
      setError(resolveError(caught, t('telegramBot.saveFailed')).message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateCustomBot = async (customBotToken: string, successMessage: string) => {
    if (!accessToken) {
      return;
    }
    setIsUpdatingBot(true);
    setError('');
    setSuccess('');
    try {
      const response = await telegramBotApi.update<TelegramBotSettings, TelegramCustomBotPayload>(
        accessToken,
        { customBotToken },
      );
      setSaved(response.data);
      setTokenInput('');
      setIsTokenEditorOpen(false);
      setLinkCopied(false);
      setSuccess(successMessage);
    } catch (caught) {
      setError(resolveError(caught, t('telegramBot.ownBotConnectFailed')).message);
    } finally {
      setIsUpdatingBot(false);
      setIsDisconnectOpen(false);
    }
  };

  const connectOwnBot = () => {
    const token = tokenInput.trim();
    if (!token) {
      setError(t('telegramBot.ownBotTokenRequired'));
      return;
    }
    void updateCustomBot(token, t('telegramBot.ownBotConnectedMessage'));
  };

  const copyLink = async () => {
    if (!saved.botLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(saved.botLink);
      setLinkCopied(true);
    } catch {
      setError(t('telegramBot.copyFailed'));
    }
  };

  const linkActions = (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
      <AppButton variant="outlined" startIcon={<AppIcons.copy />} onClick={() => void copyLink()}>
        {t('telegramBot.copyLink')}
      </AppButton>
      <AppButton
        variant="outlined"
        startIcon={<AppIcons.openLink />}
        onClick={() => window.open(saved.botLink ?? '', '_blank', 'noopener,noreferrer')}
      >
        {t('telegramBot.openLink')}
      </AppButton>
    </Stack>
  );

  const tokenEditor = (
    <Stack spacing={1}>
      <AppTextField
        label={t('telegramBot.ownBotTokenLabel')}
        type="password"
        autoComplete="off"
        value={tokenInput}
        onChange={(event) => setTokenInput(event.target.value)}
        helperText={t('telegramBot.ownBotTokenHelper')}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
        <AppButton isLoading={isUpdatingBot} onClick={connectOwnBot}>
          {t('telegramBot.ownBotConnect')}
        </AppButton>
        {isCustomBot && (
          <AppButton
            variant="text"
            onClick={() => {
              setIsTokenEditorOpen(false);
              setTokenInput('');
            }}
          >
            {t('telegramBot.ownBotCancel')}
          </AppButton>
        )}
      </Stack>
    </Stack>
  );

  return (
    <AppPage title={t('telegramBot.title')} subtitle={t('telegramBot.subtitle')} maxWidth={760}>
      <Stack spacing={2}>
        {error && <AppStatusMessage severity="error" message={error} />}
        {success && <AppStatusMessage severity="success" message={success} />}

        <AppSurface title={t('telegramBot.statusTitle')}>
          <FormControlLabel
            control={(
              <Switch
                checked={draft.enabled}
                onChange={(event) => updateDraft({ enabled: event.target.checked })}
              />
            )}
            label={t('telegramBot.enabledLabel')}
          />
          <Typography variant="body2" color="text.secondary">{t('telegramBot.enabledHint')}</Typography>
        </AppSurface>

        {isCustomBot ? (
          <AppSurface
            title={t('telegramBot.ownBotConnectedTitle')}
            action={<Chip size="small" color="success" label={t('telegramBot.ownBotConnectedBadge')} />}
            sx={{ borderColor: 'primary.main', borderWidth: 2 }}
          >
            <Typography variant="body1">
              {saved.customBot?.name ?? ''}
              {saved.customBot?.username ? ` (@${saved.customBot.username})` : ''}
            </Typography>
            {saved.botLink && (
              <Stack spacing={1}>
                <AppTextField
                  label={t('telegramBot.linkLabel')}
                  value={saved.botLink}
                  slotProps={{ input: { readOnly: true } }}
                />
                {linkActions}
                {linkCopied && <AppStatusMessage severity="success" message={t('telegramBot.linkCopied')} />}
                <BotQrCode link={saved.botLink} />
              </Stack>
            )}
            <Typography variant="body2" color="text.secondary">{t('telegramBot.ownBotNoSlugHint')}</Typography>
            {isTokenEditorOpen && tokenEditor}
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
              {!isTokenEditorOpen && (
                <AppButton variant="outlined" onClick={() => setIsTokenEditorOpen(true)}>
                  {t('telegramBot.ownBotChangeToken')}
                </AppButton>
              )}
              <AppButton variant="outlined" color="error" onClick={() => setIsDisconnectOpen(true)}>
                {t('telegramBot.ownBotDisconnect')}
              </AppButton>
            </Stack>
          </AppSurface>
        ) : (
          <>
            <AppSurface title={t('telegramBot.linkTitle')}>
              <AppTextField
                label={t('telegramBot.slugLabel')}
                value={draft.slug}
                onChange={(event) => updateDraft({ slug: event.target.value.trim().toLowerCase() })}
                error={!slugValid}
                helperText={slugValid ? t('telegramBot.slugHelper') : t('telegramBot.slugInvalid')}
                slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              {saved.botLink ? (
                <Stack spacing={1}>
                  <AppTextField
                    label={t('telegramBot.linkLabel')}
                    value={saved.botLink}
                    slotProps={{ input: { readOnly: true } }}
                  />
                  {isDirty && <Typography variant="body2" color="text.secondary">{t('telegramBot.unsavedLink')}</Typography>}
                  {linkActions}
                  {linkCopied && <AppStatusMessage severity="success" message={t('telegramBot.linkCopied')} />}
                </Stack>
              ) : (
                <AppStatusMessage severity="warning" message={t('telegramBot.linkNotConfigured')} />
              )}
            </AppSurface>

            {saved.botLink && (
              <AppSurface title={t('telegramBot.qrTitle')}>
                <BotQrCode link={saved.botLink} />
              </AppSurface>
            )}
          </>
        )}

        <AppSurface title={t('telegramBot.welcomeTitle')}>
          <AppTextField
            label={t('telegramBot.welcomeLabel')}
            value={draft.welcomeMessage}
            onChange={(event) => updateDraft({ welcomeMessage: event.target.value })}
            multiline
            minRows={3}
            helperText={`${t('telegramBot.welcomeHelper')} ${t('telegramBot.welcomeCounter')
              .replace('{count}', String(draft.welcomeMessage.length))
              .replace('{max}', String(WELCOME_MAX_LENGTH))}`}
            slotProps={{ htmlInput: { maxLength: WELCOME_MAX_LENGTH } }}
          />
        </AppSurface>

        {!isCustomBot && (
          <AppSurface
            title={t('telegramBot.ownBotTitle')}
            action={<Typography variant="caption" color="text.secondary">{t('telegramBot.ownBotOptional')}</Typography>}
            sx={{ borderStyle: 'dashed' }}
          >
            <Typography variant="body2" color="text.secondary">{t('telegramBot.ownBotHint')}</Typography>
            {tokenEditor}
          </AppSurface>
        )}

        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <AppButton
            startIcon={<AppIcons.save />}
            disabled={!isDirty || (!isCustomBot && !slugValid)}
            isLoading={isSaving}
            onClick={() => void save()}
          >
            {t('telegramBot.save')}
          </AppButton>
        </Stack>
      </Stack>

      <AppConfirmDialog
        open={isDisconnectOpen}
        title={t('telegramBot.ownBotDisconnectTitle')}
        description={t('telegramBot.ownBotDisconnectDescription')}
        cancelLabel={t('telegramBot.ownBotCancel')}
        confirmLabel={t('telegramBot.ownBotDisconnect')}
        confirmColor="error"
        isLoading={isUpdatingBot}
        onCancel={() => setIsDisconnectOpen(false)}
        onConfirm={() => void updateCustomBot('', t('telegramBot.ownBotDisconnectedMessage'))}
      />
    </AppPage>
  );
}
