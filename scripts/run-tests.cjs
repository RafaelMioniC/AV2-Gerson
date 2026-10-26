const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const raiz = path.resolve(__dirname, '..');
const pasta = path.join(raiz, 'tests');
function listar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const arquivo = path.join(dir, item.name);
    if (item.isDirectory()) return listar(arquivo);
    return item.isFile() && item.name.endsWith('.test.ts') ? [arquivo] : [];
  });
}
const arquivos = listar(pasta);
if (!arquivos.length) { console.error('Nenhum arquivo *.test.ts encontrado em tests/.'); process.exit(1); }
const resultado = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...arquivos], { cwd: raiz, stdio: 'inherit' });
process.exit(resultado.status ?? 1);
