import express, { Request, Response, NextFunction } from 'express';
import config from './utils/config';
import logger from './utils/logger';
import syncRoutes from './routes/sync.routes';
import attendanceRoutes from './routes/attendance.routes';
import healthRoutes from './routes/health.routes';
import { startMemberSyncJob } from './jobs/member-sync.job';
import { startAttendancePullJob } from './jobs/attendance-pull.job';
import { startQueueRetryJob } from './jobs/queue-retry.job';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/sync', syncRoutes);
app.use('/attendance', attendanceRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.json({
        name: 'GymTie Local Bridge',
        version: '1.0.0',
        status: 'running',
        gymId: config.gym.id,
        endpoints: {
            health: '/health',
            sync: '/sync',
            attendance: '/attendance',
        },
    });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
    });

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: config.nodeEnv === 'development' ? err.message : undefined,
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
    });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
    logger.info(`GymTie Local Bridge started on port ${PORT}`, {
        nodeEnv: config.nodeEnv,
        gymId: config.gym.id,
        strapiUrl: config.strapi.url,
        hikvisionIp: config.hikvision.ip,
    });

    // Start cron jobs
    startMemberSyncJob();
    startAttendancePullJob();
    startQueueRetryJob();

    logger.info('All cron jobs started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
});

export default app;
