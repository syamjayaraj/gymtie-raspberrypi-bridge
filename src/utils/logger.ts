import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from './config';

// Ensure log directory exists
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'gymtie-bridge' },
    transports: [
        // Write all logs to file
        new winston.transports.File({ filename: config.logging.file }),
        // Write errors to separate file
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
        }),
    ],
});

// If not in production, also log to console with colorized output
if (config.nodeEnv !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        })
    );
}

export default logger;
