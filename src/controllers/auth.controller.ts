import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { authRepository } from '../repositories/auth.repository';
import { auditoriaRepository } from '../repositories/auditoria.repository';

import {
  consultarBloqueioLogin,
  limparTentativasLogin,
  registrarFalhaLogin,
} from '../services/login-rate-limiter';

function normalizarUsuario(usuario: unknown): string {
  return typeof usuario === 'string' ? Array.from(usuario.trim().toLocaleLowerCase('pt-BR')).slice(0, 80).join('') : 'usuario-invalido';
}

export const authController = {
  async login(req: Request, res: Response) {
    const ip = req.ip || req.socket.remoteAddress || 'origem-desconhecida';
    const usuario = normalizarUsuario(req.body?.usuario);
    const segundos = consultarBloqueioLogin(ip, usuario);
    if (segundos > 0) {
      return res.status(429).json({
        erro: `Muitas tentativas de login para este usuário ou endereço IP. Tente novamente em ${segundos} segundos.`,
      });
    }

    try {
      const resultado = await authService.login(
        req.body?.usuario,
        req.body?.senha,
      );

      // Uma autenticação válida limpa o contador específico da combinação IP/usuário.
      limparTentativasLogin(ip, usuario);

      return res.json(resultado);
    } catch (erro: unknown) {
      const erroLogin = erro as { status?: number; };

      if (erroLogin.status === 401) {
        registrarFalhaLogin(ip, usuario);
      }

      throw erro;
    }
  },

  async logout(req: Request, res: Response) {
    const sessaoId = req.usuario?.sessaoId;

    if (sessaoId) {
      await authRepository.encerrarSessao(sessaoId);
      await auditoriaRepository.registrar(req.usuario!.usuario, 'LOGOUT', 'AUTENTICACAO', req.usuario!.id, `Sessão ${sessaoId} encerrada.`);
    }

    return res.json({ mensagem: 'Sessão encerrada.' });
  },
};
