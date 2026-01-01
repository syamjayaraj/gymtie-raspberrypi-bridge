import { Request, Response } from 'express';
import strapiService from '../services/strapi.service';
import hikvisionService from '../services/hikvision.service';
import queueService from '../services/queue.service';
import logger from '../utils/logger';
import config from '../utils/config';

/**
 * Overall health check
 */
export async function getHealth(req: Request, res: Response): Promise<void> {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        config: {
            gymId: config.gym.id,
            strapiUrl: config.strapi.url,
            hikvisionIp: config.hikvision.ip,
        },
        services: {
            strapi: 'unknown',
            hikvision: 'unknown',
        },
        queue: {
            size: 0,
        },
    };

    try {
        // Check Strapi
        try {
            await strapiService.testConnection();
            health.services.strapi = 'healthy';
        } catch (error) {
            health.services.strapi = 'unhealthy';
            health.status = 'degraded';
        }

        // Check Hikvision
        try {
            await hikvisionService.testConnection();
            health.services.hikvision = 'healthy';
        } catch (error) {
            health.services.hikvision = 'unhealthy';
            health.status = 'degraded';
        }

        // Check queue
        health.queue.size = await queueService.size();

        res.json(health);
    } catch (error: any) {
        logger.error('Health check failed', { error: error.message });
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
        });
    }
}

/**
 * Check Hikvision device connectivity
 */
export async function checkDevice(req: Request, res: Response): Promise<void> {
    try {
        await hikvisionService.testConnection();
        res.json({
            success: true,
            message: 'Device is reachable',
            device: {
                ip: config.hikvision.ip,
                port: config.hikvision.port,
            },
        });
    } catch (error: any) {
        logger.error('Device health check failed', { error: error.message });
        res.status(503).json({
            success: false,
            error: error.message,
            device: {
                ip: config.hikvision.ip,
                port: config.hikvision.port,
            },
        });
    }
}

/**
 * Check Strapi connectivity
 */
export async function checkStrapi(req: Request, res: Response): Promise<void> {
    try {
        await strapiService.testConnection();
        res.json({
            success: true,
            message: 'Strapi is reachable',
            strapi: {
                url: config.strapi.url,
                gymId: config.gym.id,
            },
        });
    } catch (error: any) {
        logger.error('Strapi health check failed', { error: error.message });
        res.status(503).json({
            success: false,
            error: error.message,
            strapi: {
                url: config.strapi.url,
                gymId: config.gym.id,
            },
        });
    }
}
