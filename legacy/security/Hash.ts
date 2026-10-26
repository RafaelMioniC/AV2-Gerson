import crypto from "crypto";

export class Hash {

  private static readonly TAMANHO_SALT = 16;

  static gerarSalt(): string {
    return crypto
      .randomBytes(Hash.TAMANHO_SALT)
      .toString("hex");
  }

  static gerar(senha: string, salt: string): string {
    return crypto
      .createHash("sha256")
      .update(senha + salt)
      .digest("hex");
  }

  static verificar(
    senha: string,
    hash: string,
    salt: string
  ): boolean {
    const novoHash = Hash.gerar(senha, salt);

    return crypto.timingSafeEqual(
      Buffer.from(novoHash, "hex"),
      Buffer.from(hash, "hex")
    );
  }
}
