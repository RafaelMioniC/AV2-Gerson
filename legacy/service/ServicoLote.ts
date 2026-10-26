import { Lote } from "../classes/Lote";
import { RepositorioLote } from "../repositories/RepositorioLote";
import { JournalTransacao } from "../audit/jornalTransacao";
import { ValidadorDataEntrada } from "../validators/ValidadorDataEntrada";
import { DadosLote } from "../models/DadosLote";

export class ServicoLote {
  constructor(private readonly repositorio: RepositorioLote, private readonly journal: JournalTransacao) { }

  criar(lote: Lote, usuario: string): void {
    const lotes = this.repositorio.listar();
    if (lotes.some(item => item.id === lote.id)) throw new Error("Já existe um lote com este ID.");
    if (!new ValidadorDataEntrada().validar(lote.dataEntrada)) throw new Error(new ValidadorDataEntrada().obterMensagemErro());
    const dados: DadosLote = {
      id: lote.id,
      dataEntrada: lote.dataEntrada.toISOString(),
      organizacaoId: lote.organizacaoId,
      notaFiscal: lote.notaFiscal,
      transportadora: lote.transportadora,
      status: lote.status,
      observacoes: lote.observacoes,
      equipamentoIds: []
    };
    this.journal.registrar(usuario, "CRIAR", "LOTE", lote.id, `Cadastro do lote ${lote.id}`);
    this.repositorio.salvar([...lotes, dados]);
  }

  listar(): Lote[] {
    return this.repositorio.listar().map(dados => {
      const lote = new Lote(dados.id, new Date(dados.dataEntrada), dados.organizacaoId, dados.notaFiscal, dados.transportadora, dados.observacoes);
      lote.status = dados.status;
      return lote;
    });
  }

  buscarPorId(id: string): Lote | undefined { return this.listar().find(lote => lote.id === id); }

  vincularEquipamento(loteId: string, equipamentoId: string, usuario: string): void {
    const lotes = this.repositorio.listar();
    const lote = lotes.find(item => item.id === loteId);
    if (!lote) throw new Error("O lote informado não existe.");
    if (!lote.equipamentoIds) lote.equipamentoIds = [];
    if (lote.equipamentoIds.includes(equipamentoId)) return;
    lote.equipamentoIds.push(equipamentoId);
    this.journal.registrar(usuario, "VINCULAR", "LOTE", loteId, `Equipamento ${equipamentoId} vinculado ao lote ${loteId}`);
    this.repositorio.salvar(lotes);
  }

  editar(id: string, campos: Partial<Pick<DadosLote, "organizacaoId" | "notaFiscal" | "transportadora" | "observacoes">>, usuario: string): void {
    const lotes = this.repositorio.listar();
    const lote = lotes.find(l => l.id === id);
    if (!lote) throw new Error("Lote não encontrado.");
    if (campos.organizacaoId && !lote.organizacaoId) throw new Error("Organização inválida.");
    Object.assign(lote, campos);
    this.journal.registrar(usuario, "ATUALIZAR", "LOTE", id, "Edição do lote");
    this.repositorio.salvar(lotes);
  }

  excluir(id: string, usuario: string): void {
    const lotes = this.repositorio.listar();
    const lote = lotes.find(l => l.id === id);
    if (!lote) throw new Error("Lote não encontrado.");
    if (lote.equipamentoIds?.length) throw new Error("Não é possível excluir um lote que possui equipamentos.");
    this.journal.registrar(usuario, "EXCLUIR", "LOTE", id, "Exclusão do lote");
    this.repositorio.salvar(lotes.filter(l => l.id !== id));
  }

}
