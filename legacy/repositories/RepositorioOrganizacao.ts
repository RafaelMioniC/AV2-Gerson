import { RepositorioArquivo } from "./RepositorioArquivo";
import { DadosOrganizacao } from "../models/DadosOrganizacao";

export class RepositorioOrganizacao {
  private readonly arquivo: RepositorioArquivo;
  private readonly nomeArquivo = "organizacoes.txt";

  constructor(chave: Buffer) {
    this.arquivo = new RepositorioArquivo(chave);
  }

  salvar(organizacoes: DadosOrganizacao[]): void {
    const dados = JSON.stringify(
      organizacoes,
      null,
      2
    );

    this.arquivo.salvar(
      this.nomeArquivo,
      dados
    );
  }

  listar(): DadosOrganizacao[] {
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
          "O conteúdo das organizações não é uma lista."
        );
      }

      return resultado as DadosOrganizacao[];
    } catch {
      throw new Error(
        "O arquivo de organizações está inválido ou corrompido."
      );
    }
  }
}