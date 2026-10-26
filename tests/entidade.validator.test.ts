import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDados } from '../src/validators/entidade.validator';
import { StatusEquipamento } from '@prisma/client';
import { transicoesPermitidas } from '../src/services/movimentacao.service';
import { derivarStatusLote } from '../src/services/lote-status.service';

function cnpjValido(base12: string): string {
  const digito = (base: string, pesos: number[]) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };
  const d1 = digito(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base12 + d1 + digito(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

test('aceita organização com CNPJ válido e normaliza pontuação', () => {
  const data = validarDados('organizacoes', {
    razaoSocial: 'Organização Teste', cnpj: cnpjValido('123456780001'), inscricaoEstadual: '123',
    enderecoCompleto: 'Rua Teste, 1', telefone: '11999999999', email: 'teste@example.com',
  });
  assert.equal(data.cnpj.length, 14);
});

test('rejeita CNPJ inválido', () => {
  assert.throws(() => validarDados('organizacoes', {
    razaoSocial: 'Organização Teste', cnpj: '11111111111111', inscricaoEstadual: '123',
    enderecoCompleto: 'Rua Teste, 1', telefone: '11999999999', email: 'teste@example.com',
  }), /CNPJ inválido/);
});

test('rejeita peso negativo ou zero', () => {
  assert.throws(() => validarDados('equipamentos', {
    loteId: 'lote', codigoBarrasInterno: 'GC-1', tipo: 'NOTEBOOK', marca: 'Marca', modelo: 'Modelo',
    anoFabricacao: 2022, estadoFisico: 'BOM_ESTADO', dataEntrada: new Date().toISOString().slice(0, 10), local: 'A', peso: 0,
  }), /peso deve ser um número maior que zero/);
});

test('exige versão em atualização parcial', () => {
  assert.throws(() => validarDados('organizacoes', { razaoSocial: 'Novo nome' }, true), /versao/);
  assert.equal(validarDados('organizacoes', { razaoSocial: 'Novo nome', versao: 2 }, true).razaoSocial, 'Novo nome');
});


test('matriz de transição permite avanço para triagem e bloqueia salto direto para descarte', () => {
  assert.equal(transicoesPermitidas[StatusEquipamento.RECEBIDO].includes(StatusEquipamento.EM_TRIAGEM), true);
  assert.equal(transicoesPermitidas[StatusEquipamento.RECEBIDO].includes(StatusEquipamento.DESCARTE), false);
  assert.equal(transicoesPermitidas[StatusEquipamento.TRIAGEM_CONCLUIDA].includes(StatusEquipamento.DESMONTE), true);
});

test('rejeita campos de texto obrigatórios vazios', () => {
  assert.throws(() => validarDados('organizacoes', {
    razaoSocial: '   ', cnpj: cnpjValido('123456780001'), inscricaoEstadual: '123',
    enderecoCompleto: 'Rua Teste, 1', telefone: '11999999999', email: 'teste@example.com',
  }), /razaoSocial não pode ficar vazio/);
});

test('limita o número de equipamentos por lote', () => {
  assert.throws(() => validarDados('lotes', {
    dataEntrada: new Date().toISOString(), organizacaoId: 'org-1', notaFiscal: 'NF-1',
    transportadora: 'TransEco', observacoes: 'Lote de teste', equipamentos: Array(501).fill({}),
  }), /no máximo 500 equipamentos/);
});


test('rejeita data de entrada do lote no futuro', () => {
  assert.throws(() => validarDados('lotes', {
    dataEntrada: '2035-01-01', organizacaoId: 'org-1', notaFiscal: 'NF-1',
    transportadora: 'TransEco', observacoes: 'Teste',
  }), /entre hoje e os últimos 90 dias/);
});

test('rejeita data de entrada do lote com mais de 90 dias', () => {
  assert.throws(() => validarDados('lotes', {
    dataEntrada: '2001-05-01', organizacaoId: 'org-1', notaFiscal: 'NF-1',
    transportadora: 'TransEco', observacoes: 'Teste',
  }), /entre hoje e os últimos 90 dias/);
});

test('rejeita datas numéricas e datas de calendário impossíveis', () => {
  assert.throws(() => validarDados('lotes', {
    dataEntrada: 5, organizacaoId: 'org-1', notaFiscal: 'NF-1', transportadora: 'TransEco', observacoes: 'Teste',
  }), /Data inválida/);
  assert.throws(() => validarDados('contratos', {
    organizacaoId: 'org-1', dataInicio: '2026-02-30', dataFim: '2026-03-01', descricao: 'Teste', valorMensal: 1,
  }), /Data inválida/);
});

test('rejeita contrato com data final igual à inicial', () => {
  assert.throws(() => validarDados('contratos', {
    organizacaoId: 'org-1', dataInicio: '2026-01-01', dataFim: '2026-01-01', descricao: 'Teste', valorMensal: 1,
  }), /estritamente posterior/);
});

test('permite observacoes e inscricao estadual vazias também na criação', () => {
  const dados = validarDados('organizacoes', {
    razaoSocial: 'Organização Teste', cnpj: cnpjValido('123456780001'), inscricaoEstadual: '',
    enderecoCompleto: 'Rua Teste, 1', telefone: '11999999999', email: 'teste@example.com',
  });
  assert.equal(dados.inscricaoEstadual, '');
  const lote = validarDados('lotes', {
    dataEntrada: new Date().toISOString().slice(0, 10), organizacaoId: 'org-1', notaFiscal: 'NF-1',
    transportadora: 'TransEco', observacoes: '',
  });
  assert.equal(lote.observacoes, '');
});

test('limita e-mail ao tamanho da coluna VARCHAR(191)', () => {
  const email = `${'a'.repeat(180)}@example.com`;
  assert.throws(() => validarDados('organizacoes', {
    razaoSocial: 'Organização Teste', cnpj: cnpjValido('123456780001'), inscricaoEstadual: '',
    enderecoCompleto: 'Rua Teste, 1', telefone: '11999999999', email,
  }), /ultrapassa o limite/);
});


test('deriva o status do lote a partir dos estados dos equipamentos', () => {
  assert.equal(derivarStatusLote([]), 'RECEBIDO');
  assert.equal(derivarStatusLote([StatusEquipamento.RECEBIDO, StatusEquipamento.EM_TRIAGEM]), 'EM_TRIAGEM');
  assert.equal(derivarStatusLote([StatusEquipamento.TRIAGEM_CONCLUIDA, StatusEquipamento.ENCAMINHADO]), 'TRIAGEM_CONCLUIDA');
  assert.equal(derivarStatusLote([StatusEquipamento.ENCAMINHADO, StatusEquipamento.DESMONTE]), 'ENCAMINHADO');
  assert.equal(derivarStatusLote([StatusEquipamento.RECICLAGEM, StatusEquipamento.DESCARTE]), 'FINALIZADO');
});

test('aceita valores mensais válidos apesar de imprecisão binária de ponto flutuante', () => {
  for (const valorMensal of [19.99, 8.2, 2.3, 1.15, 0.1, 9999999999.99]) {
    const dados = validarDados('contratos', {
      organizacaoId: 'org-1', dataInicio: '2026-01-01', dataFim: '2027-01-01',
      descricao: 'Contrato de teste', valorMensal,
    });
    assert.equal(dados.valorMensal, valorMensal);
  }
});

test('rejeita valor mensal com mais de duas casas decimais reais', () => {
  assert.throws(() => validarDados('contratos', {
    organizacaoId: 'org-1', dataInicio: '2026-01-01', dataFim: '2027-01-01',
    descricao: 'Contrato de teste', valorMensal: 19.999,
  }), /no máximo duas casas decimais/);
});

test('rejeita equipamento aninhado com ativo false', async () => {
  const { validarEquipamentoAninhado } = await import('../src/validators/entidade.validator');
  assert.throws(() => validarEquipamentoAninhado({ ativo: false }, 0), /devem ser cadastrados ativos/);
});

test('valida que equipamentos aninhados não aceitam loteId fornecido pelo cliente', async () => {
  const { validarEquipamentoAninhado } = await import('../src/validators/entidade.validator');
  assert.throws(() => validarEquipamentoAninhado({
    loteId: 'lote-manipulado', codigoBarrasInterno: 'GC-ANINHADO', tipo: 'NOTEBOOK',
    marca: 'Marca', modelo: 'Modelo', anoFabricacao: 2022, estadoFisico: 'BOM_ESTADO',
    dataEntrada: new Date().toISOString().slice(0, 10), local: 'Recebimento', peso: 1.5,
  }), /loteId dos equipamentos aninhados é definido pelo lote pai/);
});


test('relatório inclui todos os estados de lote e preenche ausentes com zero', async () => {
  const { montarLotesPorStatus } = await import('../src/services/relatorio.service');
  const resultado = montarLotesPorStatus([{ status: 'RECEBIDO', quantidade: 3 }]);
  assert.equal(resultado.length, 5);
  assert.equal(resultado.find(item => item.status === 'RECEBIDO')?.quantidade, 3);
  assert.equal(resultado.find(item => item.status === 'FINALIZADO')?.quantidade, 0);
});
