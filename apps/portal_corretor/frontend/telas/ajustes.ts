import { html } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ABAS_AJUSTES, abaDoEndereco, ehAbaAjustes, type AbaAjustes } from '../../comum/ajustes';
import './conta.js';
import './marca.js';
import './conexoes.js';
import './funil-ajustes.js';

declare const urbiVerso: UrbiVersoAPI;

/** `/conta/` e `/conta` são o mesmo endereço. */
const subAtual = () => urbiVerso.subRota().replace(/(.)\/+$/, '$1') || '/';

/** A aba do endereço que está na barra agora (apelido no caminho ou `?aba=`). */
export const abaAtual = (): AbaAjustes => abaDoEndereco(subAtual(), window.location.search) ?? 'conta';

function conteudo(aba: AbaAjustes) {
  switch (aba) {
    case 'marca':
      return html`<pc-tela-marca></pc-tela-marca>`;
    case 'conexoes':
      return html`<pc-tela-conexoes></pc-tela-conexoes>`;
    case 'funil':
      return html`<pc-tela-funil-ajustes></pc-tela-funil-ajustes>`;
    case 'atendimento':
      return html`<pc-tela-conta parte="atendimento"></pc-tela-conta>`;
    default:
      return html`<pc-tela-conta parte="conta"></pc-tela-conta>`;
  }
}

/**
 * Ajustes numa tela só (D-81, spec 11.1): Conta · Marca · Conexões · Funil e abordagens · Atendimento.
 * O `urbi-abas` vai direto no body da página, para preencher e rolar por dentro. A aba fica em
 * `?aba=` por `replaceState` (refletir estado não é navegar: sem popstate, overview.md) e
 * `atualizar` redesenha o app. Só a aba aberta é montada: cada uma carrega o que é dela ao aparecer.
 */
export function renderAjustes(atualizar: () => void) {
  const aba = abaAtual();
  const selecionar = (e: CustomEvent) => {
    const id = e.detail?.id;
    if (!ehAbaAjustes(id) || id === aba) return;
    window.history.replaceState(window.history.state, '', `${urbiVerso.href('/ajustes')}?aba=${id}`);
    atualizar();
  };
  return html`<urbi-abas .abas=${ABAS_AJUSTES} ativa=${aba} @urbi:aba-selecionar=${selecionar}>
    <urbi-hospedeiro slot=${aba}>${conteudo(aba)}</urbi-hospedeiro>
  </urbi-abas>`;
}
