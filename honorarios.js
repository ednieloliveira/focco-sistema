
// ══════════════════════════════════════════
let honorarios = JSON.parse(localStorage.getItem('focco_honorarios') || '[]');
 
async function loadFinanceiro() {
  const receber = honorarios.filter(h=>h.status==='pendente');
  const recebidos = honorarios.filter(h=>h.status==='pago' && h.venc >= new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const atrasados = honorarios.filter(h=>h.status==='atrasado'||(h.status==='pendente'&&h.venc<new Date().toISOString().split('T')[0]));
  document.getElementById('fink1').textContent = `R$ ${receber.reduce((s,h)=>s+(h.valor||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  document.getElementById('fink2').textContent = `R$ ${recebidos.reduce((s,h)=>s+(h.valor||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  document.getElementById('fink3').textContent = atrasados.length;
  const {count:cliAtivos} = await sb.from('clientes').select('*',{count:'exact',head:true}).eq('ativo',true);
  document.getElementById('fink4').textContent = cliAtivos||0;
 
  const el = document.getElementById('finHonorarios');
  if (!honorarios.length) {
    el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text3)"><div style="font-size:36px;margin-bottom:8px">💰</div><div style="font-weight:600;margin-bottom:4px">Nenhum honorário cadastrado</div><button class="btn btn-p" style="margin-top:12px" onclick="abrirModalHonorario()">+ Lançar Honorário</button></div>`;
  } else {
    el.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>Cliente</th><th>Referência</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>
      ${honorarios.sort((a,b)=>a.venc>b.venc?1:-1).map(h=>`<tr>
        <td>${h.cliNome||'—'}</td><td>${h.ref||'—'}</td>
        <td><strong>R$ ${(h.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></td>
        <td>${h.venc?new Date(h.venc+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
        <td><span class="tag ${h.status==='pago'?'tg':h.status==='atrasado'?'tr':'ta'}">${h.status}</span></td>
        <td><button class="btn btn-s" style="padding:4px 8px;font-size:11px" onclick="toggleHon('${h.id}')">
          ${h.status==='pago'?'↩ Desfazer':'✓ Pago'}
        </button></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }
 
  const hj = new Date().toISOString().split('T')[0];
  const prox7 = honorarios.filter(h=>h.status==='pendente'&&h.venc&&h.venc<=new Date(Date.now()+7*86400000).toISOString().split('T')[0]);
  document.getElementById('finVencimentos').innerHTML = prox7.length ?
    prox7.map(h=>`<div class="ui"><div class="uc" style="background:${h.venc<hj?'var(--red)':'var(--amber)'}"></div><div class="uinfo"><div class="utit">${h.cliNome}</div><div class="umeta">R$ ${(h.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})} · ${new Date(h.venc+'T12:00:00').toLocaleDateString('pt-BR')}</div></div></div>`).join('') :
    '<div class="vazio">Nenhum vencimento nos próximos 7 dias.</div>';
}
 
async function abrirModalHonorario() {
  const {data:cls} = await sb.from('clientes').select('id,nome').eq('ativo',true).order('nome');
  const sel = document.getElementById('honCli');
  sel.innerHTML = '<option value="">Selecione...</option>';
  (cls||[]).forEach(c => { sel.innerHTML += `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`; });
  document.getElementById('honValor').value = '';
  document.getElementById('honRef').value = '';
  const hoje = new Date(); hoje.setDate(hoje.getDate()+30);
  document.getElementById('honVenc').value = hoje.toISOString().split('T')[0];
  document.getElementById('honStatus').value = 'pendente';
  om('mHonorario');
}
 
function salvarHonorario() {
  const cliEl = document.getElementById('honCli');
  const cliId = cliEl.value;
  const cliNome = cliEl.options[cliEl.selectedIndex]?.dataset?.nome || '';
  const valor = parseFloat(document.getElementById('honValor').value);
  const venc = document.getElementById('honVenc').value;
  if (!cliId || !valor || !venc) { toast('Preencha cliente, valor e vencimento','err'); return; }
  const novo = { id: Date.now().toString(), cliId, cliNome, valor, venc, ref: document.getElementById('honRef').value, status: document.getElementById('honStatus').value };
  honorarios.push(novo);
  localStorage.setItem('focco_honorarios', JSON.stringify(honorarios));
  toast('Honorário lançado!','ok'); fm('mHonorario'); loadFinanceiro();
}
 
function toggleHon(id) {
  const h = honorarios.find(x=>x.id===id);
  if (!h) return;
  h.status = h.status==='pago' ? 'pendente' : 'pago';
  localStorage.setItem('focco_honorarios', JSON.stringify(honorarios));
  loadFinanceiro();
}
 
// ══════════════════════════════════════════
// RELATÓRIOS
// ══════════════════════════════════════════
let relDados = [], relTituloAtual = '';
 
async function gerarRelatorio(tipo) {
  document.getElementById('relatorioResultado').style.display = 'block';
  document.getElementById('relatorioConteudo').innerHTML = '<div class="loading">Gerando relatório...</div>';
  const hj = new Date().toISOString().split('T')[0];
  const im = new Date(); im.setDate(1);
 
  if (tipo === 'demandas_mes') {
    relTituloAtual = `Demandas — ${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`;
    document.getElementById('relatorioTitulo').textContent = relTituloAtual;
    const {data} = await sb.from('demandas').select('numero,resumo,status,prioridade,created_at,data_conclusao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome)').gte('created_at',im.toISOString()).order('created_at');
    relDados = data || [];
    renderRelatorioTabela(['Número','Cliente','Resumo','Status','Prioridade','Responsável','Depto','Abertura'], relDados.map(d=>[d.numero,d.clientes?.nome,d.resumo,SL[d.status]||d.status,d.prioridade,d.profiles?.nome,d.departamentos?.nome,new Date(d.created_at).toLocaleDateString('pt-BR')]));
  }
  else if (tipo === 'produtividade') {
    relTituloAtual = 'Produtividade da Equipe';
    document.getElementById('relatorioTitulo').textContent = relTituloAtual;
    const {data} = await sb.from('demandas').select('responsavel_atual_id,status,ultima_movimentacao,profiles!demandas_responsavel_atual_id_fkey(nome)').not('status','in','(cancelada)');
    const map = {};
    (data||[]).forEach(d => {
      const id = d.responsavel_atual_id, nome = d.profiles?.nome||'?';
      if (!map[id]) map[id] = {nome, total:0, concluidas:0, ativas:0};
      map[id].total++;
      if (d.status==='concluida') map[id].concluidas++;
      else map[id].ativas++;
    });
    relDados = Object.values(map).sort((a,b)=>b.total-a.total);
    renderRelatorioTabela(['Colaborador','Total','Ativas','Concluídas','Taxa Conclusão'], relDados.map(d=>[d.nome,d.total,d.ativas,d.concluidas,d.total>0?Math.round(d.concluidas/d.total*100)+'%':'0%']));
  }
  else if (tipo === 'clientes_ativos') {
    relTituloAtual = 'Clientes Ativos';
    document.getElementById('relatorioTitulo').textContent = relTituloAtual;
    const {data:cls} = await sb.from('clientes').select('id,nome,tipo_pessoa,tipo_cliente,cpf_cnpj,whatsapp').eq('ativo',true).order('nome');
    const {data:dems} = await sb.from('demandas').select('cliente_id,status,ultima_movimentacao');
    const map = {};
    (dems||[]).forEach(d => { if (!map[d.cliente_id]) map[d.cliente_id]={total:0,ativas:0}; map[d.cliente_id].total++; if(d.status!=='concluida'&&d.status!=='cancelada') map[d.cliente_id].ativas++; });
    relDados = (cls||[]).map(c=>({...c, ...map[c.id]||{total:0,ativas:0}}));
    renderRelatorioTabela(['Cliente','Tipo','CPF/CNPJ','WhatsApp','Demandas','Ativas'], relDados.map(d=>[d.nome,d.tipo_pessoa==='juridica'?'PJ':'PF',d.cpf_cnpj||'—',d.whatsapp||'—',d.total,d.ativas]));
  }
  else if (tipo === 'pendencias') {
    relTituloAtual = 'Pendências em Aberto';
    document.getElementById('relatorioTitulo').textContent = relTituloAtual;
    const {data} = await sb.from('pendencias').select('*,demandas(numero,clientes(nome))').eq('resolvida',false).order('created_at');
    relDados = data||[];
    renderRelatorioTabela(['Demanda','Cliente','Tipo','Descrição','Vencimento','Criada em'], relDados.map(p=>[p.demandas?.numero,p.demandas?.clientes?.nome,p.tipo.replace(/_/g,' '),p.descricao,p.data_prevista?new Date(p.data_prevista+'T12:00:00').toLocaleDateString('pt-BR'):'—',new Date(p.created_at).toLocaleDateString('pt-BR')]));
  }
  else if (tipo === 'inatividade') {
    relTituloAtual = 'Demandas Sem Movimentação';
    document.getElementById('relatorioTitulo').textContent = relTituloAtual;
    const {data} = await sb.from('vw_demandas_inatividade').select('*').order('dias_sem_movimentacao',{ascending:false});
    relDados = data||[];
    renderRelatorioTabela(['Número','Cliente','Responsável','Depto','Dias parada','Nível'], relDados.map(d=>[d.numero,d.cliente_nome,d.responsavel_nome,d.departamento_nome,d.dias_sem_movimentacao,d.nivel_inatividade.replace(/_/g,' ')]));
  }
  else if (tipo === 'por_tipo') {
    relTituloAtual = 'Demandas por Tipo de Serviço';
    document.getElementById('relatorioTitulo').textContent = relTituloAtual;
    const {data} = await sb.from('demandas').select('tipos_demanda(nome),departamentos!demandas_departamento_atual_id_fkey(nome),status');
    const map = {};
    (data||[]).forEach(d => {
      const k = d.tipos_demanda?.nome||'—';
      if (!map[k]) map[k]={tipo:k,dep:d.departamentos?.nome||'—',total:0,ativas:0,concluidas:0};
      map[k].total++;
      if(d.status==='concluida') map[k].concluidas++;
      else if(d.status!=='cancelada') map[k].ativas++;
    });
    relDados = Object.values(map).sort((a,b)=>b.total-a.total);
    renderRelatorioTabela(['Tipo de Serviço','Departamento','Total','Ativas','Concluídas'], relDados.map(d=>[d.tipo,d.dep,d.total,d.ativas,d.concluidas]));
  }
}
 
function renderRelatorioTabela(cabecalhos, linhas) {
  if (!linhas.length) { document.getElementById('relatorioConteudo').innerHTML='<div class="vazio">Nenhum dado encontrado.</div>'; return; }
  document.getElementById('relatorioConteudo').innerHTML = `<div style="margin-bottom:10px;font-size:13px;color:var(--text3)">${linhas.length} registro(s) encontrado(s)</div><div style="overflow-x:auto"><table><thead><tr>${cabecalhos.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l=>`<tr>${l.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
 
async function gerarExcelRelatorio(tipo) {
  await gerarRelatorio(tipo || 'demandas_mes');
  setTimeout(() => {
    if (!relDados.length) return;
    exportarExcel(relDados.map(r => {
      const obj = {};
      document.querySelectorAll('#relatorioConteudo th').forEach((th,i) => { obj[th.textContent] = r[i]||''; });
      return obj;
    }), 'focco_'+relTituloAtual.toLowerCase().replace(/\s+/g,'_'), relTituloAtual);
  }, 500);
}
 
function exportarExcelRel() {
  if (!relDados.length) { toast('Gere um relatório primeiro','err'); return; }
  const ths = [...document.querySelectorAll('#relatorioConteudo th')].map(t=>t.textContent);
  const rows = [...document.querySelectorAll('#relatorioConteudo tbody tr')];
  const dados = rows.map(tr => {
    const obj = {};
    [...tr.querySelectorAll('td')].forEach((td,i) => { obj[ths[i]||'Col'+i] = td.textContent; });
    return obj;
  });
  exportarExcel(dados, 'focco_'+relTituloAtual.toLowerCase().replace(/\s+/g,'_'), relTituloAtual);
}
 
function exportarCSV() {
  if (!relDados.length) { toast('Gere um relatório primeiro','err'); return; }
  const el = document.getElementById('relatorioConteudo');
  const ths = [...el.querySelectorAll('th')].map(t=>t.textContent);
  const rows = [...el.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>'"'+td.textContent.replace(/"/g,'""')+'"'));
  const csv = [ths.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focco_${relTituloAtual.toLowerCase().replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  toast('CSV exportado!','ok');
}
 
// ══════════════════════════════════════════
// WHATSAPP
// ══════════════════════════════════════════
function salvarWAConfig() {
  const config = { prov: document.getElementById('waProv').value, url: document.getElementById('waUrl').value, token: document.getElementById('waToken').value, inst: document.getElementById('waInst').value };
