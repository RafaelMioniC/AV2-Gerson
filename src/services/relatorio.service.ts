import { StatusEquipamento, StatusLote } from '@prisma/client';
import { relatorioRepository } from '../repositories/relatorio.repository';

export function montarLotesPorStatus(contagens: Array<{ status: StatusLote; quantidade: number }>) {
  const mapa = new Map(contagens.map(item => [item.status, item.quantidade] as const));
  return Object.values(StatusLote).map(status => ({ status, quantidade: mapa.get(status) ?? 0 }));
}

export const relatorioService = {
  async resumo() {
    const [organizacoes, lotes, equipamentos, movimentacoes, usuarios] = await relatorioRepository.resumoContagens();
    const [porStatus, lotesPorStatusRaw] = await Promise.all([
      relatorioRepository.equipamentosPorStatus(),
      relatorioRepository.lotesPorStatus(),
    ]);
    const contagens = new Map<StatusEquipamento, number>(porStatus.map(item => [item.status, item._count._all] as const));
    return {
      organizacoes, lotes, equipamentos, movimentacoes, usuarios,
      lotesPorStatus: montarLotesPorStatus(lotesPorStatusRaw.map(item => ({ status: item.status, quantidade: item._count._all }))),
      porStatus: Object.values(StatusEquipamento).map(status => ({ status, quantidade: contagens.get(status) ?? 0 }))
    };
  },
};
