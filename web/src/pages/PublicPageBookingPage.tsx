import { useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { PublicBookingForm } from '../components/public-page-blocks/PublicBookingForm';
import { useI18n } from '../shared/i18n/I18nContext';
import { AppPage } from '../shared/ui/AppPage';
import { AppSurface } from '../shared/ui/AppSurface';

export function PublicPageBookingPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [succeeded, setSucceeded] = useState(false);

  return <AppPage
    title={succeeded ? t('publicBooking.successTitle') : t('publicBooking.title')}
    subtitle={succeeded ? undefined : t('publicBooking.subtitle')}
    maxWidth={succeeded ? 640 : 720}
  >
    <AppSurface>
      <PublicBookingForm
        slug={slug}
        initialServiceId={searchParams.get('service') ?? undefined}
        initialSpecialistId={searchParams.get('specialist') ?? undefined}
        onSuccess={() => setSucceeded(true)}
      />
    </AppSurface>
  </AppPage>;
}
