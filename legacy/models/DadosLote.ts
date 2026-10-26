import { StatusLote } from "../enums/StatusLote";
export interface DadosLote { id: string; dataEntrada: string; organizacaoId: string; notaFiscal: string; transportadora: string; status: StatusLote; observacoes: string; equipamentoIds: string[]; }
