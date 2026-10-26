import type { Request, Response } from 'express';
import { relatorioService } from '../services/relatorio.service';

export const relatorioController = {
  resumo: async (_req: Request, res: Response) => res.json(await relatorioService.resumo()),
};
