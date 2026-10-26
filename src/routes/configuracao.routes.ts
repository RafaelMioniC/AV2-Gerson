import { Router } from 'express';
import { PapelUsuario } from '@prisma/client';
import { configuracaoController } from '../controllers/configuracao.controller';
import { permitir } from '../middlewares/auth.middleware';
import { asyncRoute } from '../middlewares/error.middleware';
const router = Router();
router.get('/', permitir(PapelUsuario.ADMINISTRADOR, PapelUsuario.AUDITOR), asyncRoute(configuracaoController.obter));
router.patch('/', permitir(PapelUsuario.ADMINISTRADOR), asyncRoute(configuracaoController.atualizar));
export default router;
