import { Router } from 'express';
import { PapelUsuario } from '@prisma/client';
import { auditoriaController } from '../controllers/auditoria.controller';
import { permitir } from '../middlewares/auth.middleware';
import { asyncRoute } from '../middlewares/error.middleware';

const router = Router();
router.get('/', permitir(PapelUsuario.ADMINISTRADOR, PapelUsuario.AUDITOR), asyncRoute(auditoriaController.listar));
export default router;
