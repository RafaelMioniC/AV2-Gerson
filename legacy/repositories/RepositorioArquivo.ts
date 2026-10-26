import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Criptografia } from "../security/Criptografia";

export class RepositorioArquivo {
  private readonly diretorio: string;
  private readonly criptografia: Criptografia;
  private readonly chave: Buffer;

  constructor(chave: Buffer) {
    if (!Buffer.isBuffer(chave) || chave.length !== 32) {
      throw new Error(
        "A chave de criptografia deve possuir 32 bytes."
      );
    }

    this.chave = Buffer.from(chave);
    this.diretorio = path.join(process.cwd(), "data");
    this.criptografia = new Criptografia();

    fs.mkdirSync(this.diretorio, {
      recursive: true
    });
  }

  salvar(nomeArquivo: string, dados: string): void {
    const caminho = this.obterCaminho(nomeArquivo);

    const dadosCriptografados = this.criptografia.criptografar(
      dados,
      this.chave
    );

    const temporario = `${caminho}.${crypto.randomUUID()}.tmp`;

    try {
      fs.writeFileSync(
        temporario,
        dadosCriptografados,
        "utf8"
      );

      fs.renameSync(
        temporario,
        caminho
      );
    } catch (erro) {
      if (fs.existsSync(temporario)) {
        fs.unlinkSync(temporario);
      }

      throw new Error(
        `Não foi possível salvar o arquivo "${nomeArquivo}".`
      );
    }
  }

  ler(nomeArquivo: string): string | null {
    const caminho = this.obterCaminho(nomeArquivo);

    if (!fs.existsSync(caminho)) {
      return null;
    }

    let dadosCriptografados: string;

    try {
      dadosCriptografados = fs.readFileSync(
        caminho,
        "utf8"
      );
    } catch {
      throw new Error(
        `Não foi possível ler o arquivo "${nomeArquivo}".`
      );
    }

    if (!dadosCriptografados.trim()) {
      return null;
    }

    try {
      return this.criptografia.descriptografar(
        dadosCriptografados,
        this.chave
      );
    } catch {
      throw new Error(
        `Não foi possível descriptografar o arquivo "${nomeArquivo}".`
      );
    }
  }

  excluir(nomeArquivo: string): void {
    const caminho = this.obterCaminho(nomeArquivo);

    if (!fs.existsSync(caminho)) {
      return;
    }

    try {
      fs.unlinkSync(caminho);
    } catch {
      throw new Error(
        `Não foi possível excluir o arquivo "${nomeArquivo}".`
      );
    }
  }

  private obterCaminho(nomeArquivo: string): string {
    if (!nomeArquivo || nomeArquivo.trim() === "") {
      throw new Error("O nome do arquivo é obrigatório.");
    }

    const caminho = path.resolve(
      this.diretorio,
      nomeArquivo
    );

    const diretorioResolvido = path.resolve(
      this.diretorio
    );

    if (
      caminho !== diretorioResolvido &&
      !caminho.startsWith(diretorioResolvido + path.sep)
    ) {
      throw new Error(
        "O arquivo deve estar dentro do diretório de dados."
      );
    }

    return caminho;
  }
}
