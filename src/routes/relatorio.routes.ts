import { Router } from 'express';
import { PapelUsuario } from '@prisma/client';
import { relatorioController } from '../controllers/relatorio.controller';
import { permitir } from '../middlewares/auth.middleware';
import { asyncRoute } from '../middlewares/error.middleware';

const router = Router();
const podeConsultarRelatorio = permitir(
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.AUDITOR,
);

router.get(
  '/resumo',
  podeConsultarRelatorio,
  asyncRoute(relatorioController.resumo),
);

export default router;
