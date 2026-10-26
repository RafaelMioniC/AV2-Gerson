import crypto from "crypto";

import { RepositorioCredencial } from "../repositories/RepositorioCredencial";
import { JournalTransacao } from "../audit/jornalTransacao";
import { Hash } from "../security/Hash";
import { GerenciadorSessao } from "../security/GerenciadorSessao";
import { Sessao } from "../classes/Sessao";
import { PapelUsuario } from "../enums/PapelUsuario";
import { DadosCredencial } from "../models/DadosCredencial";

export class ServicoAutenticacao {

  constructor(
    private readonly repositorio: RepositorioCredencial,
    private readonly journal: JournalTransacao,
    private readonly gerenciadorSessao: GerenciadorSessao
  ) { }

  autenticar(
    usuario: string,
    senha: string
  ): Sessao | undefined {

    const credenciais =
      this.repositorio.listar();

    const dados =
      credenciais.find(
        item => item.usuario === usuario
      );

    if (!dados) {
      return undefined;
    }

    const senhaValida =
      Hash.verificar(
        senha,
        dados.senhaHash,
        dados.salt
      );

    if (!senhaValida) {
      return undefined;
    }

    const sessao =
      new Sessao(
        crypto.randomUUID(),
        usuario,
        dados.papel as PapelUsuario
      );

    this.gerenciadorSessao.criar(
      sessao
    );

    return sessao;
  }

  criarUsuario(
    usuario: string,
    senha: string,
    papel: PapelUsuario,
    usuarioResponsavel: string
  ): void {

    const credenciais =
      this.repositorio.listar();

    if (
      credenciais.some(
        item => item.usuario === usuario
      )
    ) {
      throw new Error(
        "Usuário já cadastrado."
      );
    }

    const salt =
      Hash.gerarSalt();

    const hash =
      Hash.gerar(
        senha,
        salt
      );

    const dados: DadosCredencial = {
      id: crypto.randomUUID(),
      usuario,
      senhaHash: hash,
      salt,
      papel,
      ultimoAcesso: new Date().toISOString()
    };

    this.journal.registrar(
      usuarioResponsavel,
      "CRIAR",
      "CREDENCIAL",
      dados.id,
      `Criação do usuário ${usuario}`
    );

    this.repositorio.salvar(
      [
        ...credenciais,
        dados
      ]
    );
  }

  sincronizarAdministrador(
    usuario: string,
    senhaHash: string,
    salt: string
  ): void {

    const credenciais =
      this.repositorio.listar();

    const administradorExiste =
      credenciais.some(
        item => item.usuario === usuario
      );

    if (administradorExiste) {
      return;
    }

    const dados: DadosCredencial = {
      id: crypto.randomUUID(),
      usuario,
      senhaHash,
      salt,
      papel: PapelUsuario.ADMINISTRADOR,
      ultimoAcesso: new Date().toISOString()
    };

    this.journal.registrar(
      "sistema",
      "CRIAR",
      "CREDENCIAL",
      dados.id,
      `Provisionamento do administrador ${usuario}`
    );

    this.repositorio.salvar(
      [
        ...credenciais,
        dados
      ]
    );
  }

  listarUsuarios(): DadosCredencial[] {
    return this.repositorio.listar();
  }

  validarSessao(
    token: string
  ): Sessao | undefined {

    return this.gerenciadorSessao.buscar(
      token
    );
  }

  encerrarSessao(
    token: string
  ): void {

    this.gerenciadorSessao.encerrar(
      token
    );
  }

  editarUsuario(usuario: string, novaSenha: string | undefined, papel: PapelUsuario | undefined, responsavel: string): void {
    const usuarios = this.repositorio.listar();
    const item = usuarios.find(u => u.usuario === usuario);
    if (!item) throw new Error("Usuário não encontrado.");
    if (item.papel === PapelUsuario.ADMINISTRADOR && papel && papel !== PapelUsuario.ADMINISTRADOR)
      throw new Error("Não é possível remover o perfil de administrador por este comando.");
    if (novaSenha) {
      item.salt = Hash.gerarSalt();
      item.senhaHash = Hash.gerar(novaSenha, item.salt);
    }
    if (papel) item.papel = papel;
    this.journal.registrar(responsavel, "ATUALIZAR", "CREDENCIAL", item.id, `Edição do usuário ${usuario}`);
    this.repositorio.salvar(usuarios);
  }

  excluirUsuario(usuario: string, responsavel: string): void {
    const usuarios = this.repositorio.listar();
    const item = usuarios.find(u => u.usuario === usuario);
    if (!item) throw new Error("Usuário não encontrado.");
    if (item.papel === PapelUsuario.ADMINISTRADOR) throw new Error("Não é permitido excluir o administrador.");
    this.journal.registrar(responsavel, "EXCLUIR", "CREDENCIAL", item.id, `Exclusão do usuário ${usuario}`);
    this.repositorio.salvar(usuarios.filter(u => u.usuario !== usuario));
  }

}