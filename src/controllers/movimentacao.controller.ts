import type { Request, Response } from 'express';
import { movimentacaoService } from '../services/movimentacao.service';

function obterId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || !id.trim()) throw Object.assign(new Error('Identificador inválido.'), { status: 400 });
  return id;
}

export const movimentacaoController = {
  listar: async (req: Request, res: Response) => res.json(await movimentacaoService.listar(req.query as Record<string, unknown>)),
  buscar: async (req: Request, res: Response) => res.json(await movimentacaoService.buscarPorId(obterId(req))),
  criar: async (req: Request, res: Response) => res.status(201).json(await movimentacaoService.criar(req.body, req.usuario!)),
  atualizar: async (req: Request, res: Response) => res.json(await movimentacaoService.atualizar(obterId(req), req.body, req.usuario!)),
  excluir: async (req: Request, res: Response) => {
    const versao = Number(req.query.versao);
    return res.json(await movimentacaoService.excluir(obterId(req), versao, req.usuario!));
  },
};
