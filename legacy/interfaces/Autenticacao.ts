export interface Autenticacao {

  autenticar(
    usuario: string,
    senha: string
  ): boolean;

  encerrarSessao(
    token: string
  ): void;
}