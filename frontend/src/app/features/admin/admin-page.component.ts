import { Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  LogOut,
  LucideAngularModule,
  Mail,
  Moon,
  RotateCw,
  Search,
  Sun,
} from 'lucide-angular';
import { Subscription, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';

import { LogoComponent } from '../../core/layout/logo.component';
import { ContatoAdmin, ContatosAdminMeta } from '../../core/models/admin.model';
import { DEMANDAS, Demanda, rotuloDemanda } from '../../core/models/contato.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { interpretarErroApi } from '../../core/services/api-erro';
import { TemaService } from '../../core/services/tema.service';

export const TOKEN_MINIMO = 32;

type Estado = 'ocioso' | 'carregando' | 'pronto' | 'erro';

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, LogoComponent],
  templateUrl: './admin-page.component.html',
})
export class AdminPageComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AdminAuthService);
  readonly tema = inject(TemaService);

  readonly icones = {
    AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Inbox, LogOut, Mail,
    Moon, RotateCw, Search, Sun,
  };

  readonly formLogin = this.fb.nonNullable.group({
    token: ['', [Validators.required, Validators.minLength(TOKEN_MINIMO)]],
  });
  readonly entrando = signal(false);
  readonly erroLogin = signal<string | null>(null);
  readonly tentouEntrar = signal(false);

  readonly filtros = this.fb.nonNullable.group({ busca: [''], demanda: [''], produto_id: [''] });
  readonly demandas = DEMANDAS;
  readonly rotuloDemanda = rotuloDemanda;

  readonly estado = signal<Estado>('ocioso');
  readonly contatos = signal<ContatoAdmin[]>([]);
  readonly dadosMeta = signal<ContatosAdminMeta | null>(null);
  readonly pagina = signal(1);
  readonly mensagemErro = signal<string | null>(null);
  readonly expandido = signal<number | null>(null);
  readonly copiado = signal<number | null>(null);
  readonly esqueletos = [0, 1, 2, 3];

  readonly filtroAtivo = signal(false);

  readonly textoTotal = computed(() => {
    const total = this.dadosMeta()?.total ?? 0;
    const plural = total !== 1;
    const base = `${total} ${plural ? 'contatos' : 'contato'}`;
    return this.filtroAtivo()
      ? `${base} ${plural ? 'encontrados' : 'encontrado'} com os filtros atuais`
      : `${base} no total`;
  });

  @ViewChild('campoToken') private campoToken?: ElementRef<HTMLInputElement>;
  @ViewChild('tituloLista') private tituloLista?: ElementRef<HTMLElement>;

  private requisicao?: Subscription;

  ngOnInit(): void {
    this.title.setTitle('Área administrativa · Contatos');
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    this.filtros.valueChanges
      .pipe(
        debounceTime(350),
        map((v) => JSON.stringify(v)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.pagina.set(1);
        this.carregar();
      });

    if (this.auth.autenticado()) this.carregar();
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
    this.requisicao?.unsubscribe();
  }

  erroToken(): string | null {
    const c = this.formLogin.controls.token;
    if (!(c.touched || this.tentouEntrar()) || c.valid) return null;
    if (c.hasError('required')) return 'Informe o token de acesso.';
    return `O token tem pelo menos ${TOKEN_MINIMO} caracteres.`;
  }

  entrar(): void {
    this.tentouEntrar.set(true);
    this.erroLogin.set(null);
    if (this.formLogin.invalid || this.entrando()) {
      this.campoToken?.nativeElement.focus();
      return;
    }
    // Ignora espaços e aspas que costumam vir junto ao copiar do .env.
    const token = this.formLogin.controls.token.value.trim().replace(/^["']|["']$/g, '');
    this.entrando.set(true);
    this.api
      .listarContatos(token, { pagina: 1 })
      .pipe(finalize(() => this.entrando.set(false)))
      .subscribe({
        next: (r) => {
          this.auth.entrar(token);
          this.formLogin.reset();
          this.tentouEntrar.set(false);
          this.filtros.reset({ busca: '', demanda: '', produto_id: '' }, { emitEvent: false });
          this.pagina.set(1);
          this.aplicar(r);
          setTimeout(() => this.tituloLista?.nativeElement.focus());
        },
        error: (erro: unknown) => {
          const { status, mensagem } = interpretarErroApi(erro);
          this.erroLogin.set(
            status === 401
              ? 'Token inválido. Confira com `flask admin-token` na pasta do backend.'
              : status === 503
                ? 'A área administrativa não está configurada no servidor (defina ADMIN_TOKEN).'
                : mensagem,
          );
          this.campoToken?.nativeElement.focus();
        },
      });
  }

  carregar(): void {
    const token = this.auth.token();
    if (!token) return;
    const { busca, demanda, produto_id } = this.filtros.getRawValue();
    this.filtroAtivo.set(busca.trim() !== '' || demanda !== '' || produto_id !== '');
    this.requisicao?.unsubscribe();
    this.estado.set('carregando');
    this.mensagemErro.set(null);
    this.requisicao = this.api
      .listarContatos(token, {
        pagina: this.pagina(),
        busca,
        demanda: (demanda || null) as Demanda | null,
        produto_id: produto_id ? Number(produto_id) : null,
      })
      .subscribe({
        next: (r) => this.aplicar(r),
        error: (erro: unknown) => {
          const { status, mensagem } = interpretarErroApi(erro);
          if (status === 401) {
            this.sair('Sua sessão expirou ou o token foi alterado. Entre novamente.');
            return;
          }
          this.mensagemErro.set(mensagem);
          this.estado.set('erro');
        },
      });
  }

  private aplicar({ contatos, meta }: { contatos: ContatoAdmin[]; meta: ContatosAdminMeta }): void {
    this.contatos.set(contatos);
    this.dadosMeta.set(meta);
    this.expandido.set(null);
    this.estado.set('pronto');
  }

  irPagina(pagina: number): void {
    const total = this.dadosMeta()?.paginas ?? 1;
    if (pagina < 1 || pagina > total) return;
    this.pagina.set(pagina);
    this.carregar();
    this.tituloLista?.nativeElement.focus();
  }

  limparFiltros(): void {
    this.filtros.setValue({ busca: '', demanda: '', produto_id: '' });
  }

  sair(motivo: string | null = null): void {
    this.requisicao?.unsubscribe();
    this.auth.sair();
    this.contatos.set([]);
    this.dadosMeta.set(null);
    this.estado.set('ocioso');
    this.erroLogin.set(motivo);
    setTimeout(() => this.campoToken?.nativeElement.focus());
  }

  alternar(id: number): void {
    this.expandido.update((atual) => (atual === id ? null : id));
  }

  formatarData(iso: string): string {
    const data = new Date(iso);
    return Number.isNaN(data.getTime()) ? iso : FORMATO_DATA.format(data);
  }

  linkResposta(c: ContatoAdmin): string {
    return `mailto:${c.email_cliente}?subject=${encodeURIComponent('Re: ' + c.assunto)}`;
  }

  async copiarEmail(c: ContatoAdmin): Promise<void> {
    try {
      await navigator.clipboard.writeText(c.email_cliente);
      this.copiado.set(c.id);
      setTimeout(() => this.copiado.update((id) => (id === c.id ? null : id)), 2000);
    } catch {
      /* sem permissão de área de transferência: o e-mail continua visível para cópia manual */
    }
  }
}
