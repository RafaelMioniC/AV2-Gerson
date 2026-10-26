import { ServicoOrganizacao } from "./ServicoOrganizacao";
import { ServicoLote } from "./ServicoLote";
import { ServicoEquipamento } from "./ServicoEquipamento";
import { ServicoMovimentacao } from "./ServicoMovimentacao";

export class ServicoRelatorio {

  constructor(
    private readonly servicoOrganizacao:
      ServicoOrganizacao,

    private readonly servicoLote:
      ServicoLote,

    private readonly servicoEquipamento:
      ServicoEquipamento,

    private readonly servicoMovimentacao:
      ServicoMovimentacao
  ) { }

  gerarRelatorio(): void {

    const organizacoes =
      this.servicoOrganizacao
        .listar();

    const lotes =
      this.servicoLote
        .listar();

    const equipamentos =
      this.servicoEquipamento
        .listar();

    const movimentacoes =
      this.servicoMovimentacao
        .listar();

    console.log("");
    console.log(
      "================================="
    );
    console.log(
      "       RELATÓRIO GREENCODE"
    );
    console.log(
      "================================="
    );

    console.log(
      `Organizações: ${organizacoes.length}`
    );

    console.log(
      `Lotes: ${lotes.length}`
    );

    console.log(
      `Equipamentos: ${equipamentos.length}`
    );

    console.log(
      `Movimentações: ${movimentacoes.length}`
    );

    console.log(
      "================================="
    );
  }
}