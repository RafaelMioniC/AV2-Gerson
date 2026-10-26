import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PapelUsuario } from '@prisma/client';
import { authRepository } from '../repositories/auth.repository';

function obterSegredo(): string {
  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  return segredo;
}

export async function autenticar(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ erro: 'Token de autenticação ausente.' });

  let payload: jwt.JwtPayload;
  try {
    const decodificado = jwt.verify(token, obterSegredo());
    if (typeof decodificado === 'string' || typeof decodificado.id !== 'string' || typeof decodificado.sid !== 'string') {
      return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
    payload = decodificado;
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith('JWT_SECRET')) {
      return res.status(500).json({ erro: 'Configuração de autenticação inválida no servidor.' });
    }
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }

  try {
    // Revalida o usuário no banco para que exclusões e mudanças de papel tenham efeito imediato.
    const registro = await authRepository.buscarPorId(payload.id as string);
    if (!registro) return res.status(401).json({ erro: 'Usuário não encontrado.' });
    if (!registro.ativo) return res.status(401).json({ erro: 'Usuário desativado.' });
    const sessaoValida = await authRepository.validarSessao(payload.sid as string, registro.id);
    if (!sessaoValida) return res.status(401).json({ erro: 'Sessão expirada por inatividade. Faça login novamente.' });
    req.usuario = { id: registro.id, usuario: registro.usuario, papel: registro.papel, sessaoId: payload.sid as string };
    return next();
  } catch (erro) {
    return next(erro);
  }
}

export function permitir(...papeis: PapelUsuario[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Você não tem permissão para esta operação.' });
    }
    return next();
  };
}
