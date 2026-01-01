import fs from 'fs';
import path from 'path';
import config from '../utils/config';
import logger from '../utils/logger';

interface QueueItem {
    id: string;
    type: 'attendance';
    data: any;
    timestamp: number;
    retries: number;
}

class QueueService {
    private queueDir: string;

    constructor() {
        this.queueDir = config.queue.dir;
        this.ensureQueueDir();
    }

    /**
     * Ensure queue directory exists
     */
    private ensureQueueDir(): void {
        if (!fs.existsSync(this.queueDir)) {
            fs.mkdirSync(this.queueDir, { recursive: true });
            logger.info('Queue directory created', { dir: this.queueDir });
        }
    }

    /**
     * Add item to queue
     */
    async enqueue(type: string, data: any): Promise<string> {
        const item: QueueItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: type as 'attendance',
            data,
            timestamp: Date.now(),
            retries: 0,
        };

        const filePath = path.join(this.queueDir, `${item.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
        logger.info('Item added to queue', { id: item.id, type });
        return item.id;
    }

    /**
     * Get all queued items
     */
    async getAll(): Promise<QueueItem[]> {
        const files = fs.readdirSync(this.queueDir).filter(f => f.endsWith('.json'));
        const items: QueueItem[] = [];

        for (const file of files) {
            try {
                const filePath = path.join(this.queueDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const item = JSON.parse(content);
                items.push(item);
            } catch (error) {
                logger.error('Failed to read queue item', { file, error });
            }
        }

        return items.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Remove item from queue
     */
    async dequeue(id: string): Promise<void> {
        const filePath = path.join(this.queueDir, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info('Item removed from queue', { id });
        }
    }

    /**
     * Update item retry count
     */
    async updateRetries(id: string, retries: number): Promise<void> {
        const filePath = path.join(this.queueDir, `${id}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const item = JSON.parse(content);
            item.retries = retries;
            fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
        }
    }

    /**
     * Get queue size
     */
    async size(): Promise<number> {
        const files = fs.readdirSync(this.queueDir).filter(f => f.endsWith('.json'));
        return files.length;
    }

    /**
     * Clear all items from queue
     */
    async clear(): Promise<void> {
        const files = fs.readdirSync(this.queueDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            fs.unlinkSync(path.join(this.queueDir, file));
        }
        logger.info('Queue cleared');
    }
}

export default new QueueService();
