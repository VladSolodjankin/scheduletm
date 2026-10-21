import type { ChangeEvent } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { SpecialistManagementItem } from "../../shared/types/api";
import { AppButton } from "../../shared/ui/AppButton";
import { useI18n } from "../../shared/i18n/I18nContext";
import { AppDialog } from "../../shared/ui/AppDialog";
import { AppSurface } from "../../shared/ui/AppSurface";
import { AppTextField } from "../../shared/ui/AppTextField";
import { FormContainer } from "../../shared/ui/FormContainer";
import "./specialists.css";

type SpecialistFormDialogProps = {
  open: boolean;
  isSaving: boolean;
  editingSpecialist: SpecialistManagementItem | null;
  title: string;
  saveLabel: string;
  closeLabel: string;
  nameLabel: string;
  activeLabel: string;
  baseSessionPriceLabel: string;
  baseHourPriceLabel: string;
  workStartHourLabel: string;
  workEndHourLabel: string;
  slotDurationMinLabel: string;
  slotStepMinLabel: string;
  defaultSessionContinuationMinLabel: string;
  availableWebUsers: Array<{ id: number; email: string }>;
  onClose: () => void;
  onSubmit: (payload: {
    userId?: number;
    name?: string;
    isActive: boolean;
    baseSessionPrice: number;
    baseHourPrice: number;
    workStartHour: number;
    workEndHour: number;
    slotDurationMin: number;
    slotStepMin: number;
    defaultSessionContinuationMin: number;
  }) => Promise<void> | void;
};

export function SpecialistFormDialog({
  open,
  isSaving,
  editingSpecialist,
  title,
  saveLabel,
  closeLabel,
  nameLabel,
  activeLabel,
  baseSessionPriceLabel,
  baseHourPriceLabel,
  workStartHourLabel,
  workEndHourLabel,
  slotDurationMinLabel,
  slotStepMinLabel,
  defaultSessionContinuationMinLabel,
  availableWebUsers,
  onClose,
  onSubmit,
}: SpecialistFormDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [baseSessionPrice, setBaseSessionPrice] = useState(0);
  const [baseHourPrice, setBaseHourPrice] = useState(0);
  const [workStartHour, setWorkStartHour] = useState(9);
  const [workEndHour, setWorkEndHour] = useState(20);
  const [slotDurationMin, setSlotDurationMin] = useState(90);
  const [slotStepMin, setSlotStepMin] = useState(30);
  const [defaultSessionContinuationMin, setDefaultSessionContinuationMin] =
    useState(60);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setName(editingSpecialist?.name ?? "");
      setIsActive(editingSpecialist?.isActive ?? true);
      setSelectedUserId(0);
      setBaseSessionPrice(editingSpecialist?.baseSessionPrice ?? 0);
      setBaseHourPrice(editingSpecialist?.baseHourPrice ?? 0);
      setWorkStartHour(editingSpecialist?.workStartHour ?? 9);
      setWorkEndHour(editingSpecialist?.workEndHour ?? 20);
      setSlotDurationMin(editingSpecialist?.slotDurationMin ?? 90);
      setSlotStepMin(editingSpecialist?.slotStepMin ?? 30);
      setDefaultSessionContinuationMin(
        editingSpecialist?.defaultSessionContinuationMin ?? 60,
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [editingSpecialist, open]);

  const handleSubmit = async () => {
    if (editingSpecialist && !name.trim()) {
      return;
    }

    if (!editingSpecialist && !selectedUserId) {
      return;
    }

    await onSubmit(
      editingSpecialist
        ? {
            name: name.trim(),
            isActive,
            baseSessionPrice,
            baseHourPrice,
            workStartHour,
            workEndHour,
            slotDurationMin,
            slotStepMin,
            defaultSessionContinuationMin,
          }
        : {
            userId: selectedUserId,
            isActive: true,
            baseSessionPrice,
            baseHourPrice,
            workStartHour,
            workEndHour,
            slotDurationMin,
            slotStepMin,
            defaultSessionContinuationMin,
          },
    );
  };

  const numberField = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    helper?: string,
  ) => (
    <AppTextField
      margin="none"
      fullWidth
      label={label}
      type="number"
      value={value}
      helperText={helper}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
    />
  );

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title={title}
      description={t('settings.specialistSettings.formDescription')}
      actions={(
        <>
          <AppButton variant="text" onClick={onClose}>
            {closeLabel}
          </AppButton>
          <AppButton
            onClick={() => void handleSubmit()}
            isLoading={isSaving}
            disabled={editingSpecialist ? !name.trim() : !selectedUserId}
          >
            {saveLabel}
          </AppButton>
        </>
      )}
    >
      <FormContainer>
        <AppSurface
          title={t('settings.specialistSettings.profileTitle')}
          description={t('settings.specialistSettings.profileDescription')}
        >
          {editingSpecialist ? (
            <AppTextField
              margin="none"
              fullWidth
              label={nameLabel}
              value={name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            />
          ) : (
            <FormControl margin="none" fullWidth>
              <InputLabel id="specialist-user-select-label">{nameLabel}</InputLabel>
              <Select
                labelId="specialist-user-select-label"
                label={nameLabel}
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(Number(event.target.value))}
              >
                {availableWebUsers.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Box className="specialist-form__toggle">
            <FormControlLabel
              control={(
                <Switch
                  checked={isActive}
                  disabled={!editingSpecialist}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
              )}
              label={activeLabel}
            />
            <Typography variant="body2" color="text.secondary">
              {t('settings.specialistSettings.activeHelper')}
            </Typography>
          </Box>
        </AppSurface>

        <AppSurface
          title={t('settings.specialistSettings.pricingTitle')}
          description={t('settings.specialistSettings.pricingDescription')}
        >
          <Box className="specialist-form__grid">
            {numberField(baseSessionPriceLabel, baseSessionPrice, setBaseSessionPrice)}
            {numberField(baseHourPriceLabel, baseHourPrice, setBaseHourPrice)}
          </Box>
        </AppSurface>

        <AppSurface
          title={t('settings.specialistSettings.scheduleTitle')}
          description={t('settings.specialistSettings.scheduleDescription')}
        >
          <Box className="specialist-form__grid">
            {numberField(workStartHourLabel, workStartHour, setWorkStartHour, t('settings.specialistSettings.hoursHelper'))}
            {numberField(workEndHourLabel, workEndHour, setWorkEndHour, t('settings.specialistSettings.hoursHelper'))}
            {numberField(slotDurationMinLabel, slotDurationMin, setSlotDurationMin, t('settings.specialistSettings.minutesHelper'))}
            {numberField(slotStepMinLabel, slotStepMin, setSlotStepMin, t('settings.specialistSettings.minutesHelper'))}
            {numberField(
              defaultSessionContinuationMinLabel,
              defaultSessionContinuationMin,
              setDefaultSessionContinuationMin,
              t('settings.specialistSettings.minutesHelper'),
            )}
          </Box>
        </AppSurface>

      </FormContainer>
    </AppDialog>
  );
}
