import type { AoIniciarApp, ContextoListener } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../comum/conta';
import { MARCA_PADRAO } from '../comum/estudio';
import { TEMAS } from '../comum/pagina';

// Semente de demonstração (spec 12.2), idempotente: roda a cada boot e só cria o que falta.
// Alcança apenas as contas cujo nome termina em "(demo)" — as contas de teste da equipe, criadas à
// mão na instância (migração e hook não criam conta nem usuário). O critério é o nome: a equipe não
// deve usar o sufixo em conta de corretor real, e a semente só cria o que falta (nunca sobrescreve).
export const SUFIXO_DEMO = '(demo)';

export function ehContaDemo(nome: string): boolean {
  return nome.trim().toLowerCase().endsWith(SUFIXO_DEMO);
}

export async function semear(ctx: ContextoListener): Promise<number> {
  if (!ctx.dados?.comConta || !ctx.contas) return 0;
  const contas = (await ctx.contas.listarAtivas()).filter((c) => ehContaDemo(c.nome));
  const falhas: string[] = [];
  for (const conta of contas) {
    // Uma conta com problema não impede as outras; a falha volta ao shell no fim (iniciar_falhou).
    try {
      await semearConta(ctx, conta);
    } catch (e) {
      falhas.push(`${conta.nome}: ${(e as Error).message}`);
    }
  }
  if (falhas.length) throw new Error(`Semente incompleta — ${falhas.join('; ')}`);
  return contas.length;
}

async function semearConta(ctx: ContextoListener, conta: { id: number; nome: string }) {
  await ctx.dados!.comConta!(conta.id, async (trx) => {
    // Em contexto SISTEMA a leitura enxerga todas as contas: filtrar `conta_id` é obrigatório.
    const perfil = (await trx.listar('perfil_conta', { filtros: { conta_id: conta.id, chave: 'conta' }, por_pagina: 1 })).dados[0];
    if (!perfil) {
      await trx.criar('perfil_conta', {
        chave: 'conta',
        tipo: 'corretor_autonomo',
        nome: conta.nome.trim().slice(0, -SUFIXO_DEMO.length).trim() || conta.nome,
        demo: true,
      });
    } else if (!perfil.demo) {
      // Marca a conta de teste: libera "Gerar dados de demonstração" no Início (bloco 4b).
      await trx.atualizar('perfil_conta', perfil.id, { demo: true });
    }
    const temConfig = await trx.existe('configuracoes_conta', { conta_id: conta.id, chave: 'conta' });
    if (!temConfig) await trx.criar('configuracoes_conta', { chave: 'conta', ...CONFIGURACOES_PADRAO });
  });
}

// Marca única (D-85): a cor pública vem de `marca_conta.cor_primaria`. Conta que escolheu uma cor na
// Minha Página (`paginas_corretor.tema`) e ainda não salvou a marca ganha essa cor na marca, para a
// página, as seleções e o portal não mudarem de cor. Não é migração: em migração só a adoção grava
// `conta_id` explícito; aqui a escrita vai pela conta do bloco `comConta`, como a semente acima.
// Idempotente: conta com marca fica como está (inclusive a que o próprio preenchimento criou).
// "Oceano" é o azul padrão da marca, e tema fora de TEMAS não tem cor a levar: nada a gravar.
export async function levarTemaParaMarca(ctx: ContextoListener): Promise<number> {
  if (!ctx.dados?.comConta || !ctx.contas) return 0;
  const contas = await ctx.contas.listarAtivas();
  const falhas: string[] = [];
  let criadas = 0;
  for (const conta of contas) {
    try {
      if (await temaParaMarcaConta(ctx, conta.id)) criadas++;
    } catch (e) {
      falhas.push(`${conta.nome}: ${(e as Error).message}`);
    }
  }
  if (falhas.length) throw new Error(`Cor da página para a marca incompleta — ${falhas.join('; ')}`);
  return criadas;
}

async function temaParaMarcaConta(ctx: ContextoListener, contaId: number): Promise<boolean> {
  let criou = false;
  await ctx.dados!.comConta!(contaId, async (trx) => {
    // Em contexto SISTEMA a leitura enxerga todas as contas: filtrar `conta_id` é obrigatório.
    const pagina = (await trx.listar('paginas_corretor', { filtros: { conta_id: contaId, chave: 'conta' }, por_pagina: 1 })).dados[0];
    const cor = pagina ? TEMAS[String(pagina.tema)]?.cor : undefined;
    if (!cor || cor.toLowerCase() === MARCA_PADRAO.cor_primaria) return;
    if (await trx.existe('marca_conta', { conta_id: contaId, chave: 'conta' })) return;
    try {
      await trx.criar('marca_conta', { chave: 'conta', ...MARCA_PADRAO, cor_primaria: cor });
      criou = true;
    } catch (e) {
      // O corretor salvou a marca entre a leitura e a escrita: a dele prevalece.
      if ((e as { code?: string }).code !== '23505') throw e;
    }
  });
  return criou;
}

// As duas tarefas são independentes: a falha de uma não impede a outra. Se alguma falhar, o hook lança
// no fim com as duas mensagens — o shell registra `iniciar_falhou` e a app segue operacional
// (overview.md § Hooks de ciclo de vida); no próximo boot, cada uma retoma só o que falta.
export const aoIniciar: AoIniciarApp = async (ctx) => {
  const falhas: string[] = [];
  for (const tarefa of [semear, levarTemaParaMarca]) {
    try {
      await tarefa(ctx);
    } catch (e) {
      falhas.push((e as Error).message);
    }
  }
  if (falhas.length) throw new Error(falhas.join(' | '));
};
