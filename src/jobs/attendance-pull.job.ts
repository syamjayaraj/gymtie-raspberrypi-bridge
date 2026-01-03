import cron from 'node-cron';
import strapiService from '../services/strapi.service';
import hikvisionService from '../services/hikvision.service';
import queueService from '../services/queue.service';
import logger from '../utils/logger';
import config from '../utils/config';

/**
 * Pull attendance logs from device
 */
async function pullAttendance(): Promise<void> {
    try {
        console.log('[ATTENDANCE] Starting attendance pull job...');
        logger.info('[CRON] Starting attendance pull job...');

        // Get logs from last 10 minutes
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);

        console.log(`[ATTENDANCE] Pulling logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);

        const logs = await hikvisionService.getAttendanceLogs(startTime, endTime);

        console.log(`[ATTENDANCE] Retrieved ${logs.length} logs from device`);

        let successful = 0;
        let queued = 0;
        let failed = 0;

        for (const log of logs) {
            try {
                const eventTime = new Date(log.time);
                const date = eventTime.toISOString().split('T')[0];
                const timeStr = eventTime.toTimeString().split(' ')[0];

                const attendanceData = {
                    memberId: parseInt(log.employeeNo, 10),
                    gymId: config.gym.id,
                    date,
                    checkIn: timeStr,
                };

                try {
                    await strapiService.createAttendance(attendanceData);
                    successful++;
                } catch (error: any) {
                    // Queue if Strapi is unreachable
                    await queueService.enqueue('attendance', attendanceData);
                    queued++;
                }
            } catch (error: any) {
                failed++;
                logger.error(`[CRON] Failed to process attendance for employee ${log.employeeNo}`, {
                    error: error.message,
                });
            }
        }

        logger.info('[CRON] Attendance pull job completed', {
            total: logs.length,
            successful,
            queued,
            failed,
        });
    } catch (error: any) {
        logger.error('[CRON] Attendance pull job failed', { error: error.message });
    }
}

/**
 * Start attendance pull cron job
 */
export function startAttendancePullJob(): void {
    const interval = config.sync.attendanceInterval;
    const schedule = `*/${interval} * * * *`; // Every N minutes

    cron.schedule(schedule, pullAttendance);
    logger.info(`Attendance pull job scheduled (every ${interval} minutes)`);
}
