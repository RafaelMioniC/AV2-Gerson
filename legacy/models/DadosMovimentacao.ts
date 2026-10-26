import { StatusEquipamento } from "../enums/StatusEquipamento";

export interface DadosMovimentacao {
  id: string;
  equipamentoId: string;
  statusAnterior: StatusEquipamento;
  novoStatus: StatusEquipamento;
  data: string;
  usuario: string;
  justificativa: string;
}