import { Component, ElementRef, ViewChild, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AlertCircle, CheckCircle2, Loader2, LucideAngularModule, RotateCw, Send, X } from 'lucide-angular';

import { ContatoPayload, DEMANDAS, Demanda, DesafioCaptcha, LIMITES_CONTATO as L, rotuloDemanda } from '../../core/models/contato.model';
import { interpretarErroApi } from '../../core/services/api-erro';
import { CatalogoStore } from '../../core/services/catalogo.store';
import { ContatoService } from '../../core/services/contato.service';
import { SelecaoProdutoService } from '../../core/services/selecao-produto.service';

type Campo = 'nome_cliente' | 'email_cliente' | 'telefone' | 'demanda' | 'produto_id' | 'assunto' | 'mensagem' | 'captcha_resposta';

const ORDEM_CAMPOS: Campo[] = ['nome_cliente', 'email_cliente', 'telefone', 'demanda', 'produto_id', 'assunto', 'mensagem', 'captcha_resposta'];
/** Demanda que habilita a escolha de uma peça do catálogo. */
export const DEMANDA_CATALOGO: Demanda = 'peca_catalogo';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Rejeita valores compostos apenas por espaços (o backend também remove espaços). */
function naoVazio(controle: AbstractControl<string | null>): ValidationErrors | null {
  const valor = controle.value ?? '';
  return valor.length > 0 && valor.trim().length === 0 ? { required: true } : null;
}

/** Telefone é opcional; se informado, precisa ter DDD (mesma regra do backend). */
function telefoneValido(controle: AbstractControl<string | null>): ValidationErrors | null {
  const valor = (controle.value ?? '').trim();
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '').length;
  const valido = /^[+()\d\s-]+$/.test(valor) && digitos >= L.telefoneDigitosMin && digitos <= L.telefoneDigitosMax;
  return valido ? null : { telefone: true };
}

@Component({
  selector: 'app-contato-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './contato-form.component.html',
})
export class ContatoFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly contatoService = inject(ContatoService);
  private readonly selecao = inject(SelecaoProdutoService);
  readonly store = inject(CatalogoStore);

  readonly L = L;
  readonly demandas = DEMANDAS;
  readonly DEMANDA_CATALOGO = DEMANDA_CATALOGO;
  readonly icones = { Send, Loader2, CheckCircle2, AlertCircle, X, RotateCw };

  readonly form = this.fb.group({
    nome_cliente: ['', [Validators.required, naoVazio, Validators.minLength(L.nomeMin), Validators.maxLength(L.nomeMax)]],
    email_cliente: ['', [Validators.required, Validators.maxLength(L.emailMax), Validators.pattern(EMAIL_REGEX)]],
    telefone: ['', [telefoneValido, Validators.maxLength(L.telefoneMax)]],
    demanda: this.fb.control<Demanda | ''>('', Validators.required),
    produto_id: this.fb.control<number | null>(null),
    assunto: ['', [Validators.required, naoVazio, Validators.minLength(L.assuntoMin), Validators.maxLength(L.assuntoMax)]],
    mensagem: ['', [Validators.required, naoVazio, Validators.minLength(L.mensagemMin), Validators.maxLength(L.mensagemMax)]],
    website: [''],
    captcha_resposta: ['', [Validators.required, Validators.pattern(/^\s*\d{1,2}\s*$/)]],
  });

  readonly desafio = signal<DesafioCaptcha | null>(null);
  readonly desafioFalhou = signal(false);

  readonly enviando = signal(false);
  readonly sucesso = signal<string | null>(null);
  readonly erroGeral = signal<string | null>(null);

  @ViewChild('alertaSucesso') private alertaSucesso?: ElementRef<HTMLElement>;
  @ViewChild('alertaErro') private alertaErro?: ElementRef<HTMLElement>;
  @ViewChild('formEl') private formEl?: ElementRef<HTMLFormElement>;

  private assuntoAutomatico: string | null = null;

  constructor() {
    this.carregarDesafio();

    // Catálogo → formulário: mantém o campo sincronizado com a seleção.
    effect(() => {
      const produto = this.selecao.selecionado();
      untracked(() => {
        const controle = this.form.controls.produto_id;
        if (controle.value !== (produto?.id ?? null)) {
          controle.setValue(produto?.id ?? null, { emitEvent: false });
        }
        if (produto) {
          this.form.controls.demanda.setValue(DEMANDA_CATALOGO, { emitEvent: false });
          this.sugerirAssunto(`Orçamento: ${produto.nome}`);
        }
      });
    });

    // A peça do catálogo só faz sentido na demanda "Peça do catálogo".
    this.form.controls.demanda.valueChanges.pipe(takeUntilDestroyed()).subscribe((demanda) => {
      if (demanda !== DEMANDA_CATALOGO && this.form.controls.produto_id.value !== null) {
        this.form.controls.produto_id.setValue(null);
      }
      if (demanda && demanda !== DEMANDA_CATALOGO) this.sugerirAssunto(rotuloDemanda(demanda));
    });

    // Formulário → seleção compartilhada.
    this.form.controls.produto_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const produto = id === null ? null : this.store.buscarPorId(Number(id)) ?? null;
      this.selecao.selecionar(produto);
    });

    // Qualquer edição após um envio dispensa a mensagem de sucesso anterior.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.sucesso() && this.form.dirty) this.sucesso.set(null);
    });
  }

  get tamanhoMensagem(): number {
    return this.form.controls.mensagem.value?.length ?? 0;
  }

  erroDe(campo: Campo): string | null {
    const c = this.form.controls[campo];
    if (!c.errors || !(c.touched || c.dirty)) return null;
    const e = c.errors;
    if (e['servidor']) return e['servidor'] as string;
    if (e['required']) return campo === 'demanda' ? 'Selecione o tipo de demanda.' : 'Campo obrigatório.';
    if (e['telefone']) return 'Informe um telefone válido com DDD.';
    if (e['pattern']) {
      return campo === 'captcha_resposta' ? 'Responda só com números.' : 'Informe um e-mail válido, por exemplo nome@empresa.com.';
    }
    if (e['minlength']) return `Informe ao menos ${e['minlength'].requiredLength} caracteres.`;
    if (e['maxlength']) return `Use no máximo ${e['maxlength'].requiredLength} caracteres.`;
    return 'Valor inválido.';
  }

  removerProduto(): void {
    this.form.controls.produto_id.setValue(null);
  }

  carregarDesafio(): void {
    this.desafio.set(null);
    this.desafioFalhou.set(false);
    this.contatoService.desafioCaptcha().subscribe({
      next: (resp) => this.desafio.set(resp.data),
      error: () => this.desafioFalhou.set(true),
    });
  }

  enviar(): void {
    if (this.enviando()) return;
    this.erroGeral.set(null);
    this.sucesso.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarPrimeiroInvalido();
      return;
    }

    const desafio = this.desafio();
    if (!desafio) {
      this.erroGeral.set('A verificação ainda não foi carregada. Seus dados foram mantidos; tente novamente.');
      if (this.desafioFalhou()) this.carregarDesafio();
      return;
    }

    const v = this.form.getRawValue();
    const payload: ContatoPayload = {
      nome_cliente: (v.nome_cliente ?? '').trim(),
      email_cliente: (v.email_cliente ?? '').trim(),
      telefone: (v.telefone ?? '').trim() || null,
      demanda: v.demanda as Demanda,
      assunto: (v.assunto ?? '').trim(),
      mensagem: (v.mensagem ?? '').trim(),
      produto_id: v.demanda === DEMANDA_CATALOGO && v.produto_id !== null ? Number(v.produto_id) : null,
      website: v.website ?? '',
      captcha_token: desafio.token,
      captcha_resposta: (v.captcha_resposta ?? '').trim(),
    };

    this.enviando.set(true);
    this.contatoService
      .enviar(payload)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (resp) => {
          // Tira o foco do campo antes de limpar, para o "blur" não marcá-lo como tocado.
          (document.activeElement as HTMLElement | null)?.blur();
          this.form.reset(
            { nome_cliente: '', email_cliente: '', telefone: '', demanda: '', produto_id: null, assunto: '', mensagem: '', website: '', captcha_resposta: '' },
            { emitEvent: false },
          );
          this.assuntoAutomatico = null;
          this.selecao.limpar();
          this.carregarDesafio();
          this.sucesso.set(resp.message ?? 'Mensagem enviada com sucesso.');
          setTimeout(() => this.alertaSucesso?.nativeElement.focus());
        },
        error: (erro: unknown) => {
          const { mensagem, campos } = interpretarErroApi(erro);
          // Um desafio não pode ser repetido: toda falha traz uma nova pergunta.
          this.form.controls.captcha_resposta.reset('');
          this.carregarDesafio();
          let algumCampo = false;
          for (const [campo, msgs] of Object.entries(campos)) {
            const controle = this.form.get(campo);
            if (controle && msgs.length) {
              controle.setErrors({ ...(controle.errors ?? {}), servidor: msgs[0] });
              controle.markAsTouched();
              algumCampo = true;
            }
          }
          this.erroGeral.set(
            algumCampo ? `${mensagem} Corrija os campos destacados e envie novamente.` : `${mensagem} Seus dados foram mantidos.`,
          );
          setTimeout(() => this.alertaErro?.nativeElement.focus());
        },
      });
  }

  private sugerirAssunto(texto: string): void {
    const controle = this.form.controls.assunto;
    const atual = controle.value ?? '';
    if (atual === '' || atual === this.assuntoAutomatico) {
      const limitado = texto.slice(0, L.assuntoMax);
      controle.setValue(limitado);
      this.assuntoAutomatico = limitado;
    }
  }

  private focarPrimeiroInvalido(): void {
    const campo = ORDEM_CAMPOS.find((c) => this.form.controls[c].invalid);
    if (campo) this.formEl?.nativeElement.querySelector<HTMLElement>(`#${campo}`)?.focus();
  }
}
