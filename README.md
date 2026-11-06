# SOLID — catálogo de peças impressas em 3D (MVP)

[![CI](https://github.com/thigastech/solid-college/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/thigastech/solid-college/actions/workflows/ci.yml)

Landing page com catálogo de produtos impressos em 3D e formulário de contato/orçamento.
O objetivo é **apresentar o portfólio e gerar contatos**. Não há carrinho, checkout, pagamento, frete nem contas de cliente.
Há uma **área administrativa somente leitura** (`/admin`) para consultar os contatos recebidos, protegida por token.

| Camada | Tecnologias |
| --- | --- |
| Frontend | Angular 17.3 (standalone components, signals, Reactive Forms, Router), TypeScript 5.4, Tailwind CSS 3.4, lucide-angular 0.460, Inter (fonte self-hosted via `@fontsource-variable/inter`) |
| Backend | Python 3.12, Flask 3.0, Flask-SQLAlchemy 3.1 / SQLAlchemy 2.0, Pydantic 2.6, Flask-Cors 4.0, Flask-Migrate 4.0 (Alembic) |
| Banco | SQLite 3 (arquivo local, chaves estrangeiras ativadas) |
| Testes | pytest (backend), Jasmine + Karma (frontend) |

> **Marca:** SOLID, “Desde 2026” (nome e slogan do logotipo fornecido). Textos e canais ficam em `frontend/src/app/core/config/site.config.ts`; cores e estilos em `frontend/src/styles.css`.
> **Dados e imagens do catálogo são fictícios** (itens “(demo)”). Veja [Dados demonstrativos](#dados-demonstrativos).

Documentação complementar:

- [docs/API.md](docs/API.md): contrato da API REST, com exemplos de requisição e resposta.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): modelo de dados, decisões de arquitetura e de UX, segurança/LGPD.

---

## Estrutura

```
SOLID/
├── backend/
│   ├── app/
│   │   ├── __init__.py        # create_app(): config, extensões, CORS, blueprints, handlers
│   │   ├── config.py          # configuração via variáveis de ambiente
│   │   ├── extensions.py      # db, migrate, cors + PRAGMA foreign_keys=ON
│   │   ├── errors.py          # contrato único de erro + tradução dos erros do Pydantic
│   │   ├── cli.py             # flask init-db | seed-demo | backup-db | admin-token | expurgar-contatos
│   │   ├── models/            # Produto, Contato (SQLAlchemy)
│   │   ├── schemas/           # Pydantic: contato, produto e admin (filtro/saída da consulta de contatos)
│   │   ├── services/          # regras de negócio, rate limit e notificação por e-mail
│   │   ├── routes/            # /api/produtos, /api/contatos, /api/admin/contatos, /api/health
│   │   └── static/produtos/   # ilustrações SVG dos produtos demo
│   ├── data/produtos_demo.json
│   ├── migrations/            # Alembic (esquema inicial)
│   ├── exemplos/contato.json  # payload de exemplo para testes manuais
│   ├── tests/                 # pytest
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py
├── frontend/
│   └── src/app/
│       ├── core/              # config do site, modelos, serviços HTTP, estado, layout (header/footer)
│       ├── shared/            # utilitários
│       └── features/          # home (hero, vitrine, diferenciais), catalogo, contato, privacidade, admin
├── tools/gerar_ilustracoes.py # gera os SVGs isométricos dos produtos demo
├── .github/workflows/ci.yml   # testes do backend e do frontend no GitHub Actions
└── docs/
```

## Pré-requisitos

- **Python 3.12** (o Pydantic 2.6 não publica binários para 3.13/3.14).
  No Windows: `py install 3.12` (Python Install Manager) ou instalador do python.org.
- **Node.js 18.13+ ou 20.9+** (faixas suportadas pelo Angular 17).
  Foi validado também com Node 24.11, que funciona, mas o Angular CLI 17 o considera não suportado e pode emitir um aviso.
- Google Chrome (para os testes do frontend com Karma).

## Como executar localmente

### 1. Backend (API Flask): porta 5000

**Windows (PowerShell)**

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
flask init-db        # cria/atualiza o esquema (migrações Alembic)
flask seed-demo      # opcional: insere produtos FICTÍCIOS de demonstração
python run.py        # http://127.0.0.1:5000
```

**Linux / macOS**

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask init-db
flask seed-demo
python run.py
```

Teste rápido: `curl http://127.0.0.1:5000/api/health` deve retornar `{"success": true, ...}`.

### 2. Frontend (Angular): porta 4200

Em outro terminal:

```bash
cd frontend
npm install
npm start            # http://localhost:4200
```

Para usar a área administrativa, defina `ADMIN_TOKEN` no `backend/.env` (mínimo 32 caracteres) e reinicie o backend:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Depois acesse `http://localhost:4200/admin` e informe esse token. Sem `ADMIN_TOKEN`, a área fica desativada (a API responde 503).

Em desenvolvimento o frontend chama `http://localhost:5000` (definido em `src/environments/environment.development.ts`).
O backend aceita requisições do navegador apenas das origens em `CORS_ORIGINS` (padrão `http://localhost:4200`).

### 3. Testes

```bash
# Backend (com o venv ativo)
cd backend
pytest -q

# Frontend (abre o Chrome, executa e encerra)
cd frontend
npx ng test --watch=false
# CI / contêiner sem interface:
npx ng test --watch=false --browsers=ChromeHeadlessCI
```

Se o Karma não conseguir iniciar o Chrome (ambientes restritos), rode-o sem navegador e abra a URL exibida (`http://localhost:9876`) em qualquer navegador:

```bash
KARMA_SEM_NAVEGADOR=1 npx ng test        # PowerShell: $env:KARMA_SEM_NAVEGADOR=1; npx ng test
```

**Integração contínua:** o workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda as duas suítes no GitHub Actions a cada push e pull request para `main`: backend com Python 3.12 (`pytest`) e frontend com Node 20 (`ng test` no `ChromeHeadlessCI`). O badge no topo deste arquivo mostra o resultado mais recente.

### 4. Build de produção do frontend

```bash
cd frontend
npx ng build         # saída em frontend/dist/frontend/browser
```

Em produção, `environment.ts` usa `apiBaseUrl: ''`, ou seja, a API deve ser servida na **mesma origem** (proxy reverso encaminhando `/api` e `/static` para o Flask).
Se a API ficar em outro domínio, ajuste `apiBaseUrl` e inclua o domínio do site em `CORS_ORIGINS`.
Para produção, rode o Flask atrás de um servidor WSGI (ex.: `waitress` no Windows ou `gunicorn` no Linux) com `FLASK_DEBUG=0` e `APP_ENV=production`.

**Atrás de proxy reverso** (nginx, balanceador etc.), defina `TRUSTED_PROXIES` com o número de proxies na frente da aplicação (normalmente `1`).
Com isso o Flask aplica o `ProxyFix` do Werkzeug e lê o IP real do visitante (e o esquema/host) de `X-Forwarded-For`/`X-Forwarded-Proto`/`X-Forwarded-Host`, o que é necessário para o limite de envios por IP e o bloqueio de tentativas do admin funcionarem por visitante, e não para o proxy inteiro.
Deixe `TRUSTED_PROXIES=0` (padrão) quando a API recebe conexões diretamente: nesse caso os cabeçalhos `X-Forwarded-*` são ignorados, porque qualquer cliente poderia falsificá-los para burlar os limites.

### 5. Deploy do frontend na Vercel

O site Angular é publicado na Vercel como **site estático**, a partir de `frontend/` (projeto com *Root Directory* `frontend`, ligado a este repositório). Cada push em `main` publica em produção; os outros branches geram previews.
O backend Flask **não** vai para a Vercel: lá o SQLite seria apagado a cada nova instância e os contatos se perderiam. Até a API ter hospedagem própria, o catálogo e o formulário mostram o estado de erro previsto e a vitrine mostra a marca.

Configuração em [`frontend/vercel.json`](frontend/vercel.json):

- Build `ng build --configuration production` (sem source maps, sem `onload` inline do CSS crítico) e saída `dist/frontend/browser`; fallback de SPA para `index.html`.
  Na prática a Vercel também devolve o `index.html` em `/api/*` e `/static/*` (a exclusão do rewrite não teve efeito). Não há vazamento, porque só existe o build público, e o frontend trata a resposta como API indisponível. Quando a API existir, um rewrite `/api/(.*)` para ela, colocado antes do fallback, resolve.
- Cabeçalhos de segurança em todas as respostas: CSP restrita (scripts só da própria origem mais o script de tema inline, liberado pelo hash SHA-256; sem `eval`; `frame-ancestors 'none'`), HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` negando câmera, microfone, localização etc., e `Cross-Origin-Opener/Resource-Policy`.
- Cache longo (`immutable`) para JS/CSS com hash e fontes; `index.html` sempre revalidado.

**Se alterar o script inline de `src/index.html`**, recalcule o hash e atualize a CSP no `vercel.json`; senão o navegador bloqueia o script:

```bash
node -e "const s=require('fs').readFileSync('frontend/src/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];console.log('sha256-'+require('crypto').createHash('sha256').update(s).digest('base64'))"
```

Arquivos sensíveis: [`frontend/.vercelignore`](frontend/.vercelignore) impede o envio de `.env*`, chaves, bancos, logs e testes, e o *Root Directory* faz com que o build use apenas `frontend/`. O frontend não usa nenhuma variável secreta: **não cadastre `ADMIN_TOKEN`, `SMTP_SENHA` nem outros segredos do backend no projeto da Vercel.**
Deployments de preview exigem login na Vercel (Vercel Authentication); a produção é pública.

Quando a API estiver hospedada, aponte `apiBaseUrl` em `src/environments/environment.ts` para ela (ou adicione um rewrite `/api/(.*)` → API no `vercel.json`), inclua o domínio da API em `connect-src` e `img-src` da CSP e o domínio do site em `CORS_ORIGINS` no backend.

## Banco de dados

- Arquivo padrão: `backend/instance/catalogo.db`. Para mudar, use `DATABASE_URL` (ex.: `sqlite:///C:/dados/catalogo.db`).
- `PRAGMA foreign_keys=ON` é aplicado em toda conexão (`app/extensions.py`).
- **Evolução do esquema:** altere os modelos e então rode
  `flask db migrate -m "descrição"`, revise o arquivo gerado em `migrations/versions/` e aplique com `flask db upgrade` (ou `flask init-db`).
- **Backup:** `flask backup-db` gera uma cópia consistente (API de backup do SQLite, segura mesmo com a aplicação rodando) em `backend/backups/catalogo-AAAAMMDD-HHMMSS.db` (pasta configurável via `BACKUP_DIR`).
  Para restaurar, pare a aplicação e substitua o arquivo do banco pela cópia.
- Não exclua produtos com contatos associados: a chave estrangeira usa `ON DELETE RESTRICT`. **Desative** o produto (`status = 'inativo'`); ele some da API pública e o histórico de contatos é preservado.

### Retenção de contatos (LGPD)

`flask expurgar-contatos` apaga **definitivamente** os contatos mais antigos que o prazo de retenção, definido em `CONTATO_RETENCAO_DIAS` (padrão 730 dias, cerca de 2 anos). O prazo deve ser decidido pelo responsável pelo tratamento dos dados.

```bash
flask expurgar-contatos --simular      # só informa quantos seriam apagados
flask expurgar-contatos                # pede confirmação antes de apagar
flask expurgar-contatos --dias 365     # usa outro prazo nesta execução
flask expurgar-contatos --sim          # sem confirmação, para agendadores
```

A data de corte é calculada em UTC sobre `data_envio`. Agende o comando (por exemplo, diariamente pelo Agendador de Tarefas do Windows ou pelo `cron`) com `--sim`.
Lembre que backups antigos (`flask backup-db`) continuam guardando os contatos expurgados: aplique a eles a mesma política.

### Gerenciar produtos (sem painel administrativo)

Nesta versão os produtos são mantidos diretamente no banco, por exemplo com o shell do Flask:

```bash
flask shell
>>> from app.models import Produto
>>> p = Produto(nome="Suporte de parede", categoria="Organização", descricao="...",
...             especificacao_tecnica=[{"rotulo": "Material", "valor": "PETG"}],
...             imagem_url="/static/produtos/suporte.svg", status="ativo")
>>> db.session.add(p); db.session.commit()
>>> Produto.query.get(3).status = "inativo"; db.session.commit()   # desativar
```

Imagens podem ser colocadas em `backend/app/static/produtos/` (referenciadas como `/static/produtos/arquivo.ext`) ou apontar para uma URL absoluta.

## Área administrativa (consulta de contatos)

- Rota `/admin` (não aparece na navegação pública e tem `noindex`), com cabeçalho próprio e alternância de tema.
- Acesso por **token compartilhado** (`ADMIN_TOKEN`) enviado no cabeçalho `Authorization: Bearer`. O backend compara em tempo constante e limita tentativas inválidas por IP (`ADMIN_FALHAS_LIMITE` em `ADMIN_FALHAS_JANELA` segundos → 429).
- O token fica só no `sessionStorage` da aba: some ao clicar em “Sair” ou fechar o navegador e nunca vai para a URL.
- Lista paginada (20 por página, mais recentes primeiro), busca por nome, e-mail ou assunto, filtro por produto (inclui inativos), detalhes com a mensagem completa, “Responder por e-mail” (`mailto:`) e “Copiar e-mail”.
- **Somente leitura**: não edita nem exclui contatos ou produtos. O log registra apenas que houve consulta (página e total), nunca o conteúdo.

## Dados demonstrativos

- `flask seed-demo` lê `backend/data/produtos_demo.json`, valida cada item com Pydantic e **insere apenas produtos cujo nome ainda não existe**. Nunca altera nem apaga registros existentes, e informa quantos foram inseridos e ignorados.
- O comando é **bloqueado com `APP_ENV=production`**.
- Todos os itens têm “(demo)” no nome e “Item demonstrativo” na descrição. Um deles está `inativo` de propósito, para demonstrar que não aparece na API.
- As imagens são **ilustrações vetoriais geradas** por `tools/gerar_ilustracoes.py` (`python tools/gerar_ilustracoes.py`), não fotos de peças reais. Substitua-as por fotografias reais antes de publicar.

## Funcionalidades implementadas

- Identidade SOLID (laranja, grafite e papel quadriculado), logotipo vetorial que acompanha o tema. Visual liquid glass sóbrio: painéis translúcidos com desfoque e borda fina, sem brilhos coloridos; laranja reservado às ações. Fallback opaco sem `backdrop-filter` ou com `prefers-reduced-transparency`.
- Fundo animado ligado ao tema da marca: peças sendo impressas camada por camada em projeção isométrica, com o bico percorrendo o contorno (canvas, até 30 fps, pausado com a aba oculta e estático com `prefers-reduced-motion`; cores acompanham o tema).
- Tema claro e escuro: segue o sistema por padrão, com botão no cabeçalho; a escolha fica salva no navegador e é aplicada antes do primeiro desenho (sem “piscar”).
- Landing page única: header sticky com menu mobile acessível, hero, diferenciais, catálogo, formulário e rodapé.
- Vitrine no topo com os produtos reais da API: troca automática a cada 6 s com barra de progresso, anterior/próximo, miniaturas, “Orçamento” e “Detalhes”, com transição simples (fade). Segue o padrão de carrossel do WAI-ARIA: botão de pausa, pausa com mouse ou foco, e sem rotação automática com `prefers-reduced-motion`.
- Catálogo consumindo `GET /api/produtos` (apenas produtos ativos), com:
  pesquisa por nome e descrição (sem diferenciar acentos e maiúsculas), filtro por categoria, contagem de resultados anunciada a leitores de tela, estados de carregamento (skeleton), erro com “Tentar novamente” e vazio com “Limpar filtros”.
- Diálogo de detalhes (`<dialog>` nativo): imagem ampliada, descrição completa, especificações (ou “Não informado”), foco no botão de fechar, Escape/backdrop fecham e o foco volta ao gatilho.
- “Solicitar orçamento” em card ou diálogo: seleciona o produto, rola até o formulário, preenche “Produto de interesse” e sugere o assunto. A seleção é compartilhada (signal) entre catálogo e formulário.
- Formulário com validação no frontend (obrigatórios, e-mail, limites, mensagens junto aos campos, `aria-invalid`/`aria-describedby`, foco no primeiro campo inválido), botão desabilitado e indicador durante o envio, sucesso **somente após HTTP 201**, erro preservando os dados e exibindo erros de campo vindos do servidor.
- Busca da API (`GET /api/produtos?busca=` e a busca do admin) sem diferenciar acentos e maiúsculas, como a do frontend.
- Aviso opcional por e-mail (SMTP) a cada novo contato, sem impedir o registro se o envio falhar.
- Comando `flask expurgar-contatos` para aplicar o prazo de retenção dos contatos (LGPD).
- IP real do visitante atrás de proxy reverso (`TRUSTED_PROXIES` + `ProxyFix`).
- Testes automatizados no GitHub Actions a cada push e pull request para `main`.
- Backend com validação Pydantic estrita, contrato de erro único, verificação de produto ativo, transação com rollback, honeypot e limite de envios por IP, CORS restrito, limite de tamanho do corpo e logs sem dados pessoais.
- Aviso de privacidade em `/privacidade`. Canal de contato e e-mail de privacidade só aparecem se configurados.
- Animações apenas em CSS, desativadas com `prefers-reduced-motion`.

## Testes executados nesta entrega

- **Backend:** `pytest`: **85 testes aprovados**. Cobrem: captcha (acerto, erro, reuso, expiração, token forjado), demanda, telefone, listagem só de ativos, busca, filtro por categoria, 404 para produto inexistente ou inativo, criação válida e persistência, e-mail inválido, campos ausentes, vazios, longos e com tipo errado, campos extras, JSON malformado, content-type, corpo grande, honeypot, rate limit, falha de banco (500 sem detalhes e com rollback), ausência de listagem pública de contatos, `RESTRICT` na exclusão, CORS, seed idempotente e bloqueado em produção, e a área administrativa (desativada sem token ou com token curto, 401 para token ausente ou errado, bloqueio 429 após falhas, ordenação, paginação, busca, filtro por produto, parâmetros inválidos, CORS com `Authorization` e log sem dados pessoais).
  Depois dessa contagem foram adicionados testes de busca sem acentos (produtos e admin), notificação por e-mail (envio, desligada e falha de SMTP sem afetar o 201), `ProxyFix` (com e sem `TRUSTED_PROXIES`) e `flask expurgar-contatos`; eles rodam no CI.
- **Frontend:** Karma/Jasmine: **40 de 40 testes aprovados** no Chrome headless (`--browsers=ChromeHeadlessCI`), localmente e no CI. Os testes de tema substituem `document.startViewTransition` por um dublê: uma View Transition real derruba o Chrome headless sem GPU e o Karma perde a conexão. Cobrem: estados do catálogo (carregando, erro com nova tentativa, lista e vazio), pesquisa, filtro, seleção de produto, validação, estado de envio e bloqueio de duplicidade, sucesso após 201, erro com preservação dos dados, erros de campo do servidor, pré-preenchimento pelo catálogo, vitrine (carregamento, navegação circular, miniaturas, slides inativos ocultos, avanço automático e pausa, detalhes e orçamento, falha sem produtos inventados), tema (escolha salva, troca com e sem View Transitions e preferência do sistema) e área administrativa (validação do token, 401, cabeçalho `Authorization`, sessão só na aba, expansão e `mailto`, busca com atraso e saída).- **Verificação manual no navegador (esta etapa):** temas claro e escuro na home e no admin; vitrine abrindo o diálogo de detalhes; login no admin com token errado e correto; busca e filtro por produto; layout em 375 e 1024 px sem rolagem horizontal.
- **Verificação manual anterior:** fluxo completo catálogo → detalhes → orçamento → gravação no SQLite (com `produto_id`), API desligada (mensagens de erro e dados preservados), menu mobile e Escape, navegação por âncoras a partir de `/privacidade`, e ausência de rolagem horizontal em 320, 375, 547, 768 e 1280 px.

## Canais e formulário de contato

- **WhatsApp e Instagram:** preencha `whatsappNumero` (DDI + DDD + número) e `instagramUrl` em `frontend/src/app/core/config/site.config.ts`. Sem número, o botão flutuante do WhatsApp leva ao formulário de contato; sem URL, o ícone do Instagram não aparece.
- **Captcha:** pergunta de soma validada no servidor, sem serviços de terceiros (`GET /api/contatos/captcha`). Variáveis: `CAPTCHA_ATIVO`, `CAPTCHA_SEGREDO` e `CAPTCHA_VALIDADE`. Em produção com mais de um processo, defina `CAPTCHA_SEGREDO`.
- **Demanda e telefone:** a demanda é obrigatória; o telefone é opcional. Depois de atualizar o código, rode `flask db upgrade` para aplicar as migrações.
- **Aviso por e-mail de novos contatos:** desligado por padrão. Para ativar, configure no `backend/.env`:

  | Variável | Uso |
  | --- | --- |
  | `NOTIFICACAO_ATIVA` | `1` liga o envio |
  | `NOTIFICACAO_DESTINO` | e-mails que recebem o aviso, separados por vírgula |
  | `SMTP_HOST` / `SMTP_PORTA` | servidor SMTP (padrão porta 587) |
  | `SMTP_USUARIO` / `SMTP_SENHA` | credenciais; sem usuário, não faz login |
  | `SMTP_REMETENTE` | remetente; se vazio, usa `SMTP_USUARIO` ou o primeiro destino |
  | `SMTP_STARTTLS` / `SMTP_SSL` | `587` + `SMTP_STARTTLS=1` (padrão) ou `465` + `SMTP_SSL=1` |
  | `SMTP_TIMEOUT` | tempo limite da conexão, em segundos (padrão 10) |

  Só envia com `NOTIFICACAO_ATIVA=1`, `SMTP_HOST` e ao menos um destino. O e-mail traz os dados do contato, com `Reply-To` apontando para o cliente (basta responder).
  O envio acontece depois da gravação e é de melhor esforço: se o SMTP falhar, o contato continua salvo, a API responde 201 normalmente e o log registra apenas o `id` do contato e o tipo do erro.
  O envio é síncrono, então um SMTP lento atrasa a resposta do formulário até `SMTP_TIMEOUT`.

## Versionamento e dados sensíveis

O repositório é privado e **não versiona** segredos nem dados pessoais:

- `backend/.env` (inclui o `ADMIN_TOKEN`): só o modelo `backend/.env.example` é versionado. Cada ambiente gera o próprio token com `flask admin-token --novo`.
- `backend/instance/`, `*.db`, `*.sqlite*` e backups: o banco guarda os contatos recebidos (dados pessoais, LGPD).
- Logs, chaves/certificados (`*.pem`, `*.key`, `*.pfx`), `node_modules/`, `.venv/`, builds e caches.

Se um segredo for commitado por engano, **troque-o** (`flask admin-token --novo`) antes de removê-lo do histórico: apagar o arquivo não invalida o valor já publicado.

## Limitações conhecidas

- A área administrativa só **consulta** contatos. Produtos continuam sendo gerenciados via banco e shell.
- Autenticação administrativa por um único token compartilhado, sem usuários individuais nem trilha de auditoria por pessoa. Troque o token se ele vazar e use HTTPS em produção.
- O rate limit (e os nonces do captcha) ficam em memória: zeram ao reiniciar e não são compartilhados entre processos.
- O aviso por e-mail é síncrono e sem fila nem nova tentativa: se o SMTP falhar, aquele aviso se perde (o contato continua salvo e visível no admin).
- A busca do catálogo é feita no cliente sobre a lista completa (adequada a dezenas ou centenas de itens). A API já aceita `?busca=` e `?categoria=` para quando o catálogo crescer.
- A busca sem acentos da API usa uma função Python registrada no SQLite, que não aproveita índices (varredura completa; adequado ao volume do MVP).
- Imagens são ilustrações SVG geradas, não fotos. A meta de resposta visual em menos de 2 s não foi medida formalmente.
- O aviso de privacidade é um texto-base: **precisa ser revisado pelo responsável pelo tratamento dos dados** e não garante conformidade com a LGPD.
- O expurgo de contatos antigos existe (`flask expurgar-contatos`), mas não roda sozinho: precisa ser agendado, e o prazo de retenção deve ser definido pelo responsável.
