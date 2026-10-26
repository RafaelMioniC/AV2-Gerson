import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';

type DbClient = PrismaClient | Prisma.TransactionClient;

const modelos = (db: DbClient): Record<string, any> => ({
  organizacoes: db.organizacao,
  contratos: db.contrato,
  lotes: db.lote,
  equipamentos: db.equipamento,
  usuarios: db.usuario,
});

export function obterModelo(nome: string, db: DbClient = prisma): any {
  const modelo = modelos(db)[nome];
  if (!modelo) throw Object.assign(new Error('Recurso não encontrado.'), { status: 404 });
  return modelo;
}

export const entidadeRepository = {
  async listar(nome: string, filtros: Record<string, unknown> = {}) {
    const model = obterModelo(nome);
    const busca = typeof filtros.q === 'string' ? filtros.q.trim().slice(0, 100) : '';
    const camposBusca: Record<string, string[]> = {
      organizacoes: ['razaoSocial', 'cnpj', 'email', 'telefone'],
      contratos: ['descricao', 'organizacaoId'],
      lotes: ['notaFiscal', 'transportadora', 'organizacaoId'],
      equipamentos: ['codigoBarrasInterno', 'marca', 'modelo', 'local'],
      usuarios: ['usuario'],
    };
    const where: Record<string, unknown> = {};
    if (busca) where.OR = (camposBusca[nome] ?? []).map(campo => ({ [campo]: { contains: busca } }));
    if (
      typeof filtros.ativo === 'string' &&
      ['true', 'false'].includes(filtros.ativo) &&
      ['organizacoes', 'contratos', 'usuarios', 'equipamentos', 'lotes'].includes(nome)
    ) {
      where.ativo = filtros.ativo === 'true';
    }
    if (typeof filtros.status === 'string' && filtros.status.trim() && ['lotes', 'equipamentos'].includes(nome)) {
      where.status = filtros.status.trim();
    }
    if (nome === 'equipamentos' && typeof filtros.loteId === 'string' && filtros.loteId.trim()) {
      where.loteId = filtros.loteId.trim();
    }
    if (['lotes', 'contratos'].includes(nome) && typeof filtros.organizacaoId === 'string' && filtros.organizacaoId.trim()) {
      where.organizacaoId = filtros.organizacaoId.trim();
    }
    const pagina = Math.max(1, Number.parseInt(String(filtros.page ?? '1'), 10) || 1);
    const limite = Math.min(500, Math.max(1, Number.parseInt(String(filtros.limit ?? '50'), 10) || 50));
    const select = nome === 'usuarios'
      ? {
        id: true,
        usuario: true,
        papel: true,
        ativo: true,
        ultimoAcesso: true,
        criadoEm: true,
        versao: true,
        protegido: true,
      }
      : undefined;
    const [total, dados] = await Promise.all([
      model.count({ where }),
      model.findMany({
        where,
        ...(select ? { select } : {}),
        orderBy: { id: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return { dados, total, pagina, limite, totalPaginas: Math.ceil(total / limite) };
  },
  buscarPorId(nome: string, id: string, db: DbClient = prisma) {
    return obterModelo(nome, db).findUnique({
      where: { id },
      ...(nome === 'lotes'
        ? { include: { equipamentos: true } }
        : {}),
    });
  },
  criar(nome: string, data: Record<string, unknown>, db: DbClient = prisma) {
    return obterModelo(nome, db).create({ data });
  },
  async atualizar(nome: string, id: string, versao: number, data: Record<string, unknown>, db: DbClient = prisma) {
    const model = obterModelo(nome, db);
    const resultado = await model.updateMany({
      where: { id, versao },
      data: { ...data, versao: { increment: 1 } },
    });
    if (resultado.count === 0) {
      const existe = await model.findUnique({ where: { id }, select: { id: true } });
      if (!existe) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
      throw Object.assign(
        new Error('O registro foi alterado por outra requisição. Atualize os dados e tente novamente.'),
        { status: 409, code: 'VERSION_CONFLICT' },
      );
    }
    return model.findUnique({ where: { id } });
  },
  excluir(nome: string, id: string, db: DbClient = prisma) {
    return obterModelo(nome, db).delete({ where: { id } });
  },
};
