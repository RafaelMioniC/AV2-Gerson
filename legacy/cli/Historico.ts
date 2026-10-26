import { RepositorioArquivo } from "../repositories/RepositorioArquivo";

export class Historico {
  private readonly arquivo: RepositorioArquivo;
  private readonly nomeArquivo = "historico.txt";

  constructor(chave: Buffer) {
    this.arquivo = new RepositorioArquivo(chave);
  }

  adicionar(comando: string): void {
    const comandos = this.listar();
    comandos.push(comando);
    this.arquivo.salvar(this.nomeArquivo, JSON.stringify(comandos.slice(-100)));
  }

  listar(): string[] {
    const dados = this.arquivo.ler(this.nomeArquivo);
    if (!dados) return [];
    try {
      const resultado: unknown = JSON.parse(dados);
      return Array.isArray(resultado) ? resultado.filter((v): v is string => typeof v === "string") : [];
    } catch {
      throw new Error("O histórico está inválido ou corrompido.");
    }
  }

  limpar(): void { this.arquivo.salvar(this.nomeArquivo, JSON.stringify([])); }
}
