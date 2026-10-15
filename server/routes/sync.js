import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pushChanges, pullChanges } from '../controllers/syncController.js';

const router = Router();
router.use(requireAuth);
router.post('/push', pushChanges);
router.post('/pull', pullChanges);
export default router;
