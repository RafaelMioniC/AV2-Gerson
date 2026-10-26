-- Protege o administrador inicial já existente, sem depender de uma nova execução do seed.
-- Se houver mais de um administrador, protege o mais antigo; o seed também mantém a proteção.
UPDATE `Usuario`
SET `protegido` = TRUE
WHERE `id` = (
  SELECT `id`
  FROM (
    SELECT `id`
    FROM `Usuario`
    WHERE `papel` = 'ADMINISTRADOR'
    ORDER BY `criadoEm` ASC, `id` ASC
    LIMIT 1
  ) AS `primeiro_administrador`
);
