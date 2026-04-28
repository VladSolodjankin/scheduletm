import dotenv from 'dotenv';

dotenv.config();

const [{ createApp }, { env }, { startNotificationDefaultsJob }, { startAppointmentNotificationsJob }, { startAppointmentAutoCancelUnpaidJob }] = await Promise.all([
  import('./app.js'),
  import('./config/env.js'),
  import('./jobs/notificationDefaults.job.js'),
  import('./jobs/appointmentNotifications.job.js'),
  import('./jobs/appointmentAutoCancelUnpaid.job.js'),
]);
const { trackServerError } = await import('./services/errorTrackingService.js');
const jobTimers: NodeJS.Timeout[] = [];
let shuttingDown = false;

const stopJobs = () => {
  for (const timer of jobTimers) {
    clearInterval(timer);
  }
  jobTimers.length = 0;
};

const shutdown = (signal: 'SIGINT' | 'SIGTERM') => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[process] received ${signal}, shutting down`);
  stopJobs();
  server.close((error) => {
    if (error) {
      console.error('[process] graceful shutdown failed', error);
      void trackServerError({
        method: 'PROCESS',
        path: '/process/graceful-shutdown',
        error,
      });
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  });
};

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[process] unhandledRejection', error);
  void trackServerError({
    method: 'PROCESS',
    path: '/process/unhandled-rejection',
    error,
  });
});

process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException', error);
  void trackServerError({
    method: 'PROCESS',
    path: '/process/uncaught-exception',
    error,
  });
});

const app = createApp();
const server = app.listen(env.PORT, () => {
  jobTimers.push(startNotificationDefaultsJob());
  jobTimers.push(startAppointmentNotificationsJob());
  jobTimers.push(startAppointmentAutoCancelUnpaidJob());
  console.log(`server listening on http://localhost:${env.PORT}`);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.on('error', (error) => {
  console.error('[process] listen error', error);
  void trackServerError({
    method: 'PROCESS',
    path: '/process/listen-error',
    error,
  });
});
