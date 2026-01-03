import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
    nodeEnv: string;
    strapi: {
        url: string;
        apiToken?: string;
        email?: string;
        password?: string;
    };
    gym: {
        id: number;
    };
    hikvision: {
        ip: string;
        port: number;
        username: string;
        password: string;
    };
    sync: {
        memberInterval: number;
        attendanceInterval: number;
        queueRetryInterval: number;
    };
    logging: {
        level: string;
        file: string;
    };
    queue: {
        dir: string;
    };
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvVarOptional(key: string, defaultValue?: string): string | undefined {
    return process.env[key] || defaultValue;
}

const config: Config = {
    port: parseInt(getEnvVar('PORT', '3000'), 10),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    strapi: {
        url: getEnvVar('STRAPI_URL'),
        apiToken: getEnvVarOptional('STRAPI_API_TOKEN'),
        email: getEnvVarOptional('STRAPI_EMAIL'),
        password: getEnvVarOptional('STRAPI_PASSWORD'),
    },
    gym: {
        id: parseInt(getEnvVar('GYM_ID'), 10),
    },
    hikvision: {
        ip: getEnvVar('HIKVISION_IP'),
        port: parseInt(getEnvVar('HIKVISION_PORT', '80'), 10),
        username: getEnvVar('HIKVISION_USERNAME'),
        password: getEnvVar('HIKVISION_PASSWORD'),
    },
    sync: {
        memberInterval: parseInt(getEnvVar('MEMBER_SYNC_INTERVAL', '1'), 10),
        attendanceInterval: parseInt(getEnvVar('ATTENDANCE_PULL_INTERVAL', '1'), 10),
        queueRetryInterval: parseInt(getEnvVar('QUEUE_RETRY_INTERVAL', '2'), 10),
    },
    logging: {
        level: getEnvVar('LOG_LEVEL', 'info'),
        file: getEnvVar('LOG_FILE', './logs/bridge.log'),
    },
    queue: {
        dir: getEnvVar('QUEUE_DIR', './data/queue'),
    },
};

// Validate configuration
if (!config.strapi.apiToken && (!config.strapi.email || !config.strapi.password)) {
    throw new Error('Either STRAPI_API_TOKEN or both STRAPI_EMAIL and STRAPI_PASSWORD must be provided');
}

export default config;
