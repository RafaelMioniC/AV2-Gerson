import { PapelUsuario } from "../enums/PapelUsuario";
export class Menu {
  exibir(papel: PapelUsuario): void {
    console.log("\n==============================\n          GREENCODE\n==============================");
    console.log(`Perfil: ${papel}\n`);
    const menus: Record<PapelUsuario, string[]> = {
      [PapelUsuario.ADMINISTRADOR]: ["organização criar", "organização listar", "organização editar", "organização excluir", "contrato criar", "contrato listar", "contrato editar", "contrato excluir", "contrato renovar", "contrato encerrar", "lote criar", "lote listar", "lote editar", "lote excluir", "equipamento cadastrar", "equipamento listar", "equipamento editar", "equipamento excluir", "equipamento estado", "movimentação registrar", "movimentação listar", "movimentação editar", "movimentação excluir", "usuário criar", "usuário listar", "usuário editar", "usuário excluir", "configuração atualizar", "configuração listar", "relatório"],
      [PapelUsuario.OPERADOR_CADASTRO]: ["organização criar", "organização listar", "organização editar", "contrato criar", "contrato listar", "contrato editar", "contrato renovar", "contrato encerrar"],
      [PapelUsuario.GESTOR_ALMOXARIFADO]: ["lote criar", "lote listar", "lote editar", "lote excluir", "equipamento cadastrar", "equipamento listar", "equipamento editar", "equipamento excluir", "equipamento estado", "movimentação registrar", "movimentação listar", "movimentação editar", "movimentação excluir"],
      [PapelUsuario.AUDITOR]: ["organização listar", "contrato listar", "lote listar", "equipamento listar", "movimentação listar", "configuração listar", "relatório"]
    };
    (menus[papel] ?? []).forEach(item => console.log(item));
    console.log("\nDigite 'menu' para exibir novamente.\nDigite 'sair' para encerrar.\n");
  }
}
