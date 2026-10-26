ALTER TABLE `Usuario` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Equipamento` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Contrato` MODIFY `valorMensal` DECIMAL(12, 2) NOT NULL;
CREATE TABLE `Sessao` (
  `id` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NOT NULL,
  `ultimoUso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Sessao_usuarioId_idx` (`usuarioId`),
  INDEX `Sessao_ultimoUso_idx` (`ultimoUso`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Sessao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
