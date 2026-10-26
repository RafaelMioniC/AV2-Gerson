import { Validador } from "./Validador";

export class ValidadorCNPJ extends Validador {

  validar(objeto: any): boolean {

    if (typeof objeto !== "string") {
      return false;
    }

    const numero = objeto.replace(/\D/g, "");

    if (numero.length !== 14) {
      return false;
    }

    if (/^(\d)\1+$/.test(numero)) {
      return false;
    }

    let soma = 0;
    let peso = 5;

    for (let i = 0; i < 12; i++) {
      soma += Number(numero[i]) * peso;

      peso--;

      if (peso === 1) {
        peso = 9;
      }
    }

    let resto = soma % 11;
    const primeiroDigito =
      resto < 2 ? 0 : 11 - resto;

    if (primeiroDigito !== Number(numero[12])) {
      return false;
    }

    soma = 0;
    peso = 6;

    for (let i = 0; i < 13; i++) {
      soma += Number(numero[i]) * peso;

      peso--;

      if (peso === 1) {
        peso = 9;
      }
    }

    resto = soma % 11;

    const segundoDigito =
      resto < 2 ? 0 : 11 - resto;

    return segundoDigito === Number(numero[13]);
  }

  obterMensagemErro(): string {
    return "CNPJ inválido.";
  }
}