-- Marca o administrador inicial como protegido pelo seed.
ALTER TABLE `Usuario`
  ADD COLUMN `protegido` BOOLEAN NOT NULL DEFAULT false;

-- Mantém o schema alinhado ao comportamento de exclusão em cascata.
ALTER TABLE `Movimentacao`
  DROP FOREIGN KEY `Movimentacao_equipamentoId_fkey`;
ALTER TABLE `Equipamento`
  DROP FOREIGN KEY `Equipamento_loteId_fkey`;
ALTER TABLE `Lote`
  DROP FOREIGN KEY `Lote_organizacaoId_fkey`;
ALTER TABLE `Contrato`
  DROP FOREIGN KEY `Contrato_organizacaoId_fkey`;

ALTER TABLE `Contrato`
  ADD CONSTRAINT `Contrato_organizacaoId_fkey`
  FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Lote`
  ADD CONSTRAINT `Lote_organizacaoId_fkey`
  FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Equipamento`
  ADD CONSTRAINT `Equipamento_loteId_fkey`
  FOREIGN KEY (`loteId`) REFERENCES `Lote`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Movimentacao`
  ADD CONSTRAINT `Movimentacao_equipamentoId_fkey`
  FOREIGN KEY (`equipamentoId`) REFERENCES `Equipamento`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
