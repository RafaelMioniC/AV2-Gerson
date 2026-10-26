import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRepository } from '../repositories/auth.repository';
import { auditoriaRepository } from '../repositories/auditoria.repository';

const hashFalso = bcrypt.hash('senha-falsa-para-equalizar-tempo', 12);

function obterSegredo(): string {
  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.length < 32) throw Object.assign(new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.'), { status: 500 });
  return segredo;
}
export const authService = {
  async login(usuario: unknown, senha: unknown) {
    if (typeof usuario !== 'string' || typeof senha !== 'string') {
      throw Object.assign(new Error('Informe usuário e senha.'), { status: 400 });
    }
    const segredo = obterSegredo();
    await authRepository.purgarSessoesExpiradas();
    const registro = await authRepository.buscarPorUsuario(usuario);
    const senhaValida = registro
      ? await bcrypt.compare(senha, registro.senhaHash)
      : await bcrypt.compare(senha, await hashFalso);

    if (!registro || !senhaValida) {
      const usuarioAuditado =
        typeof usuario === 'string'
          ? usuario.trim().slice(0, 191) || 'desconhecido'
          : 'desconhecido';

      await auditoriaRepository.registrar(
        usuarioAuditado,
        'LOGIN_FALHA',
        'AUTENTICACAO',
        '-',
        'Tentativa de autenticação inválida.',
      );

      throw Object.assign(new Error('Usuário ou senha inválidos.'), {
        status: 401,
      });
    }
    if (!registro.ativo) {
      await auditoriaRepository.registrar(
        registro.usuario,
        'LOGIN_FALHA',
        'AUTENTICACAO',
        registro.id,
        'Tentativa de autenticação por usuário desativado.',
      );
      throw Object.assign(new Error('Usuário desativado. Procure um administrador.'), { status: 403 });
    }
    await authRepository.registrarAcesso(registro.id);
    const sessao = await authRepository.criarSessao(registro.id);
    await auditoriaRepository.registrar(registro.usuario, 'LOGIN', 'AUTENTICACAO', registro.id, 'Autenticação concluída com sucesso.');
    const token = jwt.sign(
      { id: registro.id, sid: sessao.id, usuario: registro.usuario, papel: registro.papel },
      segredo,
      { expiresIn: '8h' },
    );
    return { token, usuario: { id: registro.id, usuario: registro.usuario, papel: registro.papel, protegido: registro.protegido } };
  },
};
