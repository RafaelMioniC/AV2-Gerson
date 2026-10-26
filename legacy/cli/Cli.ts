import readline from "readline";
import crypto from "crypto";
import { Sessao } from "../classes/Sessao";
import { Organizacao } from "../classes/Organizacao";
import { Lote } from "../classes/Lote";
import { Equipamento } from "../classes/Equipamento";
import { Movimentacao } from "../classes/Movimentacao";
import { Contrato } from "../classes/Contrato";
import { TipoEquipamento } from "../enums/TipoEquipamento";
import { EstadoFisico } from "../enums/EstadoFisico";
import { StatusEquipamento } from "../enums/StatusEquipamento";
import { PapelUsuario } from "../enums/PapelUsuario";
import { Menu } from "./Menu";
import { ParserComando, Comando } from "./ParserComando";
import { Historico } from "./Historico";
import { ServicoAutenticacao } from "../service/ServicoAutenticar";
import { ServicoOrganizacao } from "../service/ServicoOrganizacao";
import { ServicoLote } from "../service/ServicoLote";
import { ServicoEquipamento } from "../service/ServicoEquipamento";
import { ServicoMovimentacao } from "../service/ServicoMovimentacao";
import { ServicoRelatorio } from "../service/ServicoRelatorio";
import { ServicoContrato } from "../service/ServicoContrato";
import { ServicoConfiguracao } from "../service/ServicoConfiguracao";

export class CLI {
  private readonly rl: readline.Interface;
  private readonly menu: Menu;
  private readonly parser: ParserComando;
  private readonly historico: Historico;

  constructor(
    private readonly sessao: Sessao,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly servicoOrganizacao: ServicoOrganizacao,
    private readonly servicoLote: ServicoLote,
    private readonly servicoEquipamento: ServicoEquipamento,
    private readonly servicoMovimentacao: ServicoMovimentacao,
    private readonly servicoRelatorio: ServicoRelatorio,
    private readonly servicoContrato: ServicoContrato,
    private readonly servicoConfiguracao: ServicoConfiguracao,
    chaveMestre: Buffer
  ) {
    this.menu = new Menu();
    this.parser = new ParserComando();
    this.historico = new Historico(chaveMestre);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "greencode> ",
      historySize: 100,
      removeHistoryDuplicates: true,
      completer: (linha: string, callback: (err: null, result: [string[], string]) => void) => {
        const opcoes = this.opcoesAutocomplete();
        const correspondentes = opcoes.filter(item => item.startsWith(linha));
        callback(null, [correspondentes.length ? correspondentes : opcoes, linha]);
      }
    });
    (this.rl as readline.Interface & { history: string[]; }).history = this.historico.listar().slice().reverse();
  }

  iniciar(): void {
    console.log("\n==============================\n          GREENCODE\n==============================");
    console.log(`Usuário: ${this.sessao.usuario}`);
    console.log(`Perfil: ${this.sessao.papel}`);
    this.menu.exibir(this.sessao.papel);
    this.rl.prompt();

    this.rl.on("line", async linha => {
      const entrada = linha.trim();
      if (!entrada) { this.rl.prompt(); return; }
      try {
        if (entrada.toLowerCase() === "sair") { this.encerrar(); return; }
        if (entrada.toLowerCase() === "menu") { this.menu.exibir(this.sessao.papel); this.rl.prompt(); return; }
        const sessaoAtual = this.autenticacao.validarSessao(this.sessao.token);
        if (!sessaoAtual) { console.log("\n[ERRO] Sessão expirada."); this.encerrar(); return; }
        this.sessao.renovar();
        this.historico.adicionar(entrada);
        await this.executar(this.parser.interpretar(entrada));
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
        console.log(`\n[ERRO] ${mensagem}`);
      }
      this.rl.prompt();
    });
    this.rl.on("close", () => console.log("\nGreenCode encerrado."));
  }

  private async executar(comando: Comando): Promise<void> {
    const chave = `${comando.recurso} ${comando.acao}`.trim().toLowerCase();
    switch (chave) {
      case "organização criar": case "organizacao criar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]); this.criarOrganizacao(comando); break;
      case "organização listar": case "organizacao listar": this.verificarPermissao(Object.values(PapelUsuario)); this.listarOrganizacoes(); break;
      case "organização editar": case "organizacao editar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]); this.editarOrganizacao(comando); break;
      case "organização excluir": case "organizacao excluir": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.excluirOrganizacao(comando); break;
      case "contrato criar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]); this.criarContrato(comando); break;
      case "contrato listar": this.verificarPermissao(Object.values(PapelUsuario)); this.listarContratos(); break;
      case "contrato editar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]); this.editarContrato(comando); break;
      case "contrato excluir": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.excluirContrato(comando); break;
      case "contrato renovar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]); this.renovarContrato(comando); break;
      case "contrato encerrar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]); this.encerrarContrato(comando); break;
      case "lote criar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.criarLote(comando); break;
      case "lote listar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO, PapelUsuario.AUDITOR]); this.listarLotes(); break;
      case "lote editar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.editarLote(comando); break;
      case "lote excluir": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.servicoLote.excluir(this.obrigatorio(this.completar(comando, ["id"]), "id"), this.sessao.usuario); console.log("[OK] Lote excluído."); break;
      case "equipamento cadastrar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.cadastrarEquipamento(comando); break;
      case "equipamento listar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO, PapelUsuario.AUDITOR]); this.listarEquipamentos(); break;
      case "equipamento editar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.editarEquipamento(comando); break;
      case "equipamento excluir": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.servicoEquipamento.excluir(this.obrigatorio(this.completar(comando, ["id"]), "id"), this.sessao.usuario); console.log("[OK] Equipamento excluído."); break;
      case "equipamento estado": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.alterarEstado(comando); break;
      case "movimentação registrar": case "movimentacao registrar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.registrarMovimentacao(comando); break;
      case "movimentação listar": case "movimentacao listar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO, PapelUsuario.AUDITOR]); this.listarMovimentacoes(comando); break;
      case "movimentação editar": case "movimentacao editar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]); this.editarMovimentacao(comando); break;
      case "movimentação excluir": case "movimentacao excluir": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.servicoMovimentacao.excluir(this.obrigatorio(this.completar(comando, ["id"]), "id"), this.sessao.usuario); console.log("[OK] Movimentação excluída."); break;
      case "usuário criar": case "usuario criar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.criarUsuario(comando); break;
      case "usuário listar": case "usuario listar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.listarUsuarios(); break;
      case "usuário editar": case "usuario editar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.editarUsuario(comando); break;
      case "usuário excluir": case "usuario excluir": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.excluirUsuario(comando); break;
      case "configuração atualizar": case "configuracao atualizar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR]); this.atualizarConfiguracao(comando); break;
      case "configuração listar": case "configuracao listar": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.AUDITOR]); this.listarConfiguracao(); break;
      case "relatório": case "relatorio": this.verificarPermissao([PapelUsuario.ADMINISTRADOR, PapelUsuario.AUDITOR]); this.servicoRelatorio.gerarRelatorio(); break;
      default: console.log("\n[AVISO] Comando não reconhecido.\nDigite 'menu' para visualizar as opções.");
    }
  }

  private criarOrganizacao(c: Comando): void {
    const p = this.completar(c, ["id", "nome", "cnpj", "ie", "endereco", "telefone", "email"]);
    const organizacao = new Organizacao(this.obrigatorio(p, "id"), this.obrigatorio(p, "nome"), this.obrigatorio(p, "cnpj"), p.ie ?? "", p.endereco ?? "", p.telefone ?? "", p.email ?? "");
    this.servicoOrganizacao.criar(organizacao, this.sessao.usuario);
    console.log("[OK] Organização cadastrada.");
  }

  private listarOrganizacoes(): void {
    const dados = this.servicoOrganizacao.listar();
    if (!dados.length) { console.log("[INFO] Nenhuma organização cadastrada."); return; }
    dados.forEach(o => console.log(`${o.id} | ${o.razaoSocial} | ${o.cnpj} | ${o.ativo ? "ATIVA" : "INATIVA"}`));
  }

  private criarContrato(c: Comando): void {
    const p = this.completar(c, ["id", "org", "inicio", "fim", "descricao", "valor", "coleta"]);
    const contrato = new Contrato(this.obrigatorio(p, "id"), this.obrigatorio(p, "org"), this.converterData(this.obrigatorio(p, "inicio")), this.converterData(this.obrigatorio(p, "fim")), p.descricao ?? "", Number(this.obrigatorio(p, "valor")), (p.coleta ?? "false").toLowerCase() === "true");
    this.servicoContrato.criar(contrato, this.sessao.usuario);
    console.log("[OK] Contrato cadastrado.");
  }

  private listarContratos(): void {
    const dados = this.servicoContrato.listar();
    if (!dados.length) { console.log("[INFO] Nenhum contrato cadastrado."); return; }
    dados.forEach(c => console.log(`${c.id} | organização: ${c.organizacaoId} | ${c.dataInicio.toLocaleDateString()} -> ${c.dataFim.toLocaleDateString()} | R$ ${c.valorMensal.toFixed(2)} | ${c.ativo ? "ATIVO" : "ENCERRADO"}`));
  }

  private renovarContrato(c: Comando): void {
    const p = this.completar(c, ["id", "fim"]);
    this.servicoContrato.renovar(this.obrigatorio(p, "id"), this.converterData(this.obrigatorio(p, "fim")), this.sessao.usuario);
    console.log("[OK] Contrato renovado.");
  }

  private encerrarContrato(c: Comando): void {
    const p = this.completar(c, ["id"]);
    this.servicoContrato.encerrar(this.obrigatorio(p, "id"), this.sessao.usuario);
    console.log("[OK] Contrato encerrado.");
  }

  private criarLote(c: Comando): void {
    const p = { ...c.parametros };
    if (c.posicionais.length) {
      p.org ??= c.posicionais[0]; p.nf ??= c.posicionais[1]; p.transp ??= c.posicionais[2];
    }
    p.id ??= `LOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    p.data ??= new Date().toISOString().slice(0, 10);
    const lote = new Lote(this.obrigatorio(p, "id"), this.converterData(this.obrigatorio(p, "data")), this.obrigatorio(p, "org"), this.obrigatorio(p, "nf"), this.obrigatorio(p, "transp"), p.obs ?? "");
    if (!this.servicoOrganizacao.buscarPorId(lote.organizacaoId)) throw new Error("A organização informada não existe.");
    this.servicoLote.criar(lote, this.sessao.usuario);
    console.log(`[OK] Lote cadastrado: ${lote.id}`);
  }

  private listarLotes(): void {
    const dados = this.servicoLote.listar();
    if (!dados.length) { console.log("[INFO] Nenhum lote cadastrado."); return; }
    dados.forEach(l => console.log(`${l.id} | organização: ${l.organizacaoId} | NF: ${l.notaFiscal} | ${l.status}`));
  }

  private cadastrarEquipamento(c: Comando): void {
    const p = this.completar(c, ["lote", "id", "codigo", "tipo", "marca", "modelo", "ano", "estado", "data", "local", "peso"]);
    const equipamento = new Equipamento(this.obrigatorio(p, "id"), this.obrigatorio(p, "codigo"), this.converterEnum(p.tipo, TipoEquipamento), this.obrigatorio(p, "marca"), this.obrigatorio(p, "modelo"), Number(this.obrigatorio(p, "ano")), this.converterEnum(p.estado, EstadoFisico), this.converterData(this.obrigatorio(p, "data")), this.obrigatorio(p, "local"), Number(this.obrigatorio(p, "peso")));
    this.servicoEquipamento.cadastrar(equipamento, this.obrigatorio(p, "lote"), this.sessao.usuario);
    console.log("[OK] Equipamento cadastrado.");
  }

  private listarEquipamentos(): void {
    const dados = this.servicoEquipamento.listar();
    if (!dados.length) { console.log("[INFO] Nenhum equipamento cadastrado."); return; }
    dados.forEach(e => console.log(`${e.id} | ${e.codigoBarrasInterno} | ${e.tipo} | ${e.marca} ${e.modelo} | ${e.estadoFisico} | ${e.status}`));
  }

  private alterarEstado(c: Comando): void {
    const p = this.completar(c, ["equipamento", "estado", "justificativa"]);
    this.servicoEquipamento.atualizarEstadoFisico(this.obrigatorio(p, "equipamento"), this.converterEnum(p.estado, EstadoFisico), p.justificativa ?? "", this.sessao.usuario);
    console.log("[OK] Estado físico atualizado.");
  }

  private registrarMovimentacao(c: Comando): void {
    const p = this.completar(c, ["equipamento", "status", "justificativa"]);
    const equipamento = this.servicoEquipamento.buscarPorId(this.obrigatorio(p, "equipamento"));
    if (!equipamento) throw new Error("O equipamento informado não existe.");
    const novoStatus = this.converterEnum(p.status, StatusEquipamento);
    const movimentacao = new Movimentacao(`${equipamento.id}-${Date.now()}`, equipamento.id, equipamento.status, novoStatus, this.sessao.usuario, p.justificativa ?? "");
    this.servicoMovimentacao.registrar(equipamento, movimentacao);
    console.log("[OK] Movimentação registrada.");
  }

  private editarMovimentacao(c: Comando): void {
    const p = this.completar(c, ["id"]);
    const status = p.status ? this.converterEnum(p.status, StatusEquipamento) : undefined;
    this.servicoMovimentacao.editar(this.obrigatorio(p, "id"), status, p.justificativa, this.sessao.usuario);
    console.log("[OK] Movimentação atualizada.");
  }

  private listarMovimentacoes(c: Comando): void {
    const id = c.parametros.equipamento ?? c.posicionais[0];
    const dados = id ? this.servicoMovimentacao.buscarPorEquipamento(id) : this.servicoMovimentacao.listar();
    if (!dados.length) { console.log("[INFO] Nenhuma movimentação encontrada."); return; }
    dados.forEach(m => console.log(`${m.id} | ${m.equipamentoId} | ${m.statusAnterior} -> ${m.novoStatus} | ${m.usuario} | ${m.justificativa}`));
  }

  private criarUsuario(c: Comando): void {
    const p = this.completar(c, ["usuario", "senha", "papel"]);
    this.autenticacao.criarUsuario(this.obrigatorio(p, "usuario"), this.obrigatorio(p, "senha"), this.converterEnum(p.papel, PapelUsuario), this.sessao.usuario);
    console.log("[OK] Usuário cadastrado.");
  }

  private listarUsuarios(): void { this.autenticacao.listarUsuarios().forEach(u => console.log(`${u.usuario} | ${u.papel}`)); }

  private editarOrganizacao(c: Comando): void {
    const p = this.completar(c, ["id"]);
    const campos: any = {};
    if (p.nome) campos.razaoSocial = p.nome;
    if (p.cnpj) campos.cnpj = p.cnpj;
    if (p.ie) campos.inscricaoEstadual = p.ie;
    if (p.endereco) campos.enderecoCompleto = p.endereco;
    if (p.telefone) campos.telefone = p.telefone;
    if (p.email) campos.email = p.email;
    this.servicoOrganizacao.editar(this.obrigatorio(p, "id"), campos, this.sessao.usuario);
    console.log("[OK] Organização atualizada.");
  }

  private excluirOrganizacao(c: Comando): void {
    const id = this.obrigatorio(this.completar(c, ["id"]), "id");
    if (this.servicoContrato.listar().some(x => x.organizacaoId === id)) throw new Error("Não é possível excluir uma organização vinculada a contratos.");
    if (this.servicoLote.listar().some(x => x.organizacaoId === id)) throw new Error("Não é possível excluir uma organização vinculada a lotes.");
    this.servicoOrganizacao.excluir(id, this.sessao.usuario);
    console.log("[OK] Organização excluída.");
  }

  private editarContrato(c: Comando): void {
    const p = this.completar(c, ["id"]);
    const campos: any = {};
    if (p.org) campos.organizacaoId = p.org;
    if (p.inicio) campos.dataInicio = this.converterData(p.inicio);
    if (p.fim) campos.dataFim = this.converterData(p.fim);
    if (p.descricao) campos.descricao = p.descricao;
    if (p.valor !== undefined) campos.valorMensal = Number(p.valor);
    if (p.coleta !== undefined) campos.coletaAutomatica = p.coleta.toLowerCase() === "true";
    this.servicoContrato.editar(this.obrigatorio(p, "id"), campos, this.sessao.usuario);
    console.log("[OK] Contrato atualizado.");
  }

  private excluirContrato(c: Comando): void {
    this.servicoContrato.excluir(this.obrigatorio(this.completar(c, ["id"]), "id"), this.sessao.usuario);
    console.log("[OK] Contrato excluído.");
  }

  private editarLote(c: Comando): void {
    const p = this.completar(c, ["id"]);
    const campos: any = {};
    if (p.org) {
      if (!this.servicoOrganizacao.buscarPorId(p.org)) throw new Error("Organização não encontrada.");
      campos.organizacaoId = p.org;
    }
    if (p.nf) campos.notaFiscal = p.nf;
    if (p.transp) campos.transportadora = p.transp;
    if (p.obs !== undefined) campos.observacoes = p.obs;
    this.servicoLote.editar(this.obrigatorio(p, "id"), campos, this.sessao.usuario);
    console.log("[OK] Lote atualizado.");
  }

  private editarEquipamento(c: Comando): void {
    const p = this.completar(c, ["id"]);
    const campos: any = {};
    if (p.codigo) campos.codigoBarrasInterno = p.codigo;
    if (p.tipo) campos.tipo = this.converterEnum(p.tipo, TipoEquipamento);
    if (p.marca) campos.marca = p.marca;
    if (p.modelo) campos.modelo = p.modelo;
    if (p.ano) campos.anoFabricacao = Number(p.ano);
    if (p.estado) campos.estadoFisico = this.converterEnum(p.estado, EstadoFisico);
    if (p.local) campos.local = p.local;
    if (p.peso) campos.peso = Number(p.peso);
    this.servicoEquipamento.editar(this.obrigatorio(p, "id"), campos, this.sessao.usuario);
    console.log("[OK] Equipamento atualizado.");
  }

  private editarUsuario(c: Comando): void {
    const p = this.completar(c, ["usuario"]);
    const papel = p.papel ? this.converterEnum(p.papel, PapelUsuario) : undefined;
    this.autenticacao.editarUsuario(this.obrigatorio(p, "usuario"), p.senha, papel, this.sessao.usuario);
    console.log("[OK] Usuário atualizado.");
  }

  private excluirUsuario(c: Comando): void {
    this.autenticacao.excluirUsuario(this.obrigatorio(this.completar(c, ["usuario"]), "usuario"), this.sessao.usuario);
    console.log("[OK] Usuário excluído.");
  }

  private atualizarConfiguracao(c: Comando): void {
    const p = this.completar(c, ["aliquota", "depreciacao"]);
    this.servicoConfiguracao.atualizar(Number(this.obrigatorio(p, "aliquota")), Number(this.obrigatorio(p, "depreciacao")), this.sessao.usuario);
    console.log("[OK] Configurações atualizadas.");
  }

  private listarConfiguracao(): void {
    const c = this.servicoConfiguracao.obter();
    console.log(`Alíquota de imposto: ${c.aliquotaImposto}%`);
    console.log(`Coeficiente de depreciação: ${c.coeficienteDepreciacao}%`);
  }

  private completar(c: Comando, nomes: string[]): Record<string, string> {
    const p = { ...c.parametros };
    c.posicionais.forEach((valor, i) => { if (nomes[i] && p[nomes[i]] === undefined) p[nomes[i]] = valor; });
    return p;
  }

  private verificarPermissao(permitidos: PapelUsuario[]): void {
    if (!permitidos.includes(this.sessao.papel)) throw new Error("Você não possui permissão para executar este comando.");
  }

  private obrigatorio(p: Record<string, string>, nome: string): string {
    const valor = p[nome];
    if (!valor) throw new Error(`O parâmetro --${nome} é obrigatório.`);
    return valor;
  }

  private converterData(valor: string): Date {
    const texto = valor.trim();
    let data: Date;
    const brasileiro = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
    if (brasileiro) data = new Date(Number(brasileiro[3]), Number(brasileiro[2]) - 1, Number(brasileiro[1]));
    else data = new Date(texto);
    if (Number.isNaN(data.getTime())) throw new Error(`Data inválida: ${valor}. Use DD/MM/AAAA ou AAAA-MM-DD.`);
    return data;
  }

  private converterEnum<T extends Record<string, string>>(valor: string | undefined, enumeracao: T): T[keyof T] {
    if (!valor) throw new Error("Parâmetro obrigatório não informado.");
    const encontrado = (Object.values(enumeracao) as string[]).find(item => item.toUpperCase() === valor.toUpperCase());
    if (!encontrado) throw new Error(`Valor inválido: ${valor}.`);
    return encontrado as T[keyof T];
  }

  private opcoesAutocomplete(): string[] {
    return [
      "menu", "sair", "organização criar", "organização listar", "contrato criar", "contrato listar", "contrato renovar", "contrato encerrar",
      "lote criar", "lote listar", "equipamento cadastrar", "equipamento listar", "equipamento estado", "movimentação registrar", "movimentação listar",
      "usuario criar", "usuario listar", "usuario editar", "usuario excluir", "configuracao atualizar", "configuracao listar", "relatorio"
    ];
  }

  private encerrar(): void { this.autenticacao.encerrarSessao(this.sessao.token); this.rl.close(); }
}
