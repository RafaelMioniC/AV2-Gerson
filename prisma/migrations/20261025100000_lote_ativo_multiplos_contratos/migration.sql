CREATE INDEX `Contrato_organizacaoId_idx` ON `Contrato`(`organizacaoId`);
ALTER TABLE `Contrato` DROP INDEX `Contrato_organizacaoId_key`;
ALTER TABLE `Lote` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;