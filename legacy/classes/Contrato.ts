export class Contrato {

  id: string;
  organizacaoId: string;
  dataInicio: Date;
  dataFim: Date;
  descricao: string;
  valorMensal: number;
  coletaAutomatica: boolean;
  ativo: boolean;

  constructor(
    id: string,
    organizacaoId: string,
    dataInicio: Date,
    dataFim: Date,
    descricao: string,
    valorMensal: number,
    coletaAutomatica: boolean
  ) {
    this.id = id;
    this.organizacaoId = organizacaoId;
    this.dataInicio = dataInicio;
    this.dataFim = dataFim;
    this.descricao = descricao;
    this.valorMensal = valorMensal;
    this.coletaAutomatica = coletaAutomatica;
    this.ativo = true;
  }

  renovar(novaDataFim: Date): void {
    this.dataFim = novaDataFim;
  }

  encerrar(): void {
    this.ativo = false;
  }
}