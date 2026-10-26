import { Router } from 'express';
import { PapelUsuario } from '@prisma/client';
import { movimentacaoController } from '../controllers/movimentacao.controller';
import { permitir } from '../middlewares/auth.middleware';
import { asyncRoute } from '../middlewares/error.middleware';

const router = Router();
const cadastro = permitir(PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO);
const leitura = permitir(PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO, PapelUsuario.AUDITOR);
router.get('/', leitura, asyncRoute(movimentacaoController.listar));
router.get('/:id', leitura, asyncRoute(movimentacaoController.buscar));
router.post('/', cadastro, asyncRoute(movimentacaoController.criar));
router.patch('/:id', cadastro, asyncRoute(movimentacaoController.atualizar));
router.delete('/:id', permitir(PapelUsuario.ADMINISTRADOR), asyncRoute(movimentacaoController.excluir));
export default router;
