import { Delete, Upload } from '@mui/icons-material';
import { Alert, Box, Button, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { MediaReference } from '../../features/public-page-builder/types/publicPage';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function ImageUploadControl({ label, media, previewUrl, repository, onUploaded, onAltChange, onRemoved,
  uploadLabel, replaceLabel, removeLabel, altLabel, invalidTypeText, tooLargeText, uploadErrorText, compact = false, defaultAlt = '',
}: {
  label: string; media: MediaReference | null; previewUrl?: string; repository: ApiPublicPageRepository;
  onUploaded: (media: MediaReference, objectUrl: string) => void; onRemoved: () => void;
  onAltChange: (media: MediaReference) => void;
  uploadLabel: string; replaceLabel: string; removeLabel: string; altLabel: string;
  invalidTypeText: string; tooLargeText: string; uploadErrorText: string;
  compact?: boolean; defaultAlt?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [alt, setAlt] = useState(media?.alt || defaultAlt);
  const upload = async (file?: File) => {
    if (!file) {return;}
    if (!ACCEPTED.has(file.type)) {setError(invalidTypeText); return;}
    if (file.size > MAX_BYTES) {setError(tooLargeText); return;}
    setError(''); setProgress(0);
    try {
      const uploaded = await repository.uploadMedia(file, setProgress);
      const uploadedAlt = alt.trim() || uploaded.alt.trim() || defaultAlt.trim() || label.trim() || file.name;
      onUploaded({ ...uploaded, alt: uploadedAlt }, URL.createObjectURL(file));
    } catch { setError(uploadErrorText); }
    finally { setProgress(null); if (inputRef.current) {inputRef.current.value = '';} }
  };
  return <Stack spacing={1}>
    <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp"
      onChange={(event) => void upload(event.target.files?.[0])} />
    {compact ? <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        {label ? <Typography variant="subtitle2">{label}</Typography> : <Box />}
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {(previewUrl || media?.url) ? <Box component="img" src={previewUrl ?? media?.url} alt=""
            sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider' }} /> : null}
          <Button size="small" startIcon={<Upload />} disabled={progress !== null} onClick={() => inputRef.current?.click()}>
            {media ? replaceLabel : uploadLabel}
          </Button>
          {media ? <Button size="small" color="error" aria-label={removeLabel} onClick={onRemoved} sx={{ minWidth: 36, px: 0.75 }}><Delete fontSize="small" /></Button> : null}
        </Stack>
      </Stack>
      {media ? <TextField size="small" fullWidth label={altLabel} value={alt} onChange={(event) => setAlt(event.target.value)}
        onBlur={() => onAltChange({ ...media, alt: alt.trim() || defaultAlt.trim() || label.trim() })} /> : null}
    </Stack> : <>
    <Typography variant="subtitle2">{label}</Typography>
    {(previewUrl || media?.url) ? <Box component="img" src={previewUrl ?? media?.url} alt={alt}
      sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 1 }} /> : null}
    {media ? <TextField size="small" label={altLabel} value={alt} onChange={(event) => setAlt(event.target.value)}
      onBlur={() => onAltChange({ ...media, alt })} /> : null}
    <Stack direction="row" spacing={1}>
      <Button size="small" startIcon={<Upload />} disabled={progress !== null} onClick={() => inputRef.current?.click()}>
        {media ? replaceLabel : uploadLabel}
      </Button>
      {media ? <Button size="small" color="error" startIcon={<Delete />} onClick={onRemoved}>{removeLabel}</Button> : null}
    </Stack>
    </>}
    {progress !== null ? <LinearProgress variant="determinate" value={progress} /> : null}
    {error ? <Alert severity="error">{error}</Alert> : null}
  </Stack>;
}
