# Frontend (Angular 17)

Instruções completas no [README principal](../README.md).

```bash
npm install
npm start                                  # http://localhost:4200 (API em http://localhost:5000)
npx ng test --watch=false                  # testes (Chrome)
npx ng test --watch=false --browsers=ChromeHeadlessCI
npx ng build                               # produção → dist/frontend/browser
```

Personalização:

- Nome e slogan da marca, textos, canais de contato e diferenciais: `src/app/core/config/site.config.ts`
- Cores (temas claro e escuro) e vidro: `src/styles.css`
- Fundo animado (peças sendo impressas): `src/app/core/layout/fundo-animado.component.ts`
- URL da API: `src/environments/`
