import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { asyncRoute } from '../middlewares/error.middleware';
import { autenticar } from '../middlewares/auth.middleware';

const router = Router();
router.post('/login', asyncRoute(authController.login));
router.post('/logout', autenticar, asyncRoute(authController.logout));
export default router;
