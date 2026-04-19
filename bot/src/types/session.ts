export enum UserSessionState {
  IDLE = 'idle',
  CHOOSING_SERVICE = 'choosing_service',
  CHOOSING_SPECIALIST = 'choosing_specialist',
  CHOOSING_DATE = 'choosing_date',
  CHOOSING_TIME = 'choosing_time',
  ENTERING_NAME = 'entering_name',
  ENTERING_PHONE = 'entering_phone',
  ENTERING_EMAIL = 'entering_email',
  CONFIRMING = 'confirming',
}

export type BookingPayload = {
  selectedSlots?: Array<{ date: string; time: string }>;
  currentSlotIndex?: number;
  totalSessions?: number;
  multiSessionMode?: 'same_time' | 'custom';
  datePageOffset?: number;
  serviceId?: number;
  specialistId?: number;
  selectedDate?: string;
  selectedTime?: string;
  editingAppointmentId?: number;
  enteredName?: string;
  enteredPhone?: string;
  enteredEmail?: string;
};
