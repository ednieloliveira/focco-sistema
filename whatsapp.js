localStorage.setItem('focco_wa_config', JSON.stringify(config));
  toast('Configuração WhatsApp salva!','ok');
}

function salvarTemplates() {
  const tmpl = { abertura: document.getElementById('tmplAbertura').value, aguardando: document.getElementById('tmplAguardando').value, conclusao: document.getElementById('tmplConclusao').value };
  localStorage.setItem('focco_wa_templates', JSON.stringify(tmpl));
  toast('Templates salvos!','ok');
}

async function enviarWhatsApp(numero, mensagem, demandaId, gatilho) {
  const config = JSON.parse(localStorage.getItem('focco_wa_config')||'{}');
  if (!config.url || !config.token) { toast('Configure o WhatsApp em Configurações > WhatsApp','err'); return false; }

  const numLimpo = numero.replace(/\D/g,'');
  let url = '', body = {};

  if (config.prov === 'evolution') {
    url = `${config.url}/message/sendText/${config.inst}`;
    body = { number: `55${numLimpo}`, textMessage: { text: mensagem } };
  } else if (config.prov === 'zapi') {
    url = `${config.url}/send-text`;
    body = { phone: `55${numLimpo}`, message: mensagem };
  } else {
    url = `${config.url}/send-message`;
    body = { phone: `55${numLimpo}`, message: mensagem };
  }

  try {
    const resp = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${config.token}`}, body: JSON.stringify(body) });
    const status = resp.ok ? 'enviada' : 'erro';
    const msg = resp.ok ? 'WhatsApp enviado!' : 'Erro ao enviar WhatsApp';
    if (demandaId) {
      await sb.from('whatsapp_mensagens').insert({ demanda_id: demandaId, numero_destino: numLimpo, mensagem, gatilho: gatilho||'lembrete_manual', status, enviada_por: U.id, enviada_em: resp.ok ? new Date().toISOString() : null });
    }
    toast(msg, resp.ok?'ok':'err');
    return resp.ok;
  } catch(e) {
    if (demandaId) { await sb.from('whatsapp_mensagens').insert({ demanda_id: demandaId, numero_destino: numLimpo, mensagem, gatilho: gatilho||'lembrete_manual', status:'erro', erro_msg: e.message, enviada_por: U.id }); }
    toast('Erro de conexão com a API WhatsApp','err');
    return false;
  }
}

async function dispararWADemanda(dem, gatilho) {
  const tmpl = JSON.parse(localStorage.getItem('focco_wa_templates')||'{}');
  if (!dem.clientes?.whatsapp) return;
  let msg = '';
  if (gatilho==='demanda_criada') {
    msg = (tmpl.abertura||'Olá, {NOME}! Seu serviço de {SERVICO} foi iniciado.').replace('{NOME}',dem.clientes.nome).replace('{SERVICO}',dem.tipos_demanda?.nome||dem.resumo);
  } else if (gatilho==='aguardando_cliente') {
    const {data:pends} = await sb.from('pendencias').select('descricao').eq('demanda_id',dem.id).eq('resolvida',false);
    const lista = (pends||[]).map((p,i)=>(i+1)+'. '+p.descricao).join('\n') || 'documentos pendentes';
    msg = (tmpl.aguardando||'Olá, {NOME}! Precisamos de: {PENDENCIAS}').replace('{NOME}',dem.clientes.nome).replace('{SERVICO}',dem.tipos_demanda?.nome||'').replace('{PENDENCIAS}',lista);
  } else if (gatilho==='conclusao_demanda') {
    msg = (tmpl.conclusao||'Olá, {NOME}! O serviço de {SERVICO} foi concluído!').replace('{NOME}',dem.clientes.nome).replace('{SERVICO}',dem.tipos_demanda?.nome||dem.resumo);
  }
  if (msg) await enviarWhatsApp(dem.clientes.whatsapp, msg, dem.id, gatilho);
}

async function testarWA() {
  const el = document.getElementById('waTeste');
  el.textContent = 'Testando...';
  const config = JSON.parse(localStorage.getItem('focco_wa_config')||'{}');
  if (!config.url) { el.innerHTML='<span style="color:var(--red)">Configure a URL da API primeiro.</span>'; return; }
  try {
    const resp = await fetch(config.url+'/instance/connectionState/'+config.inst, { headers:{'Authorization':`Bearer ${config.token}`} });
    el.innerHTML = resp.ok ? '<span style="color:var(--green)">✅ Conectado com sucesso!</span>' : '<span style="color:var(--red)">❌ Erro de conexão. Verifique URL e token.</span>';
  } catch(e) { el.innerHTML='<span style="color:var(--red)">❌ Não foi possível conectar: '+e.message+'</span>'; }
}

function enviarWAManual() {
  const num = document.getElementById('waNum').value.trim();
  const msg = document.getElementById('waMsgManual').value.trim();
  if (!num || !msg) { toast('Informe número e mensagem','err'); return; }
  enviarWhatsApp(num, msg, demId||null, 'lembrete_manual');
  fm('mWA');
}

async function loadWAHistorico() {
  const status = document.getElementById('waFiltroStatus').value;
  let q = sb.from('whatsapp_mensagens').select('*,demandas(numero,clientes(nome)),profiles(nome)').order('created_at',{ascending:false}).limit(50);
  if (status) q = q.eq('status', status);
  const {data} = await q;
  const el = document.getElementById('waHistorico');
  if (!data?.length) { el.innerHTML='<div class="vazio">Nenhuma mensagem no histórico.</div>'; return; }
  el.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>Data</th><th>Demanda</th><th>Cliente</th><th>Número</th><th>Gatilho</th><th>Status</th></tr></thead><tbody>
    ${data.map(m=>`<tr>
      <td>${new Date(m.created_at).toLocaleString('pt-BR')}</td>
      <td>${m.demandas?.numero||'—'}</td>
      <td>${m.demandas?.clientes?.nome||'—'}</td>
      <td>${m.numero_destino}</td>
      <td style="font-size:11px">${(m.gatilho||'').replace(/_/g,' ')}</td>
      <td><span class="tag ${m.status==='enviada'?'tg':m.status==='erro'?'tr':'ta'}">${m.status}</span></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

// ══════════════════════════════════════════
// UPLOAD DE ARQUIVOS
// ══════════════════════════════════════════
let arquivosPendentes = [];

function handleFiles(files) {
  arquivosPendentes = [...files];
  mostrarArquivosSelecionados();
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').style.borderColor = 'var(--border)';
  handleFiles(e.dataTransfer.files);
}

function mostrarArquivosSelecionados() {
  const el = document.getElementById('arquivosSelecionados');
  if (!arquivosPendentes.length) { el.innerHTML=''; return; }
  el.innerHTML = arquivosPendentes.map((f,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--sky-pale);border-radius:6px;margin-bottom:6px;font-size:13px"><span>${getIconeArquivo(f.name)}</span><span style="flex:1">${f.name}</span><span style="color:var(--text3);font-size:11px">${(f.size/1024).toFixed(0)}KB</span><button onclick="removerArquivo(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px">×</button></div>`).join('');
}

function getIconeArquivo(nome) {
  const ext = nome.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return '📄';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx'].includes(ext)) return '📊';
  return '📎';
}

function removerArquivo(i) {
  arquivosPendentes.splice(i, 1);
  mostrarArquivosSelecionados();
}

async function abrirModalUpload() {
  arquivosPendentes = [];
  document.getElementById('arquivosSelecionados').innerHTML = '';
  document.getElementById('uploadDesc').value = '';
  document.getElementById('fileInput').value = '';
  om('mUpload');
}

async function fazerUpload() {
  if (!arquivosPendentes.length) { toast('Selecione pelo menos um arquivo','err'); return; }
  if (!demId) { toast('Abra uma demanda primeiro','err'); return; }
  const btn = document.getElementById('btnEnviarUpload');
  btn.disabled = true; btn.textContent = 'Enviando...';
  const desc = document.getElementById('uploadDesc').value.trim();
  let sucesso = 0;

  for (const file of arquivosPendentes) {
    if (file.size > 10 * 1024 * 1024) { toast(`${file.name} excede 10MB`,'err'); continue; }
    const ext = file.name.split('.').pop();
    const nomeStorage = `${demId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await sb.storage.from('demandas').upload(nomeStorage, file, { contentType: file.type });
    if (upErr) {
      await sb.from('documentos').insert({ demanda_id: demId, nome: file.name, nome_storage: nomeStorage, bucket: 'demandas', tamanho_bytes: file.size, tipo_mime: file.type, descricao: desc||null, uploaded_by: U.id });
      sucesso++;
    } else {
      await sb.from('documentos').insert({ demanda_id: demId, nome: file.name, nome_storage: nomeStorage, bucket: 'demandas', tamanho_bytes: file.size, tipo_mime: file.type, descricao: desc||null, uploaded_by: U.id });
      sucesso++;
    }
  }

  await sb.from('tramites').insert({ demanda_id: demId, usuario_id: U.id, tipo: 'documento_recebido', descricao: `${sucesso} documento(s) anexado(s)${desc?' — '+desc:''}` });
  btn.disabled = false; btn.textContent = '⬆️ Enviar Arquivo';
  toast(`${sucesso} arquivo(s) enviado(s)!`,'ok');
  fm('mUpload'); arquivosPendentes = [];
  await renderDet();
}

// ══════════════════════════════════════════
// CARREGAR CONFIGS SALVAS
// ══════════════════════════════════════════
function carregarConfigsWA() {
  const config = JSON.parse(localStorage.getItem('focco_wa_config')||'{}');
  if (config.prov) document.getElementById('waProv').value = config.prov;
  if (config.url) document.getElementById('waUrl').value = config.url;
  if (config.token) document.getElementById('waToken').value = config.token;
  if (config.inst) document.getElementById('waInst').value = config.inst;
  const tmpl = JSON.parse(localStorage.getItem('focco_wa_templates')||'{}');
  if (tmpl.abertura) document.getElementById('tmplAbertura').value = tmpl.abertura;
  if (tmpl.aguardando) document.getElementById('tmplAguardando').value = tmpl.aguardando;
  if (tmpl.conclusao) document.getElementById('tmplConclusao').value = tmpl.conclusao;
}


// ══════════════════════════════════════════
// NOTIFICAÇÕES
// ══════════════════════════════════════════
let notifAberto = false;

async function carregarNotificacoes() {
  const {data} = await sb.from('notificacoes').select('*,demandas(numero)').eq('usuario_id', U.id).eq('lida', false).order('created_at', {ascending:false}).limit(20);
  const count = data?.length || 0;
  const badge = document.getElementById('sinoCount');
  if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'block'; document.getElementById('sinoBell').style.background = 'var(--red-pale)'; }
  else { badge.style.display = 'none'; document.getElementById('sinoBell').style.background = ''; }
  const lista = document.getElementById('notifLista');
  if (!data?.length) { lista.innerHTML = '<div class="vazio" style="padding:2rem">🔕 Nenhuma notificação nova</div>'; return; }
  lista.innerHTML = data.map(n => `
    <div onclick="clicarNotif('${n.id}','${n.demanda_id||''}')" style="padding:12px 18px;border-bottom:1px solid var(--border);cursor:pointer;background:${n.lida?'#fff':'var(--sky-pale)'}">
      <div style="font-size:13px;font-weight:${n.lida?400:600};color:var(--text)">${n.titulo}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">${n.mensagem}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">${new Date(n.created_at).toLocaleString('pt-BR')}</div>
    </div>`).join('');
}

function toggleNotifs() {
  const panel = document.getElementById('notifPanel');
  notifAberto = !notifAberto;
  panel.style.display = notifAberto ? 'block' : 'none';
  if (notifAberto) carregarNotificacoes();
}

async function clicarNotif(id, demandaId) {
  await sb.from('notificacoes').update({lida:true, lida_em:new Date().toISOString()}).eq('id', id);
  document.getElementById('notifPanel').style.display = 'none';
  notifAberto = false;
  if (demandaId) abrirDet(demandaId);
  carregarNotificacoes();
}

async function marcarTodasLidas() {
  await sb.from('notificacoes').update({lida:true, lida_em:new Date().toISOString()}).eq('usuario_id', U.id).eq('lida', false);
  carregarNotificacoes();
  toast('Todas marcadas como lidas!', 'ok');
}

async function criarNotificacao(userId, titulo, mensagem, demandaId, tipo) {
  await sb.from('notificacoes').insert({ usuario_id: userId, titulo, mensagem, demanda_id: demandaId||null, tipo: tipo||'movimentacao_geral', lida: false });
}

// Fechar notif ao clicar fora
