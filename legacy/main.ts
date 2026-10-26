import readline from "readline";
import { ConfiguracaoMestre } from "./config/Mestre";
import { JournalTransacao } from "./audit/jornalTransacao";
import { GerenciadorSessao } from "./security/GerenciadorSessao";
import { RepositorioCredencial } from "./repositories/RepositorioCredencial";
import { RepositorioEquipamento } from "./repositories/RepositorioEquipamento";
import { RepositorioLote } from "./repositories/RepositorioLote";
import { RepositorioMovimentacao } from "./repositories/RepositorioMovimentacao";
import { RepositorioOrganizacao } from "./repositories/RepositorioOrganizacao";
import { RepositorioContrato } from "./repositories/RepositorioContrato";
import { RepositorioConfiguracao } from "./repositories/RepositorioConfiguracao";
import { ServicoAutenticacao } from "./service/ServicoAutenticar";
import { ServicoEquipamento } from "./service/ServicoEquipamento";
import { ServicoLote } from "./service/ServicoLote";
import { ServicoMovimentacao } from "./service/ServicoMovimentacao";
import { ServicoOrganizacao } from "./service/ServicoOrganizacao";
import { ServicoRelatorio } from "./service/ServicoRelatorio";
import { ServicoContrato } from "./service/ServicoContrato";
import { ServicoConfiguracao } from "./service/ServicoConfiguracao";
import { CLI } from "./cli/Cli";

async function perguntar(pergunta: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(pergunta, res => { rl.close(); resolve(res.trim()); }));
}

async function perguntarSenha(pergunta: string): Promise<string> {
  return new Promise(resolve => {
    const stdin = process.stdin; const stdout = process.stdout; let senha = ""; stdout.write(pergunta);
    const raw = stdin.isTTY; if (raw) stdin.setRawMode(true); stdin.resume();
    const receber = (dados: Buffer) => {
      for (const caractere of dados.toString()) {
        if (caractere === "\u0003") { if (raw) stdin.setRawMode(false); stdin.pause(); process.exit(0); }
        if (caractere === "\r" || caractere === "\n") { if (raw) stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", receber); stdout.write("\n"); resolve(senha); return; }
        if (caractere === "\u007f") { senha = senha.slice(0, -1); continue; } senha += caractere;
      }
    };
    stdin.on("data", receber);
  });
}

async function provisionar(config: ConfiguracaoMestre): Promise<void> {
  console.log("\n=================================\n     GREENCODE - PROVISIONAMENTO\n=================================\n");
  let usuario = ""; while (!usuario) { usuario = await perguntar("Usuário administrador: "); if (!usuario) console.log("O usuário é obrigatório."); }
  let senha = ""; while (!senha) { senha = await perguntarSenha("Senha: "); if (!senha) console.log("A senha é obrigatória."); }
  const confirmacao = await perguntarSenha("Confirme a senha: "); if (senha !== confirmacao) throw new Error("As senhas não coincidem.");
  config.provisionar(usuario, senha); console.log("\n[OK] Configuração inicial criada.");
}

async function autenticar(servico: ServicoAutenticacao) {
  console.log("\n==============================\n          LOGIN\n==============================");
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const usuario = await perguntar("Usuário: "); const senha = await perguntarSenha("Senha: "); const sessao = servico.autenticar(usuario, senha);
    if (sessao) { console.log("\n[OK] Login realizado."); return sessao; }
    console.log("\n[ERRO] Usuário ou senha inválidos.");
  }
  throw new Error("Número máximo de tentativas excedido.");
}

async function main(): Promise<void> {
  const configuracao = new ConfiguracaoMestre();
  if (!configuracao.existe()) await provisionar(configuracao);
  const senhaMestre = await perguntarSenha("Senha do administrador para desbloquear os dados: ");
  const chaveMestre = configuracao.obterChaveMestre(senhaMestre);
  const journal = new JournalTransacao(chaveMestre);
  const gerenciadorSessao = new GerenciadorSessao();
  const repositorioCredencial = new RepositorioCredencial(chaveMestre);
  const repositorioEquipamento = new RepositorioEquipamento(chaveMestre);
  const repositorioLote = new RepositorioLote(chaveMestre);
  const repositorioMovimentacao = new RepositorioMovimentacao(chaveMestre);
  const repositorioOrganizacao = new RepositorioOrganizacao(chaveMestre);
  const repositorioContrato = new RepositorioContrato(chaveMestre);
  const repositorioConfiguracao = new RepositorioConfiguracao(chaveMestre);
  const servicoAutenticacao = new ServicoAutenticacao(repositorioCredencial, journal, gerenciadorSessao);
  const administrador = configuracao.obterAdministrador(senhaMestre);
  servicoAutenticacao.sincronizarAdministrador(administrador.usuario, administrador.senhaHash, administrador.salt);
  const servicoOrganizacao = new ServicoOrganizacao(repositorioOrganizacao, journal);
  const servicoLote = new ServicoLote(repositorioLote, journal);
  const servicoEquipamento = new ServicoEquipamento(repositorioEquipamento, repositorioLote, journal);
  const servicoMovimentacao = new ServicoMovimentacao(repositorioMovimentacao, repositorioEquipamento, journal);
  const servicoContrato = new ServicoContrato(repositorioContrato, repositorioOrganizacao, journal);
  const servicoConfiguracao = new ServicoConfiguracao(repositorioConfiguracao, journal);
  const servicoRelatorio = new ServicoRelatorio(servicoOrganizacao, servicoLote, servicoEquipamento, servicoMovimentacao);
  const sessao = await autenticar(servicoAutenticacao);
  new CLI(sessao, servicoAutenticacao, servicoOrganizacao, servicoLote, servicoEquipamento, servicoMovimentacao, servicoRelatorio, servicoContrato, servicoConfiguracao, chaveMestre).iniciar();
}

main().catch(erro => { const mensagem = erro instanceof Error ? erro.message : "Erro inesperado."; console.error(`\n[ERRO] ${mensagem}`); process.exit(1); });
