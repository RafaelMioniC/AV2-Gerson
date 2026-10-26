import { RepositorioArquivo } from "./RepositorioArquivo";
import { DadosLote } from "../models/DadosLote";

export class RepositorioLote {
  private readonly arquivo: RepositorioArquivo;
  private readonly nomeArquivo = "lotes.txt";

  constructor(chave: Buffer) {
    this.arquivo = new RepositorioArquivo(chave);
  }

  salvar(lotes: DadosLote[]): void {
    const dados = JSON.stringify(
      lotes,
      null,
      2
    );

    this.arquivo.salvar(
      this.nomeArquivo,
      dados
    );
  }

  listar(): DadosLote[] {
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
          "O conteúdo dos lotes não é uma lista."
        );
      }

      return resultado as DadosLote[];
    } catch {
      throw new Error(
        "O arquivo de lotes está inválido ou corrompido."
      );
    }
  }
}
