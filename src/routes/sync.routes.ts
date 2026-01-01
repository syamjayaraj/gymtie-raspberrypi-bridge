import { Router } from 'express';
import * as syncController from '../controllers/sync.controller';

const router = Router();

// Sync all members
router.post('/members', syncController.syncAllMembers);

// Sync single member
router.post('/member/:memberId', syncController.syncSingleMember);

// Get sync status
router.get('/status', syncController.getSyncStatus);

export default router;
