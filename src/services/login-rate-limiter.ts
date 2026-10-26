/** Limitador em memória com TTL. Chaves bloqueadas nunca são descartadas antes da expiração. */
export type RegistroTentativa = { falhas: number; atualizadoEm: number; bloqueadoAte: number };
const TTL_MS = 15 * 60 * 1000;
const MAX_CHAVES = 10_000;
const MAX_FALHAS_USUARIO_IP = 5;
// Limite alto para reduzir falsos positivos em NATs corporativos; o limite por usuário/IP continua estrito.
const MAX_FALHAS_IP = 100;
const usuarioPorIp = new Map<string, RegistroTentativa>();
const porIp = new Map<string, RegistroTentativa>();
let saturadoAte = 0;
function podar(mapa: Map<string, RegistroTentativa>, agora: number): void {
  for (const [chave, registro] of mapa) {
    if (agora - registro.atualizadoEm >= TTL_MS && registro.bloqueadoAte <= agora) mapa.delete(chave);
  }
}
function registrar(mapa: Map<string, RegistroTentativa>, chave: string, limite: number, agora: number): RegistroTentativa | undefined {
  podar(mapa, agora);
  const anterior = mapa.get(chave);
  const registro = anterior && agora - anterior.atualizadoEm < TTL_MS
    ? anterior : { falhas: 0, atualizadoEm: agora, bloqueadoAte: 0 };
  registro.falhas += 1;
  registro.atualizadoEm = agora;
  if (registro.falhas >= limite) registro.bloqueadoAte = agora + TTL_MS;
  if (!anterior && mapa.size >= MAX_CHAVES) {
    // Não expulsa bloqueios ativos. Se todos os slots estão ocupados, falha fechado temporariamente.
    const expiracaoMaisProxima = [...mapa.values()].reduce((menor, item) => Math.min(menor, item.bloqueadoAte || item.atualizadoEm + TTL_MS), agora + TTL_MS);
    saturadoAte = Math.max(saturadoAte, expiracaoMaisProxima, agora + 60_000);
    return undefined;
  }
  mapa.delete(chave); mapa.set(chave, registro);
  return registro;
}
export function consultarBloqueioLogin(ip: string, usuario: string, agora = Date.now()) {
  podar(usuarioPorIp, agora); podar(porIp, agora);
  if (agora < saturadoAte && (usuarioPorIp.size >= MAX_CHAVES || porIp.size >= MAX_CHAVES)) return Math.ceil((saturadoAte - agora) / 1000);
  const individual = usuarioPorIp.get(`${ip}:${usuario}`);
  const global = porIp.get(ip);
  const bloqueadoAte = Math.max(individual?.bloqueadoAte ?? 0, global?.bloqueadoAte ?? 0);
  return bloqueadoAte > agora ? Math.ceil((bloqueadoAte - agora) / 1000) : 0;
}
export function registrarFalhaLogin(ip: string, usuario: string, agora = Date.now()) {
  registrar(usuarioPorIp, `${ip}:${usuario}`, MAX_FALHAS_USUARIO_IP, agora);
  registrar(porIp, ip, MAX_FALHAS_IP, agora);
}
export function limparTentativasLogin(ip: string, usuario: string) {
  usuarioPorIp.delete(`${ip}:${usuario}`);
  // Uma autenticação válida comprova que o IP não está necessariamente sob spraying; zera o contador de IP.
  porIp.delete(ip);
}
export function estadoLimitadorLogin() { return { chavesUsuarioIp: usuarioPorIp.size, chavesIp: porIp.size, maxChaves: MAX_CHAVES }; }
const limpeza = setInterval(() => { const agora = Date.now(); podar(usuarioPorIp, agora); podar(porIp, agora); if (agora >= saturadoAte) saturadoAte = 0; }, 60_000);
limpeza.unref();
