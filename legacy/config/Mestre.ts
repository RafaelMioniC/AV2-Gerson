import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Criptografia } from "../security/Criptografia";
import { Hash } from "../security/Hash";

interface Administrador {
  usuario: string;
  senhaHash: string;
  salt: string;
}

export interface Configuracao {
  chaveMestre: string;
  administrador: Administrador;
}

interface ArquivoConfiguracao {
  versao: number;
  salt: string;
  conteudo: string;
}

export class ConfiguracaoMestre {
  private readonly arquivo: string;
  private readonly criptografia: Criptografia;

  constructor(arquivo: string = "data/configuracao-mestre.enc") {
    this.arquivo = path.resolve(arquivo);
    this.criptografia = new Criptografia();
    this.criarDiretorio();
  }

  private criarDiretorio(): void {
    const diretorio = path.dirname(this.arquivo);
    if (!fs.existsSync(diretorio)) {
      fs.mkdirSync(diretorio, { recursive: true });
    }
  }

  existe(): boolean {
    return fs.existsSync(this.arquivo);
  }

  provisionar(usuario: string, senha: string): void {
    if (this.existe()) {
      throw new Error("O sistema já foi provisionado.");
    }
    if (!usuario.trim()) {
      throw new Error("O usuário do administrador é obrigatório.");
    }
    if (!senha) {
      throw new Error("A senha do administrador é obrigatória.");
    }

    const chaveMestre = this.criptografia.gerarChave();
    const salt = crypto.randomBytes(16).toString("hex");
    const chaveConfiguracao = this.gerarChaveConfiguracao(senha, salt);
    const saltSenha = Hash.gerarSalt();
    const senhaHash = Hash.gerar(senha, saltSenha);

    const configuracao: Configuracao = {
      chaveMestre: chaveMestre.toString("base64"),
      administrador: {
        usuario: usuario.trim(),
        senhaHash,
        salt: saltSenha
      }
    };

    this.salvarEnvelope(configuracao, salt, chaveConfiguracao);
  }

  carregar(senhaAdministrador: string): Configuracao {
    const envelope = this.lerEnvelope();
    const chave = this.gerarChaveConfiguracao(
      senhaAdministrador,
      envelope.salt
    );

    let conteudo: string;
    try {
      conteudo = this.criptografia.descriptografar(
        envelope.conteudo,
        chave
      );
    } catch {
      throw new Error("Não foi possível desbloquear a configuração mestre. Verifique a senha do administrador.");
    }

    let configuracao: unknown;
    try {
      configuracao = JSON.parse(conteudo);
    } catch {
      throw new Error("A configuração mestre está inválida ou corrompida.");
    }

    this.validarConfiguracao(configuracao);
    return configuracao;
  }

  obterChaveMestre(senhaAdministrador: string): Buffer {
    const configuracao = this.carregar(senhaAdministrador);
    const chave = Buffer.from(configuracao.chaveMestre, "base64");
    if (chave.length !== 32) {
      throw new Error("A chave mestre deve possuir 32 bytes.");
    }
    return Buffer.from(chave);
  }

  obterAdministrador(senhaAdministrador: string): Administrador {
    const configuracao = this.carregar(senhaAdministrador);
    return {
      usuario: configuracao.administrador.usuario,
      senhaHash: configuracao.administrador.senhaHash,
      salt: configuracao.administrador.salt
    };
  }

  private lerEnvelope(): ArquivoConfiguracao {
    if (!this.existe()) {
      throw new Error("O sistema ainda não foi provisionado.");
    }

    let bruto: string;
    try {
      bruto = fs.readFileSync(this.arquivo, "utf8");
    } catch {
      throw new Error("Não foi possível ler a configuração mestre.");
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(bruto);
    } catch {
      throw new Error("A configuração mestre está inválida ou corrompida.");
    }

    if (
      typeof envelope !== "object" ||
      envelope === null ||
      typeof (envelope as Record<string, unknown>).versao !== "number" ||
      typeof (envelope as Record<string, unknown>).salt !== "string" ||
      typeof (envelope as Record<string, unknown>).conteudo !== "string"
    ) {
      throw new Error("Formato da configuração mestre inválido.");
    }

    return envelope as ArquivoConfiguracao;
  }

  private salvarEnvelope(
    configuracao: Configuracao,
    salt: string,
    chave: Buffer
  ): void {
    const conteudo = JSON.stringify(configuracao, null, 2);
    const envelope: ArquivoConfiguracao = {
      versao: 2,
      salt,
      conteudo: this.criptografia.criptografar(conteudo, chave)
    };

    const temporario = `${this.arquivo}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(
        temporario,
        JSON.stringify(envelope, null, 2),
        "utf8"
      );
      fs.renameSync(temporario, this.arquivo);
    } catch {
      if (fs.existsSync(temporario)) {
        fs.unlinkSync(temporario);
      }
      throw new Error("Não foi possível concluir o provisionamento do sistema.");
    }
  }

  private gerarChaveConfiguracao(
    senha: string,
    saltHex: string
  ): Buffer {
    return crypto.scryptSync(
      senha,
      Buffer.from(saltHex, "hex"),
      32
    );
  }

  private validarConfiguracao(
    configuracao: unknown
  ): asserts configuracao is Configuracao {
    if (typeof configuracao !== "object" || configuracao === null) {
      throw new Error("A configuração mestre possui formato inválido.");
    }

    const dados = configuracao as Record<string, unknown>;
    const administrador = dados.administrador as Record<string, unknown> | undefined;

    if (typeof dados.chaveMestre !== "string" || !dados.chaveMestre) {
      throw new Error("A configuração mestre não possui uma chave válida.");
    }
    if (!administrador || typeof administrador !== "object") {
      throw new Error("A configuração mestre não possui um administrador válido.");
    }
    if (typeof administrador.usuario !== "string" || !administrador.usuario.trim()) {
      throw new Error("O usuário do administrador é inválido.");
    }
    if (typeof administrador.senhaHash !== "string" || !administrador.senhaHash) {
      throw new Error("O hash da senha do administrador é inválido.");
    }
    if (typeof administrador.salt !== "string" || !administrador.salt) {
      throw new Error("O salt do administrador é inválido.");
    }

    const chave = Buffer.from(dados.chaveMestre, "base64");
    if (chave.length !== 32) {
      throw new Error("A chave mestre deve possuir 32 bytes válidos.");
    }
  }
}
