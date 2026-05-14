import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Fragment, useState } from 'react';
import type { AppointmentItem, AppointmentListResponse } from '../../shared/types/api';
import type { TranslationKey } from '../../shared/i18n/dictionaries';
import { APP_SIZING, APP_SPACING, rem } from '../../shared/theme/constants';
import { AppButton } from '../../shared/ui/AppButton';
import { AppIcons } from '../../shared/ui/AppIcons';
import { AppSurface } from '../../shared/ui/AppSurface';
import {
  CalendarViewMode,
  formatLocalDate,
  formatLocalTime,
  isSlotInPast,
  SLOT_ROWS,
  statusLabel,
  toDateKeyInTimezone,
} from './appointmentsUtils';

type Props = {
  t: (key: TranslationKey) => string;
  viewMode: CalendarViewMode;
  visibleDays: Date[];
  displayTimeZone: string;
  appointmentsByCell: Map<string, AppointmentItem[]>;
  appointmentsByDay: Map<string, AppointmentItem[]>;
  busySlotsByCell: Map<string, AppointmentListResponse['busySlots']>;
  movePeriod: (direction: -1 | 1) => void;
  onToday: () => void;
  onSetViewMode: (mode: CalendarViewMode) => void;
  onOpenCreate: (dayKey: string, hour: number, minute: number) => void;
  onOpenEdit: (item: AppointmentItem) => void;
  onMoveAppointment: (appointmentId: number, targetDayKey: string, targetHour: number, targetMinute: number) => void;
  onPastSlotAttempt: () => void;
  getGridDayKey: (day: Date) => string;
};

export function AppointmentsCalendar({
  t,
  viewMode,
  visibleDays,
  displayTimeZone,
  appointmentsByCell,
  appointmentsByDay,
  busySlotsByCell,
  movePeriod,
  onToday,
  onSetViewMode,
  onOpenCreate,
  onOpenEdit,
  onMoveAppointment,
  onPastSlotAttempt,
  getGridDayKey,
}: Props) {
  const theme = useTheme();
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<number | null>(null);
  const [blockedCellKey, setBlockedCellKey] = useState<string | null>(null);
  const todayKey = toDateKeyInTimezone(new Date(), displayTimeZone);
  const isPastDay = (dayKey: string) => dayKey < todayKey;

  const getGoogleSlotTitle = (slot: AppointmentListResponse['busySlots'][number]) => {
    if (slot.title) {
      return slot.title;
    }

    return slot.organizerEmail || slot.creatorEmail || 'Busy (Google)';
  };

  const getGoogleSlotTooltip = (slot: AppointmentListResponse['busySlots'][number]) =>
    [
      slot.title ? `Title: ${slot.title}` : '',
      slot.organizerEmail ? `Organizer: ${slot.organizerEmail}` : '',
      slot.creatorEmail ? `Creator: ${slot.creatorEmail}` : '',
    ]
      .filter(Boolean)
      .join(' - ');

  const getMeetingProviderLabel = (provider: AppointmentItem['meetingProvider']) => (
    provider === 'zoom'
      ? t('appointments.meetingProviderZoom')
      : provider === 'offline'
        ? t('appointments.meetingProviderOffline')
        : t('appointments.meetingProviderManual')
  );

  return (
    <Stack spacing={2}>
      <AppSurface
        sx={{
          p: APP_SPACING.surfacePadding,
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}
          >
            <Stack direction="row" spacing={1}>
              <AppButton size="small" variant="outlined" onClick={() => movePeriod(-1)}>
                {'<'}
              </AppButton>
              <AppButton size="small" variant="contained" onClick={onToday}>
                {t('appointments.today')}
              </AppButton>
              <AppButton size="small" variant="outlined" onClick={() => movePeriod(1)}>
                {'>'}
              </AppButton>
            </Stack>

            <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>
              {viewMode === 'week'
                ? `${formatLocalDate(visibleDays[0])} - ${formatLocalDate(visibleDays[visibleDays.length - 1])}`
                : viewMode === 'month'
                  ? formatLocalDate(visibleDays[0], { month: 'long', year: 'numeric' })
                  : formatLocalDate(visibleDays[0])}
            </Typography>

            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, nextMode: CalendarViewMode | null) => {
                if (nextMode) {
                  onSetViewMode(nextMode);
                }
              }}
              sx={{ alignSelf: { xs: 'flex-start', md: 'auto' } }}
            >
              <ToggleButton value="day">{t('appointments.viewDay')}</ToggleButton>
              <ToggleButton value="week">{t('appointments.viewWeek')}</ToggleButton>
              <ToggleButton value="month">{t('appointments.viewMonth')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {viewMode !== 'month' ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AppIcons.calendar fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {t('appointments.dragHint')}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </AppSurface>

      {viewMode === 'month' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {visibleDays.map((day) => {
            const dayKey = getGridDayKey(day);
            const items = appointmentsByDay.get(dayKey) ?? [];
            const isToday = dayKey === todayKey;
            const isPast = isPastDay(dayKey);

            return (
              <Card
                key={day.toISOString()}
                variant="outlined"
                onClick={() => onOpenCreate(dayKey, 9, 0)}
                sx={{
                  borderRadius: 3,
                  borderColor: isToday ? 'primary.main' : alpha(theme.palette.primary.main, 0.12),
                  bgcolor: isPast ? 'action.disabledBackground' : alpha(theme.palette.background.paper, 0.98),
                  opacity: isPast ? 0.8 : 1,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
                  '&:hover': {
                    bgcolor: isPast ? 'action.disabledBackground' : 'action.hover',
                    transform: isPast ? 'none' : `translateY(-${rem(1)})`,
                  },
                }}
              >
                <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700 }}
                        color={isPast ? 'text.disabled' : 'text.primary'}
                      >
                        {formatLocalDate(day, { weekday: 'short', day: '2-digit', month: 'short' })}
                      </Typography>
                      {isToday ? <Chip size="small" color="primary" label={t('appointments.today')} sx={{ height: 20 }} /> : null}
                    </Stack>

                    <Stack spacing={0.75}>
                      {items.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          {t('appointments.emptyDay')}
                        </Typography>
                      ) : (
                        items.map((item) => (
                          <Box
                            key={item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenEdit(item);
                            }}
                            sx={{
                              borderRadius: 2,
                              border: 1,
                              borderColor: item.status === 'cancelled' ? 'error.main' : 'primary.light',
                              bgcolor: item.status === 'cancelled'
                                ? alpha(theme.palette.error.main, 0.12)
                                : alpha(theme.palette.primary.main, 0.14),
                              px: 1,
                              py: 0.75,
                              cursor: 'pointer',
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                              {formatLocalTime(item.scheduledAt)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {`${statusLabel(item.status)} - ${getMeetingProviderLabel(item.meetingProvider)} - ${t('appointments.durationMinutesShort').replace('{minutes}', String(item.durationMin))}`}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: rem(APP_SIZING.surfaceRadius),
            overflowX: 'auto',
            backgroundColor: 'background.paper',
            boxShadow: `0 ${rem(18)} ${rem(38)} ${alpha(theme.palette.primary.main, 0.08)}`,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `${rem(72)} repeat(${visibleDays.length}, minmax(${rem(180)}, 1fr))`,
              minWidth: viewMode === 'week' ? rem(1100) : rem(560),
            }}
          >
            <Box sx={{ borderRight: 1, borderColor: 'divider', p: 1, bgcolor: alpha(theme.palette.primary.main, 0.05) }} />

            {visibleDays.map((day) => {
              const dayKey = getGridDayKey(day);
              const isToday = dayKey === todayKey;
              const isPast = isPastDay(dayKey);

              return (
                <Box
                  key={day.toISOString()}
                  sx={{
                    borderRight: 1,
                    borderColor: 'divider',
                    p: 1.25,
                    bgcolor: isToday
                      ? alpha(theme.palette.primary.main, 0.14)
                      : isPast
                        ? 'action.disabledBackground'
                        : alpha(theme.palette.primary.main, 0.04),
                    opacity: isPast ? 0.82 : 1,
                  }}
                >
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} color={isPast ? 'text.disabled' : 'text.primary'}>
                      {formatLocalDate(day, { weekday: 'short' })}
                    </Typography>
                    {isToday ? <Chip size="small" color="primary" label={t('appointments.today')} sx={{ height: 20 }} /> : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {formatLocalDate(day)}
                  </Typography>
                </Box>
              );
            })}

            {SLOT_ROWS.map((totalMinute) => {
              const hour = Math.floor(totalMinute / 60);
              const minute = totalMinute % 60;

              return (
                <Fragment key={`row-${hour}-${minute}`}>
                  <Box
                    sx={{
                      borderTop: 1,
                      borderRight: 1,
                      borderColor: 'divider',
                      px: 1,
                      py: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                    </Typography>
                  </Box>

                  {visibleDays.map((day) => {
                    const dayKey = getGridDayKey(day);
                    const timeKey = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    const key = `${dayKey}:${timeKey}`;
                    const items = appointmentsByCell.get(key) ?? [];
                    const externalBusy = busySlotsByCell.get(key) ?? [];
                    const isPastSlot = isSlotInPast(dayKey, hour, minute, displayTimeZone);

                    return (
                      <Box
                        key={`${key}-cell`}
                        sx={{
                          position: 'relative',
                          borderTop: 1,
                          borderRight: 1,
                          borderColor: 'divider',
                          minHeight: rem(40),
                          p: 0.5,
                          bgcolor: isPastSlot
                            ? 'action.disabledBackground'
                            : alpha(theme.palette.background.paper, 0.92),
                          opacity: isPastSlot ? 0.82 : 1,
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: isPastSlot ? 'action.disabledBackground' : 'action.hover',
                          },
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (!draggingAppointmentId) {
                            return;
                          }

                          if (isPastSlot) {
                            event.dataTransfer.dropEffect = 'none';
                            setBlockedCellKey(key);
                          } else {
                            event.dataTransfer.dropEffect = 'move';
                            setBlockedCellKey(null);
                          }
                        }}
                        onDragLeave={() => {
                          setBlockedCellKey((prev) => (prev === key ? null : prev));
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setBlockedCellKey(null);

                          if (isPastSlot) {
                            onPastSlotAttempt();
                            return;
                          }

                          const rawId = event.dataTransfer.getData('text/appointment-id');
                          const id = Number(rawId);

                          if (!Number.isNaN(id)) {
                            onMoveAppointment(id, dayKey, hour, minute);
                          }
                        }}
                        onClick={() => {
                          if (isPastSlot) {
                            onPastSlotAttempt();
                            return;
                          }

                          onOpenCreate(dayKey, hour, minute);
                        }}
                      >
                        {draggingAppointmentId && blockedCellKey === key ? (
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: alpha(theme.palette.error.main, 0.08),
                              pointerEvents: 'none',
                              zIndex: 2,
                            }}
                          >
                            <CloseRoundedIcon color="error" fontSize="small" />
                          </Box>
                        ) : null}

                        <Stack spacing={0.5}>
                          {externalBusy.map((slot) => (
                            <Tooltip
                              key={`${slot.specialistId}-${slot.scheduledAt}-${slot.source}`}
                              title={getGoogleSlotTooltip(slot)}
                              placement="top"
                              arrow
                              disableHoverListener={!getGoogleSlotTooltip(slot)}
                            >
                              <Chip size="small" label={getGoogleSlotTitle(slot)} color="warning" variant="outlined" />
                            </Tooltip>
                          ))}

                          {items.map((item) => (
                            <Box
                              key={item.id}
                              draggable
                              onDragStart={(event) => {
                                setDraggingAppointmentId(item.id);
                                event.dataTransfer.setData('text/appointment-id', String(item.id));
                              }}
                              onDragEnd={() => {
                                setDraggingAppointmentId(null);
                                setBlockedCellKey(null);
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenEdit(item);
                              }}
                              sx={{
                                borderRadius: 2,
                                border: 1,
                                borderColor: item.status === 'cancelled' ? 'error.main' : 'primary.light',
                                bgcolor: item.status === 'cancelled'
                                  ? alpha(theme.palette.error.main, 0.12)
                                  : alpha(theme.palette.primary.main, 0.14),
                                px: 1,
                                py: 0.75,
                                cursor: 'pointer',
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                                {formatLocalTime(item.scheduledAt)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {`${statusLabel(item.status)} - ${getMeetingProviderLabel(item.meetingProvider)} - ${t('appointments.durationMinutesShort').replace('{minutes}', String(item.durationMin))}`}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Fragment>
              );
            })}
          </Box>
        </Box>
      )}
    </Stack>
  );
}
