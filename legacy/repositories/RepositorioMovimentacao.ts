import { RepositorioArquivo } from "./RepositorioArquivo";
import { DadosMovimentacao } from "../models/DadosMovimentacao";

export class RepositorioMovimentacao {
  private readonly arquivo: RepositorioArquivo;
  private readonly nomeArquivo = "movimentacoes.txt";

  constructor(chave: Buffer) {
    this.arquivo = new RepositorioArquivo(chave);
  }

  salvar(movimentacoes: DadosMovimentacao[]): void {
    const dados = JSON.stringify(
      movimentacoes,
      null,
      2
    );

    this.arquivo.salvar(
      this.nomeArquivo,
      dados
    );
  }

  listar(): DadosMovimentacao[] {
    const dados = this.arquivo.ler(
      this.nomeArquivo
    );

    if (!dados) {
      return [];
    }

    try {
      const resultado: unknown = JSON.parse(dados);

      if (!Array.isArray(resultado)) {
        throw new Error(
          "O conteúdo das movimentações não é uma lista."
        );
      }

      return resultado as DadosMovimentacao[];
    } catch {
      throw new Error(
        "O arquivo de movimentações está inválido ou corrompido."
      );
    }
  }
}
