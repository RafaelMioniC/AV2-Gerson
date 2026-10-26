import { Organizacao } from "../classes/Organizacao";
import { RepositorioOrganizacao } from "../repositories/RepositorioOrganizacao";
import { JournalTransacao } from "../audit/jornalTransacao";
import { ValidadorCNPJ } from "../validators/ValidadorCNPJ";
import { DadosOrganizacao } from "../models/DadosOrganizacao";

export class ServicoOrganizacao {

  constructor(
    private readonly repositorio: RepositorioOrganizacao,
    private readonly journal: JournalTransacao
  ) { }

  criar(
    organizacao: Organizacao,
    usuario: string
  ): void {

    const organizacoes =
      this.repositorio.listar();

    const validador =
      new ValidadorCNPJ();

    if (
      !validador.validar(
        organizacao.cnpj
      )
    ) {
      throw new Error(
        validador.obterMensagemErro()
      );
    }

    const existe =
      organizacoes.some(
        item =>
          item.cnpj === organizacao.cnpj
      );

    if (existe) {
      throw new Error(
        "Já existe uma organização cadastrada com este CNPJ."
      );
    }

    const dados: DadosOrganizacao = {
      id: organizacao.id,
      razaoSocial: organizacao.razaoSocial,
      cnpj: organizacao.cnpj,
      inscricaoEstadual: organizacao.inscricaoEstadual,
      enderecoCompleto: organizacao.enderecoCompleto,
      telefone: organizacao.telefone,
      email: organizacao.email,
      dataCadastro:
        organizacao.dataCadastro.toISOString(),
      ativo: organizacao.ativo
    };

    this.journal.registrar(
      usuario,
      "CRIAR",
      "ORGANIZACAO",
      organizacao.id,
      `Cadastro da organização ${organizacao.razaoSocial}`
    );

    this.repositorio.salvar(
      [
        ...organizacoes,
        dados
      ]
    );
  }

  listar(): Organizacao[] {

    return this.repositorio
      .listar()
      .map(
        dados =>
          (() => {
            const organizacao = new Organizacao(
              dados.id,
              dados.razaoSocial,
              dados.cnpj,
              dados.inscricaoEstadual,
              dados.enderecoCompleto,
              dados.telefone,
              dados.email
            );
            organizacao.ativo = dados.ativo;
            organizacao.dataCadastro = new Date(dados.dataCadastro);
            return organizacao;
          })()
      );
  }

  buscarPorId(
    id: string
  ): Organizacao | undefined {

    return this.listar().find(
      organizacao =>
        organizacao.id === id
    );
  }

  editar(id: string, campos: Partial<Pick<Organizacao, "razaoSocial" | "cnpj" | "inscricaoEstadual" | "enderecoCompleto" | "telefone" | "email">>, usuario: string): void {
    const dados = this.repositorio.listar();
    const item = dados.find(o => o.id === id);
    if (!item) throw new Error("Organização não encontrada.");
    const cnpj = campos.cnpj ?? item.cnpj;
    const validador = new ValidadorCNPJ();
    if (!validador.validar(cnpj)) throw new Error(validador.obterMensagemErro());
    if (dados.some(o => o.id !== id && o.cnpj === cnpj)) throw new Error("Já existe uma organização com este CNPJ.");
    Object.assign(item, campos);
    this.journal.registrar(usuario, "ATUALIZAR", "ORGANIZACAO", id, "Edição da organização");
    this.repositorio.salvar(dados);
  }

  excluir(id: string, usuario: string): void {
    const dados = this.repositorio.listar();
    if (!dados.some(o => o.id === id)) throw new Error("Organização não encontrada.");
    this.journal.registrar(usuario, "EXCLUIR", "ORGANIZACAO", id, "Exclusão da organização");
    this.repositorio.salvar(dados.filter(o => o.id !== id));
  }

}