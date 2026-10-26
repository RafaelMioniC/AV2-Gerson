import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { auditoriaRepository } from '../repositories/auditoria.repository';

export const auditoriaController = {
  listar: async (req: ExpressRequest, res: ExpressResponse) => {
    const filtros = req.query as Record<string, unknown>;
    if (filtros.page !== undefined && (!Number.isInteger(Number(filtros.page)) || Number(filtros.page) < 1)) {
      return res.status(400).json({ erro: 'page deve ser um inteiro maior que zero.' });
    }
    if (filtros.limit !== undefined && (!Number.isInteger(Number(filtros.limit)) || Number(filtros.limit) < 1 || Number(filtros.limit) > 500)) {
      return res.status(400).json({ erro: 'limit deve ser um inteiro entre 1 e 500.' });
    }
    return res.json(await auditoriaRepository.listar(filtros));
  },
};
