import cron from 'node-cron';
import strapiService from '../services/strapi.service';
import hikvisionService from '../services/hikvision.service';
import logger from '../utils/logger';
import config from '../utils/config';

/**
 * Sync members from Strapi to device
 */
async function syncMembers(): Promise<void> {
    try {
        logger.info('[CRON] Starting member sync job...');

        const members = await strapiService.getMembers();
        let successful = 0;
        let failed = 0;

        for (const member of members) {
            try {
                await hikvisionService.syncMember({
                    id: member.id,
                    name: member.attributes.name,
                    validity: member.attributes.validity,
                    blocked: member.attributes.blocked,
                    active: member.attributes.active,
                });
                successful++;
            } catch (error: any) {
                failed++;
                logger.error(`[CRON] Failed to sync member ${member.id}`, { error: error.message });
            }
        }

        logger.info('[CRON] Member sync job completed', {
            total: members.length,
            successful,
            failed,
        });
    } catch (error: any) {
        logger.error('[CRON] Member sync job failed', { error: error.message });
    }
}

/**
 * Start member sync cron job
 */
export function startMemberSyncJob(): void {
    const interval = config.sync.memberInterval;
    const schedule = `*/${interval} * * * *`; // Every N minutes

    cron.schedule(schedule, syncMembers);
    logger.info(`Member sync job scheduled (every ${interval} minutes)`);
}
