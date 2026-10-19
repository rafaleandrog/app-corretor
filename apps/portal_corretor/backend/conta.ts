import '@urbiverso/sdk/express';
import { Router } from 'express';
import {
  CONFIGURACOES_PADRAO,
  validarConfiguracoes,
  validarMeuPerfil,
  validarPerfilConta,
} from '../comum/conta';
import { assincrono, erro, exigirPapel, primeiro, salvarUnico } from './acesso';

// Ajustes › Conta e marca. Tudo aqui é da conta do corretor logado: as três tabelas são
// segregadas por conta (RLS), e o perfil do corretor é escopado também pelo `usuario.id`.
export const contaRotas: Router = Router();

contaRotas.use(exigirPapel('corretor'));

// Sem conta resolvida o RLS devolve zero linhas e a escrita é negada: a tela explica em vez de
// mostrar formulário vazio ou um 403 do framework.
contaRotas.use((req, res, next) => {
  if (req.contexto?.resolucao === 'negar') {
    return erro(res, 409, 'SEM_CONTA', 'Seu usuário não está associado a nenhuma conta. Fale com a equipe da plataforma.');
  }
  next();
});

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
      meu_perfil: meuPerfil ?? { creci: null, telefone: null, creci_situacao: 'nao_verificado' },
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

contaRotas.put(
  '/meu-perfil',
  assincrono(async (req, res) => {
    const v = validarMeuPerfil(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira seus dados.', v.erros);
    // `usuario_id` vem sempre do contexto, nunca do corpo: o corretor só edita o próprio perfil.
    // `creci_situacao` não é editável por aqui (verificação manual, P-12).
    const linha = await salvarUnico(req.dados!, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id }, { ...v.dados });
    res.json(linha);
  }),
);
