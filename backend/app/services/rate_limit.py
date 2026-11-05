"""Limitador de taxa em memória, proporcional a um MVP de processo único.

Limitação conhecida: o estado é perdido ao reiniciar e não é compartilhado
entre múltiplos processos/workers. Atrás de proxy reverso, configure
ProxyFix para que remote_addr reflita o IP real do visitante.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self) -> None:
        self._eventos: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def permitir(self, chave: str, limite: int, janela: int) -> bool:
        agora = time.monotonic()
        with self._lock:
            fila = self._eventos[chave]
            while fila and agora - fila[0] > janela:
                fila.popleft()
            if len(fila) >= limite:
                return False
            fila.append(agora)
            return True

    def limpar(self) -> None:
        with self._lock:
            self._eventos.clear()


limitador_contatos = RateLimiter()
limitador_admin = RateLimiter()
