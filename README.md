# GymTie Local Bridge

A standalone Express application that runs on local gym devices (Raspberry Pi or similar) to bridge biometric/face recognition devices with the remote Strapi server.

## Overview

This application acts as a local bridge between:
- **Biometric Devices** (e.g., Hikvision DS-K1T343EFWX) - Local network
- **Remote Strapi Server** - Cloud/Internet

### Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Biometric     │◄────────│  Local Express   │◄────────│  Remote Strapi  │
│   Device        │  ISAPI  │  Bridge App      │  HTTPS  │     Server      │
│  (Hikvision)    │         │  (Raspberry Pi)  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Features

- ✅ **Member Sync**: Automatically syncs members from Strapi to local device
- ✅ **Attendance Logging**: Captures attendance events and sends to Strapi
- ✅ **Offline Resilience**: Queues data when cloud is unreachable
- ✅ **Health Monitoring**: Provides status endpoints for monitoring
- ✅ **Scheduled Jobs**: Automatic syncing via cron jobs
- ✅ **Docker Support**: Easy deployment with Docker Compose

## Quick Start

### Prerequisites

- Raspberry Pi (or any Linux device) with internet connection
- Docker and Docker Compose installed
- Hikvision device on local network
- Remote Strapi server with API access

### Installation

1. **Clone or copy this directory to your Raspberry Pi**

```bash
cd /home/pi
git clone <your-repo> gymtie-bridge
cd gymtie-bridge/local-bridge
```

2. **Configure environment variables**

```bash
cp .env.example .env
nano .env
```

Edit the following required variables:
- `STRAPI_URL`: Your remote Strapi server URL (e.g., `https://api.gymtie.com`)
- `STRAPI_API_TOKEN`: Your Strapi API token (or use email/password)
- `GYM_ID`: Your gym ID from Strapi
- `HIKVISION_IP`: Local IP of your biometric device (e.g., `192.168.1.100`)
- `HIKVISION_USERNAME`: Device username (usually `admin`)
- `HIKVISION_PASSWORD`: Device password

3. **Deploy**

```bash
./deploy.sh
```

The script will:
- Install Docker if needed
- Create necessary directories
- Build the Docker image
- Start the container

## Usage

### Health Checks

Check overall health:
```bash
curl http://localhost:3000/health
```

Check device connectivity:
```bash
curl http://localhost:3000/health/device
```

Check Strapi connectivity:
```bash
curl http://localhost:3000/health/strapi
```

### Member Sync

Sync all members from Strapi to device:
```bash
curl -X POST http://localhost:3000/sync/members
```

Sync single member:
```bash
curl -X POST http://localhost:3000/sync/member/123
```

Get sync status:
```bash
curl http://localhost:3000/sync/status
```

### Attendance

Manually pull attendance logs:
```bash
curl -X POST http://localhost:3000/attendance/pull
```

View queued attendance (when offline):
```bash
curl http://localhost:3000/attendance/queue
```

## Scheduled Jobs

The application runs three automatic cron jobs:

1. **Member Sync** (every 15 minutes)
   - Syncs all members from Strapi to device
   - Removes expired/blocked members

2. **Attendance Pull** (every 5 minutes)
   - Pulls attendance logs from device
   - Sends to Strapi or queues if offline

3. **Queue Retry** (every 2 minutes)
   - Retries queued attendance when Strapi is available
   - Removes items after 10 failed retries

You can adjust intervals in `.env`:
```
MEMBER_SYNC_INTERVAL=15
ATTENDANCE_PULL_INTERVAL=5
QUEUE_RETRY_INTERVAL=2
```

## Docker Commands

View logs:
```bash
docker logs -f gymtie-bridge
```

Stop container:
```bash
docker-compose down
```

Restart container:
```bash
docker-compose restart
```

Rebuild and restart:
```bash
docker-compose up -d --build
```

## Development

### Local Development (without Docker)

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run in development mode**
```bash
npm run dev
```

4. **Build for production**
```bash
npm run build
npm start
```

### Project Structure

```
local-bridge/
├── src/
│   ├── controllers/       # Request handlers
│   │   ├── sync.controller.ts
│   │   ├── attendance.controller.ts
│   │   └── health.controller.ts
│   ├── services/          # Business logic
│   │   ├── hikvision.service.ts
│   │   ├── strapi.service.ts
│   │   └── queue.service.ts
│   ├── jobs/              # Cron jobs
│   │   ├── member-sync.job.ts
│   │   ├── attendance-pull.job.ts
│   │   └── queue-retry.job.ts
│   ├── routes/            # API routes
│   │   ├── sync.routes.ts
│   │   ├── attendance.routes.ts
│   │   └── health.routes.ts
│   ├── utils/             # Utilities
│   │   ├── config.ts
│   │   └── logger.ts
│   └── index.ts           # Application entry point
├── logs/                  # Application logs
├── data/queue/            # Queued items
├── Dockerfile
├── docker-compose.yml
├── deploy.sh
└── package.json
```

## Troubleshooting

### Device Connection Failed

**Error**: "Device is not reachable"

**Solutions**:
1. Verify device IP is correct: `ping <HIKVISION_IP>`
2. Check device is powered on
3. Ensure device and Raspberry Pi are on same network
4. Verify device credentials are correct
5. Check device web interface is accessible: `http://<HIKVISION_IP>`

### Strapi Connection Failed

**Error**: "Strapi connection failed"

**Solutions**:
1. Verify Strapi URL is correct and accessible
2. Check API token is valid
3. Ensure Raspberry Pi has internet connection
4. Check firewall settings

### Members Not Syncing

**Check**:
1. View logs: `docker logs -f gymtie-bridge`
2. Test device connection: `curl http://localhost:3000/health/device`
3. Test Strapi connection: `curl http://localhost:3000/health/strapi`
4. Manually trigger sync: `curl -X POST http://localhost:3000/sync/members`

### Attendance Not Logging

**Check**:
1. Verify member exists in Strapi
2. Check member has biometric data on device
3. View queued items: `curl http://localhost:3000/attendance/queue`
4. Manually pull logs: `curl -X POST http://localhost:3000/attendance/pull`

## Security Considerations

1. **Network Security**
   - Keep device and Raspberry Pi on private network
   - Use VPN for remote access
   - Don't expose ports to internet

2. **Credentials**
   - Store credentials in `.env` file only
   - Never commit `.env` to version control
   - Use strong passwords for device

3. **API Token**
   - Use Strapi API tokens instead of email/password when possible
   - Rotate tokens regularly
   - Limit token permissions to minimum required

## Support

For issues or questions:
1. Check logs: `docker logs -f gymtie-bridge`
2. Test health endpoints
3. Review this documentation
4. Contact support with log details

## License

MIT
