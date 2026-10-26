import {
  PapelUsuario,
  TipoEquipamento,
  EstadoFisico,
  StatusLote,
} from '@prisma/client';

export const camposPermitidos: Record<string, string[]> = {
  organizacoes: ['razaoSocial', 'cnpj', 'inscricaoEstadual', 'enderecoCompleto', 'telefone', 'email', 'ativo'],
  contratos: ['organizacaoId', 'dataInicio', 'dataFim', 'descricao', 'valorMensal', 'coletaAutomatica', 'ativo'],
  lotes: ['dataEntrada', 'organizacaoId', 'notaFiscal', 'transportadora', 'observacoes', 'equipamentos', 'ativo'],
  equipamentos: [
    'loteId', 'codigoBarrasInterno', 'tipo', 'marca', 'modelo',
    'anoFabricacao', 'estadoFisico', 'dataEntrada', 'local', 'peso',
    'justificativa', 'ativo',
  ],
  usuarios: ['usuario', 'senha', 'papel', 'ativo'],
};

export const camposObrigatorios: Record<string, string[]> = {
  organizacoes: ['razaoSocial', 'cnpj', 'inscricaoEstadual', 'enderecoCompleto', 'telefone', 'email'],
  contratos: ['organizacaoId', 'dataInicio', 'dataFim', 'descricao', 'valorMensal'],
  lotes: ['dataEntrada', 'organizacaoId', 'notaFiscal', 'transportadora', 'observacoes'],
  equipamentos: [
    'loteId', 'codigoBarrasInterno', 'tipo', 'marca', 'modelo',
    'anoFabricacao', 'estadoFisico', 'dataEntrada', 'local', 'peso',
  ],
  usuarios: ['usuario', 'senha', 'papel'],
};

const camposData = ['dataInicio', 'dataFim', 'dataEntrada'];
const papeisValidos = Object.values(PapelUsuario) as string[];
const tiposValidos = Object.values(TipoEquipamento) as string[];
const estadosValidos = Object.values(EstadoFisico) as string[];
const statusLoteValidos = Object.values(StatusLote) as string[];
const camposQuePodemFicarVazios = new Set(['observacoes', 'inscricaoEstadual', 'justificativa']);

function erro(mensagem: string) {
  return Object.assign(new Error(mensagem), { status: 400 });
}

function validarCnpj(valor: string): boolean {
  const cnpj = valor.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calcular = (base: string, pesos: number[]) => {
    const soma = [...base].reduce((total, digito, i) => total + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = calcular(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcular(cnpj.slice(0, 12) + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

export function validarDados(nome: string, entrada: unknown, parcial = false): Record<string, any> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw erro('O corpo da requisição deve ser um objeto JSON.');
  }
  const origem = entrada as Record<string, unknown>;
  const permitidos = camposPermitidos[nome];
  if (!permitidos) throw erro('Recurso não suportado.');
  const permitidosEntrada = parcial ? [...permitidos, 'versao'] : permitidos;
  const desconhecidos = Object.keys(origem).filter(campo => !permitidosEntrada.includes(campo));
  if (desconhecidos.length) throw erro(`Campo(s) não permitido(s): ${desconhecidos.join(', ')}.`);
  if (!parcial) {
    const faltantes = camposObrigatorios[nome].filter(campo =>
      origem[campo] === undefined || origem[campo] === null || (origem[campo] === '' && !camposQuePodemFicarVazios.has(campo))
    );
    if (faltantes.length) throw erro(`Campo(s) obrigatório(s): ${faltantes.join(', ')}.`);
  }

  const dados: Record<string, any> = { ...origem };
  if (nome === 'lotes' && parcial && dados.equipamentos !== undefined) {
    throw erro('Equipamentos aninhados só podem ser informados na criação do lote.');
  }
  if (nome === 'lotes' && dados.equipamentos !== undefined) {
    if (!Array.isArray(dados.equipamentos)) throw erro('equipamentos deve ser uma lista.');
    if (dados.equipamentos.length > 500) throw erro('Um lote pode conter no máximo 500 equipamentos por requisição.');
  }
  if (parcial) {
    if (!Number.isInteger(dados.versao) || dados.versao < 1) throw erro('Informe a versão atual do registro no campo versao.');
  }
  delete dados.versao;
  if (nome === 'lotes') delete dados.equipamentos;
  const camposTexto = ['justificativa', 'razaoSocial', 'cnpj', 'inscricaoEstadual', 'enderecoCompleto', 'telefone', 'email',
    'organizacaoId', 'descricao', 'notaFiscal', 'transportadora', 'observacoes', 'loteId',
    'codigoBarrasInterno', 'tipo', 'marca', 'modelo', 'estadoFisico', 'local', 'usuario', 'senha', 'papel', 'status'];

  const tamanhosMaximos: Record<string, number> = {
    razaoSocial: 180, cnpj: 18, inscricaoEstadual: 40, enderecoCompleto: 300,
    telefone: 30, email: 191, justificativa: 2000, organizacaoId: 30, descricao: 2000, notaFiscal: 100,
    transportadora: 150, observacoes: 4000, loteId: 30, codigoBarrasInterno: 100,
    tipo: 40, marca: 100, modelo: 150, estadoFisico: 40, local: 150,
    usuario: 80, senha: 200, papel: 40, status: 40,
  };
  for (const campo of camposTexto) {
    if (dados[campo] !== undefined && typeof dados[campo] !== 'string') throw erro(`O campo ${campo} deve ser texto.`);
    if (typeof dados[campo] === 'string') {
      dados[campo] = dados[campo].trim();
      if (!camposQuePodemFicarVazios.has(campo) && dados[campo] === '') throw erro(`O campo ${campo} não pode ficar vazio.`);
      if (dados[campo].length > (tamanhosMaximos[campo] ?? 255)) throw erro(`O campo ${campo} ultrapassa o limite de caracteres.`);
    }
  }
  for (const campo of ['ativo', 'coletaAutomatica']) {
    if (dados[campo] !== undefined && typeof dados[campo] !== 'boolean') throw erro(`O campo ${campo} deve ser verdadeiro ou falso.`);
  }
  for (const campo of ['valorMensal', 'peso', 'anoFabricacao']) {
    if (dados[campo] !== undefined && (typeof dados[campo] !== 'number' || !Number.isFinite(dados[campo]))) {
      throw erro(`O campo ${campo} deve ser numérico.`);
    }
  }
  if (dados.usuario !== undefined && !dados.usuario.trim()) throw erro('O usuário não pode ficar vazio.');
  if (dados.senha !== undefined && dados.senha.length < 10) {
    throw erro('A senha deve possuir pelo menos 10 caracteres.');
  }

  if (dados.senha !== undefined && Buffer.byteLength(dados.senha, 'utf8') > 72) {
    throw erro('A senha não pode ultrapassar 72 bytes em UTF-8.');
  }

  for (const campo of camposData) {
    if (dados[campo] !== undefined) {
      const valor = dados[campo];
      if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(valor)) {
        throw erro(`Data inválida no campo ${campo}. Use YYYY-MM-DD ou ISO 8601.`);
      }
      const data = new Date(valor);
      const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number);
      const dataCalendarioValida = data instanceof Date && !Number.isNaN(data.getTime()) &&
        Number.isInteger(ano) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 &&
        new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === valor.slice(0, 10);
      if (!dataCalendarioValida) throw erro(`Data inválida no campo ${campo}. Use YYYY-MM-DD ou ISO 8601.`);
      dados[campo] = data;
    }
  }
  if (dados.cnpj !== undefined) {
    if (typeof dados.cnpj !== 'string' || !validarCnpj(dados.cnpj)) throw erro('CNPJ inválido.');
    dados.cnpj = dados.cnpj.replace(/\D/g, '');
  }
  if (dados.valorMensal !== undefined && dados.valorMensal < 0) {
    throw erro('valorMensal deve ser um número maior ou igual a zero.');
  }

  if (dados.valorMensal !== undefined && dados.valorMensal > 9_999_999_999.99) {
    throw erro('valorMensal ultrapassa o limite permitido para DECIMAL(12, 2).');
  }

  if (dados.valorMensal !== undefined && Math.abs(dados.valorMensal - Math.round(dados.valorMensal * 100) / 100) > 1e-8) {
    throw erro('valorMensal deve possuir no máximo duas casas decimais.');
  }
  if (dados.peso !== undefined && dados.peso <= 0) throw erro('peso deve ser um número maior que zero.');
  if (dados.anoFabricacao !== undefined &&
    (!Number.isInteger(dados.anoFabricacao) || dados.anoFabricacao < 1900 || dados.anoFabricacao > new Date().getFullYear())) {
    throw erro('anoFabricacao inválido.');
  }
  if (dados.papel !== undefined && !papeisValidos.includes(String(dados.papel))) throw erro('Papel de usuário inválido.');
  if (dados.tipo !== undefined && !tiposValidos.includes(String(dados.tipo))) throw erro('Tipo de equipamento inválido.');
  if (dados.estadoFisico !== undefined && !estadosValidos.includes(String(dados.estadoFisico))) throw erro('Estado físico inválido.');
  if (dados.status !== undefined && !statusLoteValidos.includes(String(dados.status))) throw erro('Status de lote inválido.');
  if (
    dados.email !== undefined &&
    (typeof dados.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email))
  ) {
    throw erro('E-mail inválido.');
  }
  if (dados.dataInicio && dados.dataFim && dados.dataFim <= dados.dataInicio) {
    throw erro('dataFim deve ser estritamente posterior a dataInicio.');
  }
  if (nome === 'lotes' && dados.dataEntrada instanceof Date) {
    const agora = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    if (dados.dataEntrada > agora || dados.dataEntrada < limite) {
      throw erro('A data de entrada do lote deve estar entre hoje e os últimos 90 dias.');
    }
  }
  return dados;
}

/** Valida equipamento enviado dentro de POST /api/lotes; não permite inativação no cadastro aninhado. */
export function validarEquipamentoAninhado(entrada: unknown, indice = 0): Record<string, any> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw erro(`Equipamento ${indice + 1} deve ser um objeto.`);
  }
  const equipamento = entrada as Record<string, unknown>;
  if (equipamento.loteId !== undefined) throw erro('loteId dos equipamentos aninhados é definido pelo lote pai.');
  if (equipamento.ativo === false) {
    throw erro(`Equipamento ${indice + 1}: equipamentos aninhados devem ser cadastrados ativos.`);
  }
  const dados = validarDados('equipamentos', { ...equipamento, loteId: 'lote-pendente' });
  delete dados.loteId;
  delete dados.justificativa;
  return dados;
}
