import type { Request, Response, NextFunction } from 'express';


function mensagemUnicidade(err: any): string {
  const alvo = err?.meta?.target;
  const campos = Array.isArray(alvo) ? alvo.map(String) : typeof alvo === 'string' ? [alvo] : [];
  const rotulos: Record<string, string> = {
    cnpj: 'CNPJ', Organizacao_cnpj_key: 'CNPJ', usuario: 'nome de usuário', Usuario_usuario_key: 'nome de usuário', codigoBarrasInterno: 'código de barras interno', Equipamento_codigoBarrasInterno_key: 'código de barras interno', organizacaoId: 'organização do contrato', Contrato_organizacaoId_key: 'organização do contrato',
  };
  const campo = campos.map(item => rotulos[item] ?? item).find(Boolean);
  return campo ? `Já existe um registro com este ${campo}. Se estiver inativo, reative-o em vez de cadastrar outro.` : 'Já existe um registro com valor duplicado em um campo único. Se estiver inativo, reative-o em vez de cadastrar outro.';
}

function mensagemRelacionamento(err: any): string {
  const alvo = Array.isArray(err?.meta?.field_name)
    ? err.meta.field_name.join(', ')
    : String(
      err?.meta?.field_name ??
      err?.meta?.constraint ??
      'registro relacionado',
    );
  const campo = alvo.replace(/`/g, '').replace(/_fkey$/i, '').replace(/_idx$/i, '').replace(/_/g, ' ');
  return (
    `A operação viola o relacionamento (${campo}). ` +
    'Confirme se os identificadores relacionados existem e, em exclusões, se há registros dependentes que precisam ser removidos ou transferidos.'
  );
}

export function tratarErro(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição excede o limite permitido.' });
  }
  const status = err.status ?? (
    err.code === 'P2002' || err.code === 'P2003' || err.code === 'P2034' || err.code === 'VERSION_CONFLICT' ? 409 :
      err.code === 'P2025' ? 404 :
        err.code === 'P2000' ? 400 : err.code === 'P2028' ? 503 : 500
  );
  const mensagem =
    err.code === 'VERSION_CONFLICT' || err.code === 'P2034' ? 'Conflito de concorrência. Atualize os dados e tente novamente.' :
      err.code === 'P2002' ? mensagemUnicidade(err) :
        err.code === 'P2003' ? mensagemRelacionamento(err) :
          err.code === 'P2025' ? 'Registro não encontrado.' :
            err.code === 'P2000' ? 'Um valor ultrapassa o limite permitido pelo banco.' :
              err.code === 'P2028' ? 'A transação excedeu o tempo limite; nenhum dado foi confirmado. Tente novamente.' :
                status === 500 ? 'Erro interno do servidor.' : err.message || 'Erro na requisição.';
  if (status === 500) console.error(err);
  return res.status(status).json({ erro: mensagem });
}

export function rotaNaoEncontrada(_req: Request, res: Response) {
  return res.status(404).json({ erro: 'Rota não encontrada.' });
}

export function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
}
