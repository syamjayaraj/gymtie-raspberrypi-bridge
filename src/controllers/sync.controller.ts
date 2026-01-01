import { Request, Response } from 'express';
import strapiService from '../services/strapi.service';
import hikvisionService from '../services/hikvision.service';
import logger from '../utils/logger';
import config from '../utils/config';

interface SyncStatus {
    lastSync: Date | null;
    totalMembers: number;
    successful: number;
    failed: number;
    errors: string[];
}

let lastSyncStatus: SyncStatus = {
    lastSync: null,
    totalMembers: 0,
    successful: 0,
    failed: 0,
    errors: [],
};

/**
 * Sync all members from Strapi to device
 */
export async function syncAllMembers(req: Request, res: Response): Promise<void> {
    try {
        logger.info('Starting member sync...');

        // Get members from Strapi
        const members = await strapiService.getMembers();

        const results = {
            total: members.length,
            successful: 0,
            failed: 0,
            errors: [] as string[],
        };

        // Sync each member to device
        for (const member of members) {
            try {
                await hikvisionService.syncMember({
                    id: member.id,
                    name: member.attributes.name,
                    validity: member.attributes.validity,
                    blocked: member.attributes.blocked,
                    active: member.attributes.active,
                });
                results.successful++;
            } catch (error: any) {
                results.failed++;
                results.errors.push(`Member ${member.id}: ${error.message}`);
            }
        }

        // Update last sync status
        lastSyncStatus = {
            lastSync: new Date(),
            totalMembers: results.total,
            successful: results.successful,
            failed: results.failed,
            errors: results.errors,
        };

        logger.info('Member sync completed', results);

        res.json({
            success: true,
            message: `Synced ${results.successful} out of ${results.total} members`,
            results,
        });
    } catch (error: any) {
        logger.error('Member sync failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

/**
 * Sync single member from Strapi to device
 */
export async function syncSingleMember(req: Request, res: Response): Promise<void> {
    try {
        const memberId = parseInt(req.params.memberId, 10);

        if (isNaN(memberId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid member ID',
            });
            return;
        }

        logger.info(`Syncing member ${memberId}...`);

        // Get member from Strapi
        const member = await strapiService.getMember(memberId);

        if (!member) {
            res.status(404).json({
                success: false,
                error: 'Member not found',
            });
            return;
        }

        // Check if member belongs to this gym
        if (member.attributes.gym.data.id !== config.gym.id) {
            res.status(403).json({
                success: false,
                error: 'Member does not belong to this gym',
            });
            return;
        }

        // Sync to device
        await hikvisionService.syncMember({
            id: member.id,
            name: member.attributes.name,
            validity: member.attributes.validity,
            blocked: member.attributes.blocked,
            active: member.attributes.active,
        });

        logger.info(`Member ${memberId} synced successfully`);

        res.json({
            success: true,
            message: `Member ${memberId} synced successfully`,
        });
    } catch (error: any) {
        logger.error(`Failed to sync member ${req.params.memberId}`, { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}

/**
 * Get last sync status
 */
export async function getSyncStatus(req: Request, res: Response): Promise<void> {
    res.json({
        success: true,
        status: lastSyncStatus,
    });
}
