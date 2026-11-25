import { Alert, FormControlLabel, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { BlockSchedule } from '../../features/public-page-builder/types/publicPage';
import { localScheduleTimeToUtc, utcScheduleTimeToLocal } from '../../features/public-page-builder/model/schedule';
import type { Locale } from '../../shared/i18n/dictionaries';
import { translate } from '../../shared/i18n/translate';

export function BlockScheduleControls({ value, timezone, locale, onChange, onValidityChange }: {
  value: BlockSchedule; timezone: string; locale: Locale; onChange: (schedule: BlockSchedule) => void; onValidityChange: (valid: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(value.period !== null);
  const [start, setStart] = useState(value.period ? utcScheduleTimeToLocal(value.period.startAt, timezone) : '');
  const [end, setEnd] = useState(value.period ? utcScheduleTimeToLocal(value.period.endAt, timezone) : '');
  const startResult = localScheduleTimeToUtc(start, timezone);
  const endResult = localScheduleTimeToUtc(end, timezone);
  const datesValid = Boolean(startResult.value && endResult.value && Date.parse(endResult.value) > Date.parse(startResult.value));
  const daysInvalid = value.weekdays !== null && value.weekdays.length === 0;
  const error = enabled && !datesValid
    ? startResult.error === 'ambiguous_time' || endResult.error === 'ambiguous_time' ? 'scheduleAmbiguous'
      : startResult.error === 'nonexistent_time' || endResult.error === 'nonexistent_time' ? 'scheduleNonexistent' : 'scheduleInvalidDates'
    : daysInvalid ? 'scheduleNoDays' : null;
  useEffect(() => { onValidityChange(error === null); }, [error, onValidityChange]);
  const changeDates = (nextStart: string, nextEnd: string) => {
    setStart(nextStart); setEnd(nextEnd);
    const first = localScheduleTimeToUtc(nextStart, timezone);
    const last = localScheduleTimeToUtc(nextEnd, timezone);
    if (first.value && last.value && Date.parse(last.value) > Date.parse(first.value)) {
      onChange({ ...value, period: { startAt: first.value, endAt: last.value } });
    }
  };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  return <Stack spacing={2}>
    <FormControlLabel label={translate(locale, 'publicPageBuilder.scheduleEnabled')} control={<Switch checked={enabled} onChange={(_, checked) => {
      setEnabled(checked);
      if (!checked) {onChange({ ...value, period: null });}
      else {changeDates(start, end);}
    }} />} />
    {enabled ? <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField fullWidth type="datetime-local" label={translate(locale, 'publicPageBuilder.scheduleFrom')} value={start} error={Boolean(error && !daysInvalid)} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => changeDates(event.target.value, end)} />
        <TextField fullWidth type="datetime-local" label={translate(locale, 'publicPageBuilder.scheduleUntil')} value={end} error={Boolean(error && !daysInvalid)} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => changeDates(start, event.target.value)} />
      </Stack>
      <Typography variant="body2" color="text.secondary">{translate(locale, 'publicPageBuilder.scheduleTimezone').replace('{timezone}', timezone)}</Typography>
      <Typography variant="caption" color="text.secondary">{translate(locale, 'publicPageBuilder.scheduleBoundaryHint')}</Typography>
    </> : null}
    <FormControlLabel label={translate(locale, 'publicPageBuilder.scheduleWeekdays')} control={<Switch checked={value.weekdays !== null}
      onChange={(_, checked) => onChange({ ...value, weekdays: checked ? [1, 2, 3, 4, 5] : null })} />} />
    {value.weekdays !== null ? <ToggleButtonGroup value={value.weekdays} onChange={(_, weekdays: number[]) => onChange({ ...value, weekdays })}
      aria-label={translate(locale, 'publicPageBuilder.scheduleWeekdays')} sx={{ flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5, 6, 7].map((day) => <ToggleButton key={day} value={day} aria-label={translate(locale, `publicPageBuilder.${days[day - 1]}`)}>{translate(locale, `publicPageBuilder.${days[day - 1]}`)}</ToggleButton>)}
    </ToggleButtonGroup> : null}
    {error ? <Alert severity="error">{translate(locale, `publicPageBuilder.${error}`)}</Alert> : null}
  </Stack>;
}
