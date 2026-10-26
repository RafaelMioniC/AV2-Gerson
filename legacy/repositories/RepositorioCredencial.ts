import { RepositorioArquivo } from "./RepositorioArquivo";
import { DadosCredencial } from "../models/DadosCredencial";

export class RepositorioCredencial {
  private readonly arquivo: RepositorioArquivo;
  private readonly nomeArquivo = "credenciais.txt";

  constructor(chave: Buffer) {
    this.arquivo = new RepositorioArquivo(chave);
  }

  salvar(credenciais: DadosCredencial[]): void {
    const dados = JSON.stringify(
      credenciais,
      null,
      2
    );

    this.arquivo.salvar(
      this.nomeArquivo,
      dados
    );
  }

  listar(): DadosCredencial[] {
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
          "O conteúdo das credenciais não é uma lista."
        );
      }

      return resultado as DadosCredencial[];
    } catch {
      throw new Error(
        "O arquivo de credenciais está inválido ou corrompido."
      );
    }
  }
}
