// Produção: por padrão a API é servida na mesma origem (proxy reverso em /api).
// Ajuste apiBaseUrl se o backend ficar em outro domínio (e inclua-o em CORS_ORIGINS no backend).
export const environment = {
  production: true,
  apiBaseUrl: '',
};
