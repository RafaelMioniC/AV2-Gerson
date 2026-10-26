import { Validador } from "./Validador";

export class ValidadorDataEntrada extends Validador {

  validar(data: any): boolean {

    if (!(data instanceof Date)) {
      return false;
    }

    if (isNaN(data.getTime())) {
      return false;
    }

    const agora = new Date();

    if (data > agora) {
      return false;
    }

    const limite = new Date();

    limite.setDate(limite.getDate() - 90);

    if (data < limite) {
      return false;
    }

    return true;
  }

  obterMensagemErro(): string {
    return "A data de entrada deve estar entre hoje e os últimos 90 dias.";
  }
}