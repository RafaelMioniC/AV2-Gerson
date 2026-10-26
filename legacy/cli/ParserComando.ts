export interface Comando {
  recurso: string;
  acao: string;
  parametros: Record<string, string>;
  posicionais: string[];
}

export class ParserComando {
  interpretar(entrada: string): Comando {
    const partes = this.tokenizar(entrada);
    const recurso = partes[0] ?? "";
    const acao = partes[1] ?? "";
    const parametros: Record<string, string> = {};
    const posicionais: string[] = [];

    for (let i = 2; i < partes.length; i++) {
      const parte = partes[i];
      if (!parte.startsWith("--")) {
        posicionais.push(parte);
        continue;
      }
      const nome = parte.substring(2);
      const proximo = partes[i + 1];
      if (proximo && !proximo.startsWith("--")) {
        parametros[nome] = proximo;
        i++;
      } else {
        parametros[nome] = "true";
      }
    }
    return { recurso, acao, parametros, posicionais };
  }

  private tokenizar(entrada: string): string[] {
    const resultado: string[] = [];
    const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g;
    let correspondencia: RegExpExecArray | null;
    while ((correspondencia = regex.exec(entrada)) !== null) {
      resultado.push(correspondencia[1] ?? correspondencia[2] ?? correspondencia[3]);
    }
    return resultado;
  }
}
