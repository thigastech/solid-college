import { InjectionToken } from '@angular/core';
export interface Diferencial {
  titulo: string;
  descricao: string;
}

export interface SiteConfig {
  nomeMarca: string;
  /** Linha de apoio do logotipo. */
  slogan: string | null;
  descricaoInstitucional: string;
  /** Canal comercial. Deixe null para não exibir nenhum contato direto. */
  emailContato: string | null;
  /** Canal para solicitações de privacidade (LGPD). null = não configurado. */
  emailPrivacidade: string | null;
  /** Perfil do Instagram (URL https completa). null = ícone oculto. */
  instagramUrl: string | null;
  /** WhatsApp comercial: DDI + DDD + número, só dígitos. null = o botão leva ao formulário de contato. */
  whatsappNumero: string | null;
  /** Mensagem que já vem escrita ao abrir a conversa no WhatsApp. */
  whatsappMensagem: string;
  diferenciais: Diferencial[];
}

export const SITE_CONFIG_PADRAO: SiteConfig = {
  nomeMarca: 'SOLID',
  slogan: 'Desde 2026',
  descricaoInstitucional:
    'Estúdio de fabricação digital dedicado a peças e produtos impressos em 3D, do projeto à peça final.',
  emailContato: null,
  emailPrivacidade: null,
  // Preencha com os canais oficiais. Sem URL, o ícone do Instagram não aparece.
  instagramUrl: null,
  whatsappNumero: null,
  whatsappMensagem: 'Olá! Vim pelo site e gostaria de falar sobre um projeto de impressão 3D.',
  diferenciais: [
    {
      titulo: 'Sob medida',
      descricao: 'A peça é modelada a partir das medidas e do uso que você descrever.',
    },
    {
      titulo: 'Detalhes combinados antes',
      descricao: 'Encaixes, tolerâncias e acabamento são definidos com você antes da impressão.',
    },
    {
      titulo: 'Quantidade flexível',
      descricao: 'Uma unidade para teste ou um lote pequeno.',
    },
    {
      titulo: 'Resposta por e-mail',
      descricao: 'Descreva o projeto no formulário e respondemos no e-mail informado.',
    },
  ],
};

/** Link do Instagram, só se for uma URL https válida. */
export function linkInstagram(config: SiteConfig): string | null {
  const url = config.instagramUrl?.trim();
  return url && /^https:\/\/(www\.)?instagram\.com\/[\w.\-]+\/?(\?\S*)?$/i.test(url) ? url : null;
}

/** Link wa.me do WhatsApp comercial, só se o número tiver de 10 a 15 dígitos. */
export function linkWhatsapp(config: SiteConfig): string | null {
  const numero = (config.whatsappNumero ?? '').replace(/\D/g, '');
  if (numero.length < 10 || numero.length > 15) return null;
  const texto = config.whatsappMensagem.trim();
  return `https://wa.me/${numero}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

export const SITE_CONFIG = new InjectionToken<SiteConfig>('SITE_CONFIG', {
  providedIn: 'root',
  factory: () => SITE_CONFIG_PADRAO,
});
