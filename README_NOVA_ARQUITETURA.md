# GreenCode — arquitetura da API

O sistema foi organizado em camadas para separar responsabilidades:

- `src/routes/`: rotas HTTP e permissões por papel.
- `src/controllers/`: adaptação entre requisições e respostas.
- `src/services/`: regras de negócio e transações.
- `src/repositories/`: acesso ao banco via Prisma.
- `src/validators/`: validação de dados recebidos pela API.
- `src/middlewares/`: autenticação, autorização e tratamento centralizado de erros.
- `prisma/schema.prisma`: modelo MySQL e relacionamentos.
- `prisma/migrations/`: migração inicial MySQL.
- `prisma/seed.ts`: administrador e dados de demonstração.
- `openapi.yaml`: contrato documentado da API.
- `tests/`: testes automatizados de validação e transições de status.
- `legacy/`: CLI antigo mantido isolado, com armazenamento local separado.

## Banco

A configuração é feita por `DATABASE_URL` usando o protocolo `mysql://`. A migração incluída é destinada a um banco MySQL novo e vazio; não a aplique sobre tabelas preexistentes sem um plano explícito de migração de dados.

## Regras de consistência

- Atualizações parciais exigem `versao` e fazem incremento atômico da versão.
- Movimentações validam a transição de status e registram equipamento, histórico e auditoria na mesma transação.
- Criação de lote pode incluir equipamentos e é atômica.
- Unicidade e integridade referencial são reforçadas pelo MySQL.
- Senhas são armazenadas com bcrypt e respostas de usuário não incluem hash.
