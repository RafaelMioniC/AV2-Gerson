import type { PapelUsuario } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        usuario: string;
        papel: PapelUsuario;
        sessaoId: string;
      };
    }
  }
}

export { };
