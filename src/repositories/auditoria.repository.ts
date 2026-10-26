import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
type DbClient = PrismaClient | Prisma.TransactionClient;

export const auditoriaRepository = {
  registrar(usuario: string, acao: string, entidade: string, id: string, detalhes: string, db: DbClient = prisma) {
    return db.auditoria.create({ data: { usuario, acao, entidade: entidade.toLocaleUpperCase('pt-BR'), entidadeId: id, detalhes } });
  },
  async listar(filtros: Record<string, unknown> = {}) {
    const where: Prisma.AuditoriaWhereInput = {};
    if (typeof filtros.acao === 'string' && filtros.acao.trim()) where.acao = { contains: filtros.acao.trim().slice(0, 100) };
    if (typeof filtros.entidade === 'string' && filtros.entidade.trim()) {
      where.entidade = filtros.entidade.trim().slice(0, 100).toLocaleUpperCase('pt-BR');
    }
    if (typeof filtros.entidadeId === 'string' && filtros.entidadeId.trim()) {
      where.entidadeId = filtros.entidadeId.trim().slice(0, 191);
    }
    if (typeof filtros.dataInicio === 'string' && filtros.dataInicio.trim()) {
      const dataInicio = new Date(filtros.dataInicio);
      if (Number.isNaN(dataInicio.getTime())) {
        throw Object.assign(new Error('dataInicio inválida.'), { status: 400 });
      }
      where.data = { ...((where.data as object) ?? {}), gte: dataInicio };
    }
    if (typeof filtros.dataFim === 'string' && filtros.dataFim.trim()) {
      const dataFim = new Date(filtros.dataFim);
      if (Number.isNaN(dataFim.getTime())) {
        throw Object.assign(new Error('dataFim inválida.'), { status: 400 });
      }
      where.data = { ...((where.data as object) ?? {}), lte: dataFim };
    }
    if (typeof filtros.usuario === 'string' && filtros.usuario.trim()) where.usuario = { contains: filtros.usuario.trim().slice(0, 100) };
    const pagina = Math.max(1, Number.parseInt(String(filtros.page ?? '1'), 10) || 1);
    const limite = Math.min(500, Math.max(1, Number.parseInt(String(filtros.limit ?? '50'), 10) || 50));
    const [total, dados] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({ where, orderBy: { data: 'desc' }, skip: (pagina - 1) * limite, take: limite }),
    ]);
    return { dados, total, pagina, limite, totalPaginas: Math.ceil(total / limite) };
  },
};
