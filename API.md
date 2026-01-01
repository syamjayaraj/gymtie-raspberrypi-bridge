# API Documentation

## Base URL

```
http://localhost:3000
```

## Endpoints

### Health Endpoints

#### Get Overall Health

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-29T06:00:00.000Z",
  "uptime": 3600,
  "config": {
    "gymId": 1,
    "strapiUrl": "https://api.gymtie.com",
    "hikvisionIp": "192.168.1.100"
  },
  "services": {
    "strapi": "healthy",
    "hikvision": "healthy"
  },
  "queue": {
    "size": 0
  }
}
```

#### Check Device Connectivity

```http
GET /health/device
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Device is reachable",
  "device": {
    "ip": "192.168.1.100",
    "port": 80
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Device connection failed: ECONNREFUSED",
  "device": {
    "ip": "192.168.1.100",
    "port": 80
  }
}
```

#### Check Strapi Connectivity

```http
GET /health/strapi
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Strapi is reachable",
  "strapi": {
    "url": "https://api.gymtie.com",
    "gymId": 1
  }
}
```

---

### Sync Endpoints

#### Sync All Members

```http
POST /sync/members
```

Syncs all members from Strapi to the local device.

**Response:**
```json
{
  "success": true,
  "message": "Synced 45 out of 50 members",
  "results": {
    "total": 50,
    "successful": 45,
    "failed": 5,
    "errors": [
      "Member 123: Invalid validity date",
      "Member 456: Device connection timeout"
    ]
  }
}
```

#### Sync Single Member

```http
POST /sync/member/:memberId
```

**Parameters:**
- `memberId` (path): Member ID from Strapi

**Example:**
```bash
curl -X POST http://localhost:3000/sync/member/123
```

**Response:**
```json
{
  "success": true,
  "message": "Member 123 synced successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Member not found"
}
```

#### Get Sync Status

```http
GET /sync/status
```

Returns the status of the last sync operation.

**Response:**
```json
{
  "success": true,
  "status": {
    "lastSync": "2025-12-29T06:00:00.000Z",
    "totalMembers": 50,
    "successful": 45,
    "failed": 5,
    "errors": [
      "Member 123: Invalid validity date"
    ]
  }
}
```

---

### Attendance Endpoints

#### Handle Attendance Event (Webhook)

```http
POST /attendance/event
```

This endpoint is called by the Hikvision device when a member scans their face/fingerprint.

**Request Body:**
```json
{
  "AcsEvent": {
    "employeeNo": "123",
    "time": "2025-12-29T09:30:00",
    "major": 5,
    "minor": 0,
    "doorNo": 1
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Response (Queued):**
```json
{
  "success": true,
  "queued": true
}
```

#### Pull Attendance Logs

```http
POST /attendance/pull
```

Manually pulls attendance logs from the device for the last 10 minutes.

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 logs, queued 0",
  "results": {
    "total": 5,
    "successful": 5,
    "failed": 0,
    "queued": 0,
    "errors": []
  }
}
```

#### Get Queued Attendance

```http
GET /attendance/queue
```

Returns all queued attendance events (when Strapi is unreachable).

**Response:**
```json
{
  "success": true,
  "queueSize": 3,
  "items": [
    {
      "id": "1735459200000-abc123",
      "type": "attendance",
      "data": {
        "memberId": 123,
        "gymId": 1,
        "date": "2025-12-29",
        "checkIn": "09:30:00"
      },
      "timestamp": 1735459200000,
      "retries": 2
    }
  ]
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "success": false,
  "error": "Invalid member ID"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Member not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Detailed error message (development only)"
}
```

### 503 Service Unavailable

```json
{
  "success": false,
  "error": "Device connection failed: ECONNREFUSED"
}
```

---

## Scheduled Jobs

The following jobs run automatically:

### Member Sync Job
- **Schedule**: Every 15 minutes (configurable)
- **Action**: Syncs all members from Strapi to device
- **Logs**: `[CRON] Starting member sync job...`

### Attendance Pull Job
- **Schedule**: Every 5 minutes (configurable)
- **Action**: Pulls attendance logs from device
- **Logs**: `[CRON] Starting attendance pull job...`

### Queue Retry Job
- **Schedule**: Every 2 minutes (configurable)
- **Action**: Retries queued attendance events
- **Logs**: `[CRON] Processing N queued items...`

---

## Authentication

Currently, all endpoints are public (no authentication required). This is because:
1. The application runs on a local network
2. The device webhook needs to call `/attendance/event` without auth

For production deployments, consider:
- IP whitelisting at network level
- VPN for remote access
- API key authentication for manual endpoints
