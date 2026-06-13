// ═══════════════════════════════════════════════════════════════
function getRelPeriodo() {
  const p = document.getElementById('relPeriodo')?.value || 'mes_atual';
  const hoje = new Date();
  let ini, fim;
  if(p==='mes_atual') {
    ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
  } else if(p==='mes_anterior') {
    ini = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  } else if(p==='trimestre') {
    ini = new Date(hoje.getFullYear(), hoje.getMonth()-2, 1);
    fim = hoje;
  } else if(p==='semestre') {
    ini = new Date(hoje.getFullYear(), hoje.getMonth()-5, 1);
    fim = hoje;
  } else if(p==='ano') {
    ini = new Date(hoje.getFullYear(), 0, 1);
    fim = new Date(hoje.getFullYear(), 11, 31);
  } else { // custom
    ini = new Date(document.getElementById('relDataIni')?.value || hoje.toISOString().split('T')[0]);
    fim = new Date(document.getElementById('relDataFim')?.value || hoje.toISOString().split('T')[0]);
  }
  return { ini: ini.toISOString(), fim: fim.toISOString()+' 23:59:59', label: ini.toLocaleDateString('pt-BR')+' a '+fim.toLocaleDateString('pt-BR') };
}

async function gerarRelGerencial(tipo) {
  const el = document.getElementById('relatorioResultado');
  const conteudo = document.getElementById('relatorioConteudo');
  const titulo = document.getElementById('relatorioTitulo');
  el.style.display = 'block';
  conteudo.innerHTML = '<div class="loading">Gerando relatório...</div>';
  el.scrollIntoView({behavior:'smooth'});

  const {ini, fim, label} = getRelPeriodo();
  const deptFiltro = document.getElementById('relDept')?.value || '';
  const userFiltro = document.getElementById('relUser')?.value || '';

  // Carregar todos os dados
  let dems = dbGet('demandas');
  const clis = dbGet('clientes');
  const profs = dbGet('profiles');
  const categ = dbGet('categorias');
  const tipos = dbGet('tipos_demanda');
  const deptsAll = dbGet('departamentos');
  const pends = dbGet('pendencias');

  // Aplicar filtros de período nas demandas (para relatórios de período)
  const demsNoPeriodo = dems.filter(d => d.created_at >= ini && d.created_at <= fim);
  if(deptFiltro) dems = dems.filter(d=>d.departamento_atual_id===deptFiltro||d.departamento_id===deptFiltro);
  if(userFiltro) dems = dems.filter(d=>d.responsavel_atual_id===userFiltro);

  const getNome = (arr,id,campo='nome') => arr.find(x=>x.id===id)?.[campo]||'—';

  const titulos = {
    por_departamento:'Demandas por Departamento',por_usuario:'Produtividade por Colaborador',
    por_mes:'Evolução Mensal',por_tipo:'Demandas por Tipo de Serviço',
    por_cliente:'Demandas por Cliente',demandas_mes:'Lista Completa de Demandas',
    pendencias:'Pendências em Aberto',sla:'SLA — Tempo Médio de Resolução'
  };
  titulo.textContent = (titulos[tipo]||tipo) + ' · ' + label;
  relTituloAtual = titulos[tipo]||tipo;

  let html = '', dados = [];

  if(tipo==='por_departamento') {
    const mapa = {};
    dems.forEach(d=>{
      const depId = d.departamento_atual_id||d.departamento_id;
      const depNome = getNome(deptsAll,depId);
      if(!mapa[depNome]) mapa[depNome]={nome:depNome,total:0,abertas:0,andamento:0,concluidas:0,urgentes:0};
      mapa[depNome].total++;
      if(d.status==='aberta') mapa[depNome].abertas++;
      else if(d.status==='em_andamento') mapa[depNome].andamento++;
      else if(d.status==='concluida') mapa[depNome].concluidas++;
      if(d.prioridade==='urgente') mapa[depNome].urgentes++;
    });
    dados = Object.values(mapa).sort((a,b)=>b.total-a.total);
    relDados = dados;
    html = `<table><thead><tr><th>Departamento</th><th>Total</th><th>Abertas</th><th>Em Andamento</th><th>Concluídas</th><th>Urgentes</th><th>% Concluído</th></tr></thead><tbody>
      ${dados.map(r=>`<tr><td><strong>${r.nome}</strong></td><td>${r.total}</td><td><span class="tag ts">${r.abertas}</span></td><td><span class="tag tg">${r.andamento}</span></td><td><span class="tag tgr">${r.concluidas}</span></td><td><span class="tag ${r.urgentes?'tr':'tgr'}">${r.urgentes}</span></td><td><div style="display:flex;align-items:center;gap:6px"><div style="background:var(--border);border-radius:4px;height:6px;width:80px;overflow:hidden"><div style="background:var(--green);height:6px;width:${r.total?Math.round(r.concluidas/r.total*100):0}%"></div></div><span style="font-size:12px">${r.total?Math.round(r.concluidas/r.total*100):0}%</span></div></td></tr>`).join('')}
      </tbody></table>`;

  } else if(tipo==='por_usuario') {
    const mapa = {};
    dems.forEach(d=>{
      const uid = d.responsavel_atual_id;
      const nome = getNome(profs,uid);
      if(!mapa[uid]) mapa[uid]={nome,total:0,abertas:0,concluidas:0,urgentes:0};
      mapa[uid].total++;
      if(['aberta','em_andamento','aguardando_cliente','aguardando_orgao','aguardando_conclusao'].includes(d.status)) mapa[uid].abertas++;
      if(d.status==='concluida') mapa[uid].concluidas++;
      if(d.prioridade==='urgente') mapa[uid].urgentes++;
    });
    dados = Object.values(mapa).sort((a,b)=>b.total-a.total);
    relDados = dados;
    html = `<table><thead><tr><th>Colaborador</th><th>Total</th><th>Ativas</th><th>Concluídas</th><th>Urgentes</th><th>Taxa Conclusão</th></tr></thead><tbody>
      ${dados.map(r=>`<tr><td><strong>${r.nome}</strong></td><td>${r.total}</td><td>${r.abertas}</td><td>${r.concluidas}</td><td><span class="tag ${r.urgentes?'tr':'tgr'}">${r.urgentes}</span></td><td><span class="tag tg">${r.total?Math.round(r.concluidas/r.total*100):0}%</span></td></tr>`).join('')}
      </tbody></table>`;

  } else if(tipo==='por_mes') {
    const mapa = {};
    dems.forEach(d=>{
      const dt = new Date(d.created_at);
      const key = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
      const label2 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][dt.getMonth()]+'/'+dt.getFullYear();
      if(!mapa[key]) mapa[key]={key,label:label2,total:0,concluidas:0,urgentes:0};
      mapa[key].total++;
      if(d.status==='concluida') mapa[key].concluidas++;
      if(d.prioridade==='urgente') mapa[key].urgentes++;
    });
    dados = Object.values(mapa).sort((a,b)=>a.key.localeCompare(b.key));
    relDados = dados;
    html = `<table><thead><tr><th>Mês</th><th>Total Abertas</th><th>Concluídas</th><th>Urgentes</th><th>Taxa</th></tr></thead><tbody>
      ${dados.map(r=>`<tr><td><strong>${r.label}</strong></td><td>${r.total}</td><td>${r.concluidas}</td><td><span class="tag ${r.urgentes?'tr':'tgr'}">${r.urgentes}</span></td><td><span class="tag tg">${r.total?Math.round(r.concluidas/r.total*100):0}%</span></td></tr>`).join('')}
      </tbody></table>`;

  } else if(tipo==='por_tipo') {
    const mapa = {};
    dems.forEach(d=>{
      const tid = d.tipo_demanda_id;
      const tNome = getNome(tipos,tid);
      const cid = tipos.find(t=>t.id===tid)?.categoria_id;
      const cNome = getNome(categ,cid);
      const depId = d.departamento_atual_id||d.departamento_id;
      const dNome = getNome(deptsAll,depId);
      const key = tid||tNome;
      if(!mapa[key]) mapa[key]={depto:dNome,categoria:cNome,tipo:tNome,total:0,concluidas:0};
      mapa[key].total++;
      if(d.status==='concluida') mapa[key].concluidas++;
    });
    dados = Object.values(mapa).sort((a,b)=>b.total-a.total);
    relDados = dados;
    html = `<table><thead><tr><th>Departamento</th><th>Categoria</th><th>Tipo de Serviço</th><th>Total</th><th>Concluídas</th></tr></thead><tbody>
      ${dados.map(r=>`<tr><td style="font-size:12px;color:var(--text3)">${r.depto}</td><td style="font-size:12px;color:var(--text3)">${r.categoria}</td><td><strong>${r.tipo}</strong></td><td>${r.total}</td><td><span class="tag tg">${r.concluidas}</span></td></tr>`).join('')}
      </tbody></table>`;

  } else if(tipo==='por_cliente') {
    const mapa = {};
    dems.forEach(d=>{
      const cid = d.cliente_id;
      const cNome = getNome(clis,cid);
      if(!mapa[cid]) mapa[cid]={nome:cNome,total:0,abertas:0,concluidas:0,ultima:''};
      mapa[cid].total++;
      if(['aberta','em_andamento'].includes(d.status)) mapa[cid].abertas++;
      if(d.status==='concluida') mapa[cid].concluidas++;
      if(d.created_at>mapa[cid].ultima) mapa[cid].ultima=d.created_at;
    });
    dados = Object.values(mapa).sort((a,b)=>b.total-a.total);
    relDados = dados;
    html = `<table><thead><tr><th>Cliente</th><th>Total</th><th>Ativas</th><th>Concluídas</th><th>Último Atend.</th></tr></thead><tbody>
      ${dados.map(r=>`<tr><td><strong>${r.nome}</strong></td><td>${r.total}</td><td>${r.abertas}</td><td>${r.concluidas}</td><td style="font-size:12px">${r.ultima?new Date(r.ultima).toLocaleDateString('pt-BR'):'—'}</td></tr>`).join('')}
      </tbody></table>`;

  } else if(tipo==='demandas_mes') {
    dados = demsNoPeriodo.map(d=>({
      Número:d.numero,
      Cliente:getNome(clis,d.cliente_id),
      Departamento:getNome(deptsAll,d.departamento_atual_id||d.departamento_id),
      Tipo:getNome(tipos,d.tipo_demanda_id),
      Status:d.status,Prioridade:d.prioridade,
      Responsável:getNome(profs,d.responsavel_atual_id),
      Aberta:d.created_at?new Date(d.created_at).toLocaleDateString('pt-BR'):'',
      Conclusão:d.data_conclusao?new Date(d.data_conclusao).toLocaleDateString('pt-BR'):'',
      Resumo:d.resumo
    }));
    relDados = dados;
    html = `<div style="overflow-x:auto"><table><thead><tr>${Object.keys(dados[0]||{}).map(k=>`<th>${k}</th>`).join('')}</tr></thead><tbody>
      ${dados.map(r=>`<tr>${Object.values(r).map(v=>`<td style="font-size:12px">${v||'—'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;

  } else if(tipo==='pendencias') {
    const pendAberta = pends.filter(p=>!p.resolvida);
    dados = pendAberta.map(p=>{
      const d = dems.find(x=>x.id===p.demanda_id);
      return {
        Demanda:d?.numero||'—',
        Cliente:getNome(clis,d?.cliente_id),
        Pendência:p.descricao,
        Responsável:getNome(profs,p.responsavel_id),
        Criada:p.created_at?new Date(p.created_at).toLocaleDateString('pt-BR'):'',
      };
    });
    relDados = dados;
    html = dados.length ? `<table><thead><tr>${Object.keys(dados[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead><tbody>
      ${dados.map(r=>`<tr>${Object.values(r).map(v=>`<td style="font-size:12px">${v||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<div class="vazio">Nenhuma pendência em aberto 🎉</div>';

  } else if(tipo==='sla') {
    const concluidas = dems.filter(d=>d.status==='concluida'&&d.data_conclusao&&d.created_at);
    const mapa = {};
    concluidas.forEach(d=>{
      const depId = d.departamento_atual_id||d.departamento_id;
      const dNome = getNome(deptsAll,depId);
      const dias = Math.round((new Date(d.data_conclusao)-new Date(d.created_at))/86400000);
      if(!mapa[dNome]) mapa[dNome]={depto:dNome,qtd:0,totalDias:0,minDias:999,maxDias:0};
      mapa[dNome].qtd++;
      mapa[dNome].totalDias+=dias;
      if(dias<mapa[dNome].minDias) mapa[dNome].minDias=dias;
      if(dias>mapa[dNome].maxDias) mapa[dNome].maxDias=dias;
    });
    dados = Object.values(mapa).map(r=>({...r,mediaDias:Math.round(r.totalDias/r.qtd)})).sort((a,b)=>a.mediaDias-b.mediaDias);
    relDados = dados;
    html = dados.length ? `<table><thead><tr><th>Departamento</th><th>Concluídas</th><th>Média (dias)</th><th>Menor</th><th>Maior</th></tr></thead><tbody>
      ${dados.map(r=>`<tr><td><strong>${r.depto}</strong></td><td>${r.qtd}</td><td><span class="tag ${r.mediaDias<=7?'tg':r.mediaDias<=30?'ta':'tr'}">${r.mediaDias}d</span></td><td>${r.minDias}d</td><td>${r.maxDias}d</td></tr>`).join('')}</tbody></table>`
      : '<div class="vazio">Nenhuma demanda concluída no período.</div>';
  }

  conteudo.innerHTML = html || '<div class="vazio">Nenhum dado encontrado.</div>';
}

// Inicializar filtros do relatório
function initRelatorios() {
  const deptSel = document.getElementById('relDept');
  const userSel = document.getElementById('relUser');
  if(deptSel) { deptSel.innerHTML='<option value="">Todos</option>'; deps.forEach(d=>deptSel.innerHTML+=`<option value="${d.id}">${d.nome}</option>`); }
  if(userSel) { userSel.innerHTML='<option value="">Todos</option>'; cols.forEach(c=>userSel.innerHTML+=`<option value="${c.id}">${c.nome}</option>`); }
  document.getElementById('relPeriodo')?.addEventListener('change', function(){
    const show = this.value==='custom';
    ['relDataIniWrap','relDataFimWrap'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=show?'block':'none'; });
  });
  // Datas padrão
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
  const fmt = d => d.toISOString().split('T')[0];
  const diEl = document.getElementById('relDataIni'); if(diEl) diEl.value = fmt(ini);
  const dfEl = document.getElementById('relDataFim'); if(dfEl) dfEl.value = fmt(fim);
}



function getNomeFeriado(ano, mes, dia) {
  const dataStr = ano+'-'+String(mes+1).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
  const mmdd = dataStr.slice(5);
  const nac = {
    '01-01':'Confraternização Universal',
    '04-21':'Tiradentes',
    '05-01':'Dia do Trabalho',
    '09-07':'Independência do Brasil',
    '10-12':'Nossa Senhora Aparecida',
    '11-02':'Finados',
    '11-15':'Proclamação da República',
    '11-20':'Consciência Negra',
    '12-25':'Natal'
  };
  if(nac[mmdd]) return nac[mmdd];
  const municipais = JSON.parse(localStorage.getItem('focco_feriados')||'[]');
  const mun = municipais.find(f=>f.data===dataStr||(f.ano===0&&f.data.slice(5)===mmdd));
  return mun?.nome||null;
}

function isFeriadoDia(ano, mes, dia) {
  return !!getNomeFeriado(ano, mes, dia);
}

function renderDashCal() {
  const hoje = new Date();
  // Usar as mesmas variáveis do Calendário Fiscal para sincronismo total
  const ano = dashCalAno, mes = dashCalMesAtual;
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  document.getElementById('dashCalTitulo').textContent = nomesMes[mes] + ' de ' + ano;

  // MESMA FONTE DO CALENDÁRIO FISCAL: getObrigacoesMes → convertido em mapa por dia
  const obrigLista = getObrigacoesMes(ano, mes);
  const obrigPorDia = {};
  obrigLista.forEach(o => {
    if(!obrigPorDia[o.dia]) obrigPorDia[o.dia] = [];
    obrigPorDia[o.dia].push(o);
  });

  // Compromissos do mês — calculado ANTES do loop do grid
  const todosCompDash = JSON.parse(localStorage.getItem('focco_compromissos')||'[]')
    .filter(c=>{
      const cd=new Date(c.data+'T12:00:00');
      return cd.getFullYear()===ano && cd.getMonth()===mes && c.usuario_id===U?.id;
    });
  const compPorDia = {};
  todosCompDash.forEach(c=>{
    const d=new Date(c.data+'T12:00:00').getDate();
    if(!compPorDia[d]) compPorDia[d]=[];
    compPorDia[d].push(c);
  });

  // Feriados — calculado ANTES do loop do grid
  const feriadosAnoD = getFeriadosAno(ano);

  // Gerar grade do calendário
  let cells = '';
  for(let i = 0; i < primeiroDia; i++) {
    cells += '<div style="min-height:40px"></div>';
  }

  for(let d = 1; d <= totalDias; d++) {
    const isHoje = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
    const isPassado = new Date(ano, mes, d) < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const temObrig = obrigPorDia[d]?.length > 0;
    const cores = temObrig ? [...new Set(obrigPorDia[d].map(o => o.cor))] : [];
    const isSab = (primeiroDia + d - 1) % 7 === 6;
    const isDom = (primeiroDia + d - 1) % 7 === 0;
    const fimSem = isSab || isDom;
    const nomeFer = getNomeFeriado(ano, mes, d);
    const isFer = !!nomeFer;

    let bg = 'transparent', textColor = 'var(--text)', border = 'none';
    if(isHoje)       { bg = 'var(--accent)'; textColor = '#fff'; border = '2px solid var(--accent)'; }
    else if(isFer)   { bg = '#FEF9C3'; textColor = '#92400E'; border = '1px solid #FCD34D'; }
    else if(fimSem)  { textColor = 'var(--text3)'; }
    else if(isPassado && temObrig) { bg = 'var(--surface2)'; }

    // Compromissos do dia
    const compsDoD = (compPorDia[d]||[]);
    const compDot = compsDoD.length ? `<span style="width:5px;height:5px;border-radius:50%;background:#0F9B6E;display:inline-block;margin-left:1px"></span>` : '';
    const dots = cores.slice(0,2).map(c =>
      `<span style="width:4px;height:4px;border-radius:50%;background:${c};display:inline-block"></span>`
    ).join('');

    const tooltip = [
      isFer ? '🗓️ '+nomeFer : '',
      temObrig ? obrigPorDia[d].map(o=>o.sigla||o.nome).join(', ') : '',
      compsDoD.length ? compsDoD.length+' compromisso(s)' : ''
    ].filter(Boolean).join(' | ');

    cells += `<div onclick="dashCalDiaClick(${d})" title="${tooltip}" style="padding:3px 2px;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:4px;cursor:pointer;border-radius:6px;background:${bg};border:${border};transition:all .12s">
      <span style="font-size:11px;font-weight:${isHoje||temObrig||isFer?'700':'400'};color:${textColor};line-height:1">${d}</span>
      ${isFer&&!isHoje ? `<span style="font-size:7px;color:#D97706;font-weight:700;line-height:1">FER</span>` : ''}
      ${(dots||compDot) && !isFer ? `<div style="display:flex;gap:1px;margin-top:1px">${dots}${compDot}</div>` : ''}
      ${temObrig&&isFer ? `<div style="display:flex;gap:1px;margin-top:1px">${dots}</div>` : ''}
    </div>`;
  }
  document.getElementById('dashCalGrid').innerHTML = cells;

  // Lista do mês — todos os eventos
  let lista = '';

  // Feriados + todos os dias com evento para a lista
  const feriadosPorDia = {};
  for(let d=1; d<=totalDias; d++){
    const n=getNomeFeriado(ano,mes,d);
    if(n) feriadosPorDia[d]=n;
  }
  const todosDias = new Set([
    ...Object.keys(obrigPorDia).map(Number),
    ...Object.keys(feriadosPorDia).map(Number),
    ...Object.keys(compPorDia).map(Number)
  ]);
  const diasOrdenados = [...todosDias].sort((a,b)=>a-b);

  if(diasOrdenados.length === 0) {
    lista = '<div class="vazio" style="padding:20px">Nenhuma obrigação ou feriado cadastrado</div>';
  } else {
    diasOrdenados.forEach(d => {
      const dt = new Date(ano, mes, d);
      const passado = dt < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const ehHoje = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
      const diasRestantes = Math.ceil((dt - new Date()) / 86400000);
      const nomeFer = feriadosPorDia[d];
      const temObrigNoDia = obrigPorDia[d]?.length > 0;

      lista += `<div id="dashObrig_${d}" style="border-bottom:1px solid var(--border)">
        <div style="padding:8px 14px 4px;display:flex;align-items:center;gap:8px">
          <div style="width:36px;height:36px;border-radius:8px;background:${ehHoje?'var(--accent)':nomeFer?'#FEF9C3':passado?'var(--surface2)':'var(--accent-pale)'};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border:${nomeFer&&!ehHoje?'1px solid #FCD34D':'none'}">
            <span style="font-size:13px;font-weight:700;color:${ehHoje?'#fff':nomeFer?'#92400E':passado?'var(--text3)':'var(--accent)'};line-height:1">${d}</span>
            <span style="font-size:8px;color:${ehHoje?'rgba(255,255,255,.7)':nomeFer?'#D97706':'var(--text3)'};line-height:1">${dt.toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase()}</span>
          </div>
          <div style="flex:1">
            ${nomeFer ? `
              <div style="display:flex;align-items:center;gap:6px;padding:2px 0">
                <span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;flex-shrink:0"></span>
                <span style="font-size:11px;font-weight:600;color:#92400E">🗓️ ${nomeFer}</span>
                <span style="margin-left:auto;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;background:#FEF3C7;color:#D97706;white-space:nowrap;flex-shrink:0">FERIADO</span>
              </div>` : ''}
            ${temObrigNoDia ? obrigPorDia[d].map(o => `
              <div style="display:flex;align-items:center;gap:6px;padding:2px 0">
                <span style="width:6px;height:6px;border-radius:50%;background:${o.cor};flex-shrink:0"></span>
                <span style="font-size:11px;color:${passado?'var(--text3)':'var(--text)'};${passado?'text-decoration:line-through':''};">${o.nome}</span>
                <span style="margin-left:auto;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;background:var(--surface2);color:var(--text3);white-space:nowrap;flex-shrink:0">${o.sigla}</span>
              </div>`).join('') : ''}
          </div>
          <div style="flex-shrink:0;text-align:right">
            ${ehHoje ? '<span style="font-size:10px;font-weight:700;color:var(--red);background:var(--red-pale);padding:2px 7px;border-radius:10px">HOJE</span>'
              : passado ? '<span style="font-size:10px;color:var(--text3)">Passou</span>'
              : `<span style="font-size:10px;font-weight:600;color:${diasRestantes<=3?'var(--red)':diasRestantes<=7?'var(--amber)':'var(--text3)'}">em ${diasRestantes}d</span>`}
          </div>
        </div>
        ${(compPorDia[d]||[]).map(c=>{
          const ti={reuniao:'🤝',prazo:'⏰',visita:'🏢',ligacao:'📞',treinamento:'📚',interno:'📋',outro:'📌'};
          return `<div style="padding:4px 14px 4px 58px;display:flex;align-items:center;gap:6px">
            <span>${ti[c.tipo]||'📌'}</span>
            <span style="font-size:12px;font-weight:500;color:var(--text)">${c.titulo}</span>
            ${c.hora?`<span style="font-size:11px;color:var(--accent);font-weight:600">🕐 ${c.hora}</span>`:''}
          </div>`;
        }).join('')}
      </div>`;
    });
  }
  document.getElementById('dashObrigLista').innerHTML = lista;

  // Auto-scroll para hoje se estiver no mês atual
  if(mes === hoje.getMonth() && ano === hoje.getFullYear()) {
    const elHoje = document.getElementById('dashObrig_' + hoje.getDate());
    if(elHoje) setTimeout(() => elHoje.scrollIntoView({behavior:'smooth', block:'nearest'}), 100);
  }
}

function dashCalDiaClick(d) {
  mostrarCompromissosDia(d);
  const el = document.getElementById('dashObrig_' + d);
  if(el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

document.querySelectorAll('.nav').forEach(n=>n.addEventListener('click',_closeSidebarMobile));

carregarConfigsWA();
initCalendario();
// Força reset se versão mudou
const DB_VERSION = '6.0';
if(localStorage.getItem('focco_version') !== DB_VERSION) {
  // Nova versão — limpa apenas dados estruturais, preserva demandas se existirem
  const demBackup = localStorage.getItem('focco_db_demandas');
  const tramBackup = localStorage.getItem('focco_db_tramites');
  const cliBackup = localStorage.getItem('focco_db_clientes');
  const profBackup = localStorage.getItem('focco_db_profiles');
  localStorage.clear();
  localStorage.setItem('focco_version', DB_VERSION);
  // Restaura dados operacionais se existiam
  if(demBackup && demBackup !== '[]') localStorage.setItem('focco_db_demandas', demBackup);
  if(tramBackup && tramBackup !== '[]') localStorage.setItem('focco_db_tramites', tramBackup);
  if(cliBackup && cliBackup !== '[]') localStorage.setItem('focco_db_clientes', cliBackup);
  if(profBackup && profBackup !== '[]') localStorage.setItem('focco_db_profiles', profBackup);
}
initDB().then(()=>{ init(); });
