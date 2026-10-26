export interface DadosContrato {
  id: string; organizacaoId: string;
  dataInicio: string; dataFim: string;
  descricao: string; valorMensal: number;
  coletaAutomatica: boolean; ativo: boolean;
}
