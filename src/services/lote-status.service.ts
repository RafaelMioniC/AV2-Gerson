import { Prisma, StatusEquipamento } from '@prisma/client';

const statusEncaminhado = new Set<StatusEquipamento>([
  StatusEquipamento.ENCAMINHADO,
  StatusEquipamento.DESMONTE,
  StatusEquipamento.RECICLAGEM,
  StatusEquipamento.DESCARTE,
]);
const statusTriagemConcluida = new Set<StatusEquipamento>([
  StatusEquipamento.TRIAGEM_CONCLUIDA,
  StatusEquipamento.ENCAMINHADO,
  StatusEquipamento.DESMONTE,
  StatusEquipamento.RECICLAGEM,
  StatusEquipamento.DESCARTE,
]);

export function derivarStatusLote(
  statuses: StatusEquipamento[],
): 'RECEBIDO' | 'EM_TRIAGEM' | 'TRIAGEM_CONCLUIDA' | 'ENCAMINHADO' | 'FINALIZADO' {
  if (statuses.length === 0) return 'RECEBIDO';
  const finalizados = statuses.every(status => status === StatusEquipamento.RECICLAGEM || status === StatusEquipamento.DESCARTE);
  if (finalizados) return 'FINALIZADO';
  const encaminhados = statuses.every(status => statusEncaminhado.has(status));
  if (encaminhados) return 'ENCAMINHADO';
  const triagemConcluida = statuses.every(status => statusTriagemConcluida.has(status));
  if (triagemConcluida) return 'TRIAGEM_CONCLUIDA';
  if (statuses.some(status => status !== StatusEquipamento.RECEBIDO)) return 'EM_TRIAGEM';
  return 'RECEBIDO';
}


/** Recalcula o status do lote considerando apenas equipamentos ativos. */
export async function recalcularStatusLote(
  tx: Prisma.TransactionClient,
  loteId: string,
): Promise<void> {
  const lote = await tx.lote.findUnique({
    where: { id: loteId },
    select: { id: true, status: true },
  });

  if (!lote) return;

  const equipamentosAtivos = await tx.equipamento.findMany({
    where: { loteId, ativo: true },
    select: { status: true },
  });
  const statusCalculado = derivarStatusLote(
    equipamentosAtivos.map((equipamento) => equipamento.status),
  );

  if (lote.status !== statusCalculado) {
    await tx.lote.update({
      where: { id: loteId },
      data: {
        status: statusCalculado,
        versao: { increment: 1 },
      },
    });
  }
}
