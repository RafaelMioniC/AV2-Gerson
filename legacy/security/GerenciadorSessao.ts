import { Sessao } from "../classes/Sessao";

export class GerenciadorSessao {
  private readonly sessoes: Map<string, Sessao> = new Map();

  criar(sessao: Sessao): void {
    this.sessoes.set(sessao.token, sessao);
  }

  buscar(token: string): Sessao | undefined {
    const sessao = this.sessoes.get(token);

    if (!sessao) {
      return undefined;
    }

    if (!sessao.valida()) {
      this.sessoes.delete(token);
      return undefined;
    }

    return sessao;
  }

  encerrar(token: string): void {
    this.sessoes.delete(token);
  }

  renovar(token: string): boolean {
    const sessao = this.buscar(token);

    if (!sessao) {
      return false;
    }

    sessao.renovar();
    return true;
  }

  limparExpiradas(): void {
    for (const [token, sessao] of this.sessoes) {
      if (!sessao.valida()) {
        this.sessoes.delete(token);
      }
    }
  }
}
