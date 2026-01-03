import { Request, Response } from 'express';
import strapiService from '../services/strapi.service';
import hikvisionService from '../services/hikvision.service';
import queueService from '../services/queue.service';
import logger from '../utils/logger';
import config from '../utils/config';

/**
 * Handle attendance event from device (webhook)
 */
export async function handleAttendanceEvent(req: Request, res: Response): Promise<void> {
    try {
        const event = req.body;
        logger.info('Received attendance event from device', { event });

        // Extract event data
        const employeeNo = event.AcsEvent?.employeeNo || event.employeeNo;
        const time = event.AcsEvent?.time || event.time;

        if (!employeeNo || !time) {
            res.status(400).json({
                success: false,
                error: 'Invalid event data',
            });
            return;
        }

        // Parse time
        const eventTime = new Date(time);
        const date = eventTime.toISOString().split('T')[0];
        const timeStr = eventTime.toTimeString().split(' ')[0];

        // Prepare attendance data
        const attendanceData = {
            memberId: parseInt(employeeNo, 10),
            gymId: config.gym.id,
            date,
            checkin: timeStr,
        };

        // Try to send to Strapi
        try {
            await strapiService.createAttendance(attendanceData);
            logger.info('Attendance logged to Strapi', { memberId: employeeNo, date });
            res.json({ success: true });
        } catch (error: any) {
            // If Strapi is unreachable, queue the attendance
            logger.warn('Strapi unreachable, queueing attendance', { error: error.message });
            await queueService.enqueue('attendance', attendanceData);
            res.json({ success: true, queued: true });
        }
    } catch (error: any) {
        logger.error('Failed to handle attendance event', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

/**
 * Manually pull attendance logs from device
 */
export async function pullAttendanceLogs(req: Request, res: Response): Promise<void> {
    try {
        logger.info('Manually pulling attendance logs...');

        // Get logs from last 10 minutes
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);

        const logs = await hikvisionService.getAttendanceLogs(startTime, endTime);

        const results = {
            total: logs.length,
            successful: 0,
            failed: 0,
            queued: 0,
            errors: [] as string[],
        };

        // Process each log
        for (const log of logs) {
            try {
                const eventTime = new Date(log.time);
                const date = eventTime.toISOString().split('T')[0];
                const timeStr = eventTime.toTimeString().split(' ')[0];

                const attendanceData = {
                    memberId: parseInt(log.employeeNo, 10),
                    gymId: config.gym.id,
                    date,
                    checkin: timeStr,
                };

                try {
                    await strapiService.createAttendance(attendanceData);
                    results.successful++;
                } catch (error: any) {
                    // Queue if Strapi is unreachable
                    await queueService.enqueue('attendance', attendanceData);
                    results.queued++;
                }
            } catch (error: any) {
                results.failed++;
                results.errors.push(`Employee ${log.employeeNo}: ${error.message}`);
            }
        }

        logger.info('Attendance pull completed', results);

        res.json({
            success: true,
            message: `Processed ${results.successful} logs, queued ${results.queued}`,
            results,
        });
    } catch (error: any) {
        logger.error('Failed to pull attendance logs', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

/**
 * Get queued attendance events
 */
export async function getQueuedAttendance(req: Request, res: Response): Promise<void> {
    try {
        const items = await queueService.getAll();
        const size = await queueService.size();

        res.json({
            success: true,
            queueSize: size,
            items,
        });
    } catch (error: any) {
        logger.error('Failed to get queued attendance', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
