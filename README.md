# Ascent · Sala Tática (CS2)

Painel do time: agenda com presença, kanban de treinos, posições por mapa, playbook de táticas, veto, anti-strats, histórico de partidas e vídeos de estudo.

Stack: React + Vite (frontend) e Supabase (banco de dados gratuito para os dados compartilhados do time). O login/sessão de cada dispositivo fica no localStorage.

---

## 1. Pré-requisitos

- [Node.js](https://nodejs.org) 18 ou superior (`node -v` para conferir)
- [VSCode](https://code.visualstudio.com)
- [Git](https://git-scm.com) instalado
- Conta no [GitHub](https://github.com)
- Conta na [Vercel](https://vercel.com) (gratuita — hospeda o site e conecta o domínio)
- Conta no [Supabase](https://supabase.com) (gratuita — guarda os dados do time)
- Seu domínio (Registro.br, GoDaddy, Hostinger etc.)

## 2. Configurar o banco (Supabase) — 5 minutos

1. Crie um projeto em https://supabase.com/dashboard (anote a senha do banco, mas não vamos precisar dela no app).
2. No menu lateral, abra **SQL Editor**, cole o conteúdo do arquivo `supabase.sql` deste projeto e clique em **Run**.
3. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public key**
4. Na pasta do projeto, copie `.env.example` para um arquivo chamado `.env` e preencha:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-ANON
```

## 3. Rodar no seu PC (VSCode)

Abra a pasta do projeto no VSCode, abra o terminal integrado (Ctrl+') e rode:

```bash
npm install
npm run dev
```

Abra http://localhost:5173 — o site deve carregar com a tela de login. Faça o primeiro acesso com o login admin para cadastrar o elenco.

## 4. Subir para o GitHub

No terminal do VSCode, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "Ascent sala tatica - versao inicial"
```

Crie um repositório novo em https://github.com/new (pode ser **privado** — recomendado, já que as senhas de login ficam no código). Depois:

```bash
git remote add origin https://github.com/SEU-USUARIO/ascent-cs2-hub.git
git branch -M main
git push -u origin main
```

> O arquivo `.env` NÃO sobe para o GitHub (está no `.gitignore`) — as chaves serão configuradas direto na Vercel no próximo passo.

## 5. Publicar na Vercel

1. Acesse https://vercel.com e entre com sua conta do GitHub.
2. **Add New → Project** e importe o repositório `ascent-cs2-hub`.
3. A Vercel detecta o Vite sozinha. Antes de clicar em Deploy, abra **Environment Variables** e adicione as duas variáveis (as mesmas do seu `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Clique em **Deploy**. Em ~1 minuto o site estará no ar num endereço `.vercel.app`.

A partir daqui, todo `git push` para a branch `main` publica automaticamente uma nova versão.

## 6. Conectar o domínio

1. No painel do projeto na Vercel: **Settings → Domains → Add** e digite seu domínio (ex.: `ascentcs.com.br` ou `time.seudominio.com.br`).
2. A Vercel mostrará o que configurar no seu provedor de domínio — normalmente:
   - Domínio raiz: registro **A** apontando para o IP indicado pela Vercel
   - Subdomínio (`www` ou `time`): registro **CNAME** apontando para o alvo indicado pela Vercel
3. Crie esses registros no painel DNS do seu provedor (no Registro.br fica em "Editar zona DNS").
4. Aguarde a propagação (minutos a algumas horas). O HTTPS é automático.

## 7. Manutenção

- Alterou o código? `git add . && git commit -m "descricao" && git push` — a Vercel publica sozinha.
- Trocar senhas de login: edite `TEAM_PASSWORD`, `ADMIN_NICK` e `ADMIN_PASSWORD` no topo de `src/App.jsx` e faça push.
- Backup dos dados: no Supabase, **Table Editor → storage** — o valor da chave `cs2hub:data:v1` é um JSON com tudo do time.

## Aviso de segurança (leia!)

Este app usa um controle de acesso simples: as senhas ficam no código do site e o banco aceita leitura/escrita pública via chave anônima. Isso é suficiente para organizar um time amador, mas **não é segurança real** — não guarde dados pessoais ou sensíveis. Manter o repositório privado e o domínio fora de divulgação pública já reduz bastante a exposição. Se um dia o projeto crescer, o upgrade natural é usar o login de verdade do Supabase (Auth) com regras por usuário.
