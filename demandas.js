// loadDem — lê TUDO do localStorage, faz joins manuais, conta abas
async function loadDem() {
  const todas = dbGet('demandas');
  const clis  = dbGet('clientes');
  const profs = dbGet('profiles');
  const depts = dbGet('departamentos');
  allDem = todas.map(d=>({
    ...d,
    clientes:     clis.find(c=>c.id===d.cliente_id)||null,
    profiles:     profs.find(p=>p.id===d.responsavel_atual_id)||null,
    departamentos:depts.find(x=>x.id===(d.departamento_atual_id||d.departamento_id))||null,
  })).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  const aberta = allDem.filter(d=>!['aguardando_conclusao','concluida','cancelada'].includes(d.status));
  const aprov  = allDem.filter(d=>d.status==='aguardando_conclusao');
  const enc    = allDem.filter(d=>['concluida','cancelada'].includes(d.status));
  const cA=document.getElementById('cntAberta');   if(cA)  cA.textContent=aberta.length;
  const cAp=document.getElementById('cntAprovacao');if(cAp) cAp.textContent=aprov.length;
  const cE=document.getElementById('cntEncerrada'); if(cE)  cE.textContent=enc.length;
  const tot=document.getElementById('demTotal');
  if(tot) tot.textContent=allDem.length+' total · '+aberta.length+' ativas · '+enc.length+' encerradas';
  filtDem();
}

// filtDem — respeita aba ativa E seletor de status
function filtDem() {
  const b   = (document.getElementById('fBusca')?.value||'').toLowerCase();
  const s   = document.getElementById('fStatus')?.value||'';
  const p   = document.getElementById('fPrio')?.value||'';
  const dep = document.getElementById('fDep')?.value||'';
  const hj  = new Date().toISOString().split('T')[0];

  let f = allDem.filter(x=>{
    // Status: filtro manual tem prioridade sobre aba
    let ms;
    if(s==='todas')       ms=true;
    else if(s!=='')       ms=x.status===s;
    else if(abaAtual==='aberta')    ms=!['aguardando_conclusao','concluida','cancelada'].includes(x.status);
    else if(abaAtual==='aprovacao') ms=x.status==='aguardando_conclusao';
    else if(abaAtual==='encerrada') ms=['concluida','cancelada'].includes(x.status);
    else ms=true;

    const mb=!b||(x.numero||'').toLowerCase().includes(b)||(x.clientes?.nome||'').toLowerCase().includes(b)||(x.resumo||'').toLowerCase().includes(b);
    return ms&&mb&&(!p||x.prioridade===p)&&(!dep||x.departamento_atual_id===dep||x.departamento_id===dep);
  });

  if(!f.length){
    document.getElementById('demTabela').innerHTML='<tr><td colspan="8"><div class="vazio" style="padding:2rem">Nenhuma demanda encontrada.</div></td></tr>';
    return;
  }

  document.getElementById('demTabela').innerHTML=f.map(d=>{
    const isConcluida=['concluida','cancelada'].includes(d.status);
    const dias=Math.floor((Date.now()-new Date(d.ultima_movimentacao||d.created_at))/86400000);
    const dc=isConcluida?'tgr':dias>=10?'tr':dias>=5?'ta':dias>=2?'ta':'ts';
    const pv=d.prazo&&d.prazo<hj&&!isConcluida;
    return `<tr onclick="abrirDet('${d.id}')" style="${isConcluida?'opacity:.75;background:var(--surface2)':''}">
      <td><strong style="color:${isConcluida?'var(--text3)':'var(--accent)'};font-family:monospace">${d.numero}</strong></td>
      <td style="font-size:13px">${d.clientes?.nome||'—'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${d.resumo||'—'}</td>
      <td><span class="tag ${SC[d.status]||'tgr'}">${SL[d.status]||d.status}</span></td>
      <td><span class="tag ${PC[d.prioridade]||'tgr'}">${d.prioridade||'—'}</span></td>
      <td style="font-size:12px">${d.profiles?.nome||'—'}</td>
      <td><span class="tag ${dc}">${isConcluida?'✅':dias+'d'}</span></td>
      <td style="font-size:12px;color:${pv?'var(--red)':'inherit'}">${d.prazo?new Date(d.prazo+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// KANBAN
// ══════════════════════════════════════════
const KB_COLS = [
  { id:'a_fazer',    titulo:'A Fazer',            cor:'#0099E5', status:['aberta'] },
  { id:'andamento',  titulo:'Em Andamento',        cor:'#00C48C', status:['em_andamento','aguardando_aceite'] },
  { id:'ag_cliente', titulo:'Ag. Cliente',          cor:'#F59E0B', status:['aguardando_cliente'] },
  { id:'ag_docs',    titulo:'Ag. Documentos',       cor:'#8B5CF6', status:['aguardando_orgao','aguardando_gestor'] },
  { id:'revisao',    titulo:'Revisão',              cor:'#EC4899', status:['aguardando_conclusao'] },
  { id:'concluido',  titulo:'Concluído',            cor:'#64748B', status:['concluida'] },
];

function renderKanbanCards(todas, containerId, maxCards) {
  const hoje = new Date().toISOString().split('T')[0];
  const board = document.getElementById(containerId);
  if (!board) return;
  board.innerHTML = KB_COLS.map(col => {
    let cards = todas.filter(d => col.status.includes(d.status));
    // Vencidos sobem ao topo e ficam vermelhos
    cards.sort((a,b) => {
      const aOv = a.prazo && a.prazo < hoje && a.status !== 'concluida';
      const bOv = b.prazo && b.prazo < hoje && b.status !== 'concluida';
      if (aOv && !bOv) return -1;
      if (!aOv && bOv) return 1;
      return new Date(a.prazo||'9999') - new Date(b.prazo||'9999');
    });
    const exibir = maxCards ? cards.slice(0, maxCards) : cards;
    return `<div class="kb-col">
      <div style="background:${col.cor};padding:9px 12px;display:flex;align-items:center;justify-content:space-between">
        <div class="kb-col-title" style="font-family:Syne,sans-serif;font-weight:700;font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${col.titulo}</div>
        <span style="background:rgba(255,255,255,.28);color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;flex-shrink:0;margin-left:6px">${cards.length}</span>
      </div>
      <div class="kb-col-body">
        ${exibir.length ? exibir.map(d => {
          const dias = Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000);
          const overdue = d.prazo && d.prazo < hoje && d.status !== 'concluida';
          const diasCor = dias>=10?'var(--red)':dias>=5?'var(--amber)':'var(--text3)';
          const prioCor = PC[d.prioridade]==='tr'?{bg:'var(--red-pale)',c:'var(--red)'}:PC[d.prioridade]==='ta'?{bg:'var(--amber-pale)',c:'#d97706'}:{bg:'var(--sky-pale)',c:'var(--sky)'};
          const prazoStr = d.prazo ? new Date(d.prazo+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : null;
          return `<div class="kb-card${overdue?' overdue':''}" onclick="abrirDet('${d.id}')">
            <div class="kb-proto" style="color:${col.cor}">${d.numero}</div>
            <div class="kb-cli">${d.clientes?.nome||'—'}</div>
            ${d.departamentos?.nome?`<div class="kb-info">📁 ${d.departamentos.nome}</div>`:''}
            ${d.profiles?.nome?`<div class="kb-info">👤 ${d.profiles.nome}</div>`:''}
            <div class="kb-footer">
              <span class="kb-prio" style="background:${prioCor.bg};color:${prioCor.c}">⚡${d.prioridade}</span>
              ${prazoStr?`<span style="font-size:9px;color:${overdue?'var(--red)':'var(--text3)'}">📅${prazoStr}</span>`:''}
              <span class="kb-dias" style="color:${diasCor}">⏱${dias}d</span>
            </div>
            ${overdue?`<div style="font-size:10px;font-weight:700;color:var(--red);margin-top:4px">⚠️ Atrasado</div>`:''}
          </div>`;
        }).join('') : `<div style="text-align:center;padding:1.2rem;color:var(--text3);font-size:11px">Nenhuma</div>`}
        ${maxCards && cards.length > maxCards ? `<div style="text-align:center;font-size:11px;color:var(--text3);padding:4px 0">+${cards.length-maxCards} mais</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function loadKanban() {
  const respId = document.getElementById('kbResp')?.value || '';
  const sel = document.getElementById('kbResp');
  if (sel && sel.options.length <= 1) {
    cols.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
  }
  const hj30 = new Date(); hj30.setDate(hj30.getDate()-30); const hj30s = hj30.toISOString().split('T')[0];
  let q = sb.from('demandas').select('id,numero,resumo,status,prioridade,prazo,data_conclusao,ultima_movimentacao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome)');
  if (respId) q = q.eq('responsavel_atual_id', respId);
  q = q.not('status','in','(cancelada)');
  const {data} = await q;
  // Excluir concluídas com mais de 30 dias
  const todas = (data||[]).filter(d => d.status !== 'concluida' || (d.data_conclusao && d.data_conclusao >= hj30s));
  renderKanbanCards(todas, 'kbBoard', 0);
}

// ══════════════════════════════════════════
