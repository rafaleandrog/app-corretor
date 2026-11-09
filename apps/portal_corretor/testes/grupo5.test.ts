import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import { semearFunis } from '../backend/semente';
import { CODIGOS_DO_APP, FRASE_GENERICA, FRASES_DA_PLATAFORMA, fraseDoErro } from '../frontend/estados';
import { semPapelDeEquipe } from '../frontend/telas/corretores';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Etapa 4, grupo 5: transversais (#177 mensagens da plataforma, #173 Corretores sem o papel Equipe,
// #183 literal de cor em comentário, #32 nenhum GET grava, #33 admin sem resíduo em conta real).

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], perfis_corretor: ['usuario_id'], perfil_conta: ['chave'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const RAIZ = process.cwd();
const fontes = (pasta: string) =>
  readdirSync(resolve(RAIZ, pasta))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ arq: `${pasta}/${f}`, texto: readFileSync(resolve(RAIZ, pasta, f), 'utf8') }));

function semConsole<T>(fn: () => T): T {
  const [e, w] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.error = e;
    console.warn = w;
  }
}

test('#177: a mensagem crua da plataforma nunca vai à tela; o código conhecido vira frase do app', () => {
  const daPlataforma = (codigo: string, mensagem: string, status = 403) => Object.assign(new Error(mensagem), { codigo, status });
  semConsole(() => {
    // Os do relato da issue.
    const fora = fraseDoErro(daPlataforma('CONTA_INVALIDA', 'A conta informada em X-Conta está fora da sua membership ativa.'));
    assert.doesNotMatch(fora, /X-Conta|membership/);
    assert.match(fora, /Recarregue a página/);
    const papel = fraseDoErro(daPlataforma('PROVISIONA_SEM_PAPEL', "Provisionar externo em 'portal_corretor' exige o papel 'operacao'."));
    assert.doesNotMatch(papel, /Provisionar externo/);
    assert.match(papel, /Configurações › Usuários/);
    for (const codigo of ['CONTA_FORA_DA_MEMBERSHIP', 'PROVISIONA_SEM_PAPEL', 'SEM_CONTA', 'AUTH_SEM_PERMISSAO', 'SEM_PAPEL', 'CORPO_MUITO_GRANDE']) {
      assert.ok(FRASES_DA_PLATAFORMA[codigo], codigo);
      assert.equal(fraseDoErro(daPlataforma(codigo, 'texto técnico qualquer')), FRASES_DA_PLATAFORMA[codigo]);
    }
    // Código desconhecido, 500 sem código e falha de rede: a frase genérica.
    assert.equal(fraseDoErro(daPlataforma('ALGO_NOVO_DO_SHELL', 'detalhe interno do shell', 409)), FRASE_GENERICA);
    assert.equal(fraseDoErro(Object.assign(new Error('relation "contatos" does not exist'), { status: 500 })), FRASE_GENERICA);
    assert.equal(fraseDoErro(new TypeError('Failed to fetch')), FRASE_GENERICA);
    assert.equal(fraseDoErro({ mensagem: 'objeto cru' }), FRASE_GENERICA);
  });
  // Código do app: a frase do app (ou os detalhes da validação).
  assert.equal(fraseDoErro(Object.assign(new Error('Confira o contato.'), { codigo: 'DADOS_INVALIDOS', status: 422, detalhes: ['Nome é obrigatório.'] })), 'Nome é obrigatório.');
  assert.equal(fraseDoErro(Object.assign(new Error('Contato não encontrado.'), { codigo: 'NAO_ENCONTRADO', status: 404 })), 'Contato não encontrado.');
  // Erro local da tela (sem status): a frase dela.
  assert.equal(fraseDoErro(new Error('Escolha um arquivo .csv.')), 'Escolha um arquivo .csv.');
});

test('#177: todo código que o backend emite está no conjunto do app (senão a tela trocaria a frase pela genérica)', () => {
  const emitidos = new Set<string>();
  for (const { texto } of [...fontes('backend'), ...fontes('comum')]) {
    for (const m of texto.matchAll(/erro\(res, \d+, '([A-Z_]+)'|codigo: '([A-Z_]+)'|new ErroInstagram\([^;]*?'([A-Z_]+)'\)/g)) emitidos.add(m[1] ?? m[2] ?? m[3]);
  }
  emitidos.delete('TESTE'); // `codigo` da negociação simulada do Negociador, não erro
  emitidos.delete('EXPIRED'); // `status_code` da Meta, não erro do app
  const fora = [...emitidos].filter((c) => !CODIGOS_DO_APP.has(c) && !FRASES_DA_PLATAFORMA[c]);
  assert.deepEqual(fora, []);
});

test('#177: nenhuma tela põe `message` de erro na tela sem passar pelo mapa', () => {
  // Exceções conhecidas, que leem a frase do app pelo código: DUPLICATA (nome do contato), ESCREVA_A_MENSAGEM
  // e o CANCELADO local do Estúdio.
  const permitidas = [/codigo === 'ESCREVA_A_MENSAGEM' \? \(e as Error\)\.message/, /exec\(falha\.message\)/, /\$\{falha\.message\} Abrir a ficha/, /e\.message === CANCELADO/];
  for (const { arq, texto } of fontes('frontend/telas')) {
    for (const linha of texto.split('\n')) {
      if (!/\.message\b/.test(linha) || permitidas.some((p) => p.test(linha))) continue;
      assert.fail(`${arq}: ${linha.trim()}`);
    }
  }
});

test('#173: sem o papel Equipe, Corretores explica e esconde o convite; o doc diz o caminho', () => {
  assert.equal(semPapelDeEquipe({ codigo: 'PROVISIONA_SEM_PAPEL', status: 403 }), true);
  assert.equal(semPapelDeEquipe({ codigo: 'SEM_PAPEL', status: 403 }), false);
  const tela = readFileSync(resolve(RAIZ, 'frontend/telas/corretores.ts'), 'utf8');
  const render = tela.slice(tela.indexOf('  render() {'));
  const vazio = render.slice(0, render.indexOf('const aceitos'));
  assert.match(vazio, /if \(this\.semPapelDeEquipe\)/);
  assert.match(vazio, /urbi-estado-vazio/);
  assert.doesNotMatch(vazio, /Convidar corretor<\/urbi-botao>/);
  assert.match(readFileSync(resolve(RAIZ, 'docs/convidar-corretores.md'), 'utf8'), /Administrador do app sem o papel Equipe/);
});

test('#183: nenhum comentário HTML de template carrega "#nnn" (o empacotador o conta como cor)', () => {
  for (const { arq, texto } of [...fontes('frontend'), ...fontes('frontend/telas')]) {
    assert.doesNotMatch(texto, /<!--[^>]*#[0-9a-fA-F]{3}/, arq);
  }
});

test('#32: nenhum GET do funil grava; a conta é preparada no início do app ou pelo POST', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    for (const rota of ['/funil/etapas', '/funil/quadro', '/funil/playbook', '/inicio']) assert.equal((await chamar('GET', rota)).status, 200, rota);
    assert.equal(banco.linhas('etapas_funil').length + banco.linhas('playbook_funil').length, 0);
  });
  // `aoIniciar`: cada conta ativa ganha o padrão, uma vez.
  const ctx = banco.ctxSistema([{ id: 100, nome: 'Marina' }, { id: 200, nome: 'Pedro' }]);
  assert.equal(await semearFunis(ctx), 2);
  const etapas100 = banco.linhas('etapas_funil').filter((e) => e.conta_id === 100).length;
  assert.equal(etapas100, 16);
  assert.equal(banco.linhas('etapas_funil').filter((e) => e.conta_id === 200).length, 16);
  await semearFunis(ctx);
  assert.equal(banco.linhas('etapas_funil').length, 32, 'idempotente');
  assert.ok(banco.linhas('playbook_funil').some((p) => p.conta_id === 200));
});

test('#33: o admin do app (sem papel corretor) não grava perfil de corretor numa conta real; na demo grava', async () => {
  const banco = new BancoFalso(UNICOS);
  const admin: Ator = { usuario: 9, conta: 100, papeis: [], nivel: 'admin' };
  await comServidor(rotas, admin, banco, {}, async (chamar) => {
    const r = await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990000' });
    assert.equal(r.status, 403);
    assert.equal(r.corpo.codigo, 'SO_O_CORRETOR');
    assert.equal(banco.linhas('perfis_corretor').length, 0);
    assert.equal((await chamar('GET', '/conta')).corpo.admin_em_conta_real, true);
  });
  banco.linhas('perfil_conta').push({ id: 9001, conta_id: 100, chave: 'conta', tipo: 'corretor_autonomo', nome: 'Teste', demo: true });
  await comServidor(rotas, admin, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990000' })).status, 200);
  });
  // O corretor grava o próprio perfil em qualquer conta.
  await comServidor(rotas, { ...A, conta: 300 }, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990001' })).status, 200);
  });
});

test('P05: três perguntas sugeridas por tela, que preenchem o campo; exemplo na conversa vazia; Confirmar · Cancelar', async () => {
  const { PERGUNTAS_SUGERIDAS, perguntasSugeridas, TELAS_APP } = await import('../comum/assistente');
  for (const [sub, lista] of Object.entries(PERGUNTAS_SUGERIDAS)) {
    assert.equal(lista.length, 3, sub);
    assert.ok(sub in TELAS_APP, `${sub} é tela do app`);
  }
  assert.deepEqual(perguntasSugeridas('/clientes/12'), PERGUNTAS_SUGERIDAS['/clientes']);
  assert.deepEqual(perguntasSugeridas('/ajustes/privacidade'), PERGUNTAS_SUGERIDAS['/ajustes'], 'aba sem lista própria: a de Ajustes');
  assert.deepEqual(perguntasSugeridas('/qualquer'), PERGUNTAS_SUGERIDAS['/']);
  const fonte = readFileSync(resolve(RAIZ, 'frontend/telas/assistente.ts'), 'utf8');
  assert.match(fonte, /\.valorInicial=\$\{conversa\.rascunho\}/, 'o chip preenche o campo do chat');
  assert.match(fonte, /<urbi-badge interativo[^>]*@click=\$\{\(\) => preencherPergunta\(p\)\}/);
  assert.match(fonte, /\baudio\b/, 'microfone no campo');
  assert.match(fonte, />Confirmar<\/urbi-botao>[\s\S]*>Cancelar<\/urbi-botao>/);
  assert.match(fonte, /EXEMPLO_CONVERSA_VAZIA/);
  assert.match(fonte, /Ir para \$\{irPara\.nome\}/);
  assert.doesNotMatch(fonte, /\bpequeno\b/);
});

test('P10: abre em Funil e conversão; sem "Mensageiro · em breve"; KPI em reais sem centavos acima de mil (#180, #182)', async () => {
  const { reaisKpi } = await import('../comum/numeros');
  assert.equal(reaisKpi(10482500).replace(/\s/g, ' '), 'R$ 104.825');
  assert.equal(reaisKpi(145000000).replace(/\s/g, ' '), 'R$ 1.450.000');
  assert.equal(reaisKpi(99990).replace(/\s/g, ' '), 'R$ 999,90');
  assert.equal(reaisKpi(0).replace(/\s/g, ' '), 'R$ 0,00');
  assert.equal(reaisKpi(null), '—');
  const fonte = readFileSync(resolve(RAIZ, 'frontend/telas/desempenho.ts'), 'utf8');
  assert.match(fonte, /RELATORIO_PADRAO: Relatorio = RELATORIOS\[1\]/);
  assert.match(fonte, /\{ id: 'funil', titulo: 'Funil e conversão'/);
  assert.doesNotMatch(fonte, /em breve|id: 'mensageiro'|id: 'tempo'/);
  assert.doesNotMatch(fonte, /\bpequeno\b/);
  assert.doesNotMatch(fonte, /min="160px"/, 'quatro KPIs numa linha: o piso do urbi-kpi (140 px)');
});

test('P12: linha de estado de cada item do menu de Ajustes; WhatsApp com os 3 passos; Instagram desligado com o porquê (#30)', async () => {
  const { ABAS_AJUSTES, linhaDeEstado } = await import('../comum/ajustes');
  for (const a of ABAS_AJUSTES) assert.ok(linhaDeEstado(a.id).length > 3, a.id);
  assert.equal(linhaDeEstado('conexoes', { instagram: 'conectado' }), 'Instagram conectado');
  assert.equal(linhaDeEstado('conexoes', { instagram: 'indisponivel' }), 'Instagram e WhatsApp indisponíveis');
  assert.equal(linhaDeEstado('negociador', { negociador: { ligado: true, estilo: 'cooperativo', conduz_padrao: 'ia' } }), 'ligado · IA · cooperativo');
  assert.equal(linhaDeEstado('negociador', { negociador: { ligado: false, estilo: 'firme', conduz_padrao: 'humano' } }), 'pausado · uma pessoa · firme');
  assert.equal(linhaDeEstado('atendimento', { configuracoes: { validade_selecao_dias: 14, dias_cliente_parado: 7 } }), 'parado em 7 dias · seleção vale 14');
  const fonte = readFileSync(resolve(RAIZ, 'frontend/telas/conexoes.ts'), 'utf8');
  const { PASSOS_WHATSAPP } = await import('../frontend/telas/conexoes');
  assert.equal(PASSOS_WHATSAPP.length, 3);
  assert.match(fonte, /Conectar WhatsApp<\/urbi-botao>/);
  assert.match(fonte, /<urbi-botao icone="fa-brands fa-whatsapp" desabilitado/);
  assert.match(fonte, /<urbi-botao icone="fa-brands fa-instagram" desabilitado title="Indisponível/);
  assert.match(fonte, />Testar publicação<\/urbi-botao>/);
  assert.match(fonte, /d\.ja_conectou \? 'Reconectar Instagram' : 'Conectar Instagram'/);
  assert.doesNotMatch(fonte + readFileSync(resolve(RAIZ, 'frontend/telas/ajustes.ts'), 'utf8'), /\bpequeno\b/);
});

test('P13: nome profissional e regiões no perfil (sem apagar o que não veio); tom de voz na marca e nos textos das artes', async () => {
  const { validarMeuPerfil } = await import('../comum/conta');
  const { validarMarca, contextoPeca } = await import('../comum/estudio');
  const banco = new BancoFalso({ ...UNICOS, marca_conta: ['chave'] });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('PUT', '/conta/meu-perfil', { creci: '', telefone: '61999990000', nome_profissional: '  Marina   Souza ', regioes: 'Lago Sul, Sudoeste' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const eu = (await chamar('GET', '/conta')).corpo.meu_perfil;
    assert.deepEqual([eu.nome_profissional, eu.regioes], ['Marina Souza', 'Lago Sul, Sudoeste']);
    // Tela antiga (sem os campos novos): o que estava gravado fica.
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-1-F', telefone: '61999990000' })).status, 200);
    const depois = (await chamar('GET', '/conta')).corpo.meu_perfil;
    assert.deepEqual([depois.nome_profissional, depois.regioes, depois.creci], ['Marina Souza', 'Lago Sul, Sudoeste', 'DF-1-F']);
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { nome_profissional: 'x'.repeat(121) })).status, 422);
    // Marca: tom de voz validado; sem o campo, fica o gravado.
    const base = { cor_primaria: '#112233', cor_secundaria: '#445566', estilo: 'moderno', assinatura: '' };
    assert.equal((await chamar('PUT', '/estudio/marca', { ...base, tom_voz: 'gritado' })).status, 422);
    assert.equal((await chamar('PUT', '/estudio/marca', { ...base, tom_voz: 'formal' })).corpo.tom_voz, 'formal');
    assert.equal((await chamar('PUT', '/estudio/marca', base)).corpo.tom_voz, 'formal', 'sem o campo, fica o gravado');
  });
  assert.deepEqual(validarMeuPerfil({ creci: '', telefone: '' }).ok && (validarMeuPerfil({ creci: '', telefone: '' }) as any).dados, { creci: null, telefone: null });
  assert.equal(validarMarca({ cor_primaria: '#112233', cor_secundaria: '#445566', estilo: 'moderno' }).ok, true);
  assert.match(contextoPeca('', null, 'institucional' as any, 'post_1x1' as any, 'sofisticado'), /Tom de voz da marca: Sofisticado/);
  assert.doesNotMatch(contextoPeca('', null, 'institucional' as any, 'post_1x1' as any, null), /Tom de voz/);
  // Telas: formulário na tela com Salvar, sem diálogo (`urbiVerso.formulario`) no perfil nem na marca.
  const conta = readFileSync(resolve(RAIZ, 'frontend/telas/conta.ts'), 'utf8');
  const marca = readFileSync(resolve(RAIZ, 'frontend/telas/marca.ts'), 'utf8');
  assert.doesNotMatch(marca, /urbiVerso\.formulario/);
  assert.doesNotMatch(conta.slice(conta.indexOf('private async salvar')), /urbiVerso\.formulario\(\{ titulo: 'Seus dados'/);
  assert.match(marca, /tipo="color"/, 'amostra de cor (#182 item 6)');
  assert.match(marca, /label="Logo"[\s\S]*label="Sua foto \(opcional\)"/, 'rótulos claros dos arquivos (#182 item 6)');
  for (const fonte of [conta, marca]) assert.doesNotMatch(fonte, /\bpequeno\b/);
});

test('P14: vCard vira as linhas da planilha (2.1 QP, 3.0 dobrado, 4.0, celular preferido)', async () => {
  const { lerVcard, ehVcard, CABECALHO_VCARD } = await import('../comum/vcard');
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Ana Souza', 'N:Souza;Ana;;;', 'TEL;TYPE=HOME:+55 61 3333-0000', 'TEL;TYPE=CELL:+55 61 98888-7777',
    'EMAIL;TYPE=INTERNET:ana@exemplo.com', 'NOTE:Quer 3 quartos\\, perto do metrô\\nliga à noite', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:2.1', 'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Concei=C3=A7=C3=A3o;Jo=C3=A3o;;;', 'TEL;CELL:61977770001', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:4.0', 'FN:Bruno', ' Costa', 'item1.TEL;VALUE=uri:tel:+5561966660002', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'ORG:Empresa sem nome nem telefone', 'END:VCARD',
  ].join('\r\n');
  const linhas = lerVcard(vcf);
  assert.deepEqual(linhas[0], [...CABECALHO_VCARD]);
  assert.deepEqual(linhas.slice(1), [
    ['Ana Souza', '+55 61 98888-7777', 'ana@exemplo.com', 'Quer 3 quartos, perto do metrô liga à noite'],
    ['João Conceição', '61977770001', '', ''],
    ['BrunoCosta', '+5561966660002', '', ''],
  ]);
  assert.equal(ehVcard('contatos.VCF', ''), true);
  assert.equal(ehVcard('x.csv', 'BEGIN:VCARD\n'), true);
  assert.equal(ehVcard('x.csv', 'nome;telefone'), false);
});

test('#40: importação em lotes que cabem no corpo do shell, com o número da linha da planilha original', async () => {
  const { dividirEmLotes, somarRelatorios, csvDasRejeitadas, LOTE_IMPORTACAO } = await import('../comum/csv');
  // 2000 linhas com 5 colunas (~230 bytes cada): nenhum lote passa de 400 linhas nem de ~80 kB.
  const linhas = Array.from({ length: 2000 }, (_, i) => ({ nome: `Contato ${i} ${'x'.repeat(60)}`, telefone: `619${String(70000000 + i)}`, email: `c${i}@exemplo.com.br`, papeis: 'comprador', observacoes: 'o'.repeat(120) }));
  const lotes = dividirEmLotes(linhas);
  assert.ok(lotes.length >= 5);
  assert.equal(lotes.reduce((t, l) => t + l.linhas.length, 0), 2000);
  for (const l of lotes) {
    assert.ok(l.linhas.length <= LOTE_IMPORTACAO.linhas);
    const corpo = JSON.stringify({ linhas: l.linhas, modo: 'pular', arquivo: 'contatos-2026.csv', primeira_linha: l.inicio + 2 });
    assert.ok(new TextEncoder().encode(corpo).length < 100_000, `lote em ${l.inicio}: ${corpo.length}`);
  }
  assert.deepEqual(lotes.map((l) => l.inicio), lotes.map((_, i) => lotes.slice(0, i).reduce((t, x) => t + x.linhas.length, 0)));
  // A rota numera as linhas pelo `primeira_linha` do lote.
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('POST', '/contatos/importar', { linhas: [{ nome: 'Ok', telefone: '61911112222' }, { nome: '' }], modo: 'pular', primeira_linha: 402 });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.deepEqual(r.corpo.rejeitados.map((x: any) => x.linha), [403]);
    const p = await chamar('POST', '/contatos/importar', { linhas: [{ nome: '' }], simular: true, primeira_linha: 10 });
    assert.equal(p.corpo.previa[0].linha, 10);
    assert.equal((await chamar('POST', '/contatos/importar', { linhas: [{ nome: '' }], simular: true })).corpo.previa[0].linha, 2, 'sem o campo: a linha 2');
  });
  const soma = somarRelatorios([{ criados: 2, unidos: 1, pulados: 0, rejeitados: [{ linha: 3, motivo: 'a' }] }, { criados: 1, unidos: 0, pulados: 4, rejeitados: [{ linha: 403, motivo: 'b' }] }]);
  assert.deepEqual(soma, { criados: 3, unidos: 1, pulados: 4, rejeitados: [{ linha: 3, motivo: 'a' }, { linha: 403, motivo: 'b' }] });
  // Baixar relatório: a linha rejeitada com o motivo e as células originais.
  const csv = csvDasRejeitadas([{ linha: 3, motivo: 'Informe o nome.' }], ['Nome', 'Telefone'], [['Ana', '61 1'], ['', '61 2']]);
  assert.match(csv, /Linha;Motivo;Nome;Telefone\r\n3;Informe o nome\.;;61 2\r\n/);
  // A tela: fontes com vCard ativo e o outro CRM na fase 2; repetidos como escolha única com explicação.
  const fonte = readFileSync(resolve(RAIZ, 'frontend/telas/importar.ts'), 'utf8');
  assert.match(fonte, /dividirEmLotes\(convertidas\(\)\)/);
  assert.match(fonte, /primeira_linha: lote\.inicio \+ 2/);
  assert.match(fonte, />Baixar relatório<\/urbi-botao>/);
  assert.match(fonte, /escolhaUnica\(REPETIDOS/);
  assert.doesNotMatch(fonte, /Em breve|urbi-chips-atalho|\bpequeno\b/);
});
