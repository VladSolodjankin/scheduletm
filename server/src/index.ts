import dotenv from 'dotenv';

dotenv.config();

const [{ createApp }, { env }, { startNotificationDefaultsJob }, { startAppointmentNotificationsJob }] = await Promise.all([
  import('./app.js'),
  import('./config/env.js'),
  import('./jobs/notificationDefaults.job.js'),
  import('./jobs/appointmentNotifications.job.js'),
]);

createApp().listen(env.PORT, () => {
  startNotificationDefaultsJob();
  startAppointmentNotificationsJob();
  console.log(`server listening on http://localhost:${env.PORT}`);
});
