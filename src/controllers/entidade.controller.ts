import type { Request, Response } from 'express';
import { entidadeService } from '../services/entidade.service';

function idDaRota(req: Request) {
  const id = req.params.id;
  if (typeof id !== 'string' || !id.trim()) throw Object.assign(new Error('Identificador inválido.'), { status: 400 });
  return id;
}

export function criarEntidadeController(nome: string) {
  return {
    listar: async (req: Request, res: Response) => res.json(await entidadeService.listar(nome, req.query as Record<string, unknown>)),
    buscar: async (req: Request, res: Response) => res.json(await entidadeService.buscar(nome, idDaRota(req))),
    criar: async (req: Request, res: Response) => res.status(201).json(await entidadeService.criar(nome, req.body, req.usuario!)),
    atualizar: async (req: Request, res: Response) =>
      res.json(
        await entidadeService.atualizar(
          nome,
          idDaRota(req),
          req.body,
          req.usuario!,
        ),
      ),
    excluir: async (req: Request, res: Response) => res.json(await entidadeService.excluir(nome, idDaRota(req), req.usuario!)),
  };
}
