// ═══════════════════════════════════════════
// Modal nova demanda + detalhe demanda
// ═══════════════════════════════════════════

// ── ABRIR MODAL DE NOVA DEMANDA ───────────────────────────────────────────────
function abrirNovaDemanda() {
  // Limpar campos
  ['ndDesc','ndPrazo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['ndCli','ndDep','ndCat','ndTipo','ndResp','ndPrio'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.innerHTML='<option value="">Selecione...</option>'; }
  });
  const prio=document.getElementById('ndPrio');
  if(prio) prio.innerHTML='<option value="normal">Normal</option><option value="baixa">Baixa</option><option value="alta">Alta</option><option value="urgente">Urgente</option>';
  const prev=document.getElementById('ndPrevWrap');
  if(prev) prev.style.display='none';

  // Popular clientes
  const cliSel=document.getElementById('ndCli');
  if(cliSel){
    cliSel.innerHTML='<option value="">Selecione o cliente...</option>';
    dbGet('clientes').filter(c=>c.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome))
      .forEach(c=>cliSel.innerHTML+=`<option value="${c.id}">${c.nome}</option>`);
  }

  // Popular departamentos
  const depSel=document.getElementById('ndDep');
  if(depSel){
    depSel.innerHTML='<option value="">Selecione o departamento...</option>';
    dbGet('departamentos').filter(d=>d.ativo!==false).sort((a,b)=>(a.ordem||0)-(b.ordem||0))
      .forEach(d=>depSel.innerHTML+=`<option value="${d.id}">${d.icone||''} ${d.nome}</option>`);
  }

  // Popular responsáveis
  const respSel=document.getElementById('ndResp');
  if(respSel){
    respSel.innerHTML='<option value="">Selecione o responsável...</option>';
    dbGet('profiles').filter(p=>p.ativo!==false)
      .forEach(p=>respSel.innerHTML+=`<option value="${p.id}" ${p.id===U?.id?'selected':''}>${p.nome}</option>`);
  }

  om('mNovaDem');
}

function loadCatsND(){
  const depId=document.getElementById('ndDep').value;
  const catSel=document.getElementById('ndCat');
  catSel.innerHTML='<option value="">Selecione a categoria...</option>';
  document.getElementById('ndTipo').innerHTML='<option value="">Selecione o tipo...</option>';
  if(!depId) return;
  dbGet('categorias').filter(c=>c.departamento_id===depId&&c.ativo!==false)
    .sort((a,b)=>(a.ordem||0)-(b.ordem||0))
    .forEach(c=>catSel.innerHTML+=`<option value="${c.id}">${c.nome}</option>`);
}

function loadTiposND(){
  const catId=document.getElementById('ndCat').value;
  const tipSel=document.getElementById('ndTipo');
  tipSel.innerHTML='<option value="">Selecione o tipo...</option>';
  const prev=document.getElementById('ndPrevWrap');
  if(prev) prev.style.display='none';
  if(!catId) return;
  dbGet('tipos_demanda').filter(t=>t.categoria_id===catId&&t.ativo!==false)
    .sort((a,b)=>(a.ordem||0)-(b.ordem||0))
    .forEach(t=>tipSel.innerHTML+=`<option value="${t.id}">${t.nome} (${t.prefixo_numeracao})</option>`);
}

function updPref(){
  const tipId=document.getElementById('ndTipo').value;
  const prev=document.getElementById('ndPrevWrap');
  const prevEl=document.getElementById('ndPrev');
  if(!tipId||!prev||!prevEl){if(prev)prev.style.display='none';return;}
  const tipo=dbGet('tipos_demanda').find(t=>t.id===tipId);
  if(tipo?.prefixo_numeracao){
    prevEl.textContent='Protocolo: '+tipo.prefixo_numeracao+'-'+new Date().getFullYear()+'-XXXX';
    prev.style.display='block';
  }
}

async function salvarDem(){
  const ci=document.getElementById('ndCli').value;
  const di=document.getElementById('ndDep').value;
  const cai=document.getElementById('ndCat').value;
  const ti=document.getElementById('ndTipo').value;
  const desc=document.getElementById('ndDesc').value.trim();
  const ri=document.getElementById('ndResp').value;
  const prio=document.getElementById('ndPrio').value||'normal';
  const prazo=document.getElementById('ndPrazo').value||null;

  if(!ci){toast('Selecione o cliente','err');return;}
  if(!di){toast('Selecione o departamento','err');return;}
  if(!cai){toast('Selecione a categoria','err');return;}
  if(!ti){toast('Selecione o tipo de demanda','err');return;}
  if(!desc){toast('Preencha a descrição','err');return;}
  if(!ri){toast('Selecione o responsável','err');return;}

  try{
    const {data:num,error:eN}=await sb.rpc('fn_proximo_numero_demanda',{p_tipo_id:ti});
    if(eN)throw eN;

    const {data:dem,error:eD}=await sb.from('demandas').insert({
      numero:num,
      cliente_id:ci,
      departamento_id:di,
      categoria_id:cai,
      tipo_demanda_id:ti,
      responsavel_atual_id:ri,
      departamento_atual_id:di,
      status:'aberta',
      prioridade:prio,
      resumo:desc.slice(0,120),
      descricao:desc,
      prazo:prazo,
      ultima_movimentacao:new Date().toISOString(),
      created_by:U.id
    }).select().single();
    if(eD)throw eD;

    await Promise.all([
      sb.from('tramites').insert({demanda_id:dem.id,usuario_id:U.id,tipo:'abertura',descricao:'Demanda aberta por '+U.nome+'.'}),
      sb.from('demanda_responsaveis').insert({demanda_id:dem.id,responsavel_id:ri,departamento_id:di,aceite_status:ri===U.id?'aceito':'pendente'})
    ]);

    // Notificar responsável se for diferente do criador
    if(ri!==U.id){
      await criarNotificacao(ri,'📋 Nova demanda para você',
        'Você recebeu a demanda '+num+' — "'+desc.slice(0,60)+'".',
        dem.id,'nova_demanda');
    }

    toast('Demanda '+num+' aberta!','ok');
    fm('mNovaDem');
    await loadDem();
  }catch(e){
    toast('Erro ao salvar: '+String(e.message),'err');
    console.error('salvarDem error:',e);
  }
}

async function abrirDet(id){
  demId=id;ir('det');
  document.getElementById('detConteudo').innerHTML='<div class="loading">Carregando...</div>';
  try {
    await renderDet();
  } catch(e) {
    console.error('renderDet error:', e);
    mostrarErroDet('Erro ao carregar demanda', String(e.message));
  }
}

function mostrarErroDet(titulo, msg) {
  const el = document.getElementById('detConteudo');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'vazio';
  div.style.padding = '3rem';
  div.innerHTML = '<div style="font-size:32px;margin-bottom:12px">⚠️</div>' +
    '<div style="font-size:16px;font-weight:600;margin-bottom:6px">' + titulo + '</div>' +
    '<div style="font-size:13px;color:var(--text3);margin-bottom:16px">' + msg + '</div>';
  const btn = document.createElement('button');
  btn.className = 'btn btn-s';
  btn.textContent = '← Voltar para Demandas';
  btn.onclick = function() { ir('dem'); };
  div.appendChild(btn);
  el.innerHTML = '';
  el.appendChild(div);
}

async function renderDet(){
  const id = demId;

  // ── Leitura direta do localStorage — sem depender do motor de query ──────
  const todasDem   = dbGet('demandas');
  const todasCli   = dbGet('clientes');
  const todosProf  = dbGet('profiles');
  const todosDept  = dbGet('departamentos');
  const todasCat   = dbGet('categorias');
  const todosTipo  = dbGet('tipos_demanda');
  const todosTram  = dbGet('tramites');
  const todasAcoes = dbGet('proximas_acoes');
  const todasPend  = dbGet('pendencias');
  const todasChat  = dbGet('chat_mensagens');

  const d = todasDem.find(x=>x.id===id);
  if(!d){ mostrarErroDet('Demanda não encontrada','O registro pode ter sido removido.'); return; }

  // Enriquecer com joins manuais
  d.clientes     = todasCli.find(c=>c.id===d.cliente_id)||null;
  d.profiles     = todosProf.find(p=>p.id===d.responsavel_atual_id)||null;
  d.departamentos= todosDept.find(x=>x.id===(d.departamento_atual_id||d.departamento_id))||null;
  d.categorias   = todasCat.find(c=>c.id===d.categoria_id)||null;
  d.tipos_demanda= todosTipo.find(t=>t.id===d.tipo_demanda_id)||null;

  // Trâmites
  const trDados = todosTram
    .filter(t=>t.demanda_id===id)
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
    .map(t=>({...t, profiles: todosProf.find(p=>p.id===t.usuario_id)||null}));

  // Próximas ações (não concluídas)
  const prDados = todasAcoes
    .filter(t=>t.demanda_id===id && !t.concluida)
    .sort((a,b)=>new Date(a.data_prevista)-new Date(b.data_prevista))
    .map(t=>({...t, profiles: todosProf.find(p=>p.id===t.responsavel_id)||null}));

  // Pendências (não resolvidas)
  const peDados = todasPend
    .filter(t=>t.demanda_id===id && !t.resolvida)
    .map(t=>({...t, profiles: todosProf.find(p=>p.id===t.responsavel_id)||null}));

  // Chat
  const chDados = todasChat
    .filter(t=>t.demanda_id===id)
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
    .map(t=>({...t, profiles: todosProf.find(p=>p.id===t.usuario_id)||null}));

  const tr = { data: trDados };
  const pr = { data: prDados };
  const pe = { data: peDados };
  const ch = { data: chDados };

  const hj = new Date().toISOString().split('T')[0];
  const pE = d.responsavel_atual_id===U.id || U.perfil==='gestor' || U.perfil==='supervisor';
  const iG = U.perfil==='gestor';
  const pA = pr.data?.[0], pV = pA && pA.data_prevista < hj;
  const dataAbertura = d.data_abertura||d.created_at||'';
  document.getElementById('detConteudo').innerHTML=`
  <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px;box-shadow:var(--shadow)">
    <div style="font-family:Syne,sans-serif;font-weight:800;font-size:22px;color:var(--navy);margin-bottom:4px">${d.numero}</div>
    <div style="font-size:15px;font-weight:500;margin-bottom:12px">${d.resumo}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${pE&&d.status!=='concluida'?'14px':'0'}">
      <span class="tag ${SC[d.status]||'ts'}">${SL[d.status]||d.status}</span>
      <span class="tag ${PC[d.prioridade]||'ts'}">⚡ ${d.prioridade}</span>
      <span class="tag tn">📁 ${d.departamentos?.nome}</span>
      <span class="tag tn">📂 ${d.categorias?.nome}</span>
      ${d.prazo?`<span class="tag ${d.prazo<hj?'tr':'tgr'}">📅 ${new Date(d.prazo+'T12:00:00').toLocaleDateString('pt-BR')}</span>`:''}
    </div>
    ${pE&&d.status!=='concluida'&&d.status!=='cancelada'?`<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-s" onclick="omDet('mTram')">+ Trâmite</button>
      <button class="btn btn-s" onclick="omDet('mPend')">+ Pendência</button>
      <button class="btn btn-s" onclick="omTransf()">↔ Transferir</button>
      <button class="btn btn-s" onclick="abrirModalUpload()">📎 Anexar</button>
      <button class="btn btn-s" onclick="om('mWA')">📱 WhatsApp</button>
      ${iG ? `<button class="btn btn-er" onclick="excluirDemanda('${d.id}','${d.numero}')">🗑️ Excluir</button>` : ''}
      ${d.status!=='aguardando_conclusao'?`<button class="btn btn-p" onclick="om('mConc')">✓ Solicitar conclusão</button>`:''}
      ${iG&&d.status==='aguardando_conclusao'?`<button class="btn btn-ok" onclick="aprovarConc()">✓ Aprovar conclusão</button>`:''}
    </div>`:''}
  </div>
  <div style="display:grid;grid-template-columns:1fr 340px;gap:20px">
    <div>
      <div class="card">
        <div class="ch"><div class="ct">📋 Linha do Tempo / Tramitação</div><span style="font-size:12px;color:var(--text3)">${tr.data?.length||0} registros</span></div>
        <div class="cb">
          ${tr.data?.length?`<div class="tram-timeline-v2">${tr.data.map(t=>{
            const tipoClass=t.tipo||'';
            const label=TL[t.tipo]||t.tipo;
            const dt=new Date(t.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
            return `<div class="tram-item-v2 ${tipoClass}">
              <span class="tram-tipo-badge ${tipoClass}">${label}</span>
              <div class="tram-desc-v2">${t.descricao||''}</div>
              <div class="tram-meta-v2">👤 ${t.profiles?.nome||'—'} &nbsp;·&nbsp; 🕐 ${dt}</div>
            </div>`;
          }).join('')}</div>`:'<div class="vazio">Nenhum trâmite registrado.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="ch"><div class="ct">💬 Chat Interno</div></div>
        <div class="cb">
          <div id="chatBox" style="max-height:250px;overflow-y:auto;background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:10px;display:flex;flex-direction:column">
            ${ch.data?.length?ch.data.map(m=>{const own=m.usuario_id===U.id,ini=m.profiles?.nome?.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()||'?';return`<div class="chat-msg ${own?'own':''}"><div class="chat-av" style="background:${own?'var(--sky)':'var(--navy)'}">${ini}</div><div><div class="chat-bub">${m.mensagem}</div><div class="chat-time">${m.profiles?.nome} · ${new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></div></div>`}).join(''):'<div class="vazio" style="padding:1rem">Nenhuma mensagem.</div>'}
          </div>
          <div style="display:flex;gap:8px"><input type="text" class="fi" id="chatIn" placeholder="Mensagem..." onkeydown="if(event.key==='Enter')envChat()"><button class="btn btn-p" onclick="envChat()">Enviar</button></div>
        </div>
      </div>
    </div>
    <div>
      <div class="card">
        <div class="ch"><div class="ct">ℹ️ Informações</div></div>
        <div class="cb">
          <div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Cliente</div><div style="font-size:13px;font-weight:500">${d.clientes?.nome}</div>${d.clientes?.whatsapp?`<a href="https://wa.me/55${d.clientes.whatsapp}" target="_blank" style="font-size:12px;color:var(--green)">📱 WhatsApp</a>`:''}</div>
          <hr class="hr">
          <div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Responsável</div><div style="font-size:13px;font-weight:500">${d.profiles?.nome}</div></div>
          <hr class="hr">
          <div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Aberta em</div><div style="font-size:13px;font-weight:500">${dataAbertura ? new Date(dataAbertura).toLocaleDateString('pt-BR') : '—'}</div></div>
          <hr class="hr">
          <div><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Descrição</div><div style="font-size:13px;line-height:1.5">${d.descricao}</div></div>
        </div>
      </div>
      <div class="card">
        <div class="ch"><div class="ct">⚡ Próxima Ação</div>${pE?`<button class="btn btn-s" style="padding:4px 10px;font-size:12px" onclick="omDet('mAcao')">+ Nova</button>`:''}</div>
        <div class="cb">
          ${pA?`<div style="background:var(--sky-pale);border:1px solid rgba(0,153,229,.2);border-radius:8px;padding:12px;margin-bottom:10px"><div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:4px">${pA.descricao}</div><div style="font-size:12px;color:${pV?'var(--red)':'var(--sky)'}">${pV?'⚠️ Vencida: ':'📅 '}${new Date(pA.data_prevista+'T12:00:00').toLocaleDateString('pt-BR')}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${pA.profiles?.nome}</div></div>${pE?'<button class=\"btn btn-ok\" style=\"width:100%;justify-content:center\" onclick=\"concAcao(\'' + pA.id + '\')\">✓ Marcar concluída</button>':''}` : '<div class="vazio">Sem próxima ação.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="ch"><div class="ct">⏳ Pendências (${pe.data?.length||0})</div>${pE?`<button class="btn btn-s" style="padding:4px 10px;font-size:12px" onclick="omDet('mPend')">+ Nova</button>`:''}</div>
        <div class="cb">
          ${pe.data?.length?pe.data.map(p=>`<div class="pend-row"><div class="pend-dot" style="background:${p.tipo==='cliente'?'var(--amber)':p.tipo==='orgao_publico'?'var(--purple)':p.tipo==='gestor'?'var(--navy)':'var(--sky)'}"></div><div style="flex:1"><div style="font-size:13px">${p.descricao}</div><div style="font-size:11px;color:var(--text3)">${p.tipo.replace(/_/g,' ')}</div></div>${pE?`<button onclick="resolPend('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--green);font-size:12px;font-weight:600;padding:2px 6px">✓</button>`:''}</div>`).join(''):'<div class="vazio">Sem pendências.</div>'}
        </div>
      </div>
    </div>
  </div>`;
  const ce=document.getElementById('chatBox');if(ce)ce.scrollTop=ce.scrollHeight;
  fillDetSelects();
}
function omDet(id){om(id);fillDetSelects();}
function omTransf(){om('mTransf');fillDetSelects();}
function fillDetSelects(){
  ['pResp','aResp','trResp'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=id==='pResp'?'<option value="">Ninguém</option>':'<option value="">Selecione...</option>';cols.forEach(c=>{el.innerHTML+=`<option value="${c.id}" ${c.id===U.id?'selected':''}>${c.nome}</option>`;});});
  const sd=document.getElementById('trDep');if(sd){sd.innerHTML='<option value="">Selecione...</option>';deps.forEach(d=>{sd.innerHTML+=`<option value="${d.id}">${d.nome}</option>`;});}
}
async function salvarTram(){const desc=document.getElementById('tDesc').value.trim(),tipo=document.getElementById('tTipo').value;if(!desc){toast('Informe a descrição','err');return;}await sb.from('tramites').insert({demanda_id:demId,usuario_id:U.id,tipo,descricao:desc});toast('Trâmite registrado!','ok');fm('mTram');document.getElementById('tDesc').value='';await renderDet();}
async function salvarPend(){const desc=document.getElementById('pDesc').value.trim();if(!desc){toast('Informe a descrição','err');return;}const tipo=document.getElementById('pTipo').value,resp=document.getElementById('pResp').value||null,data=document.getElementById('pData').value||null;const sm={cliente:'aguardando_cliente',orgao_publico:'aguardando_orgao',gestor:'aguardando_gestor'};await sb.from('pendencias').insert({demanda_id:demId,tipo,descricao:desc,responsavel_id:resp,data_prevista:data,created_by:U.id});if(sm[tipo])await sb.from('demandas').update({status:sm[tipo]}).eq('id',demId);await sb.from('tramites').insert({demanda_id:demId,usuario_id:U.id,tipo:'pendencia_criada',descricao:`Pendência (${tipo}): ${desc}`});toast('Pendência criada!','ok');fm('mPend');document.getElementById('pDesc').value='';await renderDet();}
async function resolPend(id){await sb.from('pendencias').update({resolvida:true,resolvida_em:new Date().toISOString(),resolvida_por:U.id}).eq('id',id);await sb.from('tramites').insert({demanda_id:demId,usuario_id:U.id,tipo:'pendencia_resolvida',descricao:'Pendência resolvida.'});toast('Resolvida!','ok');await renderDet();}
async function salvarAcao(){const desc=document.getElementById('aDesc').value.trim(),resp=document.getElementById('aResp').value,data=document.getElementById('aData').value;if(!desc||!resp||!data){toast('Preencha todos os campos','err');return;}await sb.from('proximas_acoes').insert({demanda_id:demId,responsavel_id:resp,descricao:desc,data_prevista:data,created_by:U.id});toast('Ação salva!','ok');fm('mAcao');document.getElementById('aDesc').value='';await renderDet();}
async function concAcao(id){await sb.from('proximas_acoes').update({concluida:true,concluida_em:new Date().toISOString(),concluida_por:U.id}).eq('id',id);toast('Ação concluída!','ok');await renderDet();}
async function salvarTransf(){
  const resp=document.getElementById('trResp').value;
  const dep=document.getElementById('trDep').value;
  const mot=document.getElementById('trMot').value;
  const obs=document.getElementById('trObs').value.trim();
  const lembrete=document.getElementById('trLembrete')?.checked!==false;
  if(!resp||!dep){toast('Selecione responsável e departamento','err');return;}
  // Atualiza demanda
  await sb.from('demanda_responsaveis').update({data_fim:new Date().toISOString()}).eq('demanda_id',demId).is('data_fim',null);
  await sb.from('demanda_responsaveis').insert({demanda_id:demId,responsavel_id:resp,departamento_id:dep,motivo_transferencia:mot,observacao:obs,transferido_por:U.id,aceite_status:resp===U.id?'aceito':'pendente'});
  await sb.from('demandas').update({responsavel_atual_id:resp,departamento_atual_id:dep,status:resp===U.id?'em_andamento':'aguardando_aceite'}).eq('id',demId);
  const {data:dem}=await sb.from('demandas').select('numero,resumo').eq('id',demId).single();
  const motLabel={etapa_concluida:'Etapa concluída',redistribuicao:'Redistribuição',ferias:'Férias',afastamento:'Afastamento',erro_encaminhamento:'Erro de encaminhamento',outros:'Outros'};
  await sb.from('tramites').insert({demanda_id:demId,usuario_id:U.id,tipo:'transferencia',descricao:`Transferido para ${cols.find(c=>c.id===resp)?.nome||'novo responsável'}. Motivo: ${motLabel[mot]||mot}.${obs?' '+obs:''}`});
  // Enviar lembrete/notificação
  if(lembrete && resp!==U.id){
    await criarNotificacao(resp,'📋 Nova demanda transferida para você',
      `${U.nome} transferiu a demanda ${dem?.numero} — "${dem?.resumo||''}" para você.${obs?' Mensagem: '+obs:''}`,
      demId,'transferencia');
  }
  toast('Demanda transferida com sucesso!','ok');
  fm('mTransf');
  await renderDet();
}
async function salvarConc(){
  const obs=document.getElementById('cObs').value.trim();
  await sb.from('aprovacoes').insert({demanda_id:demId,solicitado_por:U.id,observacao_envio:obs});
  await sb.from('demandas').update({status:'aguardando_conclusao'}).eq('id',demId);
  const {data:dem}=await sb.from('demandas').select('numero,resumo').eq('id',demId).single();
  await sb.from('tramites').insert({demanda_id:demId,usuario_id:U.id,tipo:'aprovacao_solicitada',descricao:`Conclusão solicitada por ${U.nome}.${obs?' '+obs:''}`});
  // Notificar todos os gestores
  const gestores=dbGet('profiles').filter(p=>p.perfil==='gestor'&&p.ativo&&p.id!==U.id);
  for(const g of gestores){
    await criarNotificacao(g.id,'✅ Solicitação de conclusão',
      `${U.nome} solicitou conclusão da demanda ${dem?.numero} — "${dem?.resumo||''}".${obs?' Obs: '+obs:''}`,
      demId,'conclusao_solicitada');
  }
  toast('Conclusão solicitada! Gestor notificado.','ok');
  fm('mConc');
  await renderDet();
}
async function aprovarConc(){if(!confirm('Aprovar conclusão desta demanda?'))return;await sb.from('demandas').update({status:'concluida',data_conclusao:new Date().toISOString()}).eq('id',demId);await sb.from('aprovacoes').update({status:'aprovada',aprovado_por:U.id,respondido_em:new Date().toISOString()}).eq('demanda_id',demId).eq('status','pendente');await sb.from('tramites').insert({demanda_id:demId,usuario_id:U.id,tipo:'aprovacao_concedida',descricao:'Conclusão aprovada. Demanda encerrada.'});toast('Demanda concluída!','ok');await renderDet();}
async function envChat(){const input=document.getElementById('chatIn'),msg=input?.value.trim();if(!msg)return;input.value='';await sb.from('chat_mensagens').insert({demanda_id:demId,usuario_id:U.id,mensagem:msg});await renderDet();}
