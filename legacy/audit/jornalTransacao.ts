import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Criptografia } from "../security/Criptografia";

export interface RegistroJournal {
  readonly id: string;
  readonly data: string;
  readonly usuario: string;
  readonly operacao: string;
  readonly entidade: string;
  readonly entidadeId: string;
  readonly detalhes: string;
  readonly hashAnterior: string;
  readonly hashRegistro: string;
}

export class JournalTransacao {
  private readonly arquivo: string;
  private readonly chave: Buffer;
  private readonly criptografia: Criptografia;
  private readonly limiteTamanho = 10 * 1024 * 1024;
  private readonly retencaoDias = 180;

  constructor(chave: Buffer, arquivo: string = "data/journal.enc") {
    this.chave = Buffer.from(chave);
    this.arquivo = path.resolve(arquivo);
    this.criptografia = new Criptografia();
    this.criarDiretorio();
    this.criarArquivo();
    this.aplicarRetencao();
    this.validarIntegridade();
  }

  private criarDiretorio(): void {
    const diretorio = path.dirname(this.arquivo);
    if (!fs.existsSync(diretorio)) fs.mkdirSync(diretorio, { recursive: true });
  }

  private criarArquivo(): void {
    if (!fs.existsSync(this.arquivo)) this.salvarRegistros([]);
  }

  private lerRegistrosArquivo(arquivo: string): RegistroJournal[] {
    if (!fs.existsSync(arquivo)) return [];
    const criptografado = fs.readFileSync(arquivo, "utf8");
    if (!criptografado.trim()) return [];
    let conteudo: string;
    try { conteudo = this.criptografia.descriptografar(criptografado, this.chave); }
    catch { throw new Error(`Não foi possível descriptografar o journal: ${arquivo}`); }
    try {
      const registros: unknown = JSON.parse(conteudo);
      if (!Array.isArray(registros)) throw new Error();
      return registros as RegistroJournal[];
    } catch {
      throw new Error(`Journal inválido: ${arquivo}`);
    }
  }

  private lerRegistros(): RegistroJournal[] { return this.lerRegistrosArquivo(this.arquivo); }

  private salvarRegistros(registros: RegistroJournal[]): void {
    const conteudo = this.criptografia.criptografar(JSON.stringify(registros, null, 2), this.chave);
    const temporario = `${this.arquivo}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporario, conteudo, "utf8");
      fs.renameSync(temporario, this.arquivo);
    } catch (erro) {
      if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      throw erro;
    }
  }

  private hashRegistro(registro: Omit<RegistroJournal, "hashRegistro">): string {
    return crypto.createHash("sha256").update(JSON.stringify(registro)).digest("hex");
  }

  private rotacionarSeNecessario(): void {
    if (!fs.existsSync(this.arquivo) || fs.statSync(this.arquivo).size <= this.limiteTamanho) return;
    const data = new Date().toISOString().replace(/[:.]/g, "-");
    const destino = path.join(path.dirname(this.arquivo), `journal-${data}-${crypto.randomUUID()}.enc`);
    fs.renameSync(this.arquivo, destino);
    this.salvarRegistros([]);
  }

  private aplicarRetencao(): void {
    // O journal é mantido por tempo indeterminado, portanto atende ao
    // requisito mínimo de 180 dias sem quebrar o encadeamento de hashes.
    // A rotação por tamanho continua sendo aplicada separadamente.
  }

  private salvarArquivoRotacionado(arquivo: string, registros: RegistroJournal[]): void {
    const conteudo = this.criptografia.criptografar(JSON.stringify(registros, null, 2), this.chave);
    const temporario = `${arquivo}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporario, conteudo, "utf8");
      fs.renameSync(temporario, arquivo);
    } catch (erro) {
      if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      throw erro;
    }
  }

  private validarIntegridade(): void {
    const registros = this.listarBruto();
    let anterior = "GENESIS";
    for (const registro of registros) {
      if (registro.hashAnterior !== anterior) throw new Error("Integridade do journal comprometida: encadeamento inválido.");
      const semHash: Omit<RegistroJournal, "hashRegistro"> = {
        id: registro.id,
        data: registro.data,
        usuario: registro.usuario,
        operacao: registro.operacao,
        entidade: registro.entidade,
        entidadeId: registro.entidadeId,
        detalhes: registro.detalhes,
        hashAnterior: registro.hashAnterior
      };
      if (this.hashRegistro(semHash) !== registro.hashRegistro) throw new Error("Integridade do journal comprometida: hash inválido.");
      anterior = registro.hashRegistro;
    }
  }

  private listarBruto(): RegistroJournal[] {
    const registros = [...this.lerRegistros()];
    const diretorio = path.dirname(this.arquivo);
    if (fs.existsSync(diretorio)) {
      for (const nome of fs.readdirSync(diretorio).filter(n => n.startsWith("journal-") && n.endsWith(".enc")).sort()) {
        registros.push(...this.lerRegistrosArquivo(path.join(diretorio, nome)));
      }
    }
    registros.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    return registros;
  }

  registrar(usuario: string, operacao: string, entidade: string, entidadeId: string, detalhes: string): RegistroJournal {
    const registros = this.lerRegistros();
    const todos = this.listarBruto();
    const hashAnterior = todos.length ? todos[todos.length - 1].hashRegistro : "GENESIS";
    const base = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      usuario,
      operacao,
      entidade,
      entidadeId,
      detalhes,
      hashAnterior
    };
    const registro: RegistroJournal = { ...base, hashRegistro: this.hashRegistro(base) };
    registros.push(registro);
    this.salvarRegistros(registros);
    this.rotacionarSeNecessario();
    return Object.freeze({ ...registro });
  }

  listar(): readonly RegistroJournal[] {
    return Object.freeze(this.listarBruto().map(registro => Object.freeze({ ...registro })));
  }

  buscarPorEntidade(entidade: string, entidadeId: string): readonly RegistroJournal[] {
    return Object.freeze(this.listar().filter(r => r.entidade === entidade && r.entidadeId === entidadeId).map(r => Object.freeze({ ...r })));
  }
}
