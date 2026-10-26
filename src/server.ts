import 'dotenv/config';
import { app } from './app';
import { prisma } from './config/prisma';
import { authRepository } from './repositories/auth.repository';

async function iniciar() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser um número entre 1 e 65535.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não foi definida no arquivo .env.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');

  await prisma.$connect();
  await authRepository.purgarSessoesExpiradas();
  const purgaSessoes = setInterval(() => {
    void authRepository.purgarSessoesExpiradas().catch((erro) => console.error('Falha ao purgar sessões expiradas:', erro));
  }, 15 * 60 * 1000);
  purgaSessoes.unref();
  const server = app.listen(port, () => {
    console.log(`GreenCode API rodando em http://localhost:${port}`);
    console.log(`Swagger UI disponível em http://localhost:${port}/api-docs`);
  });
  let encerrando = false;
  async function encerrar(sinal: string) {
    if (encerrando) return;
    encerrando = true;
    console.log(`Sinal ${sinal} recebido. Encerrando servidor...`);
    clearInterval(purgaSessoes);
    server.close(async (erro) => {
      if (erro) console.error('Erro ao fechar o servidor:', erro);
      await prisma.$disconnect();
      process.exitCode = erro ? 1 : 0;
    });
  }
  process.on('SIGINT', () => void encerrar('SIGINT'));
  process.on('SIGTERM', () => void encerrar('SIGTERM'));
}

iniciar().catch(async (erro) => {
  console.error('Não foi possível iniciar a API:', erro instanceof Error ? erro.message : erro);
  await prisma.$disconnect();
  process.exitCode = 1;
});




// EASTER EGG (UM TRECHO DA MELHOR MUSICA BRASILEIRA): Pra que chorar sua mágoa?
// Se afogando em agonia
// Contra tempestade em copo d'água
// Dance o xote da alegria
// Honestamente, foi a unica ideia que me veio a cabeça de por
