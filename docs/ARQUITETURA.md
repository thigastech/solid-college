# Arquitetura, modelo de dados e decisões

## Visão geral

```
Navegador ──(HTTP/JSON)──► Flask /api ──► services ──► SQLAlchemy ──► SQLite
   Angular SPA               routes         regras        models
                             schemas (Pydantic) validam entrada e saída
```

Backend monolítico em camadas:

| Camada | Pasta | Responsabilidade |
| --- | --- | --- |
| Rotas | `app/routes` | HTTP: ler request, chamar schema e serviço, montar resposta |
| Esquemas | `app/schemas` | Validação de entrada (Pydantic estrito) e formato público de saída |
| Serviços | `app/services` | Regras: só produtos ativos, verificação do produto, transação/rollback, rate limit |
| Modelos | `app/models` | Mapeamento ORM |
| Configuração | `app/config.py`, `.env` | Tudo que varia por ambiente |
| Inicialização | `app/cli.py`, `migrations/` | Esquema (Alembic), seed demo, backup |
| Erros | `app/errors.py` | Contrato único de erro para todas as rotas |

Frontend Angular 17 com componentes standalone:

| Pasta | Conteúdo |
| --- | --- |
| `core/config` | `SITE_CONFIG`: nome provisório, textos institucionais, canais de contato (opcionais), diferenciais |
| `core/models` | Tipos `Produto`, `ContatoPayload`, contrato da API e limites dos campos |
| `core/services` | `ProdutoService`/`ContatoService`/`AdminApiService` (HTTP), `CatalogoStore` (estado do catálogo com signals), `SelecaoProdutoService` (produto escolhido), `DetalheProdutoService` (produto no diálogo, aberto pelo catálogo ou pela vitrine), `TemaService` (claro/escuro), `AdminAuthService` (token na aba), `NavegacaoService` (âncoras), `interpretarErroApi` |
| `core/layout` | Header, footer e logo |
| `features/*` | Home (hero, vitrine, diferenciais), catálogo (lista, card, diálogo), contato, privacidade, admin (consulta de contatos, carregada sob demanda) |

## Modelo de dados

### `produto`

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `id` | INTEGER | PK, autoincremento |
| `nome` | VARCHAR(120) | NOT NULL |
| `descricao` | TEXT | opcional |
| `especificacao_tecnica` | JSON (TEXT no SQLite) | NOT NULL, padrão `[]`; lista de `{"rotulo": str(≤60), "valor": str(≤120)}` |
| `imagem_url` | VARCHAR(500) | opcional; caminho `/static/...` ou URL absoluta |
| `categoria` | VARCHAR(80) | opcional, indexada |
| `status` | VARCHAR(10) | NOT NULL, padrão `ativo`; `CHECK (status IN ('ativo','inativo'))`, indexada |

**Por que JSON em lista para especificações?** Peças diferentes têm atributos diferentes (dentes, volume, material...). Uma lista ordenada de pares rótulo/valor:
(1) evita colunas vazias ou uma tabela EAV, que seria complexa demais para o MVP;
(2) preserva a ordem de exibição;
(3) permite omitir o que não é conhecido, sem inventar dados.
A estrutura é validada por Pydantic (`EspecificacaoItem`) no seed e na serialização.
A desvantagem é não poder filtrar por especificação no SQL, o que não é requisito agora.

**Sem timestamps em `produto`:** nenhuma funcionalidade do MVP usa datas de criação ou edição. Podem ser adicionados com uma migração quando houver gestão de produtos pela interface.

### `contato`

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `id` | INTEGER | PK, autoincremento |
| `nome_cliente` | VARCHAR(100) | NOT NULL |
| `email_cliente` | VARCHAR(254) | NOT NULL |
| `assunto` | VARCHAR(120) | NOT NULL |
| `mensagem` | TEXT | NOT NULL (limitada a 2000 pela validação) |
| `data_envio` | DATETIME | NOT NULL, definida no servidor em UTC |
| `produto_id` | INTEGER | FK opcional → `produto.id`, `ON DELETE RESTRICT`, indexada |

**Integridade referencial:** `RESTRICT` impede apagar um produto que tenha contatos e evita perder histórico (com `CASCADE`) ou perder silenciosamente a associação (com `SET NULL`).
O fluxo recomendado é **desativar** produtos. As chaves estrangeiras só funcionam no SQLite com `PRAGMA foreign_keys=ON`, aplicado a cada conexão.
Não há entidade de cliente separada.

## Decisões de arquitetura

- **Flask-SQLAlchemy + Flask-Migrate:** a sessão é gerenciada por request (escopo da app) e o esquema evolui com Alembic (`render_as_batch=True` para `ALTER TABLE` no SQLite). `flask init-db` aplica as migrações. Os testes usam `create_all` em SQLite em memória.
- **Pydantic estrito:** `StrictStr`/`StrictInt` evitam coerções silenciosas (`"1"` → 1, `true` → 1), e `extra="forbid"` rejeita campos inesperados, o que também impede coletar dados não previstos, como CPF. `str_strip_whitespace` remove espaços nas pontas antes dos limites.
- **SQL parametrizado:** todas as consultas usam o ORM. O `LIKE` da busca escapa `%`, `_` e `\`.
  Não usamos “sanitização” por regex: a proteção contra XSS vem da interpolação do Angular (escapa por padrão; nenhum `innerHTML` é usado).
- **Sucesso só após gravação:** o serviço faz `commit` e, só então, a rota retorna 201. Qualquer `SQLAlchemyError` resulta em `rollback` e em 500 genérico.
- **Antispam proporcional:** honeypot (`website`) + limite em memória por IP + limite do corpo (16 KB). Sem CAPTCHA, para não prejudicar usuários nem adicionar serviços externos.
- **Logs sem dados pessoais:** registra-se apenas `id` e `produto_id` do contato. Exceções são logadas pelo tipo.
- **Imagens servidas pelo Flask** (`/static/produtos`): o produto e sua imagem ficam juntos no backend.
- **Busca no cliente:** o catálogo é pequeno. Carregar uma vez e filtrar localmente dá resposta instantânea, sem debounce nem tráfego extra. A API mantém `busca` e `categoria` para escalar depois.
- **Estado com signals:** `CatalogoStore` é compartilhado pelo catálogo e pelo campo “Produto de interesse”. `SelecaoProdutoService` mantém o produto escolhido consistente entre os dois.

- **Área administrativa por token compartilhado:** atende à necessidade (uma pessoa ou equipe pequena consultando contatos) sem criar contas, senhas, sessões no servidor ou dependências novas.
  O token vem de `ADMIN_TOKEN` (mínimo 32 caracteres; abaixo disso a área fica desativada), viaja só no cabeçalho `Authorization` e é comparado com `hmac.compare_digest`. Falhas por IP são limitadas.
  No navegador fica em `sessionStorage` (escopo da aba), nunca em `localStorage`, cookie ou URL. A rota `/admin` é carregada sob demanda e marcada `noindex`.
  A consulta é somente leitura, e os logs registram só página e total.
  Evolução natural: usuários individuais com senha com hash, sessões com expiração e trilha de auditoria.

## Compatibilidade de dependências

- **Magic UI, shadcn/ui e Tailwind Plus são ecossistemas React** e não foram instalados.
  Serviram de referência visual e foram reproduzidos com Angular, Tailwind e CSS próprio: grade técnica com máscara radial, “shine border” no hover dos cards, texto em gradiente, botões, badges e campos no estilo shadcn, além de um diálogo nativo.
- **Ícones:** `lucide-angular@0.460.0` (peer `@angular/core 13.x–18.x`).
  Esse componente repassa o atributo `class` para o SVG interno, por isso classes de layout ficam em um `<span>` envolvendo o ícone.
- **Tailwind 3.4** (não 4.x): o builder do Angular 17 detecta `tailwind.config.js` automaticamente. O Tailwind 4 exige outra integração com PostCSS.
- **Python 3.12** é necessário para o `pydantic==2.6.4`: o `pydantic-core 2.16` não tem wheels para Python 3.13 ou mais recente.
- `email-validator` é a dependência oficial do Pydantic para validação de e-mail.

## Decisões de UX e visual

- **Identidade SOLID:** laranja `#F26A1B` para preenchimentos e marca, grafite para texto e papel creme quadriculado como fundo, derivados do logotipo fornecido.
  O logotipo foi redesenhado em SVG (impressora com moldura e base laranja), e as cores vêm dos tokens, então acompanha o tema. Também é usado como favicon.
- **Contraste:** o laranja da marca não tem contraste suficiente para texto pequeno sobre creme. Por isso há um token separado, `--c-accent-ink` (laranja escuro no tema claro, claro no escuro), e o botão primário usa texto grafite sobre laranja.
- **Tokens** em `frontend/src/styles.css`, definidos em `:root` (tema claro) e `:root[data-theme='dark']`, expostos ao Tailwind via `tailwind.config.js`. Para trocar a paleta, edite só os tokens.
- **Liquid glass sóbrio:** `.card`, `.glass` e `.glass-forte` são painéis translúcidos (`backdrop-filter: blur(24px) saturate(150%)`), com borda fina clara, realce de 1px no topo e sombra neutra.
  Ficaram de fora os brilhos coloridos, reflexos chamativos, anéis girando, flutuação, inclinação 3D e animações de entrada, que davam à página cara de template genérico.
  Sem suporte a `backdrop-filter`, ou com `prefers-reduced-transparency`, os painéis ficam opacos.
- **WhatsApp e Instagram:** configurados em `site.config.ts` (`whatsappNumero`, `instagramUrl`). O botão flutuante do WhatsApp fica sempre visível; sem número, leva ao formulário de contato em vez de apontar para um número inventado. O ícone do Instagram só aparece com URL válida.
- **Fundo animado (`FundoAnimadoComponent`):** um único `<canvas>` desenha peças (engrenagem, prismas torcidos, cilindro, caixa) sendo impressas camada por camada em projeção isométrica, com o bico percorrendo o contorno e as últimas camadas em laranja.
  Roda fora da zona do Angular (sem detecção de mudanças), limitado a 30 fps e com `devicePixelRatio` até 1,5.
  Pausa sozinho com a aba oculta (`requestAnimationFrame`) e, com `prefers-reduced-motion`, desenha as peças prontas sem animar. Em telas estreitas mostra menos peças.
  As cores vêm dos tokens `--c-fg` e `--c-accent` e são relidas quando o `data-theme` muda.
- **Tema:** script inline no `index.html` aplica `data-theme` antes do Angular (evita o “flash”), e o `TemaService` mantém o estado, salva a escolha e acompanha o sistema enquanto não houver escolha explícita.
- **Vitrine em vez de ilustração estática:** o topo mostra os produtos reais do catálogo (mesma requisição do catálogo, via `CatalogoStore`).
  O avanço automático é guiado pelo `animationend` da barra de progresso, que pausa com `animation-play-state`. Com movimento reduzido, não há rotação automática.
  Slides inativos ficam `inert` e `aria-hidden`, e o anúncio `aria-live` só é ativado quando a rotação está parada. Se o catálogo falhar, a vitrine mostra a marca e um convite ao contato, sem produtos inventados.
- **Ilustrações dos produtos** com fundo transparente: o palco (`.vitrine-palco`) fornece o fundo nos dois temas.
- **Produto como protagonista:** a imagem ocupa o topo do card em 4:3, com dimensões reservadas (`width`/`height`) contra layout shift. As três primeiras imagens carregam com `eager` e as demais com `loading="lazy"`.
- **Diferenciais:** apenas afirmações qualitativas configuráveis. Nenhuma certificação, prazo, capacidade ou número foi inventado.
- **Do catálogo ao contato:** “Solicitar orçamento” pré-seleciona o produto e sugere o assunto. O assunto sugerido só é substituído se o usuário não o tiver editado.
- **Acessibilidade:** link “Pular para o conteúdo”, landmarks (`header`, `nav`, `main`, `footer`), labels associados, `aria-invalid` e `aria-describedby`, foco visível, `aria-pressed` nos filtros, `aria-live` na contagem, `role="status"`/`role="alert"` nas mensagens, diálogo modal nativo com retorno de foco, menu mobile com `aria-expanded` e Escape, e `prefers-reduced-motion`.
- **Desempenho:** animações apenas em CSS, fonte self-hosted (sem requisição ao Google Fonts) e bundle inicial de produção de cerca de 100 KB transferidos (gzip).

## Segurança e LGPD (resumo)

- Coletamos apenas nome, e-mail, assunto, mensagem, produto (opcional) e data. Não há CPF, CNPJ, endereço nem dados financeiros.
- Não existe endpoint **público** que liste contatos (`GET /api/contatos` → 405). A consulta existe apenas em `/api/admin/contatos`, protegida por token, somente leitura e desativada por padrão.
- Respostas sem detalhes internos. Cabeçalhos `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Cache-Control: no-store` em JSON.
- O aviso de privacidade (`/privacidade`) explica finalidade, dados, uso e direitos. O canal de privacidade só aparece se `emailPrivacidade` for configurado.
  **O texto precisa ser revisado pelo responsável pelo tratamento dos dados**, que também deve definir o prazo de retenção. Não há afirmação de conformidade automática.

## Formulário de contato: captcha, demanda e telefone

- **Captcha próprio em vez de reCAPTCHA, hCaptcha ou Turnstile:** não exige conta nem chaves e não envia dados do visitante a terceiros, o que simplifica a LGPD.
  O servidor emite uma soma simples; o token é assinado com HMAC, expira e vale para uma tentativa. Os nonces usados ficam em memória, como no rate limit.
  É uma barreira contra robôs genéricos, somada ao honeypot e ao limite por IP. Um robô feito para este site consegue resolver a soma; se o abuso aparecer, troque por um serviço externo.
- **Demanda:** lista fechada (`DEMANDAS` no backend, rótulos no frontend). A escolha de peça só aparece na demanda “Peça do catálogo”, e o botão “Orçamento” do catálogo já a seleciona.
- **Telefone:** opcional por minimização de dados; é salvo só com os dígitos, não vai para logs e aparece apenas na área administrativa.
