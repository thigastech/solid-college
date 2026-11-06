import type { BeforeSendEvent } from '@vercel/analytics';

import { filtrarEvento } from './analytics';

describe('filtrarEvento (Vercel Analytics)', () => {
  const evento = (url: string): BeforeSendEvent => ({ type: 'pageview', url });

  it('remove query string e âncora', () => {
    expect(filtrarEvento(evento('https://site.test/catalogo?busca=nome%40email.com#topo'))?.url).toBe(
      'https://site.test/catalogo',
    );
  });

  it('não envia visitas à área administrativa', () => {
    expect(filtrarEvento(evento('https://site.test/admin'))).toBeNull();
    expect(filtrarEvento(evento('https://site.test/admin/contatos?pagina=2'))).toBeNull();
  });

  it('mantém as demais páginas', () => {
    expect(filtrarEvento(evento('https://site.test/privacidade'))?.url).toBe('https://site.test/privacidade');
    expect(filtrarEvento(evento('https://site.test/administracao'))).not.toBeNull();
  });

  it('descarta URLs inválidas', () => {
    expect(filtrarEvento(evento('não é url'))).toBeNull();
  });
});
