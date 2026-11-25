import { useState } from 'react';
import { AppButton } from '../../shared/ui/AppButton';
import { AppDialog } from '../../shared/ui/AppDialog';
import { AppStatusMessage } from '../../shared/ui/AppStatus';
import {
  ServiceAssignmentsEditor,
  createAssignmentDraft,
  getChangedAssignmentDrafts,
  hasInvalidAssignmentDrafts,
  toAssignmentPayload,
  type AssignmentDraft,
} from './ServiceAssignmentsEditor';
import type { AssignmentChange, ServiceCatalogItem } from './types';
import { useI18n } from '../../shared/i18n/I18nContext';

type Props = {
  open: boolean;
  service: ServiceCatalogItem;
  isSaving: boolean;
  saveError: string;
  onClose: () => void;
  onSubmit: (changes: AssignmentChange[]) => Promise<boolean>;
};

/** Lets a specialist without catalog permissions adjust their own availability and pricing for one service. */
export function ServicePricingDialog({ open, service, isSaving, saveError, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<AssignmentDraft[]>(() => service.assignments
    .filter((assignment) => assignment.canEdit === true)
    .map((assignment) => createAssignmentDraft(
      assignment.specialistId,
      assignment.specialistName,
      assignment,
      assignment.isActive,
      true,
    )));
  const changed = getChangedAssignmentDrafts(drafts);
  const invalid = hasInvalidAssignmentDrafts(drafts);

  return (
    <AppDialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      maxWidth="sm"
      title={service.name}
      description={t('services.assignmentsHelper')}
      actions={(
        <>
          <AppButton variant="text" onClick={onClose} disabled={isSaving}>{t('common.cancel')}</AppButton>
          <AppButton
            isLoading={isSaving}
            disabled={invalid || !changed.length}
            onClick={() => void onSubmit(changed.map((draft) => ({ specialistId: draft.specialistId, ...toAssignmentPayload(draft) })))
              .then((saved) => saved && onClose())}
          >
            {t('services.save')}
          </AppButton>
        </>
      )}
    >
      {saveError ? <AppStatusMessage severity="error" message={saveError} /> : null}
      <ServiceAssignmentsEditor
        drafts={drafts}
        basePrice={service.basePrice}
        baseDurationMinutes={service.baseDurationMinutes}
        disabled={isSaving}
        onChange={setDrafts}
      />
    </AppDialog>
  );
}
