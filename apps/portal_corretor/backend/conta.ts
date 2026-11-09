import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import {
  CONFIGURACOES_PADRAO,
  validarConfiguracoes,
  validarMeuPerfil,
  validarPerfilConta,
} from '../comum/conta';
import { assincrono, erro, exigirPapel, MENSAGEM_SEM_CONTA, primeiro, salvarUnico, semConta } from './acesso';

// Ajustes › Conta e Atendimento. Tudo aqui é da conta do corretor logado: as três tabelas são
// segregadas por conta (RLS), e o perfil do corretor é escopado também pelo `usuario.id`.
export const contaRotas: Router = Router();

contaRotas.use(exigirPapel('corretor'));

// Sem conta resolvida o RLS devolve zero linhas e a escrita é negada: a tela explica em vez de
// mostrar formulário vazio ou um 403 do framework.
contaRotas.use((req, res, next) => (semConta(req) ? erro(res, 409, 'SEM_CONTA', MENSAGEM_SEM_CONTA) : next()));

contaRotas.get(
  '/',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const [perfil, configuracoes, meuPerfil] = await Promise.all([
      primeiro(dados, 'perfil_conta', { chave: 'conta' }),
      primeiro(dados, 'configuracoes_conta', { chave: 'conta' }),
      primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id }),
    ]);
    res.json({
      perfil: perfil ?? null,
      configuracoes: configuracoes ?? { ...CONFIGURACOES_PADRAO, padrao: true },
      meu_perfil: meuPerfil ?? { creci: null, telefone: null, nome_profissional: null, regioes: null },
      // #33: o admin do app numa conta que não é de demonstração não grava perfil de corretor.
      admin_em_conta_real: await adminEmContaReal(req),
    });
  }),
);

contaRotas.put(
  '/perfil',
  assincrono(async (req, res) => {
    const v = validarPerfilConta(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira os dados da conta.', v.erros);
    const linha = await salvarUnico(req.dados!, 'perfil_conta', { chave: 'conta' }, { ...v.dados });
    res.json(linha);
  }),
);

contaRotas.put(
  '/configuracoes',
  assincrono(async (req, res) => {
    // Corpo sem um campo (tela antiga em cache) mantém o valor gravado, não volta ao padrão.
    const atual = await primeiro(req.dados!, 'configuracoes_conta', { chave: 'conta' });
    const corpo = { ...(atual?.lembrete_visita_horas !== undefined && atual?.lembrete_visita_horas !== null ? { lembrete_visita_horas: atual.lembrete_visita_horas } : {}), ...(req.body ?? {}) };
    const v = validarConfiguracoes(corpo);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira as configurações.', v.erros);
    const linha = await salvarUnico(req.dados!, 'configuracoes_conta', { chave: 'conta' }, { ...v.dados });
    res.json(linha);
  }),
);

/**
 * Administrador do app que não é corretor (o SDK não lhe entrega papéis) numa conta que não é de
 * demonstração: o perfil de corretor dele não é gravado ali (#33), para a avaliação do app não deixar
 * resíduo na conta de um corretor real. Na conta "(demo)" ele grava normalmente.
 */
export async function adminEmContaReal(req: Request): Promise<boolean> {
  if (req.contexto?.nivelApp !== 'admin' || req.contexto?.rolesApp?.includes('corretor')) return false;
  const perfil = await primeiro(req.dados!, 'perfil_conta', { chave: 'conta' });
  return !perfil?.demo;
}

export const MENSAGEM_ADMIN_EM_CONTA_REAL =
  'Você está como administrador do app numa conta que não é de demonstração: o seu perfil de corretor não é gravado aqui. Para avaliar o app, use uma conta de demonstração (nome terminado em “(demo)”).';

contaRotas.put(
  '/meu-perfil',
  assincrono(async (req, res) => {
    if (await adminEmContaReal(req)) return erro(res, 403, 'SO_O_CORRETOR', MENSAGEM_ADMIN_EM_CONTA_REAL);
    const v = validarMeuPerfil(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira seus dados.', v.erros);
    // `usuario_id` vem sempre do contexto, nunca do corpo: o corretor só edita o próprio perfil.
    // `creci_situacao` fica inerte no schema (D-93): nada a grava nem a lê para decidir fluxo.
    const linha = await salvarUnico(req.dados!, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id }, { ...v.dados });
    // CRECI fora do formato usual é salvo; o aviso volta junto (D-93).
    res.json({ ...linha, avisos: v.avisos ?? [] });
  }),
);
