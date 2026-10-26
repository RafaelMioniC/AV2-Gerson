import { PapelUsuario } from "../enums/PapelUsuario";

export class Sessao {

  token: string;
  usuario: string;
  papel: PapelUsuario;
  criacao: Date;
  ultimaAtividade: Date;

  private readonly TEMPO_INATIVIDADE = 30 * 60 * 1000;

  constructor(
    token: string,
    usuario: string,
    papel: PapelUsuario
  ) {
    this.token = token;
    this.usuario = usuario;
    this.papel = papel;
    this.criacao = new Date();
    this.ultimaAtividade = new Date();
  }

  valida(): boolean {
    const agora = Date.now();

    return (
      agora - this.ultimaAtividade.getTime()
      < this.TEMPO_INATIVIDADE
    );
  }

  renovar(): void {
    this.ultimaAtividade = new Date();
  }
}
