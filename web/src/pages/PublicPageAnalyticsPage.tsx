import { ArrowBack } from '@mui/icons-material';
import { Alert, Box, Card, CardContent, CircularProgress, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PUBLIC_PAGE_ANALYTICS_PERIODS, type PublicPageAnalytics, type PublicPageAnalyticsPeriod } from '@scheduletm/shared/public-page-analytics';
import { useI18n } from '../shared/i18n/I18nContext';
import { publicPageText } from '../components/public-page-builder/uiText';
import { ApiPublicPageRepository } from '../features/public-page-builder/repository/ApiPublicPageRepository';
import { getBlockDefinition } from '../features/public-page-builder/model/blockRegistry';
import { registerPublicPageBlocks } from '../features/public-page-builder/config/registerBlocks';
import type { PublicPageDocument } from '../features/public-page-builder/types/publicPage';

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
        {rows.length === 0 ? <Typography color="text.secondary">{publicPageText(locale, 'analyticsNoData')}</Typography> : (
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
    if (!block) {return publicPageText(locale, 'analyticsRemovedBlock');}
    return block.name || getBlockDefinition(block.type)?.localizedName?.(locale) || block.type;
  };

  const analytics = loaded?.analytics;
  const clickRate = analytics && analytics.totals.views > 0
    ? `${Math.round((analytics.totals.clicks / analytics.totals.views) * 100)}%` : '-';
  return (
    <Stack spacing={3} sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <IconButton aria-label={publicPageText(locale, 'back')} onClick={() => navigate('/public-pages')}><ArrowBack /></IconButton>
        <Typography variant="h5" component="h1" sx={{ flex: 1 }}>
          {publicPageText(locale, 'analytics')}{loaded ? ` · ${loaded.title}` : ''}
        </Typography>
        <ToggleButtonGroup exclusive size="small" value={days} onChange={(_event, next: PublicPageAnalyticsPeriod | null) => { if (next) {setDays(next);} }}
          aria-label={publicPageText(locale, 'analyticsPeriodLabel')}>
          {PUBLIC_PAGE_ANALYTICS_PERIODS.map((period) => (
            <ToggleButton key={period} value={period}>{publicPageText(locale, 'analyticsPeriod').replace('{days}', String(period))}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {failed ? <Alert severity="error">{publicPageText(locale, 'analyticsLoadError')}</Alert> : null}
      {!analytics && !failed ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : null}
      {analytics ? (
        <>
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <StatCard label={publicPageText(locale, 'analyticsViews')} value={String(analytics.totals.views)} />
            <StatCard label={publicPageText(locale, 'analyticsClicks')} value={String(analytics.totals.clicks)} />
            <StatCard label={publicPageText(locale, 'analyticsClickRate')} value={clickRate} />
          </Stack>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>{publicPageText(locale, 'analyticsDaily')}</Typography>
              <DailyBars daily={analytics.daily} label={publicPageText(locale, 'analyticsDaily')} />
            </CardContent>
          </Card>
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Ranking title={publicPageText(locale, 'analyticsBlocks')}
              rows={analytics.blocks.map(({ blockId, clicks }) => ({ key: blockId, label: blockLabel(blockId), count: clicks }))} />
            <Ranking title={publicPageText(locale, 'analyticsSources')}
              rows={analytics.sources.map(({ source, views }) => ({ key: source || 'direct', label: source || publicPageText(locale, 'analyticsDirect'), count: views }))} />
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
