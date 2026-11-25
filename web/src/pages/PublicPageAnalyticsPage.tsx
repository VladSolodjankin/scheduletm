import { ArrowBack } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PUBLIC_PAGE_ANALYTICS_PERIODS, type PublicPageAnalytics, type PublicPageAnalyticsPeriod } from '@meetli/shared/public-page-analytics';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import { getBlockDefinition } from '../features/public-page-builder/model/blockRegistry';
import { registerPublicPageBlocks } from '../features/public-page-builder/config/registerBlocks';
import type { PublicPageDocument } from '../features/public-page-builder/types/publicPage';
import { translate } from '../shared/i18n/translate';

registerPublicPageBlocks();

type Loaded = { analytics: PublicPageAnalytics; document: PublicPageDocument; title: string };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" component="p">{value}</Typography>
      </CardContent>
    </Card>
  );
}

function DailyBars({ daily, label }: { daily: PublicPageAnalytics['daily']; label: string }) {
  const peak = Math.max(1, ...daily.map(({ views }) => views));
  return (
    <Box role="img" aria-label={label} sx={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--app-space-xs)', height: 160 }}>
      {daily.map(({ date, views, clicks }) => (
        <Tooltip key={date} title={`${date}: ${views} / ${clicks}`}>
          <Box sx={{ flex: 1, minWidth: 2, height: `${(views / peak) * 100}%`, minHeight: views > 0 ? 2 : 0,
            bgcolor: 'primary.main', borderRadius: 'var(--app-radius-s) var(--app-radius-s) 0 0' }} />
        </Tooltip>
      ))}
    </Box>
  );
}

function Ranking({ title, rows }: { title: string; rows: { key: string; label: string; count: number }[] }) {
  const { locale } = useI18n();
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 260 }}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>{title}</Typography>
        {rows.length === 0 ? <Typography color="text.secondary">{translate(locale, 'publicPageBuilder.analyticsNoData')}</Typography> : (
          <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0, gap: 1 }}>
            {rows.map(({ key, label, count }) => (
              <Stack key={key} component="li" direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography sx={{ overflowWrap: 'anywhere' }}>{label}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{count}</Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export function PublicPageAnalyticsPage() {
  const { pageId = '' } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const [days, setDays] = useState<PublicPageAnalyticsPeriod>(30);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    const repository = new ApiPublicPageRepository('');
    Promise.all([repository.getAnalytics(pageId, days), repository.get(pageId)])
      .then(([analytics, record]) => {
        if (!current) {return;}
        const document = record.published ?? record.draft;
        setFailed(false);
        setLoaded({ analytics, document, title: document.seo.title || document.slug });
      })
      .catch(() => { if (current) {setFailed(true);} });
    return () => { current = false; };
  }, [pageId, days]);

  const blockLabel = (blockId: string) => {
    const block = loaded?.document.sections.flatMap((section) => section.blocks).find(({ id }) => id === blockId);
    if (!block) {return translate(locale, 'publicPageBuilder.analyticsRemovedBlock');}
    return block.name || getBlockDefinition(block.type)?.localizedName?.(locale) || block.type;
  };

  const analytics = loaded?.analytics;
  const clickRate = analytics && analytics.totals.views > 0
    ? `${Math.round((analytics.totals.clicks / analytics.totals.views) * 100)}%` : '-';
  return (
    <AppPage
      title={`${translate(locale, 'publicPageBuilder.analytics')}${loaded ? ` · ${loaded.title}` : ''}`}
      action={(
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="text" startIcon={<ArrowBack />} onClick={() => navigate('/public-pages')}>
            {translate(locale, 'publicPageBuilder.back')}
          </Button>
          <ToggleButtonGroup exclusive size="small" value={days} onChange={(_event, next: PublicPageAnalyticsPeriod | null) => { if (next) {setDays(next);} }}
            aria-label={translate(locale, 'publicPageBuilder.analyticsPeriodLabel')}>
            {PUBLIC_PAGE_ANALYTICS_PERIODS.map((period) => (
              <ToggleButton key={period} value={period}>{translate(locale, 'publicPageBuilder.analyticsPeriod').replace('{days}', String(period))}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      )}
    >
    <Stack spacing={3}>
      {failed ? <Alert severity="error">{translate(locale, 'publicPageBuilder.analyticsLoadError')}</Alert> : null}
      {!analytics && !failed ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : null}
      {analytics ? (
        <>
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <StatCard label={translate(locale, 'publicPageBuilder.analyticsViews')} value={String(analytics.totals.views)} />
            <StatCard label={translate(locale, 'publicPageBuilder.analyticsClicks')} value={String(analytics.totals.clicks)} />
            <StatCard label={translate(locale, 'publicPageBuilder.analyticsClickRate')} value={clickRate} />
          </Stack>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>{translate(locale, 'publicPageBuilder.analyticsDaily')}</Typography>
              <DailyBars daily={analytics.daily} label={translate(locale, 'publicPageBuilder.analyticsDaily')} />
            </CardContent>
          </Card>
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Ranking title={translate(locale, 'publicPageBuilder.analyticsBlocks')}
              rows={analytics.blocks.map(({ blockId, clicks }) => ({ key: blockId, label: blockLabel(blockId), count: clicks }))} />
            <Ranking title={translate(locale, 'publicPageBuilder.analyticsSources')}
              rows={analytics.sources.map(({ source, views }) => ({ key: source || 'direct', label: source || translate(locale, 'publicPageBuilder.analyticsDirect'), count: views }))} />
          </Stack>
        </>
      ) : null}
    </Stack>
    </AppPage>
  );
}
