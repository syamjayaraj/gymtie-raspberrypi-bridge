import cron from 'node-cron';
import strapiService from '../services/strapi.service';
import queueService from '../services/queue.service';
import logger from '../utils/logger';
import config from '../utils/config';

/**
 * Retry queued requests
 */
async function retryQueue(): Promise<void> {
    try {
        const items = await queueService.getAll();

        if (items.length === 0) {
            return;
        }

        logger.info(`[CRON] Processing ${items.length} queued items...`);

        let successful = 0;
        let failed = 0;

        for (const item of items) {
            try {
                if (item.type === 'attendance') {
                    await strapiService.createAttendance(item.data);
                    await queueService.dequeue(item.id);
                    successful++;
                    logger.info(`[CRON] Queued attendance processed`, { id: item.id });
                }
            } catch (error: any) {
                // Increment retry count
                const newRetries = item.retries + 1;

                // Remove from queue after 10 failed retries
                if (newRetries >= 10) {
                    await queueService.dequeue(item.id);
                    logger.error(`[CRON] Queued item removed after 10 retries`, { id: item.id });
                } else {
                    await queueService.updateRetries(item.id, newRetries);
                }

                failed++;
            }
        }

        if (successful > 0 || failed > 0) {
            logger.info('[CRON] Queue retry job completed', { successful, failed });
        }
    } catch (error: any) {
        logger.error('[CRON] Queue retry job failed', { error: error.message });
    }
}

/**
 * Start queue retry cron job
 */
export function startQueueRetryJob(): void {
    const interval = config.sync.queueRetryInterval;
    const schedule = `*/${interval} * * * *`; // Every N minutes

    cron.schedule(schedule, retryQueue);
    logger.info(`Queue retry job scheduled (every ${interval} minutes)`);
}
