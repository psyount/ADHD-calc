// lib/pk-core.js 를 Scriptable 위젯 파일 안에 붙여 넣어 scriptable/FocusWidget.js 를 만든다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function buildWidget() {
  const core = readFileSync(join(root, 'lib/pk-core.js'), 'utf8').replace(/^export /gm, '');
  const tpl = readFileSync(join(root, 'scriptable/template.js'), 'utf8');
  if (!tpl.includes('/*__PK_CORE__*/')) throw new Error('template에 /*__PK_CORE__*/ 표시가 없음');
  return tpl.replace('/*__PK_CORE__*/', core.trim());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(root, 'scriptable/FocusWidget.js'), buildWidget());
  console.log('scriptable/FocusWidget.js 생성');
}
