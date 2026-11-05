"""Captcha próprio: desafio de soma validado no servidor, sem serviços de terceiros.

O token leva validade e nonce, assinados com HMAC junto com a resposta; a resposta
em si não vai para o navegador. Cada token vale para uma única tentativa, certa ou
errada, o que impede testar as respostas possíveis.

Limitação conhecida: os nonces usados ficam em memória, como no rate limit. Com mais
de um processo, defina CAPTCHA_SEGREDO; um robô feito sob medida para este site ainda
consegue resolver a soma, por isso o captcha se soma ao honeypot e ao limite por IP.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time

from flask import current_app


class _NoncesUsados:
    def __init__(self) -> None:
        self._nonces: dict[str, float] = {}
        self._lock = threading.Lock()

    def consumir(self, nonce: str, validade: float) -> bool:
        """Registra o nonce; retorna False se ele já tiver sido usado."""
        agora = time.time()
        with self._lock:
            self._nonces = {n: v for n, v in self._nonces.items() if v > agora}
            if nonce in self._nonces:
                return False
            self._nonces[nonce] = validade
            return True

    def limpar(self) -> None:
        with self._lock:
            self._nonces.clear()


nonces_usados = _NoncesUsados()


def _assinatura(validade: int, nonce: str, resposta: str) -> str:
    segredo = current_app.config["CAPTCHA_SEGREDO"].encode()
    return hmac.new(segredo, f"{validade}.{nonce}.{resposta}".encode(), hashlib.sha256).hexdigest()


def gerar_desafio() -> dict[str, str]:
    a, b = secrets.randbelow(9) + 1, secrets.randbelow(9) + 1
    validade = int(time.time()) + current_app.config["CAPTCHA_VALIDADE"]
    nonce = secrets.token_urlsafe(16)
    token = f"{validade}.{nonce}.{_assinatura(validade, nonce, str(a + b))}"
    return {"pergunta": f"Quanto é {a} + {b}?", "token": token}


def validar(token: object, resposta: object) -> bool:
    if not isinstance(token, str) or not isinstance(resposta, str):
        return False
    partes = token.split(".")
    if len(partes) != 3 or not partes[0].isdecimal():
        return False
    validade, nonce, assinatura = int(partes[0]), partes[1], partes[2]
    if validade < time.time():
        return False

    def confere(resposta_testada: str) -> bool:
        return hmac.compare_digest(assinatura.encode(), _assinatura(validade, nonce, resposta_testada).encode())

    # Só tokens emitidos aqui ocupam memória; a soma de dois dígitos vai de 2 a 18.
    if not any(confere(str(soma)) for soma in range(2, 19)):
        return False
    return nonces_usados.consumir(nonce, validade) and confere(resposta.strip())
