import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { entidadeRepository } from '../repositories/entidade.repository';
import { auditoriaRepository } from '../repositories/auditoria.repository';
import { validarDados, validarEquipamentoAninhado } from '../validators/entidade.validator';
import { recalcularStatusLote } from './lote-status.service';

const erro = (mensagem: string, status: number) => Object.assign(new Error(mensagem), { status });

async function exigirContratoVigente(tx: Prisma.TransactionClient, organizacaoId: string): Promise<void> {
  const agora = new Date();
  const inicioHoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
  const amanha = new Date(inicioHoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const contratos = await tx.contrato.findMany({ where: { organizacaoId }, orderBy: { dataFim: 'desc' } });
  if (!contratos.length) throw erro('Não é possível criar lote ou adicionar equipamento: a organização não possui contrato cadastrado.', 409);
  const ativos = contratos.filter(c => c.ativo);
  if (!ativos.length) throw erro('Não é possível criar lote ou adicionar equipamento: todos os contratos da organização estão inativos. Reative ou crie um novo contrato.', 409);
  if (ativos.some(c => c.dataInicio < amanha && c.dataFim >= inicioHoje)) return;
  if (ativos.some(c => c.dataInicio >= amanha)) throw erro('Não é possível criar lote ou adicionar equipamento: o contrato ainda não entrou em vigência.', 409);
  throw erro('Não é possível criar lote ou adicionar equipamento: todos os contratos ativos estão vencidos.', 409);
}

export const entidadeService = {
  listar(nome: string, filtros: Record<string, unknown> = {}) {
    if (typeof filtros.status === 'string' && filtros.status.trim()) {
      const statusLote = ['RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO'];
      const statusEquipamento = ['RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'DESMONTE', 'RECICLAGEM', 'DESCARTE'];
      const validos = nome === 'lotes' ? statusLote : nome === 'equipamentos' ? statusEquipamento : [];
      if (!validos.length || !validos.includes(filtros.status.trim())) throw erro('Filtro status inválido para este recurso.', 400);
    }
    if (
      filtros.ativo !== undefined &&
      !['organizacoes', 'contratos', 'usuarios', 'equipamentos', 'lotes'].includes(nome)
    ) {
      throw erro('Filtro ativo não está disponível para este recurso.', 400);
    }
    if (
      filtros.ativo !== undefined &&
      !['true', 'false'].includes(String(filtros.ativo))
    ) {
      throw erro('Filtro ativo deve ser true ou false.', 400);
    }
    if (
      filtros.page !== undefined &&
      (!Number.isInteger(Number(filtros.page)) || Number(filtros.page) < 1)
    ) {
      throw erro('page deve ser um inteiro maior que zero.', 400);
    }
    if (
      filtros.limit !== undefined &&
      (!Number.isInteger(Number(filtros.limit)) || Number(filtros.limit) < 1 || Number(filtros.limit) > 500)
    ) {
      throw erro('limit deve ser um inteiro entre 1 e 500.', 400);
    }
    return entidadeRepository.listar(nome, filtros);
  },

  async buscar(nome: string, id: string) {
    const item = await entidadeRepository.buscarPorId(nome, id);
    if (!item) throw erro('Registro não encontrado.', 404);

    if (nome === 'usuarios') {
      delete item.senhaHash;
    }

    return item;
  },

  async criar(nome: string, entrada: unknown, usuarioLogado: NonNullable<Express.Request['usuario']>) {
    const origem = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada as Record<string, unknown> : {};
    const listaEquipamentos = nome === 'lotes' && Array.isArray(origem.equipamentos) ? origem.equipamentos : [];
    const data = validarDados(nome, entrada);

    if (nome === 'lotes' && data.ativo === false) throw erro('Lotes devem ser criados ativos; use PATCH ou DELETE para arquivar após o cadastro.', 400);
    if (nome === 'equipamentos') {
      delete data.justificativa;

      if (data.ativo === false) {
        throw erro('Equipamentos devem ser cadastrados ativos. Use a operação de desativação após o cadastro.', 400);
      }
    }

    const equipamentosValidados: Omit<Prisma.EquipamentoCreateManyInput, 'loteId'>[] =
      listaEquipamentos.map((item, indice) =>
        validarEquipamentoAninhado(item, indice) as Omit<Prisma.EquipamentoCreateManyInput, 'loteId'>
      );

    if (nome === 'usuarios') {
      if (!data.usuario || !data.senha || !data.papel) throw erro('Usuário, senha e papel são obrigatórios.', 400);
      data.senhaHash = await bcrypt.hash(data.senha, 12);
      delete data.senha;
    }
    const item = await prisma.$transaction(async tx => {
      if (nome === 'equipamentos' && typeof data.loteId === 'string') {
        const lote = await tx.lote.findUnique({ where: { id: data.loteId }, select: { id: true, ativo: true, organizacaoId: true, organizacao: { select: { ativo: true } } } });
        if (!lote) throw erro('Lote informado não encontrado.', 404);
        if (!lote.ativo || !lote.organizacao.ativo) throw erro('Não é possível vincular equipamento a lote ou organização inativa.', 409);
        await exigirContratoVigente(tx, lote.organizacaoId);
      }
      if ((nome === 'contratos' || nome === 'lotes') && typeof data.organizacaoId === 'string') {
        const organizacao = await tx.organizacao.findUnique({ where: { id: data.organizacaoId }, select: { id: true, ativo: true } });
        if (!organizacao) throw erro('Organização informada não encontrada.', 404);
        if (!organizacao.ativo) throw erro('Não é possível criar contrato ou lote para uma organização inativa.', 409);
      }
      if (nome === 'lotes' && typeof data.organizacaoId === 'string') {
        await exigirContratoVigente(tx, data.organizacaoId);
      }
      if (nome === 'organizacoes' && typeof data.cnpj === 'string') {
        const duplicada = await tx.organizacao.findUnique({ where: { cnpj: data.cnpj }, select: { id: true, ativo: true } });
        if (duplicada) throw erro(duplicada.ativo ? 'Já existe uma organização com este CNPJ.' : 'Já existe uma organização inativa com este CNPJ; reative-a em vez de cadastrar outra.', 409);
      }
      if (nome === 'usuarios' && typeof data.usuario === 'string') {
        const duplicado = await tx.usuario.findUnique({ where: { usuario: data.usuario }, select: { id: true, ativo: true } });
        if (duplicado) throw erro(duplicado.ativo ? 'Já existe um usuário com este nome.' : 'Já existe um usuário inativo com este nome; reative-o em vez de cadastrar outro.', 409);
      }
      if (nome === 'equipamentos' && typeof data.codigoBarrasInterno === 'string') {
        const duplicado = await tx.equipamento.findUnique({ where: { codigoBarrasInterno: data.codigoBarrasInterno }, select: { id: true, ativo: true } });
        if (duplicado) throw erro(duplicado.ativo ? 'Já existe um equipamento com este código de barras.' : 'Já existe um equipamento inativo com este código de barras; reative-o em vez de cadastrar outro.', 409);
      }
      const criado = await entidadeRepository.criar(nome, data, tx);
      if (nome === 'equipamentos' && typeof data.loteId === 'string') {
        await recalcularStatusLote(tx, data.loteId);
      }
      if (nome === 'lotes' && equipamentosValidados.length > 0) {
        const equipamentosParaCriar: Prisma.EquipamentoCreateManyInput[] =
          equipamentosValidados.map((equipamento) => ({
            ...equipamento,
            loteId: criado.id,
          }) as Prisma.EquipamentoCreateManyInput);

        await tx.equipamento.createMany({
          data: equipamentosParaCriar,
        });

        await recalcularStatusLote(tx, criado.id);
      }
      const detalheCadastro = equipamentosValidados.length > 0
        ? `Cadastro de ${nome} com ${equipamentosValidados.length} equipamento(s)`
        : `Cadastro de ${nome}`;

      await auditoriaRepository.registrar(
        usuarioLogado.usuario,
        'CRIAR',
        nome,
        criado.id,
        detalheCadastro,
        tx,
      );
      if (nome === 'lotes' && equipamentosValidados.length > 0) {
        return tx.lote.findUnique({
          where: { id: criado.id },
          include: { equipamentos: { where: { ativo: true } } },
        });
      }

      return criado;
    }, { timeout: 15000 });
    if (nome === 'usuarios') {
      delete item.senhaHash;
    }

    return item;
  },

  async atualizar(nome: string, id: string, entrada: unknown, usuarioLogado: NonNullable<Express.Request['usuario']>) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
      throw erro('O corpo da requisição deve ser um objeto JSON.', 400);
    }
    const versao = (entrada as Record<string, unknown>).versao;
    if (!Number.isInteger(versao) || Number(versao) < 1) throw erro('Informe a versão atual do registro no campo versao.', 400);
    const data = validarDados(nome, entrada, true);
    const atual = await entidadeRepository.buscarPorId(nome, id);
    if (!atual) throw erro('Registro não encontrado.', 404);
    if (nome === 'contratos' && atual.ativo === false && data.dataFim !== undefined) throw erro('Contrato inativo: reative-o antes de alterar dataFim ou use o fluxo de renovação.', 409);
    const dataInicio = data.dataInicio ?? atual.dataInicio;
    const dataFim = data.dataFim ?? atual.dataFim;
    if (
      nome === 'contratos' &&
      dataInicio instanceof Date &&
      dataFim instanceof Date &&
      dataFim <= dataInicio
    ) {
      throw erro('dataFim deve ser estritamente posterior a dataInicio.', 400);
    }
    let justificativaEstado = '';

    if (nome === 'equipamentos' && data.estadoFisico !== undefined) {
      const niveis: Record<string, number> = {
        NOVO: 7,
        BOM_ESTADO: 6,
        USADO_LEVE: 5,
        USADO_MODERADO: 4,
        DANIFICADO_LEVE: 3,
        DANIFICADO_GRAVE: 2,
        IRRECUPERAVEL: 1,
      };
      const queda =
        (niveis[String(atual.estadoFisico)] ?? 0) -
        (niveis[String(data.estadoFisico)] ?? 0);
      justificativaEstado =
        typeof data.justificativa === 'string'
          ? data.justificativa.trim()
          : '';

      if (queda >= 2 && !justificativaEstado) {
        throw erro(
          'É obrigatória uma justificativa quando o estado físico cair duas ou mais categorias.',
          400,
        );
      }

      if (data.estadoFisico === atual.estadoFisico && justificativaEstado) {
        throw erro(
          'A justificativa só pode ser informada quando o estado físico for alterado.',
          400,
        );
      }

      delete data.justificativa;
    } else {
      delete data.justificativa;
    }
    if (Object.keys(data).length === 0) throw erro('Informe ao menos um campo para atualizar.', 400);
    if (nome === 'contratos' && data.ativo === false && usuarioLogado.papel !== 'ADMINISTRADOR') throw erro('Somente administradores podem encerrar contratos.', 403);
    let senhaAlterada = false;

    if (nome === 'usuarios') {
      if (id === usuarioLogado.id && data.ativo === false) throw erro('Não é permitido desativar o próprio usuário.', 403);
      delete data.senhaHash;
      if (data.senha) {
        senhaAlterada = true;
        data.senhaHash = await bcrypt.hash(data.senha, 12);
        delete data.senha;
      } else {
        delete data.senha;
      }
      if (
        id === usuarioLogado.id &&
        data.papel &&
        data.papel !== usuarioLogado.papel
      ) {
        throw erro('Não é permitido alterar o próprio papel.', 403);
      }
      if (atual.protegido && data.senhaHash && id !== usuarioLogado.id) {
        throw erro('Outro administrador não pode trocar a senha do administrador protegido sem reautenticação.', 403);
      }
      if (
        atual.protegido &&
        (
          (data.usuario !== undefined && data.usuario !== atual.usuario) ||
          data.ativo === false ||
          (data.papel !== undefined && data.papel !== 'ADMINISTRADOR')
        )
      ) {
        throw erro(
          'O administrador principal protegido não pode ser renomeado, desativado ou rebaixado.',
          403,
        );
      }
    }
    const item = await prisma.$transaction(async tx => {
      if (
        nome === 'usuarios' &&
        atual.papel === 'ADMINISTRADOR' &&
        atual.ativo &&
        (data.ativo === false || (data.papel && data.papel !== 'ADMINISTRADOR'))
      ) {
        const adminsAtivos = await tx.usuario.count({ where: { papel: 'ADMINISTRADOR', ativo: true } });
        if (adminsAtivos <= 1) throw erro('Não é possível desativar ou rebaixar o último administrador ativo.', 409);
      }
      if (nome === 'equipamentos' && typeof data.loteId === 'string') {
        const lote = await tx.lote.findUnique({ where: { id: data.loteId }, select: { id: true, ativo: true, organizacaoId: true, organizacao: { select: { ativo: true } } } });
        if (!lote) throw erro('Lote informado não encontrado.', 404);
        if (!lote.ativo || !lote.organizacao.ativo) throw erro('Não é possível vincular equipamento a lote ou organização inativa.', 409);
        if (data.loteId !== atual.loteId) await exigirContratoVigente(tx, lote.organizacaoId);
      }
      if ((nome === 'contratos' || nome === 'lotes') && typeof data.organizacaoId === 'string') {
        const organizacao = await tx.organizacao.findUnique({ where: { id: data.organizacaoId }, select: { id: true, ativo: true } });
        if (!organizacao) throw erro('Organização informada não encontrada.', 404);
        if (!organizacao.ativo) throw erro('Não é possível vincular contrato ou lote a uma organização inativa.', 409);
      }
      if (nome === 'lotes' && typeof data.organizacaoId === 'string' && data.organizacaoId !== atual.organizacaoId) {
        await exigirContratoVigente(tx, data.organizacaoId);
      }
      if (nome === 'organizacoes' && typeof data.cnpj === 'string') {
        const duplicada = await tx.organizacao.findUnique({ where: { cnpj: data.cnpj }, select: { id: true, ativo: true } });
        if (duplicada && duplicada.id !== id) throw erro(duplicada.ativo ? 'Já existe uma organização com este CNPJ.' : 'Já existe uma organização inativa com este CNPJ; reative-a em vez de reutilizar o valor.', 409);
      }
      if (nome === 'usuarios' && typeof data.usuario === 'string') {
        const duplicado = await tx.usuario.findUnique({ where: { usuario: data.usuario }, select: { id: true, ativo: true } });
        if (duplicado && duplicado.id !== id) throw erro(duplicado.ativo ? 'Já existe um usuário com este nome.' : 'Já existe um usuário inativo com este nome; reative-o em vez de reutilizar o valor.', 409);
      }
      if (nome === 'equipamentos' && typeof data.codigoBarrasInterno === 'string') {
        const duplicado = await tx.equipamento.findUnique({ where: { codigoBarrasInterno: data.codigoBarrasInterno }, select: { id: true, ativo: true } });
        if (duplicado && duplicado.id !== id) throw erro(duplicado.ativo ? 'Já existe um equipamento com este código de barras.' : 'Já existe um equipamento inativo com este código de barras; reative-o em vez de reutilizar o valor.', 409);
      }
      const atualizado = await entidadeRepository.atualizar(nome, id, Number(versao), data, tx);

      if (nome === 'lotes' && data.ativo === false) {
        await tx.equipamento.updateMany({ where: { loteId: id, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
      }
      if (nome === 'organizacoes' && data.ativo === false) {
        const lotes = await tx.lote.findMany({ where: { organizacaoId: id }, select: { id: true } });
        const loteIds = lotes.map(l => l.id);
        await tx.contrato.updateMany({ where: { organizacaoId: id, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
        await tx.lote.updateMany({ where: { organizacaoId: id, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
        if (loteIds.length) await tx.equipamento.updateMany({ where: { loteId: { in: loteIds }, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
      }
      if (nome === 'contratos' && data.ativo === false) {
        await auditoriaRepository.registrar(usuarioLogado.usuario, 'ENCERRAR', nome, id, `Contrato encerrado; versão ${versao} -> ${Number(versao) + 1}`, tx);
      }

      if (nome === 'usuarios' && senhaAlterada) {
        await tx.sessao.deleteMany({ where: { usuarioId: id } });
      }

      if (nome === 'equipamentos') {
        const lotesAfetados = new Set<string>();

        if (typeof atual.loteId === 'string') {
          lotesAfetados.add(atual.loteId);
        }

        if (typeof atualizado.loteId === 'string') {
          lotesAfetados.add(atualizado.loteId);
        }

        if (
          data.loteId !== undefined ||
          data.status !== undefined ||
          data.ativo !== undefined
        ) {
          for (const loteId of lotesAfetados) {
            await recalcularStatusLote(tx, loteId);
          }
        }
      }

      const mudancas = Object.entries(data).map(([campo, valor]) => {
        if (campo === 'senhaHash') return 'senha: [alterada]';
        const anterior = (atual as Record<string, unknown>)[campo];
        const formatar = (item: unknown) => {
          if (item instanceof Date) return item.toISOString();
          if (item === undefined) return 'não definido';
          return JSON.stringify(item);
        };
        return `${campo}: ${formatar(anterior)} -> ${formatar(valor)}`;
      }).join('; ');
      const detalheJustificativa = justificativaEstado
        ? `; justificativa do estado físico: ${justificativaEstado}`
        : '';

      const acaoAuditoria = nome === 'contratos' && data.ativo === false
        ? 'ENCERRAR'
        : data.ativo === false
        ? 'DESATIVAR'
        : data.ativo === true
          ? 'REATIVAR'
          : 'ATUALIZAR';

      if (!(nome === 'contratos' && data.ativo === false)) await auditoriaRepository.registrar(
        usuarioLogado.usuario, acaoAuditoria, nome, id,
        `Edição de ${nome}; versão ${versao} -> ${Number(versao) + 1}; ${mudancas || 'sem campos'}${detalheJustificativa}`, tx,
      );
      return atualizado;
    });
    if (nome === 'usuarios') {
      delete item.senhaHash;
    }

    return item;
  },

  async excluir(nome: string, id: string, usuarioLogado: NonNullable<Express.Request['usuario']>) {
    const papeisPermitidos: Record<string, string[]> = {
      organizacoes: ['ADMINISTRADOR'],
      contratos: ['ADMINISTRADOR'],
      lotes: ['ADMINISTRADOR', 'GESTOR_ALMOXARIFADO'],
      equipamentos: ['ADMINISTRADOR', 'GESTOR_ALMOXARIFADO'],
      usuarios: ['ADMINISTRADOR'],
    };

    if (!papeisPermitidos[nome]?.includes(usuarioLogado.papel)) {
      throw erro('Seu perfil não tem permissão para excluir este recurso.', 403);
    }

    if (nome === 'usuarios' && id === usuarioLogado.id) {
      throw erro('Não é possível excluir o próprio usuário.', 400);
    }
    const item = await prisma.$transaction(async tx => {
      // Organizações, contratos, lotes e usuários usam inativação lógica:
      // preserva IDs, vínculos, histórico e auditoria para rastreabilidade.
      if (['organizacoes', 'contratos', 'usuarios', 'lotes'].includes(nome)) {
        const atual = await entidadeRepository.buscarPorId(nome, id, tx);
        if (!atual) throw erro('Registro não encontrado.', 404);
        if (!atual.ativo) throw erro('O registro já está inativo.', 409);

        if (nome === 'usuarios') {
          if (atual.protegido) {
            throw erro('O administrador principal é protegido contra inativação.', 403);
          }
          if (atual.papel === 'ADMINISTRADOR') {
            const adminsAtivos = await tx.usuario.count({ where: { papel: 'ADMINISTRADOR', ativo: true } });
            if (adminsAtivos <= 1) throw erro('Não é possível inativar o último administrador ativo.', 409);
          }
        }

        const modelo: any = nome === 'organizacoes' ? tx.organizacao : nome === 'contratos' ? tx.contrato : nome === 'lotes' ? tx.lote : tx.usuario;
        const resultado = await modelo.updateMany({
          where: { id, versao: atual.versao, ativo: true },
          data: { ativo: false, versao: { increment: 1 } },
        });
        if (resultado.count === 0) {
          throw erro('O registro foi alterado por outra requisição. Atualize os dados e tente novamente.', 409);
        }

        if (nome === 'usuarios') {
          await tx.sessao.deleteMany({ where: { usuarioId: id } });
        }
        if (nome === 'lotes') {
          await tx.equipamento.updateMany({ where: { loteId: id, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
        }
        if (nome === 'organizacoes') {
          await tx.contrato.updateMany({ where: { organizacaoId: id, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
          const lotes = await tx.lote.findMany({ where: { organizacaoId: id }, select: { id: true } });
          const loteIds = lotes.map(l => l.id);
          await tx.lote.updateMany({ where: { organizacaoId: id, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
          if (loteIds.length) await tx.equipamento.updateMany({ where: { loteId: { in: loteIds }, ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
        }

        await auditoriaRepository.registrar(
          usuarioLogado.usuario,
          nome === 'contratos' ? 'ENCERRAR' : 'DESATIVAR',
          nome,
          id,
          nome === 'organizacoes' ? 'Organização inativada; contratos, lotes e equipamentos relacionados também foram inativados. Movimentações preservadas.' : nome === 'lotes' ? 'Lote arquivado; equipamentos inativados e movimentações preservadas.' : `Inativação lógica de ${nome}; dados e relacionamentos preservados.`,
          tx,
        );
        return { id, desativado: true };
      }

      if (nome === 'equipamentos') {
        const equipamento = await tx.equipamento.findUnique({ where: { id }, select: { id: true, loteId: true, ativo: true } });
        if (!equipamento) throw erro('Registro não encontrado.', 404);
        const quantidadeMovimentacoes = await tx.movimentacao.count({ where: { equipamentoId: id } });
        if (quantidadeMovimentacoes > 0) {
          if (!equipamento.ativo) throw erro('O equipamento já está inativo.', 409);
          await tx.equipamento.update({ where: { id }, data: { ativo: false, versao: { increment: 1 } } });
          await recalcularStatusLote(tx, equipamento.loteId);
          await auditoriaRepository.registrar(
            usuarioLogado.usuario,
            'DESATIVAR',
            nome,
            id,
            'Equipamento desativado para preservar o histórico de movimentações.',
            tx,
          );
          return { id, loteId: equipamento.loteId, desativado: true };
        }
      }
      const excluido = await entidadeRepository.excluir(nome, id, tx);
      if (nome === 'equipamentos') {
        await recalcularStatusLote(tx, excluido.loteId);
      }
      await auditoriaRepository.registrar(usuarioLogado.usuario, 'EXCLUIR', nome, id, `Exclusão de ${nome}`, tx);
      return excluido;
    });
    if (item.desativado) {
      return {
        mensagem: ['organizacoes', 'contratos', 'usuarios'].includes(nome)
          ? 'Registro inativado (soft delete). Os dados e relacionamentos foram preservados.'
          : nome === 'lotes' ? 'Lote arquivado; equipamentos e movimentações foram preservados.'
          : 'Equipamento desativado para preservar o histórico de movimentações.',
        id: item.id,
        ativo: false,
      };
    }

    return { mensagem: 'Registro excluído.', id: item.id };
  },
};
