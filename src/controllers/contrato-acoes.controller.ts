import type { Request, Response } from 'express';
import { contratoAcoesService } from '../services/contrato-acoes.service';
function idDaRota(req: Request) { const id = req.params.id; if (typeof id !== 'string' || !id.trim()) throw Object.assign(new Error('Identificador inválido.'), { status: 400 }); return id; }
export const contratoAcoesController = {
  renovar: async (req: Request, res: Response) => res.json(await contratoAcoesService.renovar(idDaRota(req), req.body, req.usuario!)),
  encerrar: async (req: Request, res: Response) => res.json(await contratoAcoesService.encerrar(idDaRota(req), req.body, req.usuario!)),
};
