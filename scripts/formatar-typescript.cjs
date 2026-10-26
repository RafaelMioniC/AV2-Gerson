const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const raiz = process.cwd();
const diretorios = ['src', 'prisma', 'tests'];
const arquivos = [];

function encontrarArquivos(diretorio) {
  if (!fs.existsSync(diretorio)) return;

  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, entrada.name);

    if (entrada.isDirectory()) {
      encontrarArquivos(caminho);
      continue;
    }

    if (entrada.isFile() && entrada.name.endsWith('.ts')) {
      arquivos.push(caminho);
    }
  }
}

diretorios.forEach((diretorio) => {
  encontrarArquivos(path.join(raiz, diretorio));
});

const versoes = new Map(arquivos.map((arquivo) => [arquivo, 0]));
const opcoes = {
  indentSize: 2,
  tabSize: 2,
  convertTabsToSpaces: true,
  newLineCharacter: '\n',
  insertSpaceAfterCommaDelimiter: true,
  insertSpaceAfterSemicolonInForStatements: true,
  insertSpaceBeforeAndAfterBinaryOperators: true,
  insertSpaceAfterKeywordsInControlFlowStatements: true,
  insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
  placeOpenBraceOnNewLineForFunctions: false,
  placeOpenBraceOnNewLineForControlBlocks: false,
};

const host = {
  getScriptFileNames: () => arquivos,
  getScriptVersion: (arquivo) => String(versoes.get(arquivo) || 0),
  getScriptSnapshot: (arquivo) =>
    fs.existsSync(arquivo)
      ? ts.ScriptSnapshot.fromString(fs.readFileSync(arquivo, 'utf8'))
      : undefined,
  getCurrentDirectory: () => raiz,
  getCompilationSettings: () => ({ target: ts.ScriptTarget.Latest }),
  getDefaultLibFileName: (opcoesCompilacao) =>
    ts.getDefaultLibFilePath(opcoesCompilacao),
  fileExists: fs.existsSync,
  readFile: (arquivo) => {
    try {
      return fs.readFileSync(arquivo, 'utf8');
    } catch {
      return undefined;
    }
  },
  readDirectory: ts.sys.readDirectory,
};

const servico = ts.createLanguageService(host);

for (const arquivo of arquivos) {
  const edicoes = servico.getFormattingEditsForDocument(arquivo, opcoes);
  if (!edicoes.length) continue;

  let conteudo = fs.readFileSync(arquivo, 'utf8');

  for (const edicao of edicoes.sort((a, b) => b.span.start - a.span.start)) {
    conteudo =
      conteudo.slice(0, edicao.span.start) +
      edicao.newText +
      conteudo.slice(edicao.span.start + edicao.span.length);
  }

  fs.writeFileSync(arquivo, conteudo);
}

console.log(`Formatação aplicada a ${arquivos.length} arquivos TypeScript.`);
