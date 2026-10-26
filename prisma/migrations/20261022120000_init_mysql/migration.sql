CREATE TABLE `Usuario` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `usuario` VARCHAR(191) NOT NULL,
  `senhaHash` VARCHAR(191) NOT NULL,
  `papel` ENUM('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR') NOT NULL DEFAULT 'OPERADOR_CADASTRO',
  `ultimoAcesso` DATETIME(3) NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Usuario_usuario_key` (`usuario`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Organizacao` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `razaoSocial` VARCHAR(191) NOT NULL,
  `cnpj` VARCHAR(191) NOT NULL,
  `inscricaoEstadual` VARCHAR(191) NOT NULL,
  `enderecoCompleto` TEXT NOT NULL,
  `telefone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `dataCadastro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `Organizacao_cnpj_key` (`cnpj`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Contrato` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `organizacaoId` VARCHAR(191) NOT NULL,
  `dataInicio` DATETIME(3) NOT NULL,
  `dataFim` DATETIME(3) NOT NULL,
  `descricao` TEXT NOT NULL,
  `valorMensal` DOUBLE NOT NULL,
  `coletaAutomatica` BOOLEAN NOT NULL DEFAULT false,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `Contrato_organizacaoId_key` (`organizacaoId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Lote` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `dataEntrada` DATETIME(3) NOT NULL,
  `organizacaoId` VARCHAR(191) NOT NULL,
  `notaFiscal` VARCHAR(191) NOT NULL,
  `transportadora` VARCHAR(191) NOT NULL,
  `status` ENUM('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO') NOT NULL DEFAULT 'RECEBIDO',
  `observacoes` TEXT NOT NULL,
  INDEX `Lote_organizacaoId_idx` (`organizacaoId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Equipamento` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `loteId` VARCHAR(191) NOT NULL,
  `codigoBarrasInterno` VARCHAR(191) NOT NULL,
  `tipo` ENUM('COMPUTADOR_MESA', 'NOTEBOOK', 'MONITOR', 'IMPRESSORA', 'SERVIDOR', 'SCANNER', 'BATERIA', 'CAIXA_ESTABILIZADOR', 'FONTE_ALIMENTACAO') NOT NULL,
  `marca` VARCHAR(191) NOT NULL,
  `modelo` VARCHAR(191) NOT NULL,
  `anoFabricacao` INTEGER NOT NULL,
  `estadoFisico` ENUM('NOVO', 'BOM_ESTADO', 'USADO_LEVE', 'USADO_MODERADO', 'DANIFICADO_LEVE', 'DANIFICADO_GRAVE', 'IRRECUPERAVEL') NOT NULL,
  `dataEntrada` DATETIME(3) NOT NULL,
  `local` VARCHAR(191) NOT NULL,
  `peso` DOUBLE NOT NULL,
  `status` ENUM('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'DESMONTE', 'RECICLAGEM', 'DESCARTE') NOT NULL DEFAULT 'RECEBIDO',
  UNIQUE INDEX `Equipamento_codigoBarrasInterno_key` (`codigoBarrasInterno`),
  INDEX `Equipamento_loteId_idx` (`loteId`),
  INDEX `Equipamento_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Movimentacao` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `equipamentoId` VARCHAR(191) NOT NULL,
  `statusAnterior` ENUM('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'DESMONTE', 'RECICLAGEM', 'DESCARTE') NOT NULL,
  `novoStatus` ENUM('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'DESMONTE', 'RECICLAGEM', 'DESCARTE') NOT NULL,
  `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usuarioId` VARCHAR(191) NOT NULL,
  `justificativa` TEXT NOT NULL,
  INDEX `Movimentacao_equipamentoId_data_idx` (`equipamentoId`, `data`),
  INDEX `Movimentacao_usuarioId_idx` (`usuarioId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Auditoria` (
  `id` VARCHAR(191) NOT NULL,
  `versao` INTEGER NOT NULL DEFAULT 1,
  `usuario` VARCHAR(191) NOT NULL,
  `acao` VARCHAR(191) NOT NULL,
  `entidade` VARCHAR(191) NOT NULL,
  `entidadeId` VARCHAR(191) NOT NULL,
  `detalhes` TEXT NOT NULL,
  `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Auditoria_data_idx` (`data`),
  INDEX `Auditoria_entidade_entidadeId_idx` (`entidade`, `entidadeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Contrato`
  ADD CONSTRAINT `Contrato_organizacaoId_fkey`
  FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Lote`
  ADD CONSTRAINT `Lote_organizacaoId_fkey`
  FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Equipamento`
  ADD CONSTRAINT `Equipamento_loteId_fkey`
  FOREIGN KEY (`loteId`) REFERENCES `Lote`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Movimentacao`
  ADD CONSTRAINT `Movimentacao_equipamentoId_fkey`
  FOREIGN KEY (`equipamentoId`) REFERENCES `Equipamento`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Movimentacao`
  ADD CONSTRAINT `Movimentacao_usuarioId_fkey`
  FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
