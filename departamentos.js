// ═══════════════════════════════════════════
// Páginas de departamentos e dashboard
// ═══════════════════════════════════════════

// ── PÁGINA DE DEPARTAMENTOS ────────────────────────────────────────────────
const DEPT_CONFIG = {
  'Escrita Fiscal':                      {icon:'💰',cor:'#2563EB',page:'fiscal', desc:'Apurações, documentos fiscais, fiscalizações'},
  'Departamento Pessoal':                {icon:'👷',cor:'#7C3AED',page:'dp',     desc:'Folha, admissão, rescisão, férias, eSocial'},
  'Contabilidade':                       {icon:'📒',cor:'#059669',page:'cont',   desc:'Escrituração, demonstrações, ECD, ECF, IBGE'},
  'Rural':                               {icon:'🌾',cor:'#D97706',page:'rural',  desc:'ITR, CCIR, CAR, produtor rural, gestão'},
  'Legalização e Societário':            {icon:'🏢',cor:'#1D4ED8',page:'leg',    desc:'Alterações, encerramento, licenças'},
  'Abertura de Empresas':                {icon:'🏗️',cor:'#0891B2',page:'abertura',desc:'Planejamento, registro, pós-abertura'},
  'Despachante Imobiliário':             {icon:'🏠',cor:'#0F9B6E',page:'imob',   desc:'Compra/venda, regularização, cartório'},
  'IRPF':                                {icon:'🧾',cor:'#DC2626',page:'irpf',   desc:'Declaração, malha fina, ganho de capital'},
  'Parcelamentos e Regularização Fiscal':{icon:'📑',cor:'#9333EA',page:'parc',   desc:'Receita Federal, PGFN, certidões'},
  'Prefeitura e Alvarás':                {icon:'🏛️',cor:'#EA580C',page:'pref',   desc:'Inscrições, alvarás, ISS municipal'},
  'Certidões e Documentações':           {icon:'📜',cor:'#64748B',page:'certs',  desc:'Certidões federais, estaduais, municipais'},
  'Atendimento ao Cliente':              {icon:'🤝',cor:'#0EA5E9',page:'atend',  desc:'Solicitações, financeiro, comercial, ouvidoria'},
};

async function loadDeptsPage() {
  const grid = document.getElementById('depts-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Carregando...</div>';

  // Contar demandas abertas por departamento
  const {data: demAberta} = await sb.from('demandas')
    .select('departamento_atual_id')
    .not('status','in','(concluida,cancelada)');

  const contPorDept = {};
  (demAberta||[]).forEach(d => {
    contPorDept[d.departamento_atual_id] = (contPorDept[d.departamento_atual_id]||0)+1;
  });

  // Carregar departamentos
  const {data: deptList} = await sb.from('departamentos').select('*').eq('ativo',true).order('ordem');

  grid.innerHTML = (deptList||[]).map(d => {
    const cfg = DEPT_CONFIG[d.nome] || {icon: d.icone||'📋', cor: d.cor||'#888', page: null, desc: ''};
    const count = contPorDept[d.id] || 0;
    const page = cfg.page;
    return `
      <div onclick="${page ? `ir('${page}')` : ''}" style="
        background:var(--surface);border:1.5px solid var(--border);border-radius:14px;
        padding:22px 20px;cursor:${page?'pointer':'default'};transition:all .15s;
        position:relative;overflow:hidden;
        ${page?'':'opacity:.7'}
      " onmouseover="if(${!!page})this.style.cssText+=';transform:translateY(-3px);box-shadow:var(--sh-md);border-color:${d.cor||cfg.cor}'"
         onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor=''">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${d.cor||cfg.cor};border-radius:14px 14px 0 0"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div style="width:44px;height:44px;border-radius:12px;background:${d.cor||cfg.cor}18;display:flex;align-items:center;justify-content:center;font-size:24px">${d.icone||cfg.icon}</div>
          ${count > 0 ? `<span style="font-size:11px;font-weight:700;background:var(--red-pale);color:var(--red);padding:3px 9px;border-radius:20px">${count} aberta${count>1?'s':''}</span>` : '<span style="font-size:11px;color:var(--text3);background:var(--surface2);padding:3px 9px;border-radius:20px">0 abertas</span>'}
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px;letter-spacing:-.2px">${d.nome}</div>
        <div style="font-size:12px;color:var(--text3)">${cfg.desc||'Clique para ver demandas'}</div>
        ${page ? `<div style="margin-top:14px;font-size:12px;font-weight:600;color:${d.cor||cfg.cor};display:flex;align-items:center;gap:4px">Ver demandas <span>→</span></div>` : ''}
      </div>`;
  }).join('');
}

// ─── LEGALIZAÇÃO ──────────────────────────────────────────────────────────────
async function loadLeg(){
  const prefLeg=['ABE','MEI','ABL','ABS','ALS','ALE','ALA','ALQ','RGF','RGT','RGP','PAR','ALV','LCS','LCA','ALO','BME','ENC'];
  const {data:all}=await sb.from('demandas').select('*,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),tipos_demanda(nome,prefixo_numeracao)').not('status','in','(concluida,cancelada)').order('created_at',{ascending:false});
  const dems=(all||[]).filter(d=>prefLeg.some(p=>d.numero?.startsWith(p+'-')));
  const im=new Date();im.setDate(1);
  const {count:conc}=await sb.from('demandas').select('*',{count:'exact',head:true}).not('status','in','(rascunho)').gte('data_conclusao',im.toISOString()).in('departamento_atual_id',deps.filter(d=>d.nome==='Legalização').map(d=>d.id));
  document.getElementById('legk1').textContent=dems.filter(d=>d.status==='em_andamento').length;
  document.getElementById('legk2').textContent=dems.filter(d=>d.prioridade==='urgente').length;
  document.getElementById('legk3').textContent=conc||0;
  document.getElementById('legk4').textContent=dems.filter(d=>d.status==='aguardando_cliente').length;
  const abertura=['ABE','MEI','ABL','ABS','ALS','ALE','ALA','ALQ'];
  const regulari=['RGF','RGT','RGP','PAR','ALV','LCS','LCA','ALO','BME','ENC'];
  renderDemMini(dems.filter(d=>abertura.some(p=>d.numero?.startsWith(p+'-'))),'legAbert');
  renderDemMini(dems.filter(d=>regulari.some(p=>d.numero?.startsWith(p+'-'))),'legReg');
  renderDemMini(dems,'legTabela');
}

// ─── DESPACHANTE IMOBILIÁRIO ──────────────────────────────────────────────────
async function loadImob(){
  const prefImob=['ITB','ITH','ITD','ECV','ESD','ESP','INV','ROB','HAB','AVC','DES','RIM','CIT','MAT','FIB','FGH'];
  const {data:all}=await sb.from('demandas').select('*,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),tipos_demanda(nome,prefixo_numeracao)').not('status','in','(concluida,cancelada)').order('created_at',{ascending:false});
  const dems=(all||[]).filter(d=>prefImob.some(p=>d.numero?.startsWith(p+'-')));
  const im=new Date();im.setDate(1);
  const {count:conc}=await sb.from('demandas').select('*',{count:'exact',head:true}).not('status','in','(rascunho)').gte('data_conclusao',im.toISOString()).in('departamento_atual_id',deps.filter(d=>d.nome==='Despachante Imobiliário').map(d=>d.id));
  document.getElementById('imobk1').textContent=dems.filter(d=>d.status==='em_andamento').length;
  document.getElementById('imobk2').textContent=dems.filter(d=>d.prioridade==='urgente').length;
  document.getElementById('imobk3').textContent=conc||0;
  document.getElementById('imobk4').textContent=dems.filter(d=>d.status==='aguardando_orgao').length;
  const itbi=['ITB','ITH','ITD','ECV','ESD','ESP','INV'];
  const obra=['ROB','HAB','AVC','DES','RIM','CIT','MAT','FIB','FGH'];
  renderDemMini(dems.filter(d=>itbi.some(p=>d.numero?.startsWith(p+'-'))),'imobItbi');
  renderDemMini(dems.filter(d=>obra.some(p=>d.numero?.startsWith(p+'-'))),'imobObra');
  renderDemMini(dems,'imobTabela');
}

async function loadDash(){
  const im=new Date();im.setDate(1);const ims=im.toISOString();
  const hj=new Date().toISOString().split('T')[0];
  const [{count:a},{count:c},{count:o},{count:u},{count:co},{count:conc},{count:pe}]=await Promise.all([
    sb.from('demandas').select('*',{count:'exact',head:true}).not('status','in','(concluida,cancelada)'),
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('status','aguardando_cliente'),
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('status','aguardando_orgao'),
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('prioridade','urgente').not('status','in','(concluida,cancelada)'),
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('status','aguardando_conclusao'),
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('status','concluida').gte('data_conclusao',ims),
    sb.from('pendencias').select('*',{count:'exact',head:true}).eq('resolvida',false)
  ]);
  const {data:sm}=await sb.from('vw_demandas_inatividade').select('id').in('nivel_inatividade',['atencao','critico','grave','prioridade_maxima']);
  document.getElementById('k1').textContent=a||0;document.getElementById('k2').textContent=c||0;
  document.getElementById('k3').textContent=u||0;document.getElementById('k4').textContent=conc||0;
  document.getElementById('k5').textContent=co||0;document.getElementById('k6').textContent=sm?.length||0;
  document.getElementById('k7').textContent=o||0;document.getElementById('k8').textContent=pe||0;

  // PAINEL URGENTE HOJE
  const urgenteItems = [];
  if(u>0) urgenteItems.push({label:`${u} demanda(s) urgente(s) em aberto`,badge:u,fn:`ir('dem')`});
  const {data:venc}=await sb.from('demandas').select('id,numero').not('status','in','(concluida,cancelada)').lte('prazo',hj);
  if(venc?.length) urgenteItems.push({label:`${venc.length} demanda(s) com prazo vencido`,badge:venc.length,fn:`ir('dem')`});
  if(pe>0) urgenteItems.push({label:`${pe} pendência(s) em aberto aguardando resolução`,badge:pe,fn:`ir('dem')`});
  if(co>0) urgenteItems.push({label:`${co} demanda(s) aguardando aprovação de conclusão`,badge:co,fn:`ir('dem')`});
  const dashUrg=document.getElementById('dashUrgente');
  if(urgenteItems.length>0){
    dashUrg.style.display='block';
    document.getElementById('dashUrgenteList').innerHTML=urgenteItems.map(i=>`<div class="urgente-item" onclick="${i.fn}"><span class="urgente-item-label">${i.label}</span><span class="urgente-badge">${i.badge}</span></div>`).join('');
  } else {
    dashUrg.style.display='none';
  }

  const {data:at}=await sb.from('vw_demandas_inatividade').select('*').in('nivel_inatividade',['critico','grave','prioridade_maxima']).order('dias_sem_movimentacao',{ascending:false}).limit(8);
  document.getElementById('dAtenc').innerHTML=at?.length?at.map(d=>`<div class="ui" onclick="abrirDet('${d.id}')"><div class="uc" style="background:${d.nivel_inatividade==='prioridade_maxima'?'#501313':'var(--red)'}"></div><div class="uinfo"><div class="utit">${d.numero} — ${d.cliente_nome}</div><div class="umeta">${d.responsavel_nome} · ${d.departamento_nome}</div></div><span class="ud tr">${d.dias_sem_movimentacao}d</span></div>`).join(''):'<div class="vazio">Nenhuma crítica ✅</div>';

  const {data:cr}=await sb.from('demandas').select('responsavel_atual_id,profiles!demandas_responsavel_atual_id_fkey(nome)').not('status','in','(concluida,cancelada)');
  const eC=document.getElementById('dCarga');
  if(!cr?.length){eC.innerHTML='<div class="vazio">Sem demandas abertas.</div>';}
  else{const m={};cr.forEach(d=>{const id=d.responsavel_atual_id,n=d.profiles?.nome||'?';if(!m[id])m[id]={nome:n,n:0};m[id].n++;});
  const l=Object.values(m).sort((a,b)=>b.n-a.n),mx=l[0]?.n||1;
  eC.innerHTML=l.map(c=>{const i=c.nome.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(),pct=Math.round(c.n/mx*100),cor=pct>80?'var(--red)':pct>60?'var(--amber)':'var(--sky)';return`<div class="carga-item"><div class="carga-av">${i}</div><div style="font-size:13px;flex:1">${c.nome.split(' ')[0]}</div><div class="carga-bar" style="width:80px"><div class="carga-fill" style="width:${pct}%;background:${cor}"></div></div><div class="carga-n">${c.n}</div></div>`;}).join('');}

  const {data:ap}=await sb.from('aprovacoes').select('*,demandas(numero,clientes(nome)),profiles!aprovacoes_solicitado_por_fkey(nome)').eq('status','pendente').order('solicitado_em');
  document.getElementById('dAprov').innerHTML=ap?.length?ap.map(a=>`<div class="ui" onclick="abrirDet('${a.demanda_id}')"><div class="uc" style="background:var(--green)"></div><div class="uinfo"><div class="utit">${a.demandas?.numero}</div><div class="umeta">${a.demandas?.clientes?.nome} · ${a.profiles?.nome}</div></div><span class="ud tg">Aprovar</span></div>`).join(''):'<div class="vazio">Nenhuma pendente ✅</div>';

  const {data:pr}=await sb.from('vw_proximas_acoes_vencidas').select('*').order('dias_vencida',{ascending:false}).limit(8);
  document.getElementById('dProx').innerHTML=pr?.length?pr.map(p=>`<div class="ui" onclick="abrirDet('${p.demanda_id}')"><div class="uc" style="background:var(--amber)"></div><div class="uinfo"><div class="utit">${p.demanda_numero} — ${p.cliente_nome}</div><div class="umeta">${p.descricao} · ${p.responsavel_nome}</div></div><span class="ud ta">${p.dias_vencida}d</span></div>`).join(''):'<div class="vazio">Nenhuma vencida ✅</div>';

  // Mini kanban no dashboard (sem concluídas para compactar)
  const {data:kbData}=await sb.from('demandas').select('id,numero,resumo,status,prioridade,prazo,ultima_movimentacao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome)').not('status','in','(concluida,cancelada)');
  if(kbData) renderKanbanCards(kbData,'dashKbBoard',4);
  // Render dashboard calendar
  renderDashCal();
}

async function loadCaixa(){
  const hj=new Date().toISOString().split('T')[0];
  const [{count:t},{count:ac},{count:ur},vc]=await Promise.all([
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('responsavel_atual_id',U.id).not('status','in','(concluida,cancelada)'),
    sb.from('demanda_responsaveis').select('*',{count:'exact',head:true}).eq('responsavel_id',U.id).eq('aceite_status','pendente'),
    sb.from('demandas').select('*',{count:'exact',head:true}).eq('responsavel_atual_id',U.id).eq('prioridade','urgente').not('status','in','(concluida,cancelada)'),
    sb.from('proximas_acoes').select('id').eq('responsavel_id',U.id).eq('concluida',false).lt('data_prevista',hj)
  ]);
  document.getElementById('cT').textContent=t||0;document.getElementById('cA').textContent=ac||0;
  document.getElementById('cU').textContent=ur||0;document.getElementById('cV').textContent=vc.data?.length||0;
  const badge=document.getElementById('badgeAceite');if(ac>0){badge.textContent=ac;badge.style.display='inline';}else badge.style.display='none';

  const {data:aces}=await sb.from('demanda_responsaveis').select('*,demandas(id,numero,clientes(nome))').eq('responsavel_id',U.id).eq('aceite_status','pendente');
  document.getElementById('cAList').innerHTML=aces?.length?aces.map(a=>`<div class="ui" onclick="abrirDet('${a.demandas?.id}')"><div class="uc" style="background:var(--amber)"></div><div class="uinfo"><div class="utit">${a.demandas?.numero}</div><div class="umeta">${a.demandas?.clientes?.nome}</div></div><span class="ud ta">Aceitar</span></div>`).join(''):'<div class="vazio">Nenhum aceite pendente ✅</div>';

  const {data:urg}=await sb.from('demandas').select('id,numero,clientes(nome),ultima_movimentacao').eq('responsavel_atual_id',U.id).eq('prioridade','urgente').not('status','in','(concluida,cancelada)');
  document.getElementById('cUList').innerHTML=urg?.length?urg.map(d=>{const dias=Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000);return`<div class="ui" onclick="abrirDet('${d.id}')"><div class="uc" style="background:var(--red)"></div><div class="uinfo"><div class="utit">${d.numero}</div><div class="umeta">${d.clientes?.nome}</div></div><span class="ud tr">${dias}d</span></div>`}).join(''):'<div class="vazio">Nenhuma urgente ✅</div>';

  const {data:mn}=await sb.from('demandas').select('id,numero,status,prioridade,ultima_movimentacao,clientes(nome)').eq('responsavel_atual_id',U.id).not('status','in','(concluida,cancelada)').order('ultima_movimentacao');
  document.getElementById('cMList').innerHTML=mn?.length?`<div style="overflow-x:auto"><table><thead><tr><th>Número</th><th>Cliente</th><th>Status</th><th>Inat.</th></tr></thead><tbody>${mn.map(d=>{const dias=Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000),dc=dias>=5?'tr':dias>=2?'ta':'ts';return`<tr onclick="abrirDet('${d.id}')"><td><strong style="color:var(--sky)">${d.numero}</strong></td><td>${d.clientes?.nome}</td><td><span class="tag ${SC[d.status]||''}">${SL[d.status]||d.status}</span></td><td><span class="tag ${dc}">${dias}d</span></td></tr>`}).join('')}</tbody></table></div>`:'<div class="vazio">Sem demandas ativas.</div>';
}

// loadDem — versão ativa abaixo (sistema de abas)
// filtDem — versão ativa abaixo (sistema de abas)


