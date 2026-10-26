# Correções aplicadas — GreenCode API (MySQL)

## Segurança e sessões

- Adicionado `Usuario.ativo` para desativar funcionários sem apagar seu histórico.
- O login recusa usuários desativados; o middleware também invalida o acesso se o usuário for desativado.
- Sessões passam a ter identificador próprio, validade por inatividade de 30 minutos e validade máxima do JWT de 8 horas.
- Adicionado `POST /api/auth/logout` para invalidar a sessão atual.
- Bloqueio temporário após 5 falhas de login por IP dentro de uma janela de 15 minutos (limite em memória do processo).
- Impedida a exclusão do administrador principal e do último administrador ativo; desativação/rebaixamento do último administrador é bloqueada em transação serializável.
- `GET /api/usuarios` e detalhes de usuários ficam restritos ao administrador.
- Permissões de escrita separadas por domínio: operador para organizações/contratos; gestor para lotes/equipamentos/movimentações; auditor com leitura, exceto usuários.

## Regras de domínio e integridade

- Lote só pode ser criado com `dataEntrada` entre hoje e os últimos 90 dias.
- Datas precisam ser strings ISO válidas; valores numéricos como `5` e datas de calendário impossíveis são rejeitados.
- `dataFim` de contrato deve ser estritamente posterior a `dataInicio`.
- Queda de duas ou mais categorias no estado físico exige justificativa.
- `observacoes` e `inscricaoEstadual` vazias são aceitas na criação, como previsto pelo validador.
- O e-mail é limitado a 191 caracteres, de acordo com a coluna MySQL.
- `valorMensal` foi alterado de `Float` para `Decimal(12,2)`.
- Equipamentos com histórico não são apagados fisicamente: `DELETE /api/equipamentos/:id` os desativa e mantém suas movimentações; equipamento inativo não pode receber novas movimentações.
- `StatusLote` deixa de ser editável pela API e é recalculado com base nos estados dos equipamentos.
- Não é possível criar ou vincular contrato/lote a organização inativa; organização inexistente retorna 404.
- Criação de lote usa `createMany` para equipamentos e transação com timeout de 15 segundos; `P2028` tem resposta específica.
- Mensagens de FK incluem o relacionamento indicado pelo Prisma.
- GET de lote inclui equipamentos.

## Listagens, auditoria e relatórios

- Listagens de organizações, contratos, lotes, equipamentos, usuários e movimentações retornam sempre objeto de paginação (`dados`, `total`, `pagina`, `limite`, `totalPaginas`); `limit` aceita de 1 a 500.
- Auditoria aceita filtros `acao`, `entidade`, `usuario`, `page` e `limit`.
- Auditoria de alterações inclui campos modificados sem registrar senha/hash; login bem-sucedido e falhas de credenciais são auditados.
- Nome de entidade de auditoria de movimentação padronizado para `movimentacoes`.
- Relatório retorna todos os status de equipamento, inclusive os que tenham contagem zero, e considera apenas equipamentos ativos.
- Seed cria histórico de movimentação para equipamentos de demonstração que já começam em status avançados.

## Movimentações

As movimentações possuem consulta por ID, edição versionada e exclusão versionada. A edição pode alterar a justificativa e, somente quando for o evento mais recente, o status de destino; nesse caso o status do equipamento também é atualizado na mesma transação. A exclusão só é permitida para o evento mais recente, restaura o status anterior e registra auditoria.

## Migração e validação

- Nova migration: `20261023190000_usuario_ativo_sessao_decimal`.
- Regere o Prisma Client e aplique a migration com os comandos descritos no README. Não use `db:reset` em uma base que contenha dados.
- A sintaxe TypeScript e o YAML OpenAPI foram verificados, assim como testes direcionados às regras de validação/status. Não foi possível concluir `npm run build` nem a suíte completa porque a instalação de dependências (`npm ci`) excedeu o tempo limite neste ambiente; rode esses comandos localmente antes de usar a versão em produção.


## Refatoração complementar — 24/10/2026

- Corrigida a tipagem dos dados enviados ao `equipamento.createMany`, explicitando `Prisma.EquipamentoCreateManyInput`.
- Adicionado `Usuario.protegido` para proteger o administrador principal independentemente do nome de usuário.
- Exclusão de organização agora remove, em uma transação, contrato, lotes, equipamentos e movimentações associadas; os registros de auditoria são preservados.
- Exclusão de organizações e contratos restrita ao perfil `ADMINISTRADOR`; lotes e equipamentos restritos a `ADMINISTRADOR` e `GESTOR_ALMOXARIFADO`; usuários restritos a `ADMINISTRADOR`.
- Separadas as permissões de exclusão das permissões de gravação nas rotas.
- Limitador de login passou a ser individual por combinação de IP e usuário; autenticação válida não limpa contadores de outras contas.
- Adicionada comparação bcrypt fictícia quando o usuário não existe, reduzindo diferenças de tempo de resposta.
- Justificativas de mudança do estado físico passam a constar na auditoria.
- Mudanças de senha revogam as sessões existentes do usuário.
- Recálculo do status do lote considera somente equipamentos ativos e só incrementa a versão quando o status derivado muda.
- Ajustadas validações de janela de 90 dias em atualização de lote, limite monetário e casas decimais, ano de fabricação e tamanho de senha compatível com bcrypt.
- Relatórios agora são acessíveis somente por `ADMINISTRADOR` e `AUDITOR`.
- Arquivos TypeScript formatados e adicionado `npm run format` para repetir a formatação.


## Correções complementares — 24/10/2026

- Adicionadas rotas `GET /api/movimentacoes/:id`, `PATCH /api/movimentacoes/:id` e `DELETE /api/movimentacoes/:id`, com controle de versão e preservação da consistência do equipamento.
- Erros Prisma de unicidade, relacionamentos, registro ausente e conflito recebem respostas HTTP específicas.
- Removido o nível `Serializable` aplicado indiscriminadamente a todos os `PATCH` e `DELETE`; as operações mantêm transações e usam controle otimista por versão onde necessário.
- Sessões expiradas são purgadas ao iniciar o servidor, no login e a cada 15 minutos; logout gera auditoria.
- Paginação uniformizada em todas as listagens, com limite validado de 1 a 500 (padrão 50).
- Atualizados `openapi.yaml`, `greencode-testes-api.http`, `thunder-client-collection.json` e variáveis de ambiente do Thunder Client.
- Adicionadas rotas de renovação e encerramento de contrato e CRUD de leitura/atualização da configuração global de alíquota e depreciação.
- Adicionada migration para a tabela `Configuracao` e seed inicial de seus valores.


## Correções adicionais — soft delete e lotes com contrato vigente

- `DELETE` de organizações, contratos e usuários agora realiza inativação lógica (`ativo=false`) em vez de exclusão física.
- A inativação incrementa a versão, registra auditoria como `DESATIVAR` e preserva os relacionamentos e o histórico.
- Inativar um usuário revoga suas sessões; não é permitido inativar o próprio usuário, o administrador protegido ou o último administrador ativo.
- A criação de lote exige organização ativa e contrato ativo dentro da vigência. A mesma validação é aplicada ao alterar a organização de um lote.
- Alterações `ativo=false/true` via `PATCH` agora são auditadas como `DESATIVAR`/`REATIVAR` para todos os recursos compatíveis.
- OpenAPI e README atualizados para documentar o comportamento.


## v4 — correções de validação, segurança e histórico
- Corrigida a validação de centavos de `valorMensal` para tolerar imprecisão de ponto flutuante.
- Limitador de login com TTL, limpeza periódica, limite de memória e limite agregado por IP contra password spraying.
- Configuração explícita de `trust proxy` e middleware `helmet`.
- Exclusão de lote bloqueada quando houver qualquer equipamento vinculado, ativo ou inativo.
- Migration independente para proteger o administrador mais antigo já existente.
- Testes de valores decimais, equipamentos aninhados e limitador de login.
- Verificação de `loteId` existente, campo `lotesPorStatus` no relatório e mensagens de índice único.


## v5 — correções de entrega, segurança e integridade

- Corrigidas as chamadas inválidas a `erro()` no validador e alinhada a expectativa do teste de `loteId` aninhado.
- Limitado o JSON do login a 10 KB; normalização do usuário cria uma string independente. Limitador mantém bloqueios ativos, limpa contadores após login válido, aplica 5 falhas por IP/usuário e 100 por IP, e falha fechado ao atingir a capacidade.
- `TRUST_PROXY` agora valida número de saltos ou lista de IP/CIDR; a documentação alerta contra confiar em `X-Forwarded-For` quando a API está exposta diretamente.
- Adicionado `ativo` a Lote e migration para permitir arquivamento lógico. Organizações inativam contratos/lotes/equipamentos dependentes; histórico permanece.
- Contratos agora podem ser históricos por organização; data final inclusiva, renovação com ISO estrito, encerramento com permissão/auditoria unificadas.
- Mensagens de unicidade usam rótulos de campos e orientam reativar registros inativos; valores de configuração aceitam no máximo duas casas decimais e a auditoria registra antes/depois.
- Auditoria padroniza nomes de entidade em maiúsculas; relatório mantém `lotesPorStatus`; teste automático descobre todos os arquivos `*.test.ts`; formatação ignora `legacy/`.
- Atualizados OpenAPI, coleção Thunder Client e arquivo `.http`.
