import 'dotenv/config';
import { PrismaClient, PapelUsuario, TipoEquipamento, EstadoFisico, StatusLote, StatusEquipamento } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function cnpjValido(base12: string): string {
  const digito = (base: string, pesos: number[]) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };
  const d1 = digito(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base12 + d1 + d2;
}

async function main() {
  await prisma.configuracao.upsert({ where: { id: 'GLOBAL' }, update: {}, create: { id: 'GLOBAL', aliquotaImposto: 0, coeficienteDepreciacao: 0 } });
  const usuario = process.env.ADMIN_USER || 'admin';
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha || senha.length < 10) throw new Error('Defina ADMIN_PASSWORD com pelo menos 10 caracteres no .env para criar o administrador inicial.');
  await prisma.usuario.updateMany({ where: { protegido: true, NOT: { usuario } }, data: { protegido: false } });
  await prisma.usuario.upsert({
    where: { usuario },
    update: { protegido: true },
    create: {
      usuario,
      senhaHash: await bcrypt.hash(senha, 12),
      papel: PapelUsuario.ADMINISTRADOR,
      ativo: true,
      protegido: true,
    },
  });

  const cnpjA = cnpjValido('123456780001');
  const cnpjB = cnpjValido('987654320001');
  const orgA = await prisma.organizacao.upsert({
    where: { cnpj: cnpjA }, update: {},
    create: { razaoSocial: 'EcoTech Equipamentos Ltda.', cnpj: cnpjA, inscricaoEstadual: '123456789', enderecoCompleto: 'Rua das Indústrias, 100 - São Paulo/SP', telefone: '(11) 3333-1000', email: 'contato@ecotech.example' },
  });
  const orgB = await prisma.organizacao.upsert({
    where: { cnpj: cnpjB }, update: {},
    create: { razaoSocial: 'Reuso Digital S.A.', cnpj: cnpjB, inscricaoEstadual: '987654321', enderecoCompleto: 'Av. da Reciclagem, 250 - Campinas/SP', telefone: '(19) 3333-2000', email: 'contato@reusodigital.example' },
  });
  if (!(await prisma.contrato.findFirst({ where: { organizacaoId: orgA.id, descricao: 'Coleta e triagem de equipamentos de TI' } }))) await prisma.contrato.create({
    data: { organizacaoId: orgA.id, dataInicio: new Date('2026-01-01T00:00:00.000Z'), dataFim: new Date('2027-12-31T00:00:00.000Z'), descricao: 'Coleta e triagem de equipamentos de TI', valorMensal: 12500, coletaAutomatica: true },
  });
  const fimContratoB = new Date(`${new Date().getUTCFullYear() + 5}-12-31T00:00:00.000Z`);
  const contratoB = await prisma.contrato.findFirst({ where: { organizacaoId: orgB.id, descricao: 'Logística reversa e destinação responsável' } });
  if (!contratoB) {
    await prisma.contrato.create({ data: { organizacaoId: orgB.id, dataInicio: new Date('2026-03-01T00:00:00.000Z'), dataFim: fimContratoB, descricao: 'Logística reversa e destinação responsável', valorMensal: 7800, coletaAutomatica: false } });
  } else if (contratoB.ativo && contratoB.dataFim < new Date()) {
    await prisma.contrato.update({ where: { id: contratoB.id }, data: { dataFim: fimContratoB, versao: { increment: 1 } } });
  }

  const loteA = await prisma.lote.upsert({
    where: { id: 'seed-lote-entrada' }, update: {},
    create: { id: 'seed-lote-entrada', organizacaoId: orgA.id, dataEntrada: new Date(), notaFiscal: 'NF-SEED-001', transportadora: 'Logística Verde', status: StatusLote.RECEBIDO, observacoes: 'Lote de demonstração: equipamentos recém-recebidos.' },
  });
  const loteB = await prisma.lote.upsert({
    where: { id: 'seed-lote-triagem' }, update: {},
    create: { id: 'seed-lote-triagem', organizacaoId: orgA.id, dataEntrada: new Date(), notaFiscal: 'NF-SEED-002', transportadora: 'TransEco', status: StatusLote.EM_TRIAGEM, observacoes: 'Lote de demonstração em triagem.' },
  });
  const loteC = await prisma.lote.upsert({
    where: { id: 'seed-lote-finalizado' }, update: { status: StatusLote.ENCAMINHADO },
    create: { id: 'seed-lote-finalizado', organizacaoId: orgB.id, dataEntrada: new Date(), notaFiscal: 'NF-SEED-003', transportadora: 'Reversa Express', status: StatusLote.ENCAMINHADO, observacoes: 'Lote de demonstração em encaminhamento.' },
  });

  const equipamentos = [
    { codigo: 'GC-SEED-001', loteId: loteA.id, tipo: TipoEquipamento.NOTEBOOK, marca: 'Dell', modelo: 'Latitude 5420', ano: 2022, estado: EstadoFisico.BOM_ESTADO, status: StatusEquipamento.RECEBIDO, local: 'Recebimento', peso: 1.8 },
    { codigo: 'GC-SEED-002', loteId: loteB.id, tipo: TipoEquipamento.COMPUTADOR_MESA, marca: 'Lenovo', modelo: 'ThinkCentre M70', ano: 2021, estado: EstadoFisico.USADO_LEVE, status: StatusEquipamento.EM_TRIAGEM, local: 'Bancada A', peso: 6.2 },
    { codigo: 'GC-SEED-003', loteId: loteB.id, tipo: TipoEquipamento.MONITOR, marca: 'LG', modelo: '24MK430', ano: 2020, estado: EstadoFisico.USADO_MODERADO, status: StatusEquipamento.TRIAGEM_CONCLUIDA, local: 'Bancada B', peso: 3.1 },
    { codigo: 'GC-SEED-004', loteId: loteC.id, tipo: TipoEquipamento.IMPRESSORA, marca: 'HP', modelo: 'LaserJet Pro', ano: 2019, estado: EstadoFisico.DANIFICADO_LEVE, status: StatusEquipamento.ENCAMINHADO, local: 'Expedição', peso: 8.4 },
    { codigo: 'GC-SEED-005', loteId: loteC.id, tipo: TipoEquipamento.BATERIA, marca: 'APC', modelo: 'RBC17', ano: 2018, estado: EstadoFisico.IRRECUPERAVEL, status: StatusEquipamento.DESCARTE, local: 'Área de descarte', peso: 2.4 },
  ];
  for (const e of equipamentos) {
    await prisma.equipamento.upsert({
      where: { codigoBarrasInterno: e.codigo }, update: {},
      create: { codigoBarrasInterno: e.codigo, loteId: e.loteId, tipo: e.tipo, marca: e.marca, modelo: e.modelo, anoFabricacao: e.ano, estadoFisico: e.estado, status: e.status, dataEntrada: new Date(), local: e.local, peso: e.peso },
    });
  }

  const admin = await prisma.usuario.findUniqueOrThrow({ where: { usuario } });
  const historicos: Record<string, StatusEquipamento[]> = {
    'GC-SEED-002': [StatusEquipamento.EM_TRIAGEM],
    'GC-SEED-003': [StatusEquipamento.EM_TRIAGEM, StatusEquipamento.TRIAGEM_CONCLUIDA],
    'GC-SEED-004': [StatusEquipamento.EM_TRIAGEM, StatusEquipamento.TRIAGEM_CONCLUIDA, StatusEquipamento.ENCAMINHADO],
    'GC-SEED-005': [StatusEquipamento.EM_TRIAGEM, StatusEquipamento.TRIAGEM_CONCLUIDA, StatusEquipamento.ENCAMINHADO, StatusEquipamento.DESCARTE],
  };
  for (const [codigo, destinos] of Object.entries(historicos)) {
    const equipamento = await prisma.equipamento.findUniqueOrThrow({ where: { codigoBarrasInterno: codigo } });
    let anterior: StatusEquipamento = StatusEquipamento.RECEBIDO;
    for (let i = 0; i < destinos.length; i++) {
      const destino = destinos[i];
      await prisma.movimentacao.upsert({
        where: { id: `seed-mov-${codigo}-${i + 1}` },
        update: {},
        create: { id: `seed-mov-${codigo}-${i + 1}`, equipamentoId: equipamento.id, statusAnterior: anterior, novoStatus: destino, usuarioId: admin.id, justificativa: 'Movimentação inicial de demonstração.' },
      });
      anterior = destino;
    }
  }
  console.log('Seed concluído: administrador, 2 organizações, 2 contratos, 3 lotes, 5 equipamentos e histórico de movimentações.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
