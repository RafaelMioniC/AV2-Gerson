import { Equipamento } from "../classes/Equipamento";
import { RepositorioEquipamento } from "../repositories/RepositorioEquipamento";
import { JournalTransacao } from "../audit/jornalTransacao";
import { DadosEquipamento } from "../models/DadosEquipamento";
import { RepositorioLote } from "../repositories/RepositorioLote";
import { EstadoFisico } from "../enums/EstadoFisico";

export class ServicoEquipamento {
  constructor(
    private readonly repositorio: RepositorioEquipamento,
    private readonly repositorioLote: RepositorioLote,
    private readonly journal: JournalTransacao
  ) { }

  cadastrar(equipamento: Equipamento, loteId: string, usuario: string): void {
    const equipamentos = this.repositorio.listar();
    const lotes = this.repositorioLote.listar();
    if (!lotes.some(item => item.id === loteId)) throw new Error("O lote informado não existe.");
    if (equipamentos.some(item => item.id === equipamento.id)) throw new Error("Equipamento já cadastrado.");
    if (equipamentos.some(item => item.codigoBarrasInterno === equipamento.codigoBarrasInterno)) throw new Error("O código de barras interno já está cadastrado.");
    if (!Number.isInteger(equipamento.anoFabricacao) || equipamento.anoFabricacao < 1900 || equipamento.anoFabricacao > new Date().getFullYear()) throw new Error("Ano de fabricação inválido.");
    if (!Number.isFinite(equipamento.peso) || equipamento.peso <= 0) throw new Error("O peso deve ser maior que zero.");
    if (Number.isNaN(equipamento.dataEntrada.getTime())) throw new Error("A data de entrada do equipamento é inválida.");

    const dados: DadosEquipamento = { ...equipamento, loteId, dataEntrada: equipamento.dataEntrada.toISOString() };
    this.journal.registrar(usuario, "CRIAR", "EQUIPAMENTO", equipamento.id, `Cadastro do equipamento ${equipamento.id} no lote ${loteId}`);
    this.repositorio.salvar([...equipamentos, dados]);

    const lote = lotes.find(item => item.id === loteId)!;
    if (!lote.equipamentoIds) lote.equipamentoIds = [];
    if (!lote.equipamentoIds.includes(equipamento.id)) lote.equipamentoIds.push(equipamento.id);
    this.repositorioLote.salvar(lotes);
  }

  atualizarEstadoFisico(id: string, novoEstado: EstadoFisico, justificativa: string, usuario: string): void {
    const equipamentos = this.repositorio.listar();
    const equipamento = equipamentos.find(item => item.id === id);
    if (!equipamento) throw new Error("Equipamento não encontrado.");
    const objeto = this.converter(equipamento);
    objeto.atualizarEstadoFisico(novoEstado, justificativa);
    const atualizado: DadosEquipamento = { ...equipamento, estadoFisico: objeto.estadoFisico };
    this.journal.registrar(usuario, "ATUALIZAR", "EQUIPAMENTO", id, `Estado físico: ${equipamento.estadoFisico} -> ${novoEstado}; Justificativa: ${justificativa || "não informada"}`);
    this.repositorio.salvar(equipamentos.map(item => item.id === id ? atualizado : item));
  }

  listar(): Equipamento[] { return this.repositorio.listar().map(dados => this.converter(dados)); }
  buscarPorId(id: string): Equipamento | undefined { return this.listar().find(e => e.id === id); }

  private converter(dados: DadosEquipamento): Equipamento {
    const equipamento = new Equipamento(dados.id, dados.codigoBarrasInterno, dados.tipo, dados.marca, dados.modelo, dados.anoFabricacao, dados.estadoFisico, new Date(dados.dataEntrada), dados.local, dados.peso);
    equipamento.status = dados.status;
    return equipamento;
  }

  editar(id: string, campos: Partial<Pick<Equipamento, "codigoBarrasInterno" | "tipo" | "marca" | "modelo" | "anoFabricacao" | "estadoFisico" | "local" | "peso">>, usuario: string): void {
    const dados = this.repositorio.listar();
    const item = dados.find(e => e.id === id);
    if (!item) throw new Error("Equipamento não encontrado.");
    const codigo = campos.codigoBarrasInterno ?? item.codigoBarrasInterno;
    if (dados.some(e => e.id !== id && e.codigoBarrasInterno === codigo)) throw new Error("O código de barras interno já está cadastrado.");
    if (campos.anoFabricacao !== undefined && (!Number.isInteger(campos.anoFabricacao) || campos.anoFabricacao < 1900 || campos.anoFabricacao > new Date().getFullYear())) throw new Error("Ano de fabricação inválido.");
    if (campos.peso !== undefined && (!Number.isFinite(campos.peso) || campos.peso <= 0)) throw new Error("O peso deve ser maior que zero.");
    Object.assign(item, campos);
    this.journal.registrar(usuario, "ATUALIZAR", "EQUIPAMENTO", id, "Edição do equipamento");
    this.repositorio.salvar(dados);
  }

  excluir(id: string, usuario: string): void {
    const dados = this.repositorio.listar();
    if (!dados.some(e => e.id === id)) throw new Error("Equipamento não encontrado.");
    const lotes = this.repositorioLote.listar();
    this.journal.registrar(usuario, "EXCLUIR", "EQUIPAMENTO", id, "Exclusão do equipamento");
    this.repositorio.salvar(dados.filter(e => e.id !== id));
    this.repositorioLote.salvar(lotes.map(l => ({ ...l, equipamentoIds: (l.equipamentoIds ?? []).filter(eid => eid !== id) })));
  }

}
