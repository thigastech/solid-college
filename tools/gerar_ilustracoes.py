"""Gera ilustrações SVG isométricas das peças DEMONSTRATIVAS do catálogo.

São renderizações vetoriais simples (extrusões com linhas de camada),
usadas como placeholder até existirem fotografias reais dos produtos.

Uso (a partir da raiz do projeto):
    python tools/gerar_ilustracoes.py
"""
from __future__ import annotations

import colorsys
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO_PRODUTOS = RAIZ / "backend" / "app" / "static" / "produtos"

COS30 = math.cos(math.pi / 6)
LUZ = (0.35 / math.hypot(0.35, 1.0), 1.0 / math.hypot(0.35, 1.0))
CAMADA = 0.045


# ---------------------------------------------------------------- geometria
def area(poly):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1])) / 2


def ccw(poly):
    return poly if area(poly) > 0 else poly[::-1]


def circulo(r, n=72, cx=0.0, cy=0.0, fase=0.0):
    return [(cx + r * math.cos(fase + 2 * math.pi * i / n), cy + r * math.sin(fase + 2 * math.pi * i / n)) for i in range(n)]


def retangulo_arredondado(w, h, r, cx=0.0, cy=0.0, n=8):
    pts = []
    for qx, qy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ccx, ccy = cx + qx * (w / 2 - r), cy + qy * (h / 2 - r)
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    return pts


def proj(p):
    x, y, z = p
    return ((x - y) * COS30, (x + y) * 0.5 - z)


def cor(h, s, l, fator=1.0):
    r, g, b = colorsys.hls_to_rgb(h / 360, max(0, min(1, l * fator)), s)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


class Cena:
    def __init__(self):
        self.prims = []  # (tipo, dados)

    def prisma(self, poly, z0, z1, hsl, furos=(), lados=True, camadas=True, fundo_furo="#07090c", topo=True, contorno=True):
        poly = ccw(list(poly))
        furos = [ccw(list(f)) for f in furos]
        h, s, l = hsl

        for furo in furos:
            # O interior do furo só é visível através da abertura no topo.
            self.prims.append(("clip", [(x, y, z1) for x, y in furo]))
            self.prims.append(("poly", [(x, y, z0) for x, y in furo], fundo_furo, None))
            paredes = []
            for (x1, y1), (x2, y2) in zip(furo, furo[1:] + furo[:1]):
                nx, ny = -(y2 - y1), (x2 - x1)
                if nx + ny > 1e-9:
                    k = 0.35 + 0.35 * max(0.0, (nx * LUZ[0] + ny * LUZ[1]) / math.hypot(nx, ny))
                    paredes.append(((x1 + x2) + (y1 + y2), [(x1, y1, z0), (x2, y2, z0), (x2, y2, z1), (x1, y1, z1)], cor(h, s, l, k)))
            for _, pts, c in sorted(paredes, key=lambda t: t[0]):
                self.prims.append(("poly", pts, c, c))
            self.prims.append(("fim_clip", []))

        if lados:
            faces = []
            for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
                nx, ny = (y2 - y1), -(x2 - x1)
                if nx + ny > 1e-9:
                    k = 0.5 + 0.42 * max(-0.3, (nx * LUZ[0] + ny * LUZ[1]) / math.hypot(nx, ny))
                    faces.append(((x1 + x2) + (y1 + y2), (x1, y1), (x2, y2), cor(h, s, l, k)))
            for _, a, b, c in sorted(faces, key=lambda t: t[0]):
                self.prims.append(("poly", [(*a, z0), (*b, z0), (*b, z1), (*a, z1)], c, c if contorno else None))
            if camadas and z1 - z0 > CAMADA * 1.5:
                segs = []
                n = int((z1 - z0) / CAMADA)
                for _, a, b, _c in faces:
                    for i in range(1, n):
                        z = z0 + i * (z1 - z0) / n
                        segs.append(((*a, z), (*b, z)))
                self.prims.append(("linhas", segs, "#000000", 0.16))

        if topo:
            aneis = [[(x, y, z1) for x, y in poly]] + [[(x, y, z1) for x, y in f] for f in furos]
            self.prims.append(("topo", aneis, cor(h, s, l, 1.18), cor(h, s, l, 1.45)))

    def decal(self, pts3d, fill):
        self.prims.append(("poly", pts3d, fill, None))

    def svg(self, largura, altura, margem=0.14, fundo=True, sombra=True, deslocamento_y=0.0):
        todos = [proj(p) for tipo, dados, *_r in self.prims if tipo not in ("clip", "fim_clip") for p in (
            [q for seg in dados for q in seg] if tipo == "linhas" else
            [q for anel in dados for q in anel] if tipo == "topo" else dados)]
        xs, ys = [p[0] for p in todos], [p[1] for p in todos]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        esc = min(largura * (1 - 2 * margem) / w, altura * (1 - 2 * margem) / h)
        ox = largura / 2 - (min(xs) + w / 2) * esc
        oy = altura / 2 - (min(ys) + h / 2) * esc + deslocamento_y * altura

        def t(p):
            x, y = proj(p)
            return f"{x * esc + ox:.1f},{y * esc + oy:.1f}"

        partes = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largura} {altura}" width="{largura}" height="{altura}">',
            "<defs>",
            '<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#1b212b"/><stop offset="0.55" stop-color="#11151b"/><stop offset="1" stop-color="#0b0d10"/></radialGradient>',
            '<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#6c8cff" stop-opacity="0.22"/><stop offset="1" stop-color="#6c8cff" stop-opacity="0"/></radialGradient>',
            '<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>',
            '<pattern id="grade" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#ffffff" stroke-opacity="0.035"/></pattern>',
            "</defs>",
        ]
        if fundo:
            partes.append(f'<rect width="{largura}" height="{altura}" fill="url(#bg)"/>')
            partes.append(f'<rect width="{largura}" height="{altura}" fill="url(#grade)"/>')
            partes.append(f'<ellipse cx="{largura / 2}" cy="{altura * 0.42}" rx="{largura * 0.42}" ry="{altura * 0.36}" fill="url(#halo)"/>')
        if sombra:
            partes.append(
                f'<ellipse cx="{largura / 2}" cy="{oy + max(ys) * esc - h * esc * 0.04}" rx="{w * esc * 0.42}" ry="{h * esc * 0.09}" fill="#1a120a" opacity="0.32" filter="url(#blur)"/>'
            )
        n_clip = 0
        for tipo, dados, *estilo in self.prims:
            if tipo == "clip":
                n_clip += 1
                partes.append(f'<clipPath id="c{n_clip}"><polygon points="{" ".join(t(p) for p in dados)}"/></clipPath><g clip-path="url(#c{n_clip})">')
            elif tipo == "fim_clip":
                partes.append("</g>")
            elif tipo == "poly":
                fill, stroke = estilo
                st = f' stroke="{stroke}" stroke-width="0.6" stroke-linejoin="round"' if stroke else ""
                partes.append(f'<polygon points="{" ".join(t(p) for p in dados)}" fill="{fill}"{st}/>')
            elif tipo == "linhas":
                stroke, op = estilo
                d = "".join(f"M{t(a)}L{t(b)}" for a, b in dados)
                partes.append(f'<path d="{d}" stroke="{stroke}" stroke-opacity="{op}" stroke-width="0.7" fill="none"/>')
            elif tipo == "topo":
                fill, stroke = estilo
                d = "".join("M" + "L".join(t(p) for p in anel) + "Z" for anel in dados)
                partes.append(f'<path d="{d}" fill="{fill}" fill-rule="evenodd" stroke="{stroke}" stroke-width="1" stroke-linejoin="round"/>')
        partes.append("</svg>")
        return "\n".join(partes)


# ------------------------------------------------------------------- peças
def contorno_engrenagem(dentes, r_raiz, r_ponta, n_arco=3):
    pts = []
    passo = 2 * math.pi / dentes
    for i in range(dentes):
        a = i * passo
        for k in range(n_arco):
            ang = a + passo * (0.0 + 0.4 * k / n_arco)
            pts.append((r_raiz * math.cos(ang), r_raiz * math.sin(ang)))
        for k in range(n_arco + 1):
            ang = a + passo * (0.5 + 0.25 * k / n_arco)
            pts.append((r_ponta * math.cos(ang), r_ponta * math.sin(ang)))
    return pts


def engrenagem():
    c = Cena()
    azul = (214, 0.18, 0.62)
    c.prisma(contorno_engrenagem(18, 1.0, 1.18), 0, 0.32, azul, furos=[circulo(0.22, 36)])
    c.prisma(circulo(0.42, 48), 0.32, 0.5, azul, furos=[circulo(0.22, 36)])
    return c


def polia():
    c = Cena()
    laranja = (24, 0.75, 0.52)
    furo = [circulo(0.17, 36)]
    c.prisma(circulo(1.0, 80), 0, 0.12, laranja, furos=furo)
    c.prisma(circulo(0.72, 80), 0.12, 0.42, laranja, furos=furo)
    c.prisma(circulo(1.0, 80), 0.42, 0.54, laranja, furos=furo)
    c.prisma(circulo(0.38, 48), 0.54, 0.74, laranja, furos=furo)
    return c


def suporte_l():
    c = Cena()
    cinza = (210, 0.06, 0.6)
    furos_base = [circulo(0.11, 32, 0.55, 0.75), circulo(0.11, 32, 1.65, 0.75)]
    c.prisma(retangulo_arredondado(2.2, 1.2, 0.12, 1.1, 0.6), 0, 0.2, cinza, furos=furos_base)
    c.prisma([(0, 0), (2.2, 0), (2.2, 0.2), (0, 0.2)], 0.2, 1.45, cinza)
    for cx in (0.55, 1.65):
        anel = [(cx + 0.11 * math.cos(a), 0.2, 0.95 + 0.11 * math.sin(a)) for a in (2 * math.pi * i / 32 for i in range(32))]
        c.decal(anel, "#07090c")
    for x0 in (0.05, 2.0):
        passos = 14
        for i in range(passos):
            t0, t1 = i / passos, (i + 1) / passos
            prof = 0.2 + (1 - t1) * 0.85
            c.prisma([(x0, 0.2), (x0 + 0.15, 0.2), (x0 + 0.15, prof), (x0, prof)], 0.2 + t0 * 1.0, 0.2 + t1 * 1.0, cinza, camadas=False)
    return c


def knob():
    c = Cena()
    preto = (220, 0.08, 0.3)
    c.prisma(circulo(1.12, 96), 0, 0.12, preto)
    recartilhado = [
        ((1.0 + 0.035 * (1 if math.sin(42 * a) > 0 else -1)) * math.cos(a), (1.0 + 0.035 * (1 if math.sin(42 * a) > 0 else -1)) * math.sin(a))
        for a in (2 * math.pi * i / 240 for i in range(240))
    ]
    c.prisma(recartilhado, 0.12, 0.75, preto)
    c.prisma(circulo(0.86, 96), 0.75, 0.84, preto)
    c.prisma([(0.15, -0.05), (0.75, -0.05), (0.75, 0.05), (0.15, 0.05)], 0.84, 0.87, (40, 0.9, 0.62), camadas=False)
    return c


def gabinete():
    c = Cena()
    branco = (210, 0.08, 0.8)
    c.prisma(retangulo_arredondado(2.4, 1.6, 0.18), 0, 0.72, branco)
    fendas = [retangulo_arredondado(1.2, 0.09, 0.045, 0.1, -0.45 + i * 0.18, n=4) for i in range(6)]
    parafusos = [circulo(0.06, 20, sx * 1.0, sy * 0.62) for sx in (-1, 1) for sy in (-1, 1)]
    c.prisma(retangulo_arredondado(2.4, 1.6, 0.18), 0.74, 0.9, branco, furos=fendas + parafusos)
    # Porta USB na face frontal (+x).
    c.decal([(1.2, -0.25, 0.25), (1.2, 0.05, 0.25), (1.2, 0.05, 0.38), (1.2, -0.25, 0.38)], "#0b0e12")
    c.decal([(1.2, 0.3, 0.25), (1.2, 0.42, 0.25), (1.2, 0.42, 0.37), (1.2, 0.3, 0.37)], "#6c8cff")
    return c


def vaso():
    c = Cena()
    verde = (168, 0.45, 0.5)
    altura, n = 2.6, 52
    dz = altura / n

    def perfil(z, a, tw):
        raio = 0.62 + 0.3 * math.sin(math.pi * (0.15 + 0.8 * z / altura))
        return raio * (1 + 0.1 * math.cos(6 * (a + tw)))

    def secao(z, encolhe=0.0):
        tw = 0.9 * z / altura
        return [((perfil(z, a, tw) - encolhe) * math.cos(a), (perfil(z, a, tw) - encolhe) * math.sin(a)) for a in (2 * math.pi * i / 72 for i in range(72))]

    for i in range(n):
        z0 = i * dz
        c.prisma(secao(z0 + dz / 2), z0, z0 + dz, verde, camadas=False, contorno=False)
    topo = secao(altura - dz / 2)
    c.prisma(topo, altura - 0.5, altura, verde, furos=[secao(altura - dz / 2, 0.06)], lados=False)
    return c


def organizador():
    c = Cena()
    roxo = (250, 0.35, 0.58)
    r = 0.5
    celulas = [(0, 0, 1.3), (1, 0, 0.9), (0, 1, 1.0), (-1, 1, 0.7), (-1, 0, 1.15), (0, -1, 0.8), (1, -1, 1.5)]
    posicoes = []
    for q, s, alt in celulas:
        x = r * math.sqrt(3) * (q + s / 2)
        y = r * 1.5 * s
        posicoes.append((x + y, x, y, alt))
    for _, x, y, alt in sorted(posicoes):
        hexa = circulo(r * 0.985, 6, x, y, math.pi / 6)
        c.prisma(hexa, 0, alt, roxo, furos=[circulo(r * 0.82, 6, x, y, math.pi / 6)], fundo_furo="#0e0b16")
    return c


def clipe():
    c = Cena()
    amarelo = (45, 0.85, 0.55)
    c.prisma(retangulo_arredondado(0.7, 1.0, 0.15, -1.05, 0), 0, 0.14, amarelo, furos=[circulo(0.1, 28, -1.1, 0)])
    ext = [(0.8 * math.cos(a), 0.8 * math.sin(a)) for a in (math.radians(215 - 290 * i / 60) for i in range(61))]
    inte = [(0.56 * math.cos(a), 0.56 * math.sin(a)) for a in (math.radians(-75 + 290 * i / 60) for i in range(61))]
    c.prisma(ext + inte, 0, 0.5, amarelo)
    return c


def main() -> None:
    DESTINO_PRODUTOS.mkdir(parents=True, exist_ok=True)
    pecas = {
        "engrenagem": engrenagem,
        "polia": polia,
        "suporte-l": suporte_l,
        "knob": knob,
        "gabinete": gabinete,
        "vaso": vaso,
        "organizador": organizador,
        "clipe": clipe,
    }
    for nome, fn in pecas.items():
        # Fundo transparente: a interface fornece o fundo (tema claro ou escuro).
        (DESTINO_PRODUTOS / f"{nome}.svg").write_text(fn().svg(800, 600, fundo=False), encoding="utf-8")
    print(f"Ilustrações geradas em {DESTINO_PRODUTOS}")


if __name__ == "__main__":
    main()
