
import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseTrustProxy } from './config/trust-proxy';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './config/prisma';

import authRoutes from './routes/auth.routes';
import entidadeRoutes from './routes/entidade.routes';
import movimentacaoRoutes from './routes/movimentacao.routes';
import relatorioRoutes from './routes/relatorio.routes';
import auditoriaRoutes from './routes/auditoria.routes';
import configuracaoRoutes from './routes/configuracao.routes';
import contratoAcoesRoutes from './routes/contrato-acoes.routes';

import { autenticar } from './middlewares/auth.middleware';
import {
  rotaNaoEncontrada,
  tratarErro,
} from './middlewares/error.middleware';

export const app = express();

const caminhoOpenApi = resolve(process.cwd(), 'openapi.yaml');

const documentoOpenApi = YAML.parse(
  readFileSync(caminhoOpenApi, 'utf8')
);

const origens = (
  process.env.CORS_ORIGIN ||
  'http://localhost:3000,http://localhost:5173,http://localhost:3001'
)
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

app.use(helmet());
app.use(cors({ origin: origens, credentials: true }));

// Documentação interativa da API
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(documentoOpenApi)
);

// Processamento do corpo das requisições
app.use('/api/auth/login', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '1mb' }));

// Verificação da API e da conexão com o MySQL
app.get('/api/health', async (_req, res, _next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      status: 'ok',
      banco: 'conectado',
      sistema: 'GreenCode API',
    });
  } catch {
    return res.status(503).json({
      status: 'indisponivel',
      banco: 'desconectado',
      sistema: 'GreenCode API',
    });
  }
});

// Rotas públicas de autenticação
app.use('/api/auth', authRoutes);

// Rotas protegidas específicas
app.use('/api/contratos', autenticar, contratoAcoesRoutes);
app.use('/api/configuracao', autenticar, configuracaoRoutes);

// Autenticação das demais rotas da API
app.use('/api', autenticar);

// Rotas de negócio
app.use('/api', entidadeRoutes);
app.use('/api/movimentacoes', movimentacaoRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// Tratamento de rotas inexistentes e erros
app.use(rotaNaoEncontrada);
app.use(tratarErro);
