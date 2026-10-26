import type { Request, Response } from 'express';
import { configuracaoService } from '../services/configuracao.service';
export const configuracaoController = {
  obter: async (_req: Request, res: Response) => res.json(await configuracaoService.obter()),
  atualizar: async (req: Request, res: Response) => res.json(await configuracaoService.atualizar(req.body, req.usuario!)),
};
