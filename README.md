# GreenCode — API Express + Prisma + MySQL

API REST da AV2, estruturada em Routes → Controllers → Services → Repositories → Prisma. A pasta `legacy/` mantém o CLI original, mas **o CLI continua usando seus arquivos locais criptografados e não sincroniza automaticamente com o MySQL**.

## Requisitos

- Node.js 20 ou superior e npm.
- MySQL 8.0 ou superior, com um banco vazio chamado `greencode`.
- Windows 10+ ou Linux Ubuntu 24.04+ e derivados.

## Configuração local

1. Copie `.env.example` para `.env`.
2. Ajuste `DATABASE_URL` com o usuário/senha do MySQL e configure `JWT_SECRET` com pelo menos 32 caracteres e `ADMIN_PASSWORD` com pelo menos 10 caracteres.
3. Crie o banco `greencode` no MySQL. Exemplo no MySQL Workbench ou terminal: `CREATE DATABASE greencode CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`.
4. Instale dependências e prepare o banco:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build
npm start
```

Durante desenvolvimento, use `npm run dev`. A API inicia na porta definida por `PORT` (padrão `3000`) e exige conexão com o MySQL antes de aceitar requisições. O `CORS_ORIGIN` aceita uma lista de origens separadas por vírgula. Não versionar nem compartilhar o `.env`.

### Comandos de banco

- `npm run db:generate`: gera Prisma Client para o schema atual.
- `npm run db:migrate`: cria/aplica migrations em desenvolvimento (`prisma migrate dev`).
- `npm run db:deploy`: aplica migrations versionadas sem modo interativo, recomendado para implantação.
- `npm run db:seed`: cria/garante o administrador e massa de demonstração idempotente.
- `npm test`: executa testes automatizados de validação.

> A migration `20261022120000_init_mysql` é inicial e foi preparada para um banco `greencode` novo/vazio. Em uma base existente, confira se ela já está registrada em `_prisma_migrations` antes de executar `npm run db:deploy`. Se as tabelas existem mas a migration inicial não está registrada, interrompa e faça o baseline/reconciliamento da migration antes de continuar. Não use `npm run db:reset` em uma base com dados.

## Massa de dados de demonstração

O seed garante o usuário administrador configurado em `.env`, 2 organizações, 2 contratos, 3 lotes e 5 equipamentos em estados variados. As organizações e equipamentos usam chaves únicas estáveis para evitar duplicações ao executar o seed novamente. Use apenas em desenvolvimento/testes; revise e troque as credenciais iniciais.

## Acesso do Swagger

Para acessar o Swagger, coloque (http://localhost:3000/api-docs/) no navegador ou clique na url após usar o comando `npm run dev` 

## Endpoints principais

Todas as rotas `/api` abaixo de autenticação exigem `Authorization: Bearer <token>`.

- `GET /api/health` — saúde da API, sem autenticação.
- `POST /api/auth/login` — autenticação JWT.
- `POST /api/auth/logout` — encerra a sessão autenticada.
- `/api/usuarios` — CRUD de usuários (gravação/exclusão somente administrador).
- `/api/organizacoes` e `/api/contratos` — CRUD para administrador e operador de cadastro.
- `/api/lotes`, `/api/equipamentos` e `POST /api/movimentacoes` — gravação para administrador e gestor de almoxarifado; auditor tem acesso de leitura aos recursos operacionais, exceto usuários.
- `GET/POST /api/movimentacoes` — histórico e registro de movimentação.
- `GET /api/relatorios/resumo` — contagens e equipamentos por status.
- `GET /api/auditoria` — consulta dos eventos de auditoria, com filtros `acao`, `entidade`, `usuario`, `page` e `limit`.

A especificação OpenAPI está em `openapi.yaml` e pode ser aberta no Swagger Editor ou importada para uma ferramenta compatível.

## Controle de concorrência otimista

Os registros mutáveis possuem `versao` iniciando em `1`. Para fazer `PATCH`, envie a versão lida junto com os campos que deseja alterar, por exemplo:

```json
{
  "versao": 1,
  "razaoSocial": "Nome atualizado"
}
```

Quando a atualização é aceita, a versão é incrementada. Se a versão estiver desatualizada, a API retorna `409 Conflict`; consulte o registro novamente antes de tentar de novo. Para `POST /api/movimentacoes`, envie também `versao` do equipamento. O update do equipamento, a criação da movimentação e a auditoria são feitos na mesma transação.

## Criação transacional de lote com equipamentos

`POST /api/lotes` aceita a propriedade opcional `equipamentos`, como uma lista de equipamentos sem `loteId` (o servidor o define):

```json
{
  "organizacaoId": "ID_DA_ORGANIZACAO",
  "dataEntrada": "2026-10-22T00:00:00.000Z",
  "notaFiscal": "NF-2026-001",
  "transportadora": "TransEco",
  "observacoes": "Lote de exemplo",
  "equipamentos": [
    {
      "codigoBarrasInterno": "GC-EXEMPLO-001",
      "tipo": "NOTEBOOK",
      "marca": "Dell",
      "modelo": "Latitude",
      "anoFabricacao": 2023,
      "estadoFisico": "BOM_ESTADO",
      "dataEntrada": "2026-10-22T00:00:00.000Z",
      "local": "Recebimento",
      "peso": 1.8
    }
  ]
}
```

Se qualquer equipamento falhar, a transação inteira é revertida. O lote pode receber no máximo 500 equipamentos por requisição.

## Segurança e integridade

- Senhas armazenadas com bcrypt; JWT com expiração máxima de 8 horas e expiração por 30 minutos de inatividade, por sessão; sessões expiradas são purgadas na inicialização, no login e a cada 15 minutos; logout invalida a sessão e gera auditoria.
- Usuários, organizações, contratos e lotes usam inativação lógica: `DELETE` marca `ativo=false`, incrementa `versao`, registra auditoria e preserva registros e relacionamentos. Usuários inativados têm todas as sessões revogadas. É possível reativar com `PATCH` enviando `ativo: true` e a versão atual. Equipamentos também podem ser desativados sem apagar seu histórico; equipamentos inativos não aceitam novas movimentações.
- Listagens aceitam `q`, `ativo`, `status`, `page` e `limit`; todas retornam `{ dados, total, pagina, limite, totalPaginas }`, com `limit` padrão 50 e máximo 500.
- Movimentações podem ser consultadas por ID, editadas com controle de versão e excluídas quando forem o evento mais recente do equipamento; edição de status e exclusão sincronizam o status do equipamento em transação. O status do lote é derivado dos equipamentos ativos.
- Autenticação JWT e autorização por papel; o papel atual é consultado no MySQL a cada requisição autenticada, então alterações de perfil têm efeito imediato.
- Auditoria de operações de cadastro/alteração/exclusão e movimentações.
- Restrições de unicidade para usuário, CNPJ e código de barras interno.
- As relações do banco ainda possuem regras de cascata para exclusões físicas internas, mas os endpoints `DELETE` de organização, contrato e usuário não apagam esses registros: fazem inativação lógica. A inativação de organização também inativa contratos, lotes e equipamentos relacionados, mas preserva os registros e movimentações.
- Transações em gravações de entidade + auditoria, criação de lote/equipamentos e movimentações.
- Encerramento gracioso em `SIGINT` e `SIGTERM`.

## Limitações conhecidas

- O CLI legado e a API usam armazenamentos separados; não existe importador automático dos arquivos criptografados para o MySQL. Se precisar preservar esses dados, será necessário exportá-los pelo CLI ou criar um importador específico antes de desligar o armazenamento antigo.
- Os testes automatizados atuais cobrem validações de entrada. Para implantação real, ainda é recomendado executar testes de integração contra um banco MySQL dedicado, incluindo permissões, concorrência e transações.
- Revise a matriz de transições de status com as regras operacionais finais da organização antes de produção.


## Permissões por perfil

- **ADMINISTRADOR:** acesso administrativo completo; somente este perfil pode excluir organizações e contratos ou administrar usuários.
- **OPERADOR_CADASTRO:** pode consultar e cadastrar/editar organizações e contratos, mas não pode excluí-los nem administrar usuários.
- **GESTOR_ALMOXARIFADO:** pode consultar e gerenciar lotes e equipamentos; não pode excluir organizações ou contratos nem administrar usuários.
- **AUDITOR:** acesso de leitura aos recursos operacionais permitidos pelas rotas; não pode cadastrar, editar ou excluir.

O `DELETE` de organização, contrato ou usuário realiza inativação lógica e preserva o histórico. A organização inativa não pode receber novos contratos ou lotes; um contrato inativo ou fora da vigência também impede a criação de lotes. Para voltar a usar um registro, um administrador ou operador com permissão pode reativá-lo via `PATCH` com `ativo: true` e a versão atual. A gestão da lista e dos registros de usuários continua exclusiva do administrador.

O administrador inicial recebe a marca persistida `protegido`. Essa marca impede renomeação, desativação, rebaixamento de perfil e exclusão. Depois de atualizar o projeto, execute `npm run db:deploy`, `npm run db:generate` e `npm run db:seed` para aplicar a nova migração e marcar o administrador configurado em `ADMIN_USER`.


## Inativação lógica e regra de criação de lotes

- `DELETE /api/organizacoes/:id`, `DELETE /api/contratos/:id`, `DELETE /api/lotes/:id` e `DELETE /api/usuarios/:id` fazem inativação lógica; não apagam fisicamente os dados nem os relacionamentos. Organizações e usuários são auditados como `DESATIVAR`; encerramento de contrato usa `ENCERRAR`; arquivamento de lote usa `DESATIVAR`.
- Não é possível inativar o próprio usuário nem o administrador principal protegido. Também não é possível inativar o último administrador ativo. Ao inativar outro usuário, todas as sessões dele são revogadas.
- Para criar ou vincular um lote, a organização precisa estar ativa e possuir contrato ativo cuja `dataInicio` seja menor ou igual à data atual e cuja `dataFim` seja maior ou igual à data atual.
- O filtro `?ativo=false` permite consultar registros inativos. A reativação é feita por `PATCH` com `ativo: true` e `versao` atual.

## Recursos adicionados nesta revisão

- Movimentações: consulta por ID, edição versionada e estorno. Só administradores podem excluir a movimentação mais recente do equipamento; o status anterior é restaurado na mesma transação.
- Sessões: purga sessões expiradas por inatividade (30 minutos) ou idade absoluta (8 horas) no login; logout registra auditoria.
- Paginação: listagens retornam sempre `{ dados, total, pagina, limite, totalPaginas }`; `limit` aceita de 1 a 500 e valores fora da faixa são rejeitados.
- Contratos: `POST /api/contratos/:id/renovar` recebe `{ "versao": 1, "dataFim": "2027-12-31T00:00:00.000Z" }`; `POST /api/contratos/:id/encerrar` recebe `{ "versao": 1 }`. A renovação exige ADMINISTRADOR ou OPERADOR_CADASTRO; o encerramento exige ADMINISTRADOR. Os três caminhos de encerramento usam a ação de auditoria `ENCERRAR`.
- Configuração global: `GET /api/configuracao` (ADMINISTRADOR/AUDITOR) e `PATCH /api/configuracao` (ADMINISTRADOR), com `aliquotaImposto`, `coeficienteDepreciacao` entre 0 e 100 e controle de versão.
- Erros Prisma para unicidade, chave estrangeira, registro ausente e conflito são traduzidos em respostas HTTP específicas.

A paginação é uniforme inclusive quando `page` e `limit` não são enviados: a resposta passa a ser um objeto com metadados e até 50 registros por padrão.

## Correções de segurança e integridade (v4)

- `valorMensal` aceita valores válidos com duas casas decimais sem rejeitar números como `19.99`, `8.2`, `2.3` e `1.15` por imprecisão binária de ponto flutuante.
- O limitador de login possui expiração de 15 minutos, limpeza periódica e limite máximo de chaves em memória. Aplica limite por combinação IP/usuário (5 falhas) e por IP (100 falhas), reduzindo password spraying.
- `TRUST_PROXY=false` é o padrão. Configure `TRUST_PROXY=1` somente quando houver um proxy reverso confiável; também são aceitos saltos numéricos e uma lista de proxies/IPs confiáveis. Não confie indiscriminadamente em cabeçalhos encaminhados.
- `helmet` adiciona cabeçalhos HTTP de segurança.
- Lotes são arquivados logicamente mesmo quando possuem equipamentos; os equipamentos ativos são inativados e todas as movimentações são preservadas.
- O seed sincroniza `protegido` com o usuário configurado em `ADMIN_USER`, removendo a proteção de outro usuário quando necessário.
- Equipamentos enviados dentro da criação de lote não podem ter `ativo: false` nem informar `loteId` próprio.
- `POST` e `PATCH` de equipamento verificam a existência do lote e retornam `404` quando o `loteId` não existe.
- `GET /api/relatorios/resumo` agora inclui `lotesPorStatus`, com todos os estados e quantidade zero para os estados sem registros.
- Erros de unicidade usam rótulos compreensíveis como “CNPJ”, “nome de usuário” e “código de barras interno”, orientando a reativar registros inativos.

Depois de atualizar o código, execute `npm install`, `npm run db:generate`, `npm run db:deploy`, `npm test` e `npm run build`. A migration nova não apaga dados.


## Proxy reverso e segurança de login

`TRUST_PROXY` fica desativado por padrão. Configure-o apenas quando a API estiver atrás de um proxy reverso conhecido que remova/substitua `X-Forwarded-For`. Valores como `1` significam confiar no salto mais próximo e **não devem ser usados com a API exposta diretamente à internet**, pois um cliente poderia forjar o cabeçalho e contornar limites por IP. Prefira o endereço/IP do proxy confiável ou uma topologia em que o proxy sobrescreva os cabeçalhos encaminhados. O login aceita corpo JSON de até 10 KB; as demais rotas usam limite de 1 MB. O limitador usa 5 falhas por combinação IP/usuário e 100 por IP em 15 minutos, preserva bloqueios ativos e limpa os contadores após autenticação válida.

A API expõe `protegido` nas respostas de usuários e no objeto de usuário retornado pelo login, sem expor hashes de senha. O seed sincroniza `protegido=true` com o usuário definido em `ADMIN_USER`, removendo a proteção de outro usuário se necessário. Execute `npm run db:seed` após aplicar migrations.

O comando `npm test` descobre automaticamente todos os arquivos `tests/**/*.test.ts`. `npm run format` formata apenas `src/`, `prisma/` e `tests/`, nunca `legacy/`. A exclusão de movimentações é exclusiva de administradores. A inativação lógica da organização também inativa contratos, lotes e equipamentos associados, preservando movimentações e auditoria.


### Verificação dos cabeçalhos Helmet

Depois de iniciar a API, execute `curl -I http://localhost:3000/api/health` (ou consulte a rota no navegador/Insomnia). A resposta deve incluir, entre outros, `X-Content-Type-Options: nosniff`, `X-Frame-Options` e `Content-Security-Policy`. A política efetiva pode variar conforme a configuração e deve ser validada no ambiente de implantação atrás do proxy real.


## Regras de negócio atualizadas (v5)

- `DELETE /api/organizacoes/:id` e `PATCH ativo=false` inativam organização, contratos, lotes e equipamentos vinculados; movimentações e auditoria são preservadas. Reativar a organização não reativa automaticamente dependentes, permitindo revisar cada registro.
- `DELETE /api/lotes/:id` arquiva o lote e inativa seus equipamentos, sem excluir movimentações. O campo `ativo` pode ser filtrado em `/api/lotes?ativo=false`.
- Uma organização pode ter contratos históricos. A criação de lote e a inclusão de equipamento exigem contrato ativo vigente; `dataFim` vale até o fim do dia. Um `PATCH` que apenas reenvia o mesmo `organizacaoId` do lote não repete a validação da vigência.
- As três formas de encerrar contrato (`DELETE`, `PATCH ativo=false` e `POST /api/contratos/:id/encerrar`) exigem administrador e registram a ação `ENCERRAR`. Para renovar, o contrato deve estar ativo e a data deve ser ISO estrita.
- A unicidade de CNPJ, nome de usuário e código de barras continua reservada mesmo após inativação; reative o registro existente em vez de cadastrar outro.
- Somente administradores podem estornar movimentações. A edição registra status anterior e novo status e não permite editar movimentações de equipamentos inativos.
- `protegido` é exposto na listagem/detalhe de usuários e no retorno do login. O seed sincroniza o usuário protegido com `ADMIN_USER`.
