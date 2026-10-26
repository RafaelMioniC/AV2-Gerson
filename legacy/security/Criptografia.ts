import * as crypto from "crypto";

export class Criptografia {

  private readonly algoritmo = "aes-256-gcm";
  private readonly tamanhoChave = 32;
  private readonly tamanhoIv = 16;
  private readonly aad = "GreenCode";

  criptografar(
    texto: string,
    chave: Buffer
  ): string {

    this.validarChave(chave);

    const iv =
      crypto.randomBytes(
        this.tamanhoIv
      );

    const cipher =
      crypto.createCipheriv(
        this.algoritmo,
        chave,
        iv
      );

    cipher.setAAD(
      Buffer.from(this.aad)
    );

    const criptografado =
      Buffer.concat([
        cipher.update(
          texto,
          "utf8"
        ),
        cipher.final()
      ]);

    const tag =
      cipher.getAuthTag();

    return [
      iv.toString("base64"),
      tag.toString("base64"),
      criptografado.toString("base64")
    ].join(":");
  }

  descriptografar(
    textoCriptografado: string,
    chave: Buffer
  ): string {

    this.validarChave(chave);

    const partes =
      textoCriptografado.split(":");

    if (partes.length !== 3) {
      throw new Error(
        "Conteúdo criptografado inválido."
      );
    }

    const iv =
      Buffer.from(
        partes[0],
        "base64"
      );

    const tag =
      Buffer.from(
        partes[1],
        "base64"
      );

    const criptografado =
      Buffer.from(
        partes[2],
        "base64"
      );

    const decipher =
      crypto.createDecipheriv(
        this.algoritmo,
        chave,
        iv
      );

    decipher.setAAD(
      Buffer.from(this.aad)
    );

    decipher.setAuthTag(tag);

    const texto =
      Buffer.concat([
        decipher.update(
          criptografado
        ),
        decipher.final()
      ]);

    return texto.toString("utf8");
  }

  gerarChave(): Buffer {

    return crypto.randomBytes(
      this.tamanhoChave
    );
  }

  private validarChave(
    chave: Buffer
  ): void {

    if (
      !Buffer.isBuffer(chave) ||
      chave.length !== this.tamanhoChave
    ) {
      throw new Error(
        "A chave de criptografia deve possuir 32 bytes."
      );
    }
  }
}
