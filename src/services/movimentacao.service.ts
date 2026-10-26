import { StatusEquipamento } from '@prisma/client';
import { prisma } from '../config/prisma';
import { movimentacaoRepository } from '../repositories/movimentacao.repository';
import { recalcularStatusLote } from './lote-status.service';

export const transicoesPermitidas: Record<StatusEquipamento, StatusEquipamento[]> = {
  RECEBIDO: ['EM_TRIAGEM'],
  EM_TRIAGEM: ['TRIAGEM_CONCLUIDA'],
  TRIAGEM_CONCLUIDA: ['ENCAMINHADO', 'DESMONTE'],
  ENCAMINHADO: ['RECICLAGEM', 'DESCARTE'],
  DESMONTE: ['RECICLAGEM', 'DESCARTE'],
  RECICLAGEM: [],
  DESCARTE: [],
};
const erro = (mensagem: string, status: number) => Object.assign(new Error(mensagem), { status });


export const movimentacaoService = {
  listar(filtros: Record<string, unknown> = {}) {
    if (
      filtros.status !== undefined &&
      !Object.values(StatusEquipamento).includes(String(filtros.status) as StatusEquipamento)
    ) {
      throw erro('Filtro status inválido.', 400);
    }
    if (filtros.page !== undefined && (!Number.isInteger(Number(filtros.page)) || Number(filtros.page) < 1)) {
      throw erro('page deve ser um inteiro maior que zero.', 400);
    }
    if (filtros.limit !== undefined && (!Number.isInteger(Number(filtros.limit)) || Number(filtros.limit) < 1 || Number(filtros.limit) > 500)) {
      throw erro('limit deve ser um inteiro entre 1 e 500.', 400);
    }
    return movimentacaoRepository.listar(filtros);
  },

  async buscarPorId(id: string) {
    const item = await movimentacaoRepository.buscarPorId(id);
    if (!item) throw erro('Movimentação não encontrada.', 404);
    return item;
  },

  async atualizar(id: string, entrada: unknown, usuario: NonNullable<Express.Request['usuario']>) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw erro('O corpo deve ser um objeto JSON.', 400);
    const dados = entrada as Record<string, unknown>;
    const desconhecidos = Object.keys(dados).filter(campo => !['versao', 'justificativa', 'novoStatus'].includes(campo));
    if (desconhecidos.length) throw erro(`Campo(s) não permitido(s): ${desconhecidos.join(', ')}.`, 400);
    if (!Number.isInteger(dados.versao) || Number(dados.versao) < 1) throw erro('Informe a versão atual no campo versao.', 400);
    if (dados.justificativa === undefined && dados.novoStatus === undefined) throw erro('Informe justificativa e/ou novoStatus para atualizar.', 400);
    if (dados.justificativa !== undefined && (typeof dados.justificativa !== 'string' || dados.justificativa.length > 2000)) throw erro('justificativa deve ser texto com até 2000 caracteres.', 400);
    if (dados.novoStatus !== undefined && !Object.values(StatusEquipamento).includes(dados.novoStatus as StatusEquipamento)) throw erro('novoStatus inválido.', 400);

    return prisma.$transaction(async tx => {
      const atual = await movimentacaoRepository.buscarPorId(id, tx);
      if (!atual) throw erro('Movimentação não encontrada.', 404);
      if (atual.versao !== Number(dados.versao)) throw Object.assign(erro('A movimentação foi alterada por outra requisição. Atualize os dados e tente novamente.', 409), { code: 'VERSION_CONFLICT' });
      const alteracoes: { justificativa?: string; novoStatus?: StatusEquipamento } = {};
      if (dados.justificativa !== undefined) alteracoes.justificativa = (dados.justificativa as string).trim();

      if (dados.novoStatus !== undefined && dados.novoStatus !== atual.novoStatus) {
        const equipamento = await tx.equipamento.findUnique({ where: { id: atual.equipamentoId } });
        if (!equipamento) throw erro('Equipamento relacionado não encontrado.', 404);
        if (!equipamento.ativo) throw erro('Não é possível editar a movimentação de um equipamento inativo.', 409);
        const ultima = await tx.movimentacao.findFirst({ where: { equipamentoId: atual.equipamentoId }, orderBy: [{ data: 'desc' }, { id: 'desc' }] });
        if (ultima?.id !== id || equipamento.status !== atual.novoStatus) throw erro('Só é possível alterar o status da movimentação mais recente quando o status atual do equipamento corresponde ao destino registrado.', 409);
        const destino = dados.novoStatus as StatusEquipamento;
        if (!transicoesPermitidas[atual.statusAnterior].includes(destino)) throw erro(`Transição de status não permitida: ${atual.statusAnterior} -> ${destino}.`, 400);
        const equipamentoAtualizado = await tx.equipamento.updateMany({ where: { id: equipamento.id, versao: equipamento.versao }, data: { status: destino, versao: { increment: 1 } } });
        if (!equipamentoAtualizado.count) throw Object.assign(erro('O equipamento foi alterado por outra requisição.', 409), { code: 'VERSION_CONFLICT' });
        alteracoes.novoStatus = destino;
        await recalcularStatusLote(tx, equipamento.loteId);
      }

      if (Object.keys(alteracoes).length === 0) throw erro('Nenhuma alteração efetiva foi informada.', 400);
      const atualizado = await movimentacaoRepository.atualizar(id, Number(dados.versao), alteracoes, tx);
      if (!atualizado.count) throw Object.assign(erro('A movimentação foi alterada por outra requisição.', 409), { code: 'VERSION_CONFLICT' });
      await movimentacaoRepository.auditar(usuario.usuario, id, `Movimentação editada: ${Object.keys(alteracoes).join(', ')}; statusAnterior=${atual.statusAnterior}; novoStatus anterior=${atual.novoStatus}; novoStatus atual=${alteracoes.novoStatus ?? atual.novoStatus}; versão ${dados.versao} -> ${Number(dados.versao) + 1}`, tx, 'ATUALIZAR');
      return movimentacaoRepository.buscarPorId(id, tx);
    });
  },

  async excluir(id: string, versao: number, usuario: NonNullable<Express.Request['usuario']>) {
    if (usuario.papel !== 'ADMINISTRADOR') throw erro('Somente administradores podem excluir ou estornar movimentações.', 403);
    if (!Number.isInteger(versao) || versao < 1) throw erro('Informe a versão atual pela query string versao.', 400);
    return prisma.$transaction(async tx => {
      const atual = await tx.movimentacao.findUnique({ where: { id } });
      if (!atual) throw erro('Movimentação não encontrada.', 404);
      if (atual.versao !== versao) throw Object.assign(erro('A movimentação foi alterada por outra requisição.', 409), { code: 'VERSION_CONFLICT' });
      const equipamento = await tx.equipamento.findUnique({ where: { id: atual.equipamentoId } });
      if (!equipamento) throw erro('Equipamento relacionado não encontrado.', 404);
      const ultima = await tx.movimentacao.findFirst({ where: { equipamentoId: atual.equipamentoId }, orderBy: [{ data: 'desc' }, { id: 'desc' }] });
      if (ultima?.id !== id || equipamento.status !== atual.novoStatus) {
        throw erro('Só é possível excluir a movimentação mais recente do equipamento quando o status atual corresponde ao destino registrado.', 409);
      }
      const resultado = await movimentacaoRepository.excluir(id, versao, tx);
      if (!resultado.count) throw Object.assign(erro('A movimentação foi alterada por outra requisição.', 409), { code: 'VERSION_CONFLICT' });
      const restaurado = await tx.equipamento.updateMany({ where: { id: equipamento.id, versao: equipamento.versao }, data: { status: atual.statusAnterior, versao: { increment: 1 } } });
      if (!restaurado.count) throw Object.assign(erro('O equipamento foi alterado por outra requisição.', 409), { code: 'VERSION_CONFLICT' });
      await recalcularStatusLote(tx, equipamento.loteId);
      await movimentacaoRepository.auditar(usuario.usuario, id, `Movimentação excluída; status do equipamento restaurado de ${atual.novoStatus} para ${atual.statusAnterior}`, tx, 'EXCLUIR');
      return { mensagem: 'Movimentação excluída e status anterior restaurado.', id };
    });
  },

  async criar(entrada: unknown, usuario: NonNullable<Express.Request['usuario']>) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw erro('O corpo deve ser um objeto JSON.', 400);
    const dados = entrada as Record<string, unknown>;
    const { equipamentoId, novoStatus, justificativa = '', versao } = dados;
    if (
      typeof equipamentoId !== 'string' ||
      !equipamentoId.trim() ||
      !Object.values(StatusEquipamento).includes(novoStatus as StatusEquipamento)
    ) {
      throw erro('Equipamento e novo status válido são obrigatórios.', 400);
    }
    if (!Number.isInteger(versao) || Number(versao) < 1) throw erro('Informe a versão atual do equipamento no campo versao.', 400);
    if (typeof justificativa !== 'string' || justificativa.length > 2000) {
      throw erro('A justificativa deve ser texto com até 2000 caracteres.', 400);
    }

    return prisma.$transaction(async tx => {
      const equipamento = await movimentacaoRepository.buscarEquipamento(equipamentoId, tx);
      if (!equipamento) throw erro('Equipamento não encontrado.', 404);
      if (!equipamento.ativo) throw erro('Não é possível movimentar um equipamento inativo.', 409);
      if (equipamento.versao !== Number(versao)) {
        throw Object.assign(
          erro('O equipamento foi alterado por outra requisição. Atualize os dados e tente novamente.', 409),
          { code: 'VERSION_CONFLICT' },
        );
      }
      const destino = novoStatus as StatusEquipamento;
      if (!transicoesPermitidas[equipamento.status].includes(destino)) {
        throw erro(`Transição de status não permitida: ${equipamento.status} -> ${destino}.`, 400);
      }
      const atualizado = await movimentacaoRepository.atualizarStatusSeVersao(equipamentoId, Number(versao), destino, tx);
      if (atualizado.count !== 1) {
        throw Object.assign(
          erro('Conflito de versão. Atualize o equipamento e tente novamente.', 409),
          { code: 'VERSION_CONFLICT' },
        );
      }
      const movimento = await movimentacaoRepository.criar(equipamentoId, equipamento.status, destino, usuario.id, justificativa, tx);
      await recalcularStatusLote(tx, equipamento.loteId);
      await movimentacaoRepository.auditar(
        usuario.usuario,
        movimento.id,
        `${equipamento.status} -> ${destino}; equipamento versão ${versao} -> ${Number(versao) + 1}`,
        tx,
      );
      return movimento;
    });
  },
};
