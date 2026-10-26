import { TipoEquipamento } from "../enums/TipoEquipamento";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusEquipamento } from "../enums/StatusEquipamento";
export interface DadosEquipamento { id: string; loteId: string; codigoBarrasInterno: string; tipo: TipoEquipamento; marca: string; modelo: string; anoFabricacao: number; estadoFisico: EstadoFisico; dataEntrada: string; local: string; peso: number; status: StatusEquipamento; }
