import { Equipamento } from "../classes/Equipamento";
import { Movimentacao } from "../classes/Movimentacao";
import { StatusEquipamento } from "../enums/StatusEquipamento";
import { RepositorioMovimentacao } from "../repositories/RepositorioMovimentacao";
import { RepositorioEquipamento } from "../repositories/RepositorioEquipamento";
import { JournalTransacao } from "../audit/jornalTransacao";
import { DadosMovimentacao } from "../models/DadosMovimentacao";

export class ServicoMovimentacao {

  constructor(
    private readonly repositorio: RepositorioMovimentacao,
    private readonly repositorioEquipamento: RepositorioEquipamento,
    private readonly journal: JournalTransacao
  ) { }

  registrar(
    equipamento: Equipamento,
    movimentacao: Movimentacao
  ): void {

    if (
      movimentacao.novoStatus ===
      StatusEquipamento.DESMONTE &&
      equipamento.status !==
      StatusEquipamento.TRIAGEM_CONCLUIDA
    ) {
      throw new Error(
        "O equipamento precisa passar por triagem completa antes de ir para desmonte."
      );
    }

    const movimentacoes =
      this.repositorio.listar();

    const equipamentos =
      this.repositorioEquipamento.listar();

    const dadosMovimentacao:
      DadosMovimentacao = {
      id:
        movimentacao.id,
      equipamentoId:
        movimentacao.equipamentoId,
      statusAnterior:
        movimentacao.statusAnterior,
      novoStatus:
        movimentacao.novoStatus,
      data:
        movimentacao.data.toISOString(),
      usuario:
        movimentacao.usuario,
      justificativa:
        movimentacao.justificativa
    };

    this.journal.registrar(
      movimentacao.usuario,
      "CRIAR",
      "MOVIMENTACAO",
      movimentacao.id,
      `Movimentação do equipamento ${equipamento.id}: ${movimentacao.statusAnterior} -> ${movimentacao.novoStatus}`
    );

    const equipamentoAtualizado = {
      id:
        equipamento.id,
      codigoBarrasInterno:
        equipamento.codigoBarrasInterno,
      tipo:
        equipamento.tipo,
      marca:
        equipamento.marca,
      modelo:
        equipamento.modelo,
      anoFabricacao:
        equipamento.anoFabricacao,
      estadoFisico:
        equipamento.estadoFisico,
      dataEntrada:
        equipamento.dataEntrada.toISOString(),
      local:
        equipamento.local,
      peso:
        equipamento.peso,
      status:
        movimentacao.novoStatus
    };

    this.repositorio.salvar(
      [
        ...movimentacoes,
        dadosMovimentacao
      ]
    );

    this.repositorioEquipamento.salvar(
      equipamentos.map(
        item =>
          item.id === equipamento.id
            ? { ...equipamentoAtualizado, loteId: item.loteId }
            : item
      )
    );

    equipamento.status =
      movimentacao.novoStatus;
  }

  listar(): Movimentacao[] {

    return this.repositorio
      .listar()
      .map(
        dados =>
          new Movimentacao(
            dados.id,
            dados.equipamentoId,
            dados.statusAnterior,
            dados.novoStatus,
            dados.usuario,
            dados.justificativa,
            new Date(dados.data)
          )
      );
  }

  buscarPorEquipamento(
    idEquipamento: string
  ): Movimentacao[] {

    return this.listar().filter(
      movimentacao =>
        movimentacao.equipamentoId ===
        idEquipamento
    );
  }

  editar(id: string, status: StatusEquipamento | undefined, justificativa: string | undefined, usuario: string): void {
    const movimentacoes = this.repositorio.listar();
    const item = movimentacoes.find(m => m.id === id);
    if (!item) throw new Error("Movimentação não encontrada.");
    if (justificativa !== undefined) item.justificativa = justificativa;
    if (status) {
      item.novoStatus = status;
      const equipamentos = this.repositorioEquipamento.listar();
      this.repositorioEquipamento.salvar(equipamentos.map(e => e.id === item.equipamentoId ? { ...e, status } : e));
    }
    this.journal.registrar(usuario, "ATUALIZAR", "MOVIMENTACAO", id, "Edição da movimentação");
    this.repositorio.salvar(movimentacoes);
  }

  excluir(id: string, usuario: string): void {
    const movimentacoes = this.repositorio.listar();
    const item = movimentacoes.find(m => m.id === id);
    if (!item) throw new Error("Movimentação não encontrada.");
    const restantes = movimentacoes.filter(m => m.id !== id);
    const ultima = restantes.filter(m => m.equipamentoId === item.equipamentoId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
    const equipamentos = this.repositorioEquipamento.listar();
    this.repositorioEquipamento.salvar(equipamentos.map(e => e.id === item.equipamentoId ? { ...e, status: ultima?.novoStatus ?? StatusEquipamento.RECEBIDO } : e));
    this.journal.registrar(usuario, "EXCLUIR", "MOVIMENTACAO", id, "Exclusão da movimentação");
    this.repositorio.salvar(restantes);
  }

}
