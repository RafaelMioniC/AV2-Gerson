import { StatusEquipamento } from "../enums/StatusEquipamento";
export class Movimentacao {
  id: string; equipamentoId: string; statusAnterior: StatusEquipamento; novoStatus: StatusEquipamento; data: Date; usuario: string; justificativa: string;
  constructor(id: string, equipamentoId: string, statusAnterior: StatusEquipamento, novoStatus: StatusEquipamento, usuario: string, justificativa: string = "", data: Date = new Date()) {
    this.id = id; this.equipamentoId = equipamentoId; this.statusAnterior = statusAnterior; this.novoStatus = novoStatus; this.data = data; this.usuario = usuario; this.justificativa = justificativa;
  }
}
