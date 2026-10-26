import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { auditoriaRepository } from '../repositories/auditoria.repository';

const erro = (mensagem: string, status: number) => Object.assign(new Error(mensagem), { status });

export const configuracaoService = {
  async obter() {
    const configuracao = await prisma.configuracao.findUnique({ where: { id: 'GLOBAL' } });
    if (configuracao) return configuracao;
    return prisma.configuracao.create({ data: { id: 'GLOBAL', aliquotaImposto: 0, coeficienteDepreciacao: 0 } });
  },
  async atualizar(entrada: unknown, usuario: NonNullable<Express.Request['usuario']>) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw erro('O corpo deve ser um objeto JSON.', 400);
    const dados = entrada as Record<string, unknown>;
    const desconhecidos = Object.keys(dados).filter(chave => !['versao', 'aliquotaImposto', 'coeficienteDepreciacao'].includes(chave));
    if (desconhecidos.length) throw erro(`Campo(s) não permitido(s): ${desconhecidos.join(', ')}.`, 400);
    if (!Number.isInteger(dados.versao) || Number(dados.versao) < 1) throw erro('Informe a versão atual no campo versao.', 400);
    for (const campo of ['aliquotaImposto', 'coeficienteDepreciacao']) {
      const valor = dados[campo];
      if (valor !== undefined && (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100)) {
        throw erro(`${campo} deve ser um número entre 0 e 100.`, 400);
      }
    }
    for (const campo of ['aliquotaImposto', 'coeficienteDepreciacao']) {
      const valor = dados[campo];
      if (typeof valor === 'number' && Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-8) throw erro(`${campo} deve possuir no máximo duas casas decimais.`, 400);
    }
    if (dados.aliquotaImposto === undefined && dados.coeficienteDepreciacao === undefined) throw erro('Informe aliquotaImposto e/ou coeficienteDepreciacao.', 400);
    const atual = await prisma.configuracao.findUnique({ where: { id: 'GLOBAL' } })
      ?? await prisma.configuracao.create({ data: { id: 'GLOBAL', aliquotaImposto: 0, coeficienteDepreciacao: 0 } });
    if (atual.versao !== Number(dados.versao)) throw Object.assign(erro('A configuração foi alterada por outra requisição. Atualize e tente novamente.', 409), { code: 'VERSION_CONFLICT' });
    return prisma.$transaction(async tx => {
      const atualizado = await tx.configuracao.updateMany({
        where: { id: 'GLOBAL', versao: Number(dados.versao) },
        data: {
          ...(dados.aliquotaImposto !== undefined ? { aliquotaImposto: new Prisma.Decimal(dados.aliquotaImposto as number) } : {}),
          ...(dados.coeficienteDepreciacao !== undefined ? { coeficienteDepreciacao: new Prisma.Decimal(dados.coeficienteDepreciacao as number) } : {}),
          atualizadoPor: usuario.usuario,
          versao: { increment: 1 },
        },
      });
      if (!atualizado.count) throw Object.assign(erro('Conflito de versão da configuração.', 409), { code: 'VERSION_CONFLICT' });
      await auditoriaRepository.registrar(usuario.usuario, 'ATUALIZAR', 'CONFIGURACAO', 'GLOBAL', `aliquotaImposto: ${atual.aliquotaImposto} -> ${dados.aliquotaImposto ?? atual.aliquotaImposto}; coeficienteDepreciacao: ${atual.coeficienteDepreciacao} -> ${dados.coeficienteDepreciacao ?? atual.coeficienteDepreciacao}`, tx);
      return tx.configuracao.findUniqueOrThrow({ where: { id: 'GLOBAL' } });
    });
  },
};
