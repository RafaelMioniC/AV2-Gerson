import { PapelUsuario } from "../enums/PapelUsuario";

export class Credencial {

  usuario: string;
  hashSenha: string;
  salt: string;
  ultimoAcesso: Date;
  papel: PapelUsuario;

  constructor(
    usuario: string,
    hashSenha: string,
    salt: string,
    papel: PapelUsuario
  ) {
    this.usuario = usuario;
    this.hashSenha = hashSenha;
    this.salt = salt;
    this.ultimoAcesso = new Date();
    this.papel = papel;
  }

  atualizarUltimoAcesso(): void {
    this.ultimoAcesso = new Date();
  }
}
