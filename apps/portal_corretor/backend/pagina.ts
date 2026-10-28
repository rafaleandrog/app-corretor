import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import { blocosPadrao, FORMATO_ENDERECO, sugerirEndereco, validarPagina } from '../comum/pagina';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { contaDoRequest, despublicarTudo, origemPublica, paginaDaConta, sincronizarTudo } from './vitrine';

// Minha Página (bloco 5, spec 6.15 `paginas_corretor`, 11.3): o corretor monta a página por blocos,
// escolhe o endereço e publica. Publicar gera os endereços de entrada (wh) do formulário e dos
// cliques e copia para a vitrine pública só o que pode ser visto fora.
export const paginaRotas: Router = Router();
guardarCorretor(paginaRotas, ['/pagina']);

const SCHEMA_TEXTOS = {
  type: 'object',
  properties: {
    apresentacao: { type: 'string', default: '' },
    sobre: { type: 'string', default: '' },
  },
};
const INSTRUCAO_TEXTOS =
  'Você escreve textos curtos para a página pessoal de um corretor de imóveis no Brasil, em português do Brasil. ' +
  'Use só o que foi informado: não invente prêmios, anos de experiência, números de vendas nem especialidades. ' +
  'Sem promessas (como "melhor negócio garantido") e sem linguagem discriminatória. Tom próximo e profissional, na primeira pessoa. ' +
  'apresentacao: de 120 a 250 caracteres. sobre: de 300 a 700 caracteres, em parágrafos curtos.';

/** Endereço já usado por outra conta (a vitrine é única entre todas as contas). */
async function enderecoOcupado(req: Request, endereco: string): Promise<boolean> {
  const conta = contaDoRequest(req);
  const r = await req.dados!.listar('vitrine_publica', { filtros: { tipo: 'pagina', chave: endereco }, por_pagina: 5 });
  return r.dados.some((l) => l.conta !== conta);
}

const violouUnico = (e: unknown) => (e as { code?: string })?.code === '23505';
/** Compensação depois de um único violado: tentada, mas sem derrubar a resposta 409. */
async function desfazer(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`[portal_corretor] página: compensação não aplicada: ${(e as Error).message}`);
  }
}

async function visao(req: Request) {
  const dados = req.dados!;
  const contaId = contaDoRequest(req);
  const p = await paginaDaConta(dados, contaId);
  const [conta, eu] = await Promise.all([
    primeiro(dados, 'perfil_conta', { chave: 'conta', conta_id: contaId }),
    primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id, conta_id: contaId }),
  ]);
  const nome = req.contexto!.usuario.nome || conta?.nome || 'Corretor';
  const imoveis = await dados.listar('imoveis', { filtros: { publicado_pagina: true, conta_id: contaId }, por_pagina: 1 });
  const pagina = p ?? { endereco: sugerirEndereco(nome), nome_exibicao: nome, blocos: blocosPadrao(), publicada_em: null, gerada_por_ia: false };
  const base = origemPublica(p?.url_formulario);
  return {
    pagina: {
      endereco: pagina.endereco,
      nome_exibicao: pagina.nome_exibicao,
      blocos: pagina.blocos,
      publicada_em: pagina.publicada_em ?? null,
      gerada_por_ia: !!pagina.gerada_por_ia,
    },
    salva: !!p,
    // Caminho da página pública; a tela completa com a origem quando a instância não tem URL pública.
    url: `${base}/portal_corretor/p?c=${encodeURIComponent(pagina.endereco)}`,
    marcados_para_pagina: imoveis.total,
    // CRECI opcional (D-93): a página publica sem ele; o editor só mostra o aviso discreto.
    sem_creci: !eu?.creci && !conta?.creci_juridico,
  };
}

paginaRotas.get(
  '/pagina',
  assincrono(async (req, res) => {
    res.json(await visao(req));
  }),
);

paginaRotas.put(
  '/pagina',
  assincrono(async (req, res) => {
    const v = validarPagina(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a página.', v.erros);
    if (await enderecoOcupado(req, v.dados.endereco)) return erro(res, 409, 'ENDERECO_EM_USO', 'Este endereço já é de outra página. Escolha outro.');
    const dados = req.dados!;
    const atual = await paginaDaConta(dados, contaDoRequest(req));
    const ia = req.body?.gerada_por_ia === true ? { gerada_por_ia: true } : {};
    if (atual) await dados.atualizar('paginas_corretor', atual.id, { ...v.dados, ...ia });
    else await dados.criar('paginas_corretor', { chave: 'conta', ...v.dados, ...ia });
    // Página no ar: a vitrine acompanha a edição na hora. Outra conta que tomou o endereço no
    // mesmo instante cai no único da vitrine: a página volta ao endereço anterior.
    if (atual?.publicada_em) {
      try {
        await sincronizarTudo(req);
      } catch (e) {
        if (!violouUnico(e)) throw e;
        // Se o request roda numa transação, ela já desfaz tudo; senão, volta o endereço anterior.
        await desfazer(async () => {
          await dados.atualizar('paginas_corretor', atual.id, { endereco: atual.endereco });
          await sincronizarTudo(req);
        });
        return erro(res, 409, 'ENDERECO_EM_USO', 'Este endereço acabou de ser escolhido por outra página. Escolha outro.');
      }
    }
    res.json(await visao(req));
  }),
);

paginaRotas.post(
  '/pagina/publicar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await paginaDaConta(dados, contaDoRequest(req));
    if (!p) return erro(res, 422, 'PAGINA_NAO_SALVA', 'Salve a página antes de publicar.');
    if (!FORMATO_ENDERECO.test(p.endereco)) return erro(res, 422, 'DADOS_INVALIDOS', 'Endereço da página inválido.');
    if (await enderecoOcupado(req, p.endereco)) return erro(res, 409, 'ENDERECO_EM_USO', 'Este endereço já é de outra página. Escolha outro.');
    const conta = contaDoRequest(req);
    const mudar: Record<string, unknown> = { publicada_em: new Date().toISOString() };
    // Endereços de entrada da conta (wh recorrente): gerados uma vez e reaproveitados.
    if (!p.url_formulario) {
      const g = await req.shell!.gerarIngressoWh({ webhook: 'formulario_lead', contexto: { conta_id: conta } });
      Object.assign(mudar, { ingresso_formulario_id: g.ingresso_id, url_formulario: g.url });
    }
    if (!p.url_clique) {
      const g = await req.shell!.gerarIngressoWh({ webhook: 'clique_link', contexto: { conta_id: conta } });
      Object.assign(mudar, { ingresso_clique_id: g.ingresso_id, url_clique: g.url });
    }
    await dados.atualizar('paginas_corretor', p.id, mudar);
    let r;
    try {
      r = await sincronizarTudo(req);
    } catch (e) {
      if (!violouUnico(e)) throw e;
      // Outra conta publicou o mesmo endereço no mesmo instante: esta continua fora do ar.
      await desfazer(async () => {
        await dados.atualizar('paginas_corretor', p.id, { publicada_em: p.publicada_em ?? null });
        // Já estava no ar: a vitrine volta a ser a do endereço gravado; senão, fica vazia.
        if (p.publicada_em) await sincronizarTudo(req);
        else await despublicarTudo(dados, conta);
      });
      return erro(res, 409, 'ENDERECO_EM_USO', 'Este endereço acabou de ser escolhido por outra página. Escolha outro.');
    }
    res.json({ ...(await visao(req)), imoveis_publicados: r.imoveis });
  }),
);

paginaRotas.post(
  '/pagina/atualizar',
  assincrono(async (req, res) => {
    const p = await paginaDaConta(req.dados!, contaDoRequest(req));
    if (!p?.publicada_em) return erro(res, 422, 'PAGINA_FORA_DO_AR', 'A página ainda não foi publicada.');
    const r = await sincronizarTudo(req);
    res.json({ imoveis_publicados: r.imoveis });
  }),
);

paginaRotas.post(
  '/pagina/despublicar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await paginaDaConta(dados, contaDoRequest(req));
    if (p) {
      // Fora do ar, o formulário e a contagem de cliques param de receber: os endereços de entrada
      // são revogados e nascem de novo na próxima publicação.
      for (const [webhook, id] of [['formulario_lead', p.ingresso_formulario_id], ['clique_link', p.ingresso_clique_id]] as const) {
        if (!id) continue;
        try {
          await req.shell!.revogarIngressoWh({ webhook, ingresso_id: id });
        } catch (e) {
          // Ingresso ou webhook que já não existem: nada a revogar, e a página sai do ar mesmo assim.
          const codigo = (e as { codigo?: string })?.codigo;
          if (codigo !== 'WH_INGRESSO_NAO_ENCONTRADO' && codigo !== 'WH_NAO_ENCONTRADO') throw e;
          console.warn(`[portal_corretor] página: ingresso ${id} de ${webhook} não encontrado ao revogar`);
        }
      }
      await dados.atualizar('paginas_corretor', p.id, { publicada_em: null, ingresso_formulario_id: null, url_formulario: null, ingresso_clique_id: null, url_clique: null });
    }
    await despublicarTudo(dados, contaDoRequest(req));
    res.json(await visao(req));
  }),
);

/** Sugestão de textos (apresentação e "sobre mim") pela IA; não grava, o corretor revisa. */
paginaRotas.post(
  '/pagina/sugerir-textos',
  assincrono(async (req, res) => {
    if (!req.ia) return erro(res, 503, 'IA_INDISPONIVEL', 'A escrita com IA não está disponível agora. Escreva os textos à mão.');
    let estado;
    try {
      estado = await req.ia.estadoSlot('conteudo');
    } catch (e) {
      if ((e as { codigo?: string })?.codigo === 'SLOT_INVALIDO') throw e;
    }
    if (!estado?.efetivo) return erro(res, 503, 'IA_INDISPONIVEL', 'A escrita com IA não está disponível agora. Escreva os textos à mão.');
    const dados = req.dados!;
    const [eu, imoveis] = await Promise.all([
      primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id, conta_id: contaDoRequest(req) }),
      dados.listar('imoveis', { filtros: { publicado_pagina: true, conta_id: contaDoRequest(req) }, por_pagina: 50 }),
    ]);
    const bairros = [...new Set(imoveis.dados.map((i) => [i.bairro, i.cidade].filter(Boolean).join(', ')).filter(Boolean))].slice(0, 8);
    const tipos = [...new Set(imoveis.dados.map((i) => i.tipo))].slice(0, 5);
    const contexto = [
      `Nome: ${String(req.body?.nome_exibicao ?? req.contexto!.usuario.nome ?? '').slice(0, 120)}`,
      eu?.creci ? 'Tem CRECI cadastrado.' : null,
      bairros.length ? `Regiões dos imóveis que anuncia: ${bairros.join('; ')}` : null,
      tipos.length ? `Tipos de imóvel que anuncia: ${tipos.join(', ')}` : null,
      typeof req.body?.observacoes === 'string' && req.body.observacoes.trim() ? `O corretor contou: ${req.body.observacoes.trim().slice(0, 500)}` : null,
    ].filter(Boolean).join('\n');
    let r;
    try {
      r = await req.ia.consultar({ contexto, schema: SCHEMA_TEXTOS, slot: 'conteudo', instrucoes_sistema: INSTRUCAO_TEXTOS });
    } catch (e) {
      const codigo = (e as { codigo?: string })?.codigo;
      if (!codigo || codigo === 'SLOT_INVALIDO') throw e;
      return erro(res, 503, 'IA_INDISPONIVEL', 'A escrita com IA falhou agora. Tente de novo ou escreva à mão.');
    }
    res.json({ apresentacao: String(r.dados.apresentacao ?? '').slice(0, 1500), sobre: String(r.dados.sobre ?? '').slice(0, 1500) });
  }),
);
