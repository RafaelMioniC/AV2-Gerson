import { prisma } from '../config/prisma';

export const relatorioRepository = {
  resumoContagens() {
    return Promise.all([
      prisma.organizacao.count(), prisma.lote.count(), prisma.equipamento.count({ where: { ativo: true } }),
      prisma.movimentacao.count(), prisma.usuario.count(),
    ]);
  },
  equipamentosPorStatus() {
    return prisma.equipamento.groupBy({ by: ['status'], where: { ativo: true }, _count: { _all: true } });
  },
  lotesPorStatus() {
    return prisma.lote.groupBy({ by: ['status'], _count: { _all: true } });
  },
};
