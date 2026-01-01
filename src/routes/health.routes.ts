import { Router } from 'express';
import * as healthController from '../controllers/health.controller';

const router = Router();

// Overall health check
router.get('/', healthController.getHealth);

// Check device connectivity
router.get('/device', healthController.checkDevice);

// Check Strapi connectivity
router.get('/strapi', healthController.checkStrapi);

export default router;
