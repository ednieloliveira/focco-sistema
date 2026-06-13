function isDiaUtil(data, feriados) {
  const d = new Date(data+'T12:00:00');
  const dow = d.getDay();
  if(dow===0||dow===6) return false;
  const key = data;
  return !feriados.has(key);
}

// calcVencimento — alias de calcDiaVencimento para compatibilidade
function calcVencimento(ano, mes, diaBase, regra) {
  return calcDiaVencimento(ano, mes, diaBase, regra);
}

// Carregar obrigações do localStorage
function getObrigacoes() {
  return JSON.parse(localStorage.getItem('focco_obrigacoes')||'[]');
}

// getFeriados — alias de getFeriadosAno para compatibilidade
function getFeriados(ano) {
  return getFeriadosAno(ano);
}

// Montar mapa de obrigações por dia real para um mês/ano
// getObrigPorDia — usa getObrigacoesMes para garantir dados idênticos nos 2 calendários
function getObrigPorDia(ano, mes) {
  const lista = getObrigacoesMes(ano, mes); // mesma fonte que o Calendário Fiscal
  const mapa = {};
  lista.forEach(o => {
    const d = o.dia;
    if(!mapa[d]) mapa[d] = [];
    mapa[d].push(o);
  });
  return mapa;
}

function dashCalMes(d) {
  dashCalMesAtual += d;
  if(dashCalMesAtual > 11) { dashCalMesAtual = 0; dashCalAno++; }
  if(dashCalMesAtual < 0)  { dashCalMesAtual = 11; dashCalAno--; }
  // Sincronizar com Calendário Fiscal
  calAno = dashCalAno;
  calMes = dashCalMesAtual;
  renderDashCal();
}


// ═══════════════════════════════════════════════════════════════
// COMPROMISSOS — Agenda pessoal
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GESTÃO DO CALENDÁRIO TRIBUTÁRIO
// ═══════════════════════════════════════════════════════════════

function toggleMesBase(){
  const r=document.getElementById('obRecorrencia').value;
  document.getElementById('fgMesBase').style.display=r==='anual'?'':'none';
  document.getElementById('fgMesesEsp').style.display=r==='meses_especificos'?'':'none';
}

function abrirGestaoCalendario(){
  // Abre painel lateral de gestão — usa a página de parâmetros do calendário
  ir('cal');
  setTimeout(()=>{
    const el=document.getElementById('pg-cal');
    if(el) el.scrollIntoView({behavior:'smooth'});
  },200);
}

function abrirNovaObrigacao(id){
  document.getElementById('mObrigTit').textContent = id ? '✏️ Editar Obrigação' : '📋 Nova Obrigação';
  document.getElementById('obId').value='';
  document.getElementById('obNome').value='';
  document.getElementById('obSigla').value='';
  document.getElementById('obDia').value='';
  document.getElementById('obCor').value='#DC2626';
  document.getElementById('obRegra').value='postergar';
  document.getElementById('obTipo').value='federal';
  document.getElementById('obRecorrencia').value='mensal';
  document.getElementById('obObs').value='';
  document.getElementById('fgMesBase').style.display='none';
  document.getElementById('fgMesesEsp').style.display='none';
  document.querySelectorAll('.obMesEsp').forEach(c=>c.checked=false);

  if(id){
    const obs=getObrigacoes().find(o=>o.id===id);
    if(obs){
      document.getElementById('obId').value=obs.id;
      document.getElementById('obNome').value=obs.nome;
      document.getElementById('obSigla').value=obs.sigla;
      document.getElementById('obDia').value=obs.dia_base;
      document.getElementById('obCor').value=obs.cor||'#DC2626';
      document.getElementById('obRegra').value=obs.regra||'fixo';
      document.getElementById('obTipo').value=obs.tipo||'federal';
      document.getElementById('obRecorrencia').value=obs.recorrencia||'mensal';
      document.getElementById('obObs').value=obs.obs||'';
      toggleMesBase();
      if(obs.recorrencia==='anual') document.getElementById('obMesBase').value=obs.mes_base||0;
      if(obs.recorrencia==='meses_especificos'){
        const meses=(obs.meses||'').split(',').map(Number);
        document.querySelectorAll('.obMesEsp').forEach(c=>c.checked=meses.includes(parseInt(c.value)));
      }
    }
  }
  om('mObrigacao');
}

function salvarObrigacao(){
  const nome=document.getElementById('obNome').value.trim();
  const sigla=document.getElementById('obSigla').value.trim().toUpperCase();
  const dia=parseInt(document.getElementById('obDia').value);
  if(!nome||!sigla||!dia||dia<1||dia>31){toast('Preencha nome, sigla e dia base corretamente','err');return;}
  const recorrencia=document.getElementById('obRecorrencia').value;
  let meses='', mes_base=0;
  if(recorrencia==='anual') mes_base=parseInt(document.getElementById('obMesBase').value);
  if(recorrencia==='meses_especificos'){
    meses=[...document.querySelectorAll('.obMesEsp:checked')].map(c=>c.value).join(',');
    if(!meses){toast('Selecione pelo menos um mês','err');return;}
  }
  const id=document.getElementById('obId').value||uuid();
  const nova={
    id, nome, sigla,
    dia_base:dia,
    cor:document.getElementById('obCor').value||'#DC2626',
    regra:document.getElementById('obRegra').value,
    tipo:document.getElementById('obTipo').value,
    recorrencia,
    mes_base,
    meses,
    obs:document.getElementById('obObs').value.trim(),
    ativo:true,
    created_at:new Date().toISOString()
  };
  const lista=getObrigacoes().filter(o=>o.id!==id);
  lista.push(nova);
  lista.sort((a,b)=>a.dia_base-b.dia_base);
  localStorage.setItem('focco_obrigacoes',JSON.stringify(lista));
  fm('mObrigacao');
  renderDashCal();
  renderListaObrigacoes();
  if(typeof renderCalendario==='function') renderCalendario();
  toast('Obrigação "'+sigla+'" salva!','ok');
}

function excluirObrigacao(id){
  if(!confirm('Excluir esta obrigação?')) return;
  const lista=getObrigacoes().filter(o=>o.id!==id);
  localStorage.setItem('focco_obrigacoes',JSON.stringify(lista));
  renderDashCal();
  renderListaObrigacoes();
  if(typeof renderCalendario==='function') renderCalendario();
  toast('Obrigação excluída.','ok');
}

function renderListaObrigacoes(){
  const lista=getObrigacoes();
  const el=document.getElementById('calObrigLista');
  if(!el) return;
  const REGRA_LABEL={fixo:'Fixo',postergar:'Postergar',antecipar:'Antecipar',dias_uteis:'Dias Úteis',ultimo_util:'Último Útil'};
  const REC_LABEL={mensal:'Mensal',anual:'Anual',meses_especificos:'Meses específicos'};
  el.innerHTML=lista.length?`<table style="width:100%">
    <thead><tr>
      <th>Obrigação</th><th>Sigla</th><th>Dia Base</th><th>Regra</th><th>Recorrência</th><th>Tipo</th><th style="width:80px"></th>
    </tr></thead>
    <tbody>
    ${lista.map(o=>`<tr>
      <td style="font-size:13px"><span style="width:8px;height:8px;border-radius:50%;background:${o.cor};display:inline-block;margin-right:6px"></span>${o.nome}</td>
      <td><span class="tag ts" style="font-family:monospace">${o.sigla}</span></td>
      <td style="font-size:13px;font-weight:600;text-align:center">${o.dia_base}</td>
      <td style="font-size:12px">${REGRA_LABEL[o.regra]||o.regra}</td>
      <td style="font-size:12px">${REC_LABEL[o.recorrencia]||o.recorrencia}</td>
      <td style="font-size:11px;color:var(--text3)">${o.tipo}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button onclick="abrirNovaObrigacao('${o.id}')" class="btn btn-s btn-sm" style="padding:3px 7px">✏️</button>
          <button onclick="excluirObrigacao('${o.id}')" class="btn btn-er btn-sm" style="padding:3px 7px">×</button>
        </div>
      </td>
    </tr>`).join('')}
    </tbody></table>`
  :'<div class="vazio" style="padding:20px">Nenhuma obrigação cadastrada. Clique em + Nova Obrigação.</div>';
}

// ── FERIADOS ──────────────────────────────────────────────────────────────────
function abrirFeriados(){
  renderListaFeriados();
  om('mFeriados');
}
function adicionarFeriado(){
  const data=document.getElementById('ferData').value;
  const nome=document.getElementById('ferNome').value.trim();
  const recorrente=document.getElementById('ferRecorrente').checked;
  if(!data||!nome){toast('Informe data e nome','err');return;}
  const lista=JSON.parse(localStorage.getItem('focco_feriados')||'[]');
  lista.push({id:uuid(),data,nome,ano:recorrente?0:new Date(data+'T12:00:00').getFullYear()});
  localStorage.setItem('focco_feriados',JSON.stringify(lista));
  document.getElementById('ferData').value='';
  document.getElementById('ferNome').value='';
  document.getElementById('ferRecorrente').checked=false;
  renderListaFeriados();
  renderDashCal();
  toast('Feriado adicionado!','ok');
}
function excluirFeriado(id){
  const lista=JSON.parse(localStorage.getItem('focco_feriados')||'[]').filter(f=>f.id!==id);
  localStorage.setItem('focco_feriados',JSON.stringify(lista));
  renderListaFeriados();
  renderDashCal();
}
function renderListaFeriados(){
  const el=document.getElementById('ferLista');
  if(!el) return;
  const lista=JSON.parse(localStorage.getItem('focco_feriados')||'[]');
  el.innerHTML=lista.length?lista.map(f=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${f.nome}</div>
        <div style="font-size:11px;color:var(--text3)">${new Date(f.data+'T12:00:00').toLocaleDateString('pt-BR')} ${f.ano===0?'· Recorrente':''}</div>
      </div>
      <button onclick="excluirFeriado('${f.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px">×</button>
    </div>`).join('')
  :'<div class="vazio" style="padding:12px;font-size:12px">Nenhum feriado municipal cadastrado.</div>';
}


function abrirNovoCompromisso() {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('compData').value = hoje;
  document.getElementById('compHora').value = '09:00';
  document.getElementById('compTitulo').value = '';
  document.getElementById('compPart').value = '';
  document.getElementById('compDesc').value = '';
  document.getElementById('compTipo').value = 'reuniao';
  om('mCompromisso');
}

function salvarCompromisso() {
  const titulo = document.getElementById('compTitulo').value.trim();
  const data = document.getElementById('compData').value;
  if(!titulo || !data) { toast('Informe título e data','err'); return; }
  const comp = {
    id: uuid(),
    titulo,
    data,
    hora: document.getElementById('compHora').value || '',
    tipo: document.getElementById('compTipo').value,
    participantes: document.getElementById('compPart').value.trim(),
    descricao: document.getElementById('compDesc').value.trim(),
    usuario_id: U.id,
    created_at: new Date().toISOString()
  };
  const comps = JSON.parse(localStorage.getItem('focco_compromissos')||'[]');
  comps.push(comp);
  localStorage.setItem('focco_compromissos', JSON.stringify(comps));
  fm('mCompromisso');
  toast('Compromisso salvo!','ok');
  renderDashCal();
  // Se estava no calendário fiscal, atualizar o painel do dia
  if(window._compCalDia && calDiaSel===window._compCalDia) {
    selecionarDia(calDiaSel);
    renderCalendario();
    window._compCalDia = null;
  }
}

function getCompromissosMes(ano, mes) {
  const comps = JSON.parse(localStorage.getItem('focco_compromissos')||'[]');
  return comps.filter(c => {
    const d = new Date(c.data+'T12:00:00');
    return d.getFullYear()===ano && d.getMonth()===mes && c.usuario_id===U?.id;
  });
}

function excluirCompromisso(id) {
  if(!confirm('Excluir este compromisso?')) return;
  let comps = JSON.parse(localStorage.getItem('focco_compromissos')||'[]');
  comps = comps.filter(c=>c.id!==id);
  localStorage.setItem('focco_compromissos', JSON.stringify(comps));
  renderDashCal();
  toast('Compromisso excluído','ok');
}

function mostrarCompromissosDia(dia) {
  const comps = getCompromissosMes(dashCalAno, dashCalMesAtual);
  const doDia = comps.filter(c=>new Date(c.data+'T12:00:00').getDate()===dia);
  const painel = document.getElementById('dashCompromissosDia');
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const tipoIcon = {reuniao:'🤝',prazo:'⏰',visita:'🏢',ligacao:'📞',treinamento:'📚',interno:'📋',outro:'📌'};
  document.getElementById('dashCompDiaTit').textContent = `${dia} de ${nomesMes[dashCalMesAtual]} — Compromissos`;
  const list = document.getElementById('dashCompDiaList');
  list.innerHTML = doDia.length ? doDia.map(c=>`
    <div style="padding:8px 14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:8px">
      <span style="font-size:18px">${tipoIcon[c.tipo]||'📌'}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${c.titulo}</div>
        ${c.hora?`<div style="font-size:12px;color:var(--accent);font-weight:600">🕐 ${c.hora}</div>`:''}
        ${c.participantes?`<div style="font-size:12px;color:var(--text3)">👤 ${c.participantes}</div>`:''}
        ${c.descricao?`<div style="font-size:12px;color:var(--text3)">${c.descricao}</div>`:''}
      </div>
      <button onclick="excluirCompromisso('${c.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 4px" title="Excluir">×</button>
    </div>`).join('') : '<div class="vazio" style="padding:12px">Nenhum compromisso neste dia</div>';
  painel.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════
// RELATÓRIOS GERENCIAIS COMPLETOS
