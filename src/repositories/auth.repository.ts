import { prisma } from '../config/prisma';

export const authRepository = {
  buscarPorUsuario(usuario: string) {
    return prisma.usuario.findUnique({ where: { usuario } });
  },
  buscarPorId(id: string) {
    return prisma.usuario.findUnique({ where: { id }, select: { id: true, usuario: true, papel: true, ativo: true } });
  },
  registrarAcesso(id: string) {
    return prisma.usuario.update({ where: { id }, data: { ultimoAcesso: new Date() } });
  },
  criarSessao(usuarioId: string) {
    return prisma.sessao.create({ data: { usuarioId } });
  },
  async purgarSessoesExpiradas() {
    const limiteInatividade = new Date(Date.now() - 30 * 60 * 1000);
    const limiteAbsoluto = new Date(Date.now() - 8 * 60 * 60 * 1000);
    return prisma.sessao.deleteMany({ where: { OR: [{ ultimoUso: { lt: limiteInatividade } }, { criadoEm: { lt: limiteAbsoluto } }] } });
  },
  async validarSessao(id: string, usuarioId: string) {
    const sessao = await prisma.sessao.findFirst({ where: { id, usuarioId } });
    if (!sessao) return false;
    const agora = new Date();
    if (agora.getTime() - sessao.ultimoUso.getTime() > 30 * 60 * 1000) {
      await prisma.sessao.delete({ where: { id } });
      return false;
    }
    await prisma.sessao.update({ where: { id }, data: { ultimoUso: agora } });
    return true;
  },
  encerrarSessao(id: string) {
    return prisma.sessao.deleteMany({ where: { id } });
  },
};
