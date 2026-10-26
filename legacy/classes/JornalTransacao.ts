export class JornalTransacao {

  readonly id: string;
  readonly timestamp: Date;
  readonly operacao: string;
  readonly entidade: string;
  readonly dadosAntes: unknown;
  readonly dadosDepois: unknown;
  readonly usuario: string;

  constructor(
    id: string,
    operacao: string,
    entidade: string,
    dadosAntes: unknown,
    dadosDepois: unknown,
    usuario: string
  ) {
    this.id = id;
    this.timestamp = new Date();
    this.operacao = operacao;
    this.entidade = entidade;
    this.dadosAntes = dadosAntes;
    this.dadosDepois = dadosDepois;
    this.usuario = usuario;
  }
}
