import { TipoEquipamento } from "../enums/TipoEquipamento";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusEquipamento } from "../enums/StatusEquipamento";

export class Equipamento {

  id: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  dataEntrada: Date;
  local: string;
  peso: number;
  status: StatusEquipamento;

  constructor(
    id: string,
    codigoBarrasInterno: string,
    tipo: TipoEquipamento,
    marca: string,
    modelo: string,
    anoFabricacao: number,
    estadoFisico: EstadoFisico,
    dataEntrada: Date,
    local: string,
    peso: number
  ) {
    this.id = id;
    this.codigoBarrasInterno = codigoBarrasInterno;
    this.tipo = tipo;
    this.marca = marca;
    this.modelo = modelo;
    this.anoFabricacao = anoFabricacao;
    this.estadoFisico = estadoFisico;
    this.dataEntrada = dataEntrada;
    this.local = local;
    this.peso = peso;
    this.status = StatusEquipamento.RECEBIDO;
  }

  atualizarEstadoFisico(
    novoEstado: EstadoFisico,
    justificativa?: string
  ): void {

    const nivelEstado: Record<EstadoFisico, number> = {
      [EstadoFisico.NOVO]: 7,
      [EstadoFisico.BOM_ESTADO]: 6,
      [EstadoFisico.USADO_LEVE]: 5,
      [EstadoFisico.USADO_MODERADO]: 4,
      [EstadoFisico.DANIFICADO_LEVE]: 3,
      [EstadoFisico.DANIFICADO_GRAVE]: 2,
      [EstadoFisico.IRRECUPERAVEL]: 1
    };

    const estadoAtual = nivelEstado[this.estadoFisico];
    const estadoNovo = nivelEstado[novoEstado];

    const queda = estadoAtual - estadoNovo;

    if (queda >= 2 && !justificativa?.trim()) {
      throw new Error(
        "É obrigatória uma justificativa quando o estado físico cair duas ou mais categorias."
      );
    }

    this.estadoFisico = novoEstado;
  }
}