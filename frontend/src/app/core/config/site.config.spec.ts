import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WhatsappFlutuanteComponent } from '../layout/whatsapp-flutuante.component';
import { SITE_CONFIG, SITE_CONFIG_PADRAO, SiteConfig, linkInstagram, linkWhatsapp } from './site.config';

const com = (extra: Partial<SiteConfig>): SiteConfig => ({ ...SITE_CONFIG_PADRAO, ...extra });

describe('Canais externos (site.config)', () => {
  it('não gera links enquanto os canais não forem configurados', () => {
    expect(linkInstagram(SITE_CONFIG_PADRAO)).toBeNull();
    expect(linkWhatsapp(SITE_CONFIG_PADRAO)).toBeNull();
  });

  it('aceita só URLs https do Instagram', () => {
    expect(linkInstagram(com({ instagramUrl: 'https://www.instagram.com/solid3d/' }))).toBe('https://www.instagram.com/solid3d/');
    expect(linkInstagram(com({ instagramUrl: 'https://instagram.com/solid3d?igsh=abc' }))).not.toBeNull();
    expect(linkInstagram(com({ instagramUrl: 'http://instagram.com/solid3d' }))).toBeNull();
    expect(linkInstagram(com({ instagramUrl: 'https://exemplo.com/solid3d' }))).toBeNull();
    expect(linkInstagram(com({ instagramUrl: 'javascript:alert(1)' }))).toBeNull();
  });

  it('monta o link wa.me só com dígitos e a mensagem inicial codificada', () => {
    const link = linkWhatsapp(com({ whatsappNumero: '+55 (11) 90000-0000', whatsappMensagem: 'Olá & oi' }));
    expect(link).toBe('https://wa.me/5511900000000?text=Ol%C3%A1%20%26%20oi');
    expect(linkWhatsapp(com({ whatsappNumero: '1234' }))).toBeNull();
  });

  it('leva ao WhatsApp com número configurado e ao formulário sem ele', () => {
    TestBed.configureTestingModule({
      imports: [WhatsappFlutuanteComponent],
      providers: [provideRouter([]), { provide: SITE_CONFIG, useValue: com({ whatsappNumero: '5511900000000' }) }],
    });
    const fixture = TestBed.createComponent(WhatsappFlutuanteComponent);
    fixture.detectChanges();
    const a = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(a.getAttribute('href')).toContain('https://wa.me/5511900000000');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('aria-label')).toContain('WhatsApp');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [WhatsappFlutuanteComponent], providers: [provideRouter([])] });
    const semNumero = TestBed.createComponent(WhatsappFlutuanteComponent);
    semNumero.detectChanges();
    const fallback = (semNumero.nativeElement as HTMLElement).querySelector('a')!;
    expect(fallback.getAttribute('href')).toBe('/#contato');
    expect(fallback.getAttribute('target')).toBeNull();
    expect(fallback.getAttribute('aria-label')).toBe('Ir para o formulário de contato');
  });
});
