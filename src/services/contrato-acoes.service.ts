import { prisma } from '../config/prisma';
import { auditoriaRepository } from '../repositories/auditoria.repository';
import { parseDataIsoEstrita } from '../validators/iso-date.validator';
const erro = (mensagem: string, status: number) => Object.assign(new Error(mensagem), { status });
export const contratoAcoesService = {
  async renovar(id: string, entrada: unknown, usuario: NonNullable<Express.Request['usuario']>) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw erro('O corpo deve ser um objeto JSON.', 400);
    const dados = entrada as Record<string, unknown>;
    if (!Number.isInteger(dados.versao) || Number(dados.versao) < 1) throw erro('Informe a versão atual no campo versao.', 400);
    const dataFimValidada = parseDataIsoEstrita(dados.dataFim);
    if (!dataFimValidada) throw erro('Informe dataFim em formato ISO 8601 válido (YYYY-MM-DD ou timestamp ISO).', 400);
    return prisma.$transaction(async tx => {
      const atual = await tx.contrato.findUnique({ where: { id } });
      if (!atual) throw erro('Contrato não encontrado.', 404);
      if (!atual.ativo) throw erro('Não é possível renovar um contrato encerrado.', 409);
      const dataFim = dataFimValidada;
      if (dataFim <= atual.dataInicio) throw erro('A nova data de fim deve ser posterior à data de início.', 400);
      const resultado = await tx.contrato.updateMany({ where: { id, versao: Number(dados.versao), ativo: true }, data: { dataFim, versao: { increment: 1 } } });
      if (!resultado.count) throw Object.assign(erro('O contrato foi alterado por outra requisição. Atualize os dados.', 409), { code: 'VERSION_CONFLICT' });
      await auditoriaRepository.registrar(usuario.usuario, 'RENOVAR', 'contratos', id, `Nova data de fim: ${dataFim.toISOString()}`, tx);
      return tx.contrato.findUniqueOrThrow({ where: { id } });
    });
  },
  async encerrar(id: string, entrada: unknown, usuario: NonNullable<Express.Request['usuario']>) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw erro('O corpo deve ser um objeto JSON.', 400);
    const dados = entrada as Record<string, unknown>;
    if (!Number.isInteger(dados.versao) || Number(dados.versao) < 1) throw erro('Informe a versão atual no campo versao.', 400);
    return prisma.$transaction(async tx => {
      const atual = await tx.contrato.findUnique({ where: { id } });
      if (!atual) throw erro('Contrato não encontrado.', 404);
      if (!atual.ativo) throw erro('O contrato já está encerrado.', 409);
      const resultado = await tx.contrato.updateMany({ where: { id, versao: Number(dados.versao), ativo: true }, data: { ativo: false, versao: { increment: 1 } } });
      if (!resultado.count) throw Object.assign(erro('O contrato foi alterado por outra requisição. Atualize os dados.', 409), { code: 'VERSION_CONFLICT' });
      await auditoriaRepository.registrar(usuario.usuario, 'ENCERRAR', 'contratos', id, `Contrato encerrado; versão ${dados.versao} -> ${Number(dados.versao) + 1}`, tx);
      return tx.contrato.findUniqueOrThrow({ where: { id } });
    });
  },
};
