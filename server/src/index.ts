import dotenv from 'dotenv';

dotenv.config();

const [{ createApp }, { env }, { startNotificationDefaultsJob }, { startAppointmentNotificationsJob }, { startAppointmentAutoCancelUnpaidJob }, { startAppointmentAuditRetentionJob }, { startDeletionCleanupJob }] = await Promise.all([
  import('./app.js'),
  import('./config/env.js'),
  import('./jobs/notificationDefaults.job.js'),
  import('./jobs/appointmentNotifications.job.js'),
  import('./jobs/appointmentAutoCancelUnpaid.job.js'),
  import('./jobs/appointmentAuditRetention.job.js'),
  import('./jobs/deletionCleanup.job.js'),
]);
const { trackServerError } = await import('./services/errorTrackingService.js');
const jobTimers: NodeJS.Timeout[] = [];
let shuttingDown = false;
let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
const gracefulShutdownTimeoutMs = 10_000;

const stopJobs = () => {
  for (const timer of jobTimers) {
    clearInterval(timer);
  }
  jobTimers.length = 0;
};

const shutdown = (reason: 'SIGINT' | 'SIGTERM' | 'uncaughtException', exitCode: 0 | 1 = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[process] received ${reason}, shutting down`);
  stopJobs();

  const forceExitTimer = setTimeout(() => {
    console.error('[process] graceful shutdown timed out');
    process.exit(1);
  }, gracefulShutdownTimeoutMs);
  forceExitTimer.unref();

  if (!server) {
    clearTimeout(forceExitTimer);
    process.exitCode = exitCode;
    return;
  }

  server.close((error) => {
    clearTimeout(forceExitTimer);
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

    process.exitCode = exitCode;
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
  shutdown('uncaughtException', 1);
});

const app = createApp();
server = app.listen(env.PORT, () => {
  jobTimers.push(startNotificationDefaultsJob());
  jobTimers.push(startAppointmentNotificationsJob());
  jobTimers.push(startAppointmentAutoCancelUnpaidJob());
  jobTimers.push(startAppointmentAuditRetentionJob());
  jobTimers.push(startDeletionCleanupJob());
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
