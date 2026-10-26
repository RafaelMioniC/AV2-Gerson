import { Prisma, PrismaClient, StatusEquipamento } from '@prisma/client';
import { prisma } from '../config/prisma';
type DbClient = PrismaClient | Prisma.TransactionClient;

export const movimentacaoRepository = {
  async listar(filtros: Record<string, unknown> = {}) {
    const where: Prisma.MovimentacaoWhereInput = {};
    if (typeof filtros.equipamentoId === 'string' && filtros.equipamentoId.trim()) where.equipamentoId = filtros.equipamentoId.trim();
    if (typeof filtros.usuarioId === 'string' && filtros.usuarioId.trim()) where.usuarioId = filtros.usuarioId.trim();
    if (typeof filtros.status === 'string' && filtros.status.trim()) where.novoStatus = filtros.status.trim() as StatusEquipamento;
    if (typeof filtros.q === 'string' && filtros.q.trim()) {
      const q = filtros.q.trim().slice(0, 100);
      where.OR = [{ equipamento: { is: { codigoBarrasInterno: { contains: q } } } }, { autor: { is: { usuario: { contains: q } } } }];
    }
    const include = { equipamento: true, autor: { select: { id: true, usuario: true, papel: true } } };
    const pagina = Number(filtros.page ?? 1);
    const limite = Number(filtros.limit ?? 50);
    const [total, dados] = await Promise.all([
      prisma.movimentacao.count({ where }),
      prisma.movimentacao.findMany({ where, include, orderBy: { data: 'desc' }, skip: (pagina - 1) * limite, take: limite }),
    ]);
    return { dados, total, pagina, limite, totalPaginas: Math.ceil(total / limite) };
  },
  buscarPorId(id: string, db: DbClient = prisma) {
    return db.movimentacao.findUnique({
      where: { id },
      include: { equipamento: true, autor: { select: { id: true, usuario: true, papel: true } } },
    });
  },
  atualizar(id: string, versao: number, data: { justificativa?: string; novoStatus?: StatusEquipamento }, db: DbClient = prisma) {
    return db.movimentacao.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
  },
  excluir(id: string, versao: number, db: DbClient = prisma) {
    return db.movimentacao.deleteMany({ where: { id, versao } });
  },
  buscarEquipamento(id: string, db: DbClient) {
    return db.equipamento.findUnique({ where: { id } });
  },
  atualizarStatusSeVersao(id: string, versao: number, status: StatusEquipamento, db: DbClient) {
    return db.equipamento.updateMany({ where: { id, versao }, data: { status, versao: { increment: 1 } } });
  },
  criar(
    equipamentoId: string,
    statusAnterior: StatusEquipamento,
    novoStatus: StatusEquipamento,
    usuarioId: string,
    justificativa: string,
    db: DbClient,
  ) {
    return db.movimentacao.create({ data: { equipamentoId, statusAnterior, novoStatus, usuarioId, justificativa } });
  },
  auditar(usuario: string, entidadeId: string, detalhes: string, db: DbClient, acao = 'CRIAR') {
    return db.auditoria.create({ data: { usuario, acao, entidade: 'MOVIMENTACOES', entidadeId, detalhes } });
  },
};
