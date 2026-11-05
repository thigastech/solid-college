/** Minúsculas e sem acentos, para busca tolerante ("Engrenagem" ≈ "engrenágem"). */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
