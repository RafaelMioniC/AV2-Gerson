import { Router } from 'express';
import { PapelUsuario } from '@prisma/client';
import { criarEntidadeController } from '../controllers/entidade.controller';
import { permitir } from '../middlewares/auth.middleware';
import { asyncRoute } from '../middlewares/error.middleware';

const router = Router();

const admin = permitir(PapelUsuario.ADMINISTRADOR);
const operador = permitir(
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.OPERADOR_CADASTRO,
);
const gestor = permitir(
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.GESTOR_ALMOXARIFADO,
);
const leituraCompleta = permitir(
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.OPERADOR_CADASTRO,
  PapelUsuario.GESTOR_ALMOXARIFADO,
  PapelUsuario.AUDITOR,
);
const leituraOperacional = permitir(
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.GESTOR_ALMOXARIFADO,
  PapelUsuario.AUDITOR,
);

/**
 * As permissões de leitura, gravação e exclusão são separadas.
 * A exclusão de organizações e contratos é exclusiva do administrador,
 * pois pode remover grande quantidade de dados relacionados.
 */
const permissoes: Record<
  string,
  {
    ler: ReturnType<typeof permitir>;
    gravar: ReturnType<typeof permitir>;
    excluir: ReturnType<typeof permitir>;
  }
> = {
  organizacoes: {
    ler: leituraCompleta,
    gravar: operador,
    excluir: admin,
  },
  contratos: {
    ler: leituraCompleta,
    gravar: operador,
    excluir: admin,
  },
  lotes: {
    ler: leituraOperacional,
    gravar: gestor,
    excluir: gestor,
  },
  equipamentos: {
    ler: leituraOperacional,
    gravar: gestor,
    excluir: gestor,
  },
  usuarios: {
    ler: admin,
    gravar: admin,
    excluir: admin,
  },
};

for (const nome of Object.keys(permissoes)) {
  const controller = criarEntidadeController(nome);
  const permissao = permissoes[nome];

  router.get(`/${nome}`, permissao.ler, asyncRoute(controller.listar));
  router.get(`/${nome}/:id`, permissao.ler, asyncRoute(controller.buscar));
  router.post(`/${nome}`, permissao.gravar, asyncRoute(controller.criar));
  router.patch(`/${nome}/:id`, permissao.gravar, asyncRoute(controller.atualizar));
  router.delete(`/${nome}/:id`, permissao.excluir, asyncRoute(controller.excluir));
}

export default router;
