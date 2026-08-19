# Guia completo — Super Clássico

Passo a passo do zero até o app instalado no celular. Siga na ordem:
**Firebase → GitHub → Vercel → Celular**.

---

## 1. Firebase (banco de dados gratuito)

O Firebase é onde ficam salvos os jogadores, presenças e pagamentos — compartilhado entre todos os celulares.

1. Acesse **console.firebase.google.com** e clique em **"Adicionar projeto"**.
2. Dê um nome (ex: `super-classico`). Na tela do Google Analytics, pode **desativar** — não é necessário. Clique em **"Criar projeto"** e espere carregar.
3. No menu da esquerda, clique em **Firestore Database** → **"Criar banco de dados"**.
   - Escolha **"Iniciar no modo de produção"**.
   - Na região, escolha algo próximo do Brasil, como `southamerica-east1 (São Paulo)`.
   - Clique em **Ativar**.
4. Ative o login anônimo (é o que vai travar o banco pra fora do app): no menu da esquerda, clique em **Authentication** → **"Vamos começar"** (Get started) → aba **"Sign-in method"** → clique em **"Anônimo"** (Anonymous) → ative o interruptor → **Salvar**.
5. Volte no **Firestore Database**, clique na aba **"Regras"** (Rules), apague tudo e cole:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /furao-fc/{doc} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   Clique em **Publicar**.

   > 🔒 Com isso, só quem abre o app (e recebe automaticamente uma sessão
   > anônima do Firebase) consegue ler ou escrever no banco — ninguém
   > mais consegue acessar direto pela internet sem nunca ter aberto o
   > app. É uma trava e tanto, mas não é 100%: como o login é feito na
   > própria interface do app (não pelo sistema de contas do Firebase),
   > alguém do próprio grupo com conhecimento técnico avançado ainda
   > poderia, usando as ferramentas de desenvolvedor do navegador,
   > acessar o banco enquanto usa o app normalmente. Pra fechar esse
   > último buraco de vez, precisaria de contas reais por jogador no
   > Firebase Authentication + um servidor validando cada ação — um
   > projeto bem maior.

5. Volte pra tela inicial do projeto (ícone de casinha). Clique no ícone **`</>`** (Web) para registrar um app.
6. Dê um nome qualquer (ex: `super-classico-web`) e clique em **"Registrar app"** — não precisa marcar Hosting.
7. Vai aparecer um bloco de código com `const firebaseConfig = { ... }`. **Copie esse bloco inteiro.**
8. Abra o arquivo `src/firebase.js` (dentro deste projeto) e cole os valores reais no lugar dos valores de exemplo:
   ```js
   const firebaseConfig = {
     apiKey: 'sua-api-key-aqui',
     authDomain: 'seu-projeto.firebaseapp.com',
     projectId: 'seu-projeto',
     storageBucket: 'seu-projeto.appspot.com',
     messagingSenderId: '000000000000',
     appId: '1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx',
   };
   ```
   Pode ignorar/apagar o `measurementId`, se vier — não é usado.
9. Salve o arquivo.

**Ver os dados depois:** Firestore Database → coleção `furao-fc` → documento `furao-app-data`. Dá pra conferir jogadores, presenças e pagamentos direto ali, sem abrir o app.

---

## 2. GitHub (guardar o código)

1. Crie uma conta grátis em **github.com**.
2. Clique em **"New repository"**, dê um nome (ex: `super-classico`), deixe **Public**, não marque nenhuma outra opção. Clique em **"Create repository"**.
3. Na página do repositório recém-criado, clique em **"uploading an existing file"**.
4. Abra a pasta deste projeto no seu computador, selecione **todos os arquivos e pastas** (Ctrl+A) e arraste para dentro da janela do navegador.
5. Espere o upload terminar, role até o fim da página e clique em **"Commit changes"**.

### Sempre que eu mandar um arquivo atualizado (App.jsx, index.html, etc.)
1. No repositório, clique no arquivo que vai mudar.
2. Clique no ícone de **lápis** (Edit this file).
3. Selecione tudo (Ctrl+A), apague, cole o conteúdo novo.
4. Role até o fim e clique em **"Commit changes"**.
5. A Vercel publica a versão nova sozinha, em ~1 minuto.

---

## 3. Vercel (publicar o app com um link)

1. Crie uma conta grátis em **vercel.com**, escolhendo **"Continue with GitHub"**.
2. No painel, clique em **"Add New… → Project"**.
3. Encontre seu repositório (ex: `super-classico`) e clique em **"Import"**.
4. Confirme que o **Framework Preset** está em **"Vite"** (a Vercel geralmente detecta sozinha).
5. Não mude mais nada — clique em **"Deploy"**.
6. Espere 1–2 minutos. Quando aparecer a tela de sucesso, você recebe um link tipo `super-classico.vercel.app` — é esse link que todo mundo vai usar.

### Se o build falhar
- **Erro de JSON no `package.json`**: algum arquivo foi upado com conteúdo errado. Abra o `package.json` no GitHub, edite (lápis) e cole o conteúdo correto de nossa conversa.
- **"vite: command not found"**: vá em **Settings → General → Build & Development Settings** do projeto na Vercel, confirme Framework Preset = Vite e que nenhum campo (Build/Install Command) está com **Override** ligado e vazio. Depois vá em **Deployments**, nos três pontinhos do último deploy → **Redeploy**.

### Para mudar configurações depois
Settings → General → Build & Development Settings (mesma tela acima).

---

## 4. Instalar no celular

**Android (Chrome):**
1. Abra o link do app no Chrome.
2. Toque no menu (⋮) → **"Adicionar à tela inicial"** (ou no banner automático "Instalar app").

**iPhone (precisa ser Safari):**
1. Abra o link no Safari.
2. Toque no botão de compartilhar (□ com seta pra cima).
3. Toque em **"Adicionar à Tela de Início"**.

O ícone aparece na tela do celular e abre em tela cheia, como um app nativo.

---

## Resumo do fluxo para qualquer mudança futura

1. Eu mando o(s) arquivo(s) atualizado(s) aqui no chat.
2. Você substitui no GitHub (editar arquivo → colar → Commit changes).
3. A Vercel publica sozinha.
4. Reabre o app no celular com internet — ele sempre busca a versão mais nova primeiro.
