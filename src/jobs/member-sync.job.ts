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
        // console.log('\n🔄 ========== MEMBER SYNC JOB STARTED ==========');
        // logger.info('[CRON] Starting member sync job...');

        const members = await strapiService.getMembers();
        // console.log(`📊 Fetched ${members.length} members from Strapi`);

        let successful = 0;
        let failed = 0;

        for (const member of members) {
            try {
                // console.log(`\n[${successful + failed + 1}/${members.length}] Processing member ${member.id}...`);
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
                console.error(`❌ Failed to sync member ${member.id}: ${error.message}`);
                logger.error(`[CRON] Failed to sync member ${member.id}`, { error: error.message });
            }
        }

        // console.log('\n📈 ========== SYNC JOB SUMMARY ==========');
        // console.log(`Total: ${members.length}`);
        // console.log(`✅ Successful: ${successful}`);
        // console.log(`❌ Failed: ${failed}`);
        // console.log('==========================================\n');

        logger.info('[CRON] Member sync job completed', {
            total: members.length,
            successful,
            failed,
        });
    } catch (error: any) {
        console.error('❌ CRON JOB ERROR:', error);
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
