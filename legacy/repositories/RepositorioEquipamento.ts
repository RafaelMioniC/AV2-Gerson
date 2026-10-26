import { RepositorioArquivo } from "./RepositorioArquivo";
import { DadosEquipamento } from "../models/DadosEquipamento";

export class RepositorioEquipamento {
  private readonly arquivo: RepositorioArquivo;
  private readonly nomeArquivo = "equipamentos.txt";

  constructor(chave: Buffer) {
    this.arquivo = new RepositorioArquivo(chave);
  }

  salvar(equipamentos: DadosEquipamento[]): void {
    const dados = JSON.stringify(
      equipamentos,
      null,
      2
    );

    this.arquivo.salvar(
      this.nomeArquivo,
      dados
    );
  }

  listar(): DadosEquipamento[] {
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
          "O conteúdo dos equipamentos não é uma lista."
        );
      }

      return resultado as DadosEquipamento[];
    } catch {
      throw new Error(
        "O arquivo de equipamentos está inválido ou corrompido."
      );
    }
  }
}
