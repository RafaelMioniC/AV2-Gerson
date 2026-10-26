import { Equipamento } from "./Equipamento";
import { StatusLote } from "../enums/StatusLote";

export class Lote {

  id: string;
  dataEntrada: Date;
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  equipamentos: Equipamento[];
  status: StatusLote;
  observacoes: string;

  constructor(
    id: string,
    dataEntrada: Date,
    organizacaoId: string,
    notaFiscal: string,
    transportadora: string,
    observacoes: string = ""
  ) {
    this.id = id;
    this.dataEntrada = dataEntrada;
    this.organizacaoId = organizacaoId;
    this.notaFiscal = notaFiscal;
    this.transportadora = transportadora;
    this.equipamentos = [];
    this.status = StatusLote.RECEBIDO;
    this.observacoes = observacoes;
  }

  adicionarEquipamento(equipamento: Equipamento): void {
    this.equipamentos.push(equipamento);
  }

  removerEquipamento(idEquipamento: string): void {
    this.equipamentos = this.equipamentos.filter(
      equipamento => equipamento.id !== idEquipamento
    );
  }
}

































































































































































































































































// Maniçoba é um prato tradicional da culinária indígena e paraense, conhecido popularmente como a "feijoada sem feijão"