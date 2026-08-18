# Super Clássico — App instalável (PWA)

Controle de mensalidade, presença e financeiro do futebol de quarta-feira
(Vasco x Flamengo, Campo do Furão, Olaria - RJ). Instalável na tela inicial
de qualquer Android ou iPhone, com os dados sincronizados entre todos os
celulares em tempo real via Firebase.

## Regras de visibilidade do financeiro
- Cada jogador vê os pagamentos e pendências **do próprio time** (Vasco ou
  Flamengo), não do time adversário.
- O **administrador** vê e edita o financeiro dos dois times.
- O painel inicial (dashboard) mostra o total arrecadado geral para todos.

## 1. Crie o banco de dados gratuito (Firebase)
1. Acesse https://console.firebase.google.com e crie um projeto grátis
   (pode desmarcar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Firestore Database → Criar banco de dados**.
   Escolha "modo de produção" e a região mais próxima (ex: `southamerica-east1`).
3. Ainda no Firestore, vá na aba **Regras** e cole:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /furao-fc/{doc} {
         allow read, write: if true;
       }
     }
   }
   ```
   Clique em "Publicar".

   ⚠️ Essas regras deixam o banco aberto (sem exigir login do Firebase),
   porque o login deste app é feito na própria interface, não pelo sistema
   de autenticação do Firebase. Isso é adequado para um grupo de amigos,
   mas não ofereça uma segurança forte — não é o lugar para dados
   realmente sensíveis.

4. Volte para a **Visão geral do projeto** (ícone de casa), clique no
   ícone **</>** ("Web") para criar um app da Web, dê um nome qualquer e
   clique em "Registrar app".
5. Copie o objeto `firebaseConfig` que aparece na tela.
6. Abra o arquivo `src/firebase.js` deste projeto e cole os valores no
   lugar de `COLE_AQUI_SUA_API_KEY` etc.

## 2. Suba os arquivos no GitHub
1. Crie uma conta grátis em https://github.com (se ainda não tiver).
2. Clique em "New repository", dê um nome (ex: `furao-fc`) e crie.
3. Na página do repositório, clique em "uploading an existing file" e
   arraste **todos os arquivos e pastas** deste pacote (já com o
   `firebase.js` preenchido) para dentro.
4. Clique em "Commit changes".

## 3. Publique com a Vercel (grátis)
1. Crie uma conta grátis em https://vercel.com usando login do GitHub.
2. Clique em "Add New… → Project" e selecione o repositório `furao-fc`.
3. A Vercel detecta automaticamente que é um projeto Vite — não precisa
   mudar nada. Clique em "Deploy".
4. Em ~1 minuto você recebe um link público, tipo `furao-fc.vercel.app`.

## 4. Instale no celular
**Android (Chrome):**
1. Abra o link do app no Chrome.
2. Toque no menu (⋮) → "Adicionar à tela inicial" (ou toque no banner
   automático "Instalar app").

**iPhone (Safari):**
1. Abra o link do app no Safari (precisa ser no Safari).
2. Toque no botão de compartilhar (□ com seta para cima).
3. Toque em "Adicionar à Tela de Início".

Pronto — o ícone do Super Clássico aparece na tela do celular, abre em tela
cheia como um app nativo, e os dados ficam salvos na nuvem: qualquer
jogador cadastrado em qualquer celular já vê a mesma coisa.

## Rodar localmente antes de publicar (opcional)
Com Node.js instalado:
```
npm install
npm run dev
```
