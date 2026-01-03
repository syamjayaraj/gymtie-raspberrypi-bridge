import DigestClient from 'digest-fetch';
import config from '../utils/config';
import logger from '../utils/logger';

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
    private baseUrl: string;
    private client: DigestClient;

    constructor() {
        this.baseUrl = `http://${config.hikvision.ip}:${config.hikvision.port}`;
        this.client = new DigestClient(config.hikvision.username, config.hikvision.password, {
            algorithm: 'MD5',
        });
    }

    /**
     * Test connection to Hikvision device
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.client.fetch(`${this.baseUrl}/ISAPI/System/deviceInfo`);
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
            // console.log(`\n========== SYNCING MEMBER ${member.id} ==========`);
            // console.log(`Member Name: ${member.name}`);
            // console.log(`Member Data:`, JSON.stringify(member, null, 2));

            // Check if member should have access
            const hasAccess = this.shouldMemberBeOnDevice(member);
            // console.log(`Has access: ${hasAccess}`);

            // If member doesn't have access, delete them from device
            if (!hasAccess) {
                // console.log(`❌ Member ${member.id} expired/blocked - deleting from device...`);
                try {
                    await this.deleteMember(member.id.toString());
                    // console.log(`✅ Member ${member.id} (${member.name}) deleted successfully`);
                    logger.info(`Member ${member.id} deleted from device (expired/blocked/inactive)`);
                } catch (error: any) {
                    if (error.response?.status === 404) {
                        // console.log(`ℹ️ Member ${member.id} not on device`);
                    } else {
                        console.error(`❌ Failed to delete member ${member.id}:`, error.message);
                    }
                }
                // console.log(`========== END SYNC ${member.id} ==========\n`);
                return;
            }
            // Calculate validity dates (matching Strapi logic exactly)
            let joiningDate = new Date().toISOString(); // Default to now if no joining date
            let endDate: string;

            if (hasAccess && member.validity) {
                const validityDate = new Date(member.validity);
                validityDate.setHours(23, 59, 59, 999);
                endDate = validityDate.toISOString();
            } else if (hasAccess) {
                endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            } else {
                // Expired/blocked - set to yesterday to block access
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(23, 59, 59, 999);
                endDate = yesterday.toISOString();
            }

            // Ensure beginTime is not after endTime (prevents Hikvision error)
            if (new Date(joiningDate) > new Date(endDate)) {
                joiningDate = new Date(new Date(endDate).getTime() - 24 * 60 * 60 * 1000).toISOString();
            }

            const beginTime = this.formatDate(joiningDate);
            const endTime = this.formatDate(endDate);

            // console.log(`Validity Period: ${beginTime} to ${endTime}`);


            // Create JSON payload (matching Strapi format)
            const payload = {
                UserInfo: {
                    employeeNo: String(member.id),
                    name: member.name,
                    userType: 'normal',
                    departmentNo: '1',
                    Valid: {
                        enable: true,  // Always true for active members (expired ones are deleted)
                        beginTime: beginTime,
                        endTime: endTime,
                        timeType: 'local'
                    },
                    doorRight: '1',
                    RightPlan: [
                        {
                            doorNo: 1,
                            planTemplateNo: '1'
                        }
                    ]
                }
            };

            // console.log(`\n📤 Sending JSON to device:`);
            // console.log(JSON.stringify(payload, null, 2));
            // console.log(`\n🌐 Request URL: ${this.baseUrl}/ISAPI/AccessControl/UserInfo/Modify?format=json`);

            const response = await this.client.fetch(`${this.baseUrl}/ISAPI/AccessControl/UserInfo/Modify?format=json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);
            // const responseText = await response.text();
            // console.log(`📥 Response Body:`, responseText);

            if (response.status === 200) {
                // const accessStatus = hasAccess ? '✅ ENABLED' : '🚫 DISABLED';
                // console.log(`${accessStatus} Member ${member.id} (${member.name}) synced successfully!`);
                logger.info(`Member ${member.id} synced to device`, {
                    name: member.name,
                    endTime,
                    accessEnabled: hasAccess
                });
            } else {
                // console.log(`⚠️ Unexpected status code: ${response.status}`);
            }

            // console.log(`========== END SYNC ${member.id} ==========\n`);
        } catch (error: any) {
            console.error(`\n❌ ERROR syncing member ${member.id}:`);
            console.error(`Error message: ${error.message}`);
            console.error(`Error stack:`, error.stack);
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

            await this.client.fetch(`${this.baseUrl}/ISAPI/AccessControl/UserInfo/Delete?format=json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/xml' },
                body: xml,
            });
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
            console.log('[HIKVISION] Getting attendance logs...');
            console.log(`[HIKVISION] Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

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

            const response = await this.client.fetch(`${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/xml' },
                body: xml,
            });

            console.log(`[HIKVISION] Response status: ${response.status}`);

            // Parse JSON response (not XML because of ?format=json)
            const responseText = await response.text();
            console.log(`[HIKVISION] Response body:`, responseText.substring(0, 500));

            const result: any = JSON.parse(responseText);
            const events = result?.AcsEvent?.InfoList || [];

            console.log(`[HIKVISION] Found ${events.length} events`);

            const logs: AttendanceLog[] = events.map((event: any) => ({
                employeeNo: event.employeeNoString || event.employeeNo || '',
                time: event.time || '',
                doorNo: parseInt(event.doorNo || '1', 10),
            }));

            console.log(`[HIKVISION] Parsed ${logs.length} attendance logs`);
            logger.info(`Retrieved ${logs.length} attendance logs from device`);
            return logs;
        } catch (error: any) {
            console.error('[HIKVISION] Failed to get attendance logs:', error.message);
            logger.error('Failed to get attendance logs', { error: error.message });
            return []; // Return empty array instead of throwing
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

            await this.client.fetch(`${this.baseUrl}/ISAPI/Event/notification/httpHosts`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/xml' },
                body: httpHostXml,
            });

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

            await this.client.fetch(`${this.baseUrl}/ISAPI/Event/notification/arming`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/xml' },
                body: armingXml,
            });

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
            validityDate.setHours(23, 59, 59, 999); // End of validity day
            const now = new Date();
            if (validityDate < now) {
                return false;
            }
        }

        return true;
    }

    /**
     * Format date for Hikvision (YYYY-MM-DDTHH:mm:ss)
     */
    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }
}

export default new HikvisionService();
