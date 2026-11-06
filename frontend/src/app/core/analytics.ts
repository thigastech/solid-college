import { inject as injetarVercelAnalytics, type BeforeSendEvent } from '@vercel/analytics';

import { environment } from '../../environments/environment';

/**
 * Vercel Web Analytics (temporário, enquanto o site estiver hospedado na Vercel).
 *
 * Sem cookies; a Vercel conta visitas de forma agregada. O script e o envio
 * ficam na mesma origem do site, então a CSP ('self') não precisa ser ampliada.
 * Só roda no build de produção: em desenvolvimento e nos testes nada é enviado.
 */
export function iniciarAnalytics(): void {
  if (!environment.production) return;
  injetarVercelAnalytics({ mode: 'production', beforeSend: filtrarEvento });
}

/**
 * Minimização: não conta a área administrativa e remove query string e âncora,
 * para que nenhum parâmetro digitado ou colado na URL chegue ao analytics.
 */
export function filtrarEvento(evento: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try {
    url = new URL(evento.url);
  } catch {
    return null;
  }
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return null;
  url.search = '';
  url.hash = '';
  return { ...evento, url: url.toString() };
}
