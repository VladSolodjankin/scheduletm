import { Box, Stack, Typography } from '@mui/material';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppStatusMessage } from '../../shared/ui/AppStatus';

type BotQrCodeProps = {
  link: string;
};

type QrAssets = { link: string; png: string; svg: string };

const QR_WIDTH_PX = 512;
const QR_MARGIN_MODULES = 2;
const FILE_BASENAME = 'telegram-bot-qr';

function canCopyImage() {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
}

function canCopyText() {
  return typeof navigator.clipboard?.writeText === 'function';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BotQrCode({ link }: BotQrCodeProps) {
  const { t } = useI18n();
  const [generated, setGenerated] = useState<QrAssets | null>(null);
  const [failedLink, setFailedLink] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ link: string; severity: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const options = { margin: QR_MARGIN_MODULES, width: QR_WIDTH_PX };
    Promise.all([QRCode.toDataURL(link, options), QRCode.toString(link, { ...options, type: 'svg' })])
      .then(([png, svg]) => {
        if (!cancelled) {
          setGenerated({ link, png, svg });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailedLink(link);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [link]);

  // Results belong to the link they were generated for, so a stale QR is never shown for a new link.
  const assets = generated?.link === link ? generated : null;
  const visibleFeedback = feedback?.link === link ? feedback : null;

  if (failedLink === link) {
    return <AppStatusMessage severity="error" message={t('telegramBot.qrFailed')} />;
  }

  if (!assets) {
    return null;
  }

  const downloadPng = async () => {
    downloadBlob(await (await fetch(assets.png)).blob(), `${FILE_BASENAME}.png`);
  };

  const downloadSvg = () => {
    downloadBlob(new Blob([assets.svg], { type: 'image/svg+xml' }), `${FILE_BASENAME}.svg`);
  };

  const copyImage = async () => {
    try {
      const blob = await (await fetch(assets.png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setFeedback({ link, severity: 'success', message: t('telegramBot.imageCopied') });
    } catch {
      setFeedback({ link, severity: 'error', message: t('telegramBot.copyFailed') });
    }
  };

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(assets.svg);
      setFeedback({ link, severity: 'success', message: t('telegramBot.svgCopied') });
    } catch {
      setFeedback({ link, severity: 'error', message: t('telegramBot.copyFailed') });
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">{t('telegramBot.qrHint')}</Typography>
      <Box
        component="img"
        src={assets.png}
        alt={t('telegramBot.qrAlt')}
        sx={{ width: 220, height: 220, maxWidth: '100%', bgcolor: '#fff', borderRadius: 1, alignSelf: 'flex-start' }}
      />
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
        <AppButton variant="outlined" onClick={() => void downloadPng()}>{t('telegramBot.downloadPng')}</AppButton>
        <AppButton variant="outlined" onClick={downloadSvg}>{t('telegramBot.downloadSvg')}</AppButton>
        {canCopyImage() && (
          <AppButton variant="outlined" startIcon={<AppIcons.copy />} onClick={() => void copyImage()}>
            {t('telegramBot.copyImage')}
          </AppButton>
        )}
        {canCopyText() && (
          <AppButton variant="outlined" startIcon={<AppIcons.copy />} onClick={() => void copySvg()}>
            {t('telegramBot.copySvg')}
          </AppButton>
        )}
      </Stack>
      {visibleFeedback && <AppStatusMessage severity={visibleFeedback.severity} message={visibleFeedback.message} />}
    </Stack>
  );
}
