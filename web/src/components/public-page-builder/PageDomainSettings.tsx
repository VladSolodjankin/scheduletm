import { Alert, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { PublicPageDomain } from '@scheduletm/shared/public-page-domain';
import { PublicPageRepositoryError } from '../../features/public-page-builder/repository/PublicPageRepository';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { Locale } from '../../shared/i18n/dictionaries';
import { publicPageText } from './uiText';

type DomainError = 'invalid' | 'taken' | 'failed';

/** Serves the page from the owner's own domain once the domain's DNS points at Meetli. */
export function PageDomainSettings({ pageId, locale, repository }: {
  pageId: string;
  locale: Locale;
  repository: ApiPublicPageRepository;
}) {
  const [domain, setDomain] = useState<PublicPageDomain | null | undefined>(undefined);
  const [input, setInput] = useState('');
  const [error, setError] = useState<DomainError | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let current = true;
    repository.getDomain(pageId)
      .then((loaded) => { if (current) {setDomain(loaded);} })
      .catch(() => { if (current) {setError('failed');} });
    return () => { current = false; };
  }, [pageId, repository]);

  const run = async (action: () => Promise<PublicPageDomain | null>) => {
    setPending(true);
    setError(null);
    try {
      setDomain(await action());
    } catch (caught) {
      const code = caught instanceof PublicPageRepositoryError ? caught.code : null;
      setError(code === 'invalid_domain' ? 'invalid' : code === 'domain_conflict' ? 'taken' : 'failed');
    } finally {
      setPending(false);
    }
  };

  if (domain === undefined && !error) {return null;}
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{publicPageText(locale, 'customDomain')}</Typography>
      {error ? <Alert severity="error">{publicPageText(locale, error === 'invalid' ? 'domainInvalid' : error === 'taken' ? 'domainTaken' : 'domainError')}</Alert> : null}
      {domain ? (
        <>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{domain.domain}</Typography>
            <Chip size="small" color={domain.verified ? 'success' : 'default'}
              label={publicPageText(locale, domain.verified ? 'domainConnected' : 'domainPending')} />
          </Stack>
          {domain.verified ? null : (
            <Typography variant="body2" color="text.secondary">
              {publicPageText(locale, 'domainInstruction').replace('{domain}', domain.domain).replace('{target}', domain.target)}
            </Typography>
          )}
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {domain.verified ? null : (
              <Button variant="contained" size="small" disabled={pending} onClick={() => void run(() => repository.verifyDomain(pageId))}>
                {publicPageText(locale, 'domainCheck')}
              </Button>
            )}
            <Button size="small" color="inherit" disabled={pending} onClick={() => void run(async () => { await repository.removeDomain(pageId); return null; })}>
              {publicPageText(locale, 'domainRemove')}
            </Button>
          </Stack>
        </>
      ) : (
        <Stack direction="row" sx={{ gap: 1 }}>
          <TextField size="small" fullWidth value={input} placeholder="example.com" disabled={pending}
            slotProps={{ htmlInput: { 'aria-label': publicPageText(locale, 'customDomain') } }}
            onChange={(event) => setInput(event.target.value)} />
          <Button variant="contained" size="small" disabled={pending || !input.trim()}
            onClick={() => void run(() => repository.setDomain(pageId, input))}>
            {publicPageText(locale, 'domainConnect')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
