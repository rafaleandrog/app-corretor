// D-85: a marca passa a ser única (Ajustes › Marca) e a cor pública vem de `marca_conta.cor_primaria`.
// Conta que escolheu uma cor na Minha Página e ainda não salvou a marca ganha essa cor na marca, para
// a página, as seleções e o portal não mudarem de cor no upgrade. Conta com marca salva fica como
// está. "Oceano" é o mesmo azul do padrão da marca: nada a gravar. A coluna `tema` continua no
// schema.json (aditivo). Idempotente: na segunda execução toda conta com tema já tem marca.
// As cores são as que a página oferecia (comum/pagina.ts, TEMAS) — retrato fixo desta migração.
const CORES = { oceano: '#0b5394', mata: '#1e6b52', grafite: '#33373d', terracota: '#9c4a26', vinho: '#7b2333' };
const PADRAO = '#0b5394';

export default async function ({ dados }) {
  const [paginas, marcas] = await Promise.all([dados.varrerTudo('paginas_corretor'), dados.varrerTudo('marca_conta')]);
  const comMarca = new Set(marcas.map((m) => Number(m.conta_id)));
  for (const p of paginas) {
    const conta = Number(p.conta_id);
    const cor = CORES[p.tema];
    if (!cor || cor === PADRAO || comMarca.has(conta)) continue;
    // Em migração, `criar` aceita `conta_id` explícito (contas.md § Adotar): a migração roda pelo
    // role de migração, sem conta de escrita, e é ela quem diz de que conta é a linha.
    await dados.criar('marca_conta', { conta_id: conta, chave: 'conta', cor_primaria: cor });
    comMarca.add(conta);
  }
}
