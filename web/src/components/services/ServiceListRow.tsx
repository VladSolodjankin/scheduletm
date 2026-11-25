import { AppIcons } from '../../shared/ui/AppIcons';
import { AppAvatarStack, AppListRow, AppListThumb } from '../../shared/ui/AppList';
import { AppStatusBadge } from '../../shared/ui/AppStatus';
import { formatMoney } from '../../shared/utils/money';
import { formatServiceDuration } from './format';
import type { ServiceCatalogItem } from './types';
import './services.css';
import { useI18n } from '../../shared/i18n/I18nContext';

type Props = {
  service: ServiceCatalogItem;
  canManage: boolean;
  isMutating: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

export function ServiceListRow({
  service,
  canManage,
  isMutating,
  onOpen,
  onArchive,
  onRestore,
  onDelete,
}: Props) {
  const { t, locale } = useI18n();
  const activeAssignments = service.assignments.filter((assignment) => assignment.isActive);
  const customCount = activeAssignments.filter((assignment) => (
    assignment.priceOverride !== null || assignment.durationOverrideMinutes !== null
  )).length;
  const canOpen = canManage || service.assignments.some((assignment) => assignment.canEdit === true);

  return (
    <AppListRow
      className="service-row"
      muted={!service.isActive}
      media={<AppListThumb src={service.imageUrl} alt={service.name} />}
      title={service.name}
      badges={(
        <>
          {!service.isActive ? <AppStatusBadge label={t('services.archived')} tone="neutral" /> : null}
          {service.firstSessionFree ? <AppStatusBadge label={t('services.firstSessionFree')} tone="info" /> : null}
        </>
      )}
      subtitle={(
        <>
          <span className="service-row__price">{formatMoney(service.basePrice, 'RUB', locale)}</span>
          {' · '}
          {formatServiceDuration(service.baseDurationMinutes, t)}
          {customCount ? (
            <AppStatusBadge
              className="service-row__custom"
              label={t('services.customCount').replace('{count}', String(customCount))}
              tone="warning"
            />
          ) : null}
        </>
      )}
      trailing={activeAssignments.length ? (
        <AppAvatarStack names={activeAssignments.map((assignment) => assignment.specialistName)} />
      ) : null}
      onClick={canOpen ? onOpen : undefined}
      actionsLabel={t('common.moreActions')}
      actionsDisabled={isMutating}
      actions={canManage ? [
        { key: 'edit', label: t('services.edit'), icon: <AppIcons.edit fontSize="small" />, onClick: onOpen },
        service.isActive
          ? { key: 'archive', label: t('services.archive'), icon: <AppIcons.archive fontSize="small" />, onClick: onArchive }
          : { key: 'restore', label: t('services.restore'), icon: <AppIcons.restore fontSize="small" />, onClick: onRestore },
        { key: 'delete', label: t('services.deletePermanently'), icon: <AppIcons.delete fontSize="small" />, danger: true, onClick: onDelete },
      ] : undefined}
    />
  );
}
