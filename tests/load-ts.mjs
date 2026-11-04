import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Load the project's pure TypeScript modules without introducing a test dependency.
function moduleUrl(url) {
  const source = readFileSync(url, 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const match of [...js.matchAll(/from ['"](\.[^'"]+)['"]/g)]) {
    const target = new URL(match[1].endsWith('.ts') ? match[1] : `${match[1]}.ts`, url);
    js = js.replace(match[0], `from '${moduleUrl(target)}'`);
  }
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
export const loadTs = url => import(moduleUrl(url));
