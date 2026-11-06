# API REST

Base (desenvolvimento): `http://127.0.0.1:5000/api`. Todas as respostas são JSON (UTF-8).

## Contrato

Sucesso:

```json
{ "success": true, "data": <objeto ou lista>, "meta": { ... }, "message": "..." }
```

`meta` e `message` só aparecem quando aplicáveis.

Erro (todas as rotas, inclusive 404/405/413/415/429/500 do Flask):

```json
{ "success": false, "message": "Texto para o usuário.", "errors": { "campo": ["mensagem"] } }
```

`errors` só aparece em erros de validação por campo. Nunca são retornados stack traces, SQL ou caminhos internos.

| Código | Quando |
| --- | --- |
| 200 | Consulta bem-sucedida (inclusive lista vazia) |
| 201 | Contato gravado (resposta enviada só após o `COMMIT`) |
| 400 | JSON malformado, corpo que não é objeto, honeypot preenchido |
| 401 | Área administrativa: token ausente ou inválido |
| 404 | Produto inexistente **ou inativo**; rota inexistente |
| 405 | Método não permitido (ex.: `GET /api/contatos`, pois não há listagem pública) |
| 413 | Corpo maior que `MAX_CONTENT_LENGTH` (padrão 16 KB) |
| 415 | `Content-Type` diferente de `application/json` no POST |
| 422 | Falha de validação (Pydantic) ou produto indisponível |
| 429 | Limite de envios por IP excedido, ou excesso de tentativas inválidas na área administrativa |
| 500 | Falha de persistência ou erro inesperado (mensagem genérica) |
| 503 | Área administrativa não configurada (`ADMIN_TOKEN` vazio ou com menos de 32 caracteres) |

---

## GET /api/produtos

Lista **apenas produtos ativos**, ordenados por categoria e nome.

Parâmetros opcionais (query string):

| Parâmetro | Regra |
| --- | --- |
| `categoria` | igualdade sem diferenciar maiúsculas; máx. 80 caracteres |
| `busca` | trecho do nome **ou** da descrição, sem diferenciar acentos nem maiúsculas (`organizacao` encontra “Organização” e vice-versa); curingas `%`/`_` escapados; máx. 100 caracteres |

`meta.categorias` traz todas as categorias com produtos ativos, independentemente do filtro (usado para montar os filtros da interface).

```http
GET /api/produtos?categoria=Organização
```

```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "nome": "Clipe para cabos (demo)",
      "descricao": "Item demonstrativo. Presilha em C para organizar cabos em mesas e painéis.",
      "especificacao_tecnica": [],
      "imagem_url": "/static/produtos/clipe.svg",
      "categoria": "Organização"
    },
    {
      "id": 7,
      "nome": "Organizador colmeia (demo)",
      "descricao": "Item demonstrativo. Organizador modular de mesa com células hexagonais...",
      "especificacao_tecnica": [
        { "rotulo": "Processo", "valor": "FDM (exemplo)" },
        { "rotulo": "Módulos", "valor": "Células hexagonais" }
      ],
      "imagem_url": "/static/produtos/organizador.svg",
      "categoria": "Organização"
    }
  ],
  "meta": {
    "total": 2,
    "categorias": ["Componentes mecânicos", "Decoração e design", "Gabinetes e invólucros", "Organização"]
  }
}
```

Sem resultados: `{"success": true, "data": [], "meta": {"total": 0, "categorias": [...]}}`.

`imagem_url` relativo (`/static/...`) é servido pelo próprio Flask. O frontend o prefixa com `apiBaseUrl`.
O campo `status` não é exposto.

## GET /api/produtos/{id}

```http
GET /api/produtos/1
```

```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "Engrenagem de dentes retos (demo)",
    "descricao": "Item demonstrativo. Engrenagem de dentes retos com furo central, ...",
    "especificacao_tecnica": [
      { "rotulo": "Processo", "valor": "FDM (exemplo)" },
      { "rotulo": "Material", "valor": "PETG (exemplo)" },
      { "rotulo": "Dentes", "valor": "18" }
    ],
    "imagem_url": "/static/produtos/engrenagem.svg",
    "categoria": "Componentes mecânicos"
  }
}
```

Produto inexistente ou inativo (`GET /api/produtos/9`):

```json
{ "success": false, "message": "Produto não encontrado." }
```

## GET /api/contatos/captcha

Devolve um desafio para o formulário de contato. Resposta com `Cache-Control: no-store`.

```json
{ "success": true, "data": { "pergunta": "Quanto é 4 + 7?", "token": "1793400000.aBc.<assinatura>" } }
```

O token é assinado com HMAC, vale 30 minutos (`CAPTCHA_VALIDADE`) e serve para **uma única tentativa**, certa ou errada. A resposta não vai no token.

## POST /api/contatos

`Content-Type: application/json`. Campos desconhecidos são rejeitados (`extra="forbid"`), e os tipos são estritos (`"1"` não é aceito como `produto_id`).

| Campo | Tipo | Regras |
| --- | --- | --- |
| `nome_cliente` | string | obrigatório; espaços nas pontas removidos; 2–100 |
| `email_cliente` | string | obrigatório; até 254; validado e normalizado com `email-validator` (sem consulta DNS) |
| `telefone` | string ou `null` | opcional; aceita dígitos, `+`, `(`, `)`, `-` e espaços, até 20 caracteres; 10–13 dígitos; salvo só com os dígitos |
| `demanda` | string | obrigatório; `orcamento_projeto`, `prototipagem`, `producao_lote`, `modelagem_3d`, `peca_catalogo`, `reposicao` ou `outro` |
| `assunto` | string | obrigatório; 3–120 |
| `mensagem` | string | obrigatório; 10–2000 |
| `produto_id` | inteiro ou `null` | opcional; > 0; deve existir e estar **ativo** |
| `website` | string | honeypot anti-spam: deve estar vazio ou ausente |
| `captcha_token` | string | obrigatório com `CAPTCHA_ATIVO=1`; vem de `GET /api/contatos/captcha` |
| `captcha_resposta` | string | obrigatório com `CAPTCHA_ATIVO=1`; resposta da pergunta |

`data_envio` é definido pelo servidor (UTC) e não é aceito do cliente.

Exemplo (`backend/exemplos/contato.json`, que não traz os campos do captcha: para enviá-lo como está, use `CAPTCHA_ATIVO=0` em desenvolvimento):

```bash
curl -X POST http://127.0.0.1:5000/api/contatos \
  -H "Content-Type: application/json" \
  --data-binary @backend/exemplos/contato.json
```

**201 Created**

```json
{
  "success": true,
  "message": "Mensagem recebida. Retornaremos pelo e-mail informado.",
  "data": { "id": 3, "data_envio": "2026-10-27T16:09:43.336271+00:00", "demanda": "peca_catalogo", "produto_id": 1 }
}
```

A resposta não devolve nome, e-mail, telefone nem mensagem (minimização).

Com `NOTIFICACAO_ATIVA=1` (e SMTP configurado), o servidor envia um aviso por e-mail a `NOTIFICACAO_DESTINO` **depois** do `COMMIT`.
O envio não altera o contrato: uma falha de SMTP é só registrada no log e a resposta continua 201. Como o envio é síncrono, um SMTP lento pode atrasar a resposta até `SMTP_TIMEOUT` segundos.

**422: validação**

```json
{
  "success": false,
  "message": "Verifique os campos enviados.",
  "errors": {
    "assunto": ["Informe ao menos 3 caracteres."],
    "email_cliente": ["Informe um e-mail válido."],
    "mensagem": ["Informe ao menos 10 caracteres."]
  }
}
```

Outras mensagens por campo: `"Campo obrigatório."`, `"Use no máximo N caracteres."`, `"Deve ser um texto."`, `"Deve ser um número inteiro."`, `"Campo não permitido."` `"Selecione uma opção válida."` (`demanda`), `"Informe um telefone válido com DDD."` (`telefone`), `"Resposta incorreta ou expirada. Responda à nova pergunta."` (`captcha_resposta`) e, para `produto_id`, `"O produto selecionado não está disponível."`.

**400: JSON inválido**

```json
{ "success": false, "message": "JSON inválido ou malformado." }
```

**429: limite de envios** (padrão: 5 por IP a cada 600 s; `CONTATO_RATE_LIMIT` / `CONTATO_RATE_WINDOW`; sobre o IP considerado, veja [IP do cliente](#ip-do-cliente-e-proxy-reverso))

```json
{ "success": false, "message": "Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente." }
```

**500: falha de persistência** (rollback executado; detalhe apenas no log do servidor, sem dados pessoais)

```json
{ "success": false, "message": "Não foi possível registrar sua mensagem agora. Tente novamente em instantes." }
```

## GET /api/admin/contatos (restrito)

Consulta somente leitura dos contatos recebidos. Exige `Authorization: Bearer <ADMIN_TOKEN>`.
O token é comparado em tempo constante. Tentativas inválidas por IP são limitadas (`ADMIN_FALHAS_LIMITE` a cada `ADMIN_FALHAS_JANELA` s, padrão 10 em 900 s) e respondem 429 ao exceder.

| Parâmetro | Regra |
| --- | --- |
| `pagina` | inteiro ≥ 1 (padrão 1) |
| `por_pagina` | 1–100 (padrão 20) |
| `busca` | trecho do nome, e-mail ou assunto, sem diferenciar acentos nem maiúsculas; máx. 100 caracteres |
| `produto_id` | inteiro > 0; filtra pelo produto (ativo ou inativo) |

Parâmetros desconhecidos ou fora das regras → 422. Ordenação: mais recentes primeiro.

```http
GET /api/admin/contatos?pagina=1&por_pagina=20
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "nome_cliente": "Maria Exemplo",
      "email_cliente": "maria@example.com",
      "telefone": "11912345678",
      "demanda": "peca_catalogo",
      "assunto": "Orçamento: Engrenagem de dentes retos (demo)",
      "mensagem": "Gostaria de um orçamento para 10 unidades.",
      "data_envio": "2026-10-27T17:47:00.123456+00:00",
      "produto": { "id": 1, "nome": "Engrenagem de dentes retos (demo)", "status": "ativo" }
    }
  ],
  "meta": {
    "total": 1,
    "pagina": 1,
    "por_pagina": 20,
    "paginas": 1,
    "produtos": [{ "id": 1, "nome": "Engrenagem de dentes retos (demo)", "status": "ativo" }]
  }
}
```

`meta.produtos` lista os produtos que têm ao menos um contato (para o filtro da interface).

Sem token ou token errado (401):

```json
{ "success": false, "message": "Token de acesso inválido." }
```

Área desativada (503):

```json
{ "success": false, "message": "Área administrativa não configurada." }
```

## GET /api/health

```json
{ "success": true, "data": { "status": "ok" } }
```

## IP do cliente e proxy reverso

O limite de envios de contato e o bloqueio de tentativas inválidas do admin contam por IP.

- `TRUSTED_PROXIES=0` (padrão): vale o IP da conexão; `X-Forwarded-For` e demais `X-Forwarded-*` são ignorados, para que um cliente não falsifique o IP.
- `TRUSTED_PROXIES=N` (N ≥ 1): a aplicação usa o `ProxyFix` do Werkzeug e confia nos últimos N saltos de `X-Forwarded-For`, `X-Forwarded-Proto` e `X-Forwarded-Host`. Use o número exato de proxies na frente da API (normalmente 1).

## CORS

Aplicado apenas a `/api/*`, para as origens em `CORS_ORIGINS`, com os métodos `GET`, `POST` e `OPTIONS`, os cabeçalhos `Content-Type` e `Authorization` (usado só pela área administrativa) e sem credenciais de cookie.
Origens não listadas não recebem `Access-Control-Allow-Origin`.
