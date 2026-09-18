/* ============================================================
   Agente Comercial IA — dados de demonstração
   Carregado por pipeline.html, dashboard.html e usuarios.html.
   Só popula quando o localStorage está vazio: nunca sobrescreve
   dado real do cliente.
   ============================================================ */
(function(){
  function uid(p){ return p+Date.now()+Math.random().toString(36).slice(2,7); }
  function diasAtras(n){ return new Date(Date.now()-n*86400000).toISOString(); }
  // dia específico do mês corrente (para o dashboard ter resultado no período atual)
  function diaDoMes(dia){
    const h = new Date();
    const d = new Date(h.getFullYear(), h.getMonth(), Math.min(dia, h.getDate()), 11, 0, 0);
    return d.toISOString();
  }

  const SEED_USERS = [
    {nome:'Pablo Correia', email:'pablo@empresa.com', papel:'admin',     status:'ativo',   whatsapp:'(11) 98765-4321', senha:'admin123',  meta:0,     criado:diasAtras(30)},
    {nome:'Renata Alencar', email:'renata@empresa.com', papel:'gestor',  status:'ativo',   whatsapp:'(11) 91234-5678', senha:'gestor123', meta:0,     criado:diasAtras(25)},
    {nome:'Maria Souza',   email:'maria@empresa.com',  papel:'consultor', status:'ativo',   whatsapp:'',                senha:'mudar123',  meta:80000, criado:diasAtras(15)},
    {nome:'Pedro Lima',    email:'pedro@empresa.com',  papel:'consultor', status:'ativo',   whatsapp:'',                senha:'mudar123',  meta:70000, criado:diasAtras(10)},
    {nome:'Ana Castro',    email:'ana@empresa.com',    papel:'consultor', status:'inativo', whatsapp:'',                senha:'mudar123',  meta:40000, criado:diasAtras(60)},
  ];

  // Clientes (leads) têm nomes distintos dos usuários — senão o ranking fica ambíguo
  const SEED_LEADS = [
    // fechados no mês corrente
    {nome:'Beatriz Rocha',  empresa:'Zeta Tech',        valor:45000, tag:'hot',  etapa:'fechado',    dono:'Maria Souza', obs:'Fechou! Onboarding semana que vem.', criado:diasAtras(38), fechado:diaDoMes(4)},
    {nome:'Rafael Nunes',   empresa:'Órion Logística',  valor:38000, tag:'hot',  etapa:'fechado',    dono:'Pedro Lima',  obs:'Indicação da Zeta.',                 criado:diasAtras(31), fechado:diaDoMes(8)},
    {nome:'Camila Dias',    empresa:'Vértice Odonto',   valor:22000, tag:'warm', etapa:'fechado',    dono:'Maria Souza', obs:'Entrou pelo cold call DISC.',        criado:diasAtras(24), fechado:diaDoMes(11)},
    // em aberto
    {nome:'Rodrigo Salles', empresa:'Delta Co',         valor:60000, tag:'hot',  etapa:'negociacao', dono:'Pedro Lima',  obs:'Negociando desconto de 10%.',        criado:diasAtras(18), mov:2},
    {nome:'Luciana Prado',  empresa:'TechCorp',         valor:35000, tag:'hot',  etapa:'proposta',   dono:'Maria Souza', obs:'Proposta enviada, sem retorno.',     criado:diasAtras(21), mov:9},
    {nome:'Marcos Vinícius',empresa:'Beta Ltda',        valor:28000, tag:'warm', etapa:'reuniao',    dono:'Pedro Lima',  obs:'Reunião de diagnóstico feita.',      criado:diasAtras(12), mov:3},
    {nome:'Fernanda Lopes', empresa:'Epsilon',          valor:18000, tag:'warm', etapa:'qualif',     dono:'Maria Souza', obs:'',                                   criado:diasAtras(9),  mov:5},
    {nome:'Thiago Moreira', empresa:'Gama SA',          valor:12000, tag:'cold', etapa:'lead',       dono:'',            obs:'Veio do LinkedIn. Ninguém assumiu.', criado:diasAtras(26), mov:20},
    {nome:'Patrícia Alves', empresa:'Nova Rota',        valor:0,     tag:'cold', etapa:'lead',       dono:'Pedro Lima',  obs:'Falta estimar o ticket.',            criado:diasAtras(2),  mov:1},
  ];

  function semear(){
    // quem já limpou os dados uma vez não quer a demo de volta a cada F5
    if(localStorage.getItem('pipeline_sem_demo') === '1') return;
    const temUsers = (JSON.parse(localStorage.getItem('pipeline_users') || '[]')).length > 0;
    const temLeads = (JSON.parse(localStorage.getItem('pipeline_leads') || '[]')).length > 0;

    if(!temUsers){
      const users = SEED_USERS.map(u=>({...u, id:uid('u'), atualizado:new Date().toISOString()}));
      localStorage.setItem('pipeline_users', JSON.stringify(users));
    }
    if(!temLeads){
      const leads = SEED_LEADS.map(l=>({
        id: uid('l'),
        nome: l.nome, empresa: l.empresa, valor: l.valor, tag: l.tag, etapa: l.etapa,
        dono: l.dono, whatsapp: '', email: '', obs: l.obs,
        criado: l.criado,
        atualizado: l.fechado || diasAtras(l.mov || 0),
        fechadoEm: l.fechado || null
      }));
      localStorage.setItem('pipeline_leads', JSON.stringify(leads));
    }
  }

  try{ semear(); }catch(e){ console.warn('Dados de demonstração não carregados:', e); }

  // Permite recarregar a demo depois de limpar tudo
  window.recarregarDemo = function(){
    localStorage.removeItem('pipeline_sem_demo');
    localStorage.removeItem('pipeline_users');
    localStorage.removeItem('pipeline_leads');
    semear();
    location.reload();
  };
})();
