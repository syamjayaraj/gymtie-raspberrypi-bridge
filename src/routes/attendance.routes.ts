import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';

const router = Router();

// Webhook endpoint for device events (no auth)
router.post('/event', attendanceController.handleAttendanceEvent);

// Manual pull of attendance logs
router.post('/pull', attendanceController.pullAttendanceLogs);

// Get queued attendance
router.get('/queue', attendanceController.getQueuedAttendance);

export default router;
