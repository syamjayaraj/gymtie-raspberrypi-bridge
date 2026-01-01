import axios, { AxiosInstance } from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import config from '../utils/config';
import logger from '../utils/logger';

const parseXML = promisify(parseString);

interface MemberData {
    id: number;
    name: string;
    validity: string | null;
    blocked: boolean;
    active: boolean;
}

interface AttendanceLog {
    employeeNo: string;
    time: string;
    doorNo: number;
}

class HikvisionService {
    private client: AxiosInstance;
    private baseUrl: string;

    constructor() {
        this.baseUrl = `http://${config.hikvision.ip}:${config.hikvision.port}`;
        this.client = axios.create({
            baseURL: this.baseUrl,
            auth: {
                username: config.hikvision.username,
                password: config.hikvision.password,
            },
            headers: {
                'Content-Type': 'application/xml',
            },
            timeout: 10000,
        });
    }

    /**
     * Test connection to Hikvision device
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.client.get('/ISAPI/System/deviceInfo');
            logger.info('Hikvision device connection successful');
            return response.status === 200;
        } catch (error: any) {
            logger.error('Hikvision device connection failed', { error: error.message });
            throw new Error(`Device connection failed: ${error.message}`);
        }
    }

    /**
     * Sync member to device
     */
    async syncMember(member: MemberData): Promise<void> {
        try {
            // Check if member should be on device
            const shouldBeOnDevice = this.shouldMemberBeOnDevice(member);

            if (!shouldBeOnDevice) {
                // Remove from device if present
                await this.deleteMember(member.id.toString());
                logger.info(`Member ${member.id} removed from device (expired/blocked/inactive)`);
                return;
            }

            // Calculate validity dates
            const beginTime = new Date().toISOString().split('T')[0] + 'T00:00:00';
            const endTime = member.validity
                ? new Date(member.validity).toISOString().split('T')[0] + 'T23:59:59'
                : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T23:59:59';

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UserInfo>
  <employeeNo>${member.id}</employeeNo>
  <name>${this.escapeXml(member.name)}</name>
  <userType>normal</userType>
  <Valid>
    <enable>true</enable>
    <beginTime>${beginTime}</beginTime>
    <endTime>${endTime}</endTime>
  </Valid>
  <doorRight>
    <doorNo>1</doorNo>
  </doorRight>
</UserInfo>`;

            await this.client.put('/ISAPI/AccessControl/UserInfo/Record?format=json', xml);
            logger.info(`Member ${member.id} synced to device`, { name: member.name, endTime });
        } catch (error: any) {
            logger.error(`Failed to sync member ${member.id}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Delete member from device
     */
    async deleteMember(employeeNo: string): Promise<void> {
        try {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UserInfoDelCond>
  <EmployeeNoList>
    <employeeNo>${employeeNo}</employeeNo>
  </EmployeeNoList>
</UserInfoDelCond>`;

            await this.client.put('/ISAPI/AccessControl/UserInfo/Delete?format=json', xml);
            logger.info(`Member ${employeeNo} deleted from device`);
        } catch (error: any) {
            // Ignore 404 errors (member not on device)
            if (error.response?.status !== 404) {
                logger.error(`Failed to delete member ${employeeNo}`, { error: error.message });
            }
        }
    }

    /**
     * Get attendance logs from device
     */
    async getAttendanceLogs(startTime: Date, endTime: Date): Promise<AttendanceLog[]> {
        try {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>100</maxResults>
  <major>5</major>
  <minor>0</minor>
  <startTime>${startTime.toISOString()}</startTime>
  <endTime>${endTime.toISOString()}</endTime>
</AcsEventCond>`;

            const response = await this.client.post('/ISAPI/AccessControl/AcsEvent?format=json', xml);

            // Parse XML response
            const result: any = await parseXML(response.data);
            const events = result?.AcsEvent?.InfoList?.[0]?.Info || [];

            const logs: AttendanceLog[] = events.map((event: any) => ({
                employeeNo: event.employeeNo?.[0] || '',
                time: event.time?.[0] || '',
                doorNo: parseInt(event.doorNo?.[0] || '1', 10),
            }));

            logger.info(`Retrieved ${logs.length} attendance logs from device`);
            return logs;
        } catch (error: any) {
            logger.error('Failed to get attendance logs', { error: error.message });
            throw error;
        }
    }

    /**
     * Configure event listeners on device
     */
    async configureEventListeners(callbackUrl: string): Promise<void> {
        try {
            // Configure HTTP host
            const httpHostXml = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList>
  <HttpHostNotification>
    <id>1</id>
    <url>${callbackUrl}/attendance/event</url>
    <protocolType>HTTP</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>ipaddress</addressingFormatType>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
  </HttpHostNotification>
</HttpHostNotificationList>`;

            await this.client.put('/ISAPI/Event/notification/httpHosts', httpHostXml);

            // Enable arming mode
            const armingXml = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationArming>
  <id>1</id>
  <EventNotificationArmingList>
    <EventNotificationArming>
      <id>1</id>
      <enabled>true</enabled>
      <EventTypeList>
        <EventType>
          <major>5</major>
          <minor>0</minor>
        </EventType>
      </EventTypeList>
    </EventNotificationArming>
  </EventNotificationArmingList>
</EventNotificationArming>`;

            await this.client.put('/ISAPI/Event/notification/arming', armingXml);

            logger.info('Event listeners configured on device', { callbackUrl });
        } catch (error: any) {
            logger.error('Failed to configure event listeners', { error: error.message });
            throw error;
        }
    }

    /**
     * Check if member should be on device
     */
    private shouldMemberBeOnDevice(member: MemberData): boolean {
        if (member.blocked || !member.active) {
            return false;
        }

        if (member.validity) {
            const validityDate = new Date(member.validity);
            const now = new Date();
            if (validityDate < now) {
                return false;
            }
        }

        return true;
    }

    /**
     * Escape XML special characters
     */
    private escapeXml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

export default new HikvisionService();
