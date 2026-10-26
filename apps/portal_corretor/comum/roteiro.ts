// Roteiro de visitas do Portal do Cliente (modelo da referência "tour"): as visitas agrupadas por
// dia, numeradas na ordem do horário, com "Como chegar" e o roteiro do dia no mapa. Puro: recebe a
// agenda já publicada (só dado público do imóvel) e devolve grupos e links.

export interface ImovelDaVisita {
  codigo?: string | null;
  titulo?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}

export interface VisitaDoPortal {
  ref: number;
  quando: string | null;
  imovel: ImovelDaVisita | null;
}

export interface DiaDeRoteiro {
  /** `AAAA-MM-DD` no fuso informado. */
  dia: string;
  visitas: VisitaDoPortal[];
}

const diaNoFuso = (quando: string, fuso?: string) => new Date(quando).toLocaleDateString('sv-SE', fuso ? { timeZone: fuso } : {});

/** Visitas com horário, por dia e na ordem do horário. */
export function roteiroPorDia(agenda: VisitaDoPortal[], fuso?: string): DiaDeRoteiro[] {
  const dias = new Map<string, VisitaDoPortal[]>();
  for (const v of [...agenda].filter((x) => x.quando).sort((a, b) => Date.parse(a.quando!) - Date.parse(b.quando!))) {
    const d = diaNoFuso(v.quando!, fuso);
    dias.set(d, [...(dias.get(d) ?? []), v]);
  }
  return [...dias].map(([dia, visitas]) => ({ dia, visitas }));
}

/** O lugar que pode ir ao mapa: o endereço só quando o corretor o publicou; senão, o bairro. */
export function lugarNoMapa(im: ImovelDaVisita | null): { texto: string; exato: boolean } | null {
  if (!im) return null;
  if (im.endereco) return { texto: [im.endereco, im.bairro, im.cidade].filter(Boolean).join(', '), exato: true };
  if (im.bairro) return { texto: [im.bairro, im.cidade].filter(Boolean).join(', '), exato: false };
  return null;
}

/** Link de rota até o imóvel (abre o app de mapas do celular). */
export function linkComoChegar(im: ImovelDaVisita | null): string | null {
  const l = lugarNoMapa(im);
  return l ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l.texto)}` : null;
}

/** Roteiro do dia no mapa: as paradas na ordem, a última como destino. Só com 2+ paradas mapeáveis. */
export function linkRoteiro(visitas: VisitaDoPortal[]): string | null {
  const paradas = visitas.map((v) => lugarNoMapa(v.imovel)?.texto).filter((t): t is string => !!t);
  if (paradas.length < 2) return null;
  const destino = paradas[paradas.length - 1];
  const meio = paradas.slice(0, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&waypoints=${encodeURIComponent(meio)}`;
}

/** "hoje", "amanhã" ou "em N dias", contando dias de calendário no fuso. */
export function quantoFalta(quando: string, agora = new Date(), fuso?: string): string {
  const dias = Math.round((Date.parse(diaNoFuso(quando, fuso)) - Date.parse(diaNoFuso(agora.toISOString(), fuso))) / 86400e3);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}
