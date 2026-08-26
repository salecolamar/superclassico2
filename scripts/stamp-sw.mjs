// Carimba uma versão nova (data/hora do build) no service worker antes de
// cada build, pra garantir que os navegadores sempre percebam que existe
// uma atualização — sem isso, quem já instalou o app no celular só pegaria
// a versão nova quando o sistema decidisse checar sozinho (podendo demorar
// bastante, principalmente no iOS).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(__dirname, '..', 'public', 'sw.js');

const content = fs.readFileSync(swPath, 'utf8');
const stamped = content.replace(
  /const CACHE = '[^']*';/,
  `const CACHE = 'furao-fc-${Date.now()}';`
);
fs.writeFileSync(swPath, stamped);
console.log('sw.js carimbado com nova versão de cache.');
