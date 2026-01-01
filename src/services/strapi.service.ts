import axios, { AxiosInstance } from 'axios';
import config from '../utils/config';
import logger from '../utils/logger';

interface Member {
    id: number;
    attributes: {
        name: string;
        validity: string | null;
        blocked: boolean;
        active: boolean;
        gym: {
            data: {
                id: number;
            };
        };
    };
}

interface AttendanceData {
    memberId: number;
    gymId: number;
    date: string;
    checkIn: string;
    checkOut?: string;
}

class StrapiService {
    private client: AxiosInstance;
    private jwt: string | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: config.strapi.url,
            timeout: 15000,
        });
    }

    /**
     * Authenticate with Strapi
     */
    async authenticate(): Promise<void> {
        try {
            if (config.strapi.apiToken) {
                // Use API token
                this.jwt = config.strapi.apiToken;
                this.client.defaults.headers.common['Authorization'] = `Bearer ${this.jwt}`;
                logger.info('Authenticated with Strapi using API token');
            } else if (config.strapi.email && config.strapi.password) {
                // Use email/password
                const response = await this.client.post('/api/auth/local', {
                    identifier: config.strapi.email,
                    password: config.strapi.password,
                });
                this.jwt = response.data.jwt;
                this.client.defaults.headers.common['Authorization'] = `Bearer ${this.jwt}`;
                logger.info('Authenticated with Strapi using email/password');
            } else {
                throw new Error('No authentication method configured');
            }
        } catch (error: any) {
            logger.error('Strapi authentication failed', { error: error.message });
            throw new Error(`Strapi authentication failed: ${error.message}`);
        }
    }

    /**
     * Test connection to Strapi
     */
    async testConnection(): Promise<boolean> {
        try {
            if (!this.jwt) {
                await this.authenticate();
            }
            const response = await this.client.get('/api/gyms/' + config.gym.id);
            logger.info('Strapi connection successful');
            return response.status === 200;
        } catch (error: any) {
            logger.error('Strapi connection failed', { error: error.message });
            throw new Error(`Strapi connection failed: ${error.message}`);
        }
    }

    /**
     * Get all members for the configured gym
     */
    async getMembers(): Promise<Member[]> {
        try {
            if (!this.jwt) {
                await this.authenticate();
            }

            const response = await this.client.get('/api/members', {
                params: {
                    'filters[gym][id][$eq]': config.gym.id,
                    'populate': 'gym',
                    'pagination[pageSize]': 1000,
                },
            });

            const members = response.data.data || [];
            logger.info(`Retrieved ${members.length} members from Strapi`);
            return members;
        } catch (error: any) {
            logger.error('Failed to get members from Strapi', { error: error.message });
            throw error;
        }
    }

    /**
     * Get a single member
     */
    async getMember(memberId: number): Promise<Member | null> {
        try {
            if (!this.jwt) {
                await this.authenticate();
            }

            const response = await this.client.get(`/api/members/${memberId}`, {
                params: {
                    'populate': 'gym',
                },
            });

            return response.data.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            logger.error(`Failed to get member ${memberId} from Strapi`, { error: error.message });
            throw error;
        }
    }

    /**
     * Create attendance record in Strapi
     */
    async createAttendance(data: AttendanceData): Promise<void> {
        try {
            if (!this.jwt) {
                await this.authenticate();
            }

            // Check if attendance already exists for this date
            const existingResponse = await this.client.get('/api/attendances', {
                params: {
                    'filters[member][id][$eq]': data.memberId,
                    'filters[date][$eq]': data.date,
                },
            });

            const existing = existingResponse.data.data?.[0];

            if (existing) {
                // Update checkout time
                await this.client.put(`/api/attendances/${existing.id}`, {
                    data: {
                        checkOut: data.checkOut || data.checkIn,
                    },
                });
                logger.info(`Updated attendance for member ${data.memberId}`, { date: data.date });
            } else {
                // Create new attendance
                await this.client.post('/api/attendances', {
                    data: {
                        member: data.memberId,
                        gym: data.gymId,
                        date: data.date,
                        checkIn: data.checkIn,
                        checkOut: data.checkOut,
                    },
                });
                logger.info(`Created attendance for member ${data.memberId}`, { date: data.date });
            }
        } catch (error: any) {
            logger.error('Failed to create/update attendance in Strapi', { error: error.message, data });
            throw error;
        }
    }

    /**
     * Update member biometric status
     */
    async updateMemberBiometric(memberId: number, hasFaceTemplate: boolean): Promise<void> {
        try {
            if (!this.jwt) {
                await this.authenticate();
            }

            await this.client.put(`/api/members/${memberId}`, {
                data: {
                    hasFaceTemplate,
                },
            });

            logger.info(`Updated biometric status for member ${memberId}`, { hasFaceTemplate });
        } catch (error: any) {
            logger.error(`Failed to update biometric status for member ${memberId}`, { error: error.message });
            throw error;
        }
    }
}

export default new StrapiService();
