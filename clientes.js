// ═══════════════════════════════════════════
// Clientes + parâmetros
// ═══════════════════════════════════════════


async function loadCli(){const {data}=await sb.from('clientes').select('*').eq('ativo',true).order('nome');allCli=data||[];document.getElementById('cliTotal').textContent=`${allCli.length} cliente(s)`;filtCli();}

// ═══════════════════════════════════════════════════════════
// IMPORTAÇÃO DE CLIENTES — Excel/CSV
// ═══════════════════════════════════════════════════════════

let _importCliDados = []; // dados pendentes de confirmação

// Template Excel para download
function baixarTemplateClientes() {
  if(typeof XLSX === 'undefined'){toast('Aguarde o sistema carregar...','err');return;}
  const wb = XLSX.utils.book_new();
  const cabecalho = [
    ['nome','cpf_cnpj','tipo_pessoa','regime_tributario','whatsapp','telefone','email','endereco','tipo_cliente','observacoes']
  ];
  const exemplos = [
    ['Empresa ABC Ltda','12.345.678/0001-90','juridica','simples_nacional','34999990001','3433330001','empresa@abc.com','Rua das Flores 123 - Centro - Patrocínio MG','urbano',''],
    ['João da Silva','123.456.789-00','fisica','isento','34999990002','','joao@email.com','','pf',''],
    ['Fazenda São José','234.567.890-01','fisica','produtor_rural','34999990003','','','Zona Rural - Patrocínio MG','rural','Produtor de café'],
    ['MEI Serviços','98.765.432/0001-10','juridica','mei','34999990004','','','','urbano',''],
    ['Loja Exemplo SA','11.222.333/0001-44','juridica','lucro_presumido','34999990005','3433330005','loja@exemplo.com','Av. Principal 456','urbano',''],
  ];
  const dados = [...cabecalho, ...exemplos];
  const ws = XLSX.utils.aoa_to_sheet(dados);

  // Larguras das colunas
  ws['!cols'] = [
    {wch:35},{wch:20},{wch:14},{wch:20},{wch:15},{wch:14},{wch:28},{wch:40},{wch:14},{wch:30}
  ];

  // Estilo do cabeçalho (comentários explicativos)
  const comentarios = {
    nome: 'Nome completo ou Razão Social. Obrigatório.',
    cpf_cnpj: 'CPF (000.000.000-00) ou CNPJ (00.000.000/0001-00). Com ou sem formatação.',
    tipo_pessoa: 'juridica  ou  fisica',
    regime_tributario: 'mei | simples_nacional | lucro_presumido | lucro_real | produtor_rural | isento',
    whatsapp: 'Apenas números com DDD. Ex: 34999990001',
    telefone: 'Telefone fixo com DDD',
    email: 'E-mail de contato',
    endereco: 'Endereço completo',
    tipo_cliente: 'urbano | rural | pf',
    observacoes: 'Informações adicionais'
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  // Aba de instruções
  const wsInst = XLSX.utils.aoa_to_sheet([
    ['INSTRUÇÕES DE PREENCHIMENTO'],
    [''],
    ['1. Preencha os dados na aba "Clientes"'],
    ['2. A coluna "nome" é obrigatória'],
    ['3. tipo_pessoa: use  juridica  ou  fisica'],
    ['4. regime_tributario: use um dos valores abaixo:'],
    ['   mei'],
    ['   simples_nacional'],
    ['   lucro_presumido'],
    ['   lucro_real'],
    ['   produtor_rural'],
    ['   isento'],
    ['5. tipo_cliente: urbano | rural | pf'],
    ['6. CPF/CNPJ: pode incluir ou não a formatação'],
    ['7. WhatsApp: apenas números com DDD (ex: 34999990001)'],
    [''],
    ['Após preencher, salve o arquivo e importe no sistema'],
    ['usando o botão "Importar Excel" na tela de Clientes.'],
  ]);
  wsInst['!cols'] = [{wch:60}];
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções');

  XLSX.writeFile(wb, 'Focco_Template_Clientes.xlsx');
  toast('Template baixado! Preencha e importe.', 'ok');
}

// Lê o arquivo Excel/CSV selecionado
function importarClientesExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

      if (!rows.length) { toast('Planilha vazia ou sem dados.','err'); return; }

      // Normalizar dados
      _importCliDados = rows.map(r => {
        const nome = String(r.nome||r.Nome||r.NOME||r['Razão Social']||r['razao_social']||'').trim();
        if (!nome) return null;
        const doc = String(r.cpf_cnpj||r.CPF_CNPJ||r.CNPJ||r.CPF||r['CPF/CNPJ']||'').replace(/\D/g,'').trim();
        const tipo = String(r.tipo_pessoa||r.tipo||'juridica').toLowerCase().trim();
        const regime = String(r.regime_tributario||r.regime||'').toLowerCase().trim();
        const wa = String(r.whatsapp||r.WhatsApp||r.celular||r.Celular||'').replace(/\D/g,'').trim();
        const tel = String(r.telefone||r.Telefone||r.fone||'').replace(/\D/g,'').trim();
        const email = String(r.email||r.Email||r.EMAIL||'').trim();
        const end = String(r.endereco||r.Endereço||r.endereco||'').trim();
        const tc = String(r.tipo_cliente||'urbano').toLowerCase().trim();
        const obs = String(r.observacoes||r.Observacoes||r.obs||'').trim();

        const regimesValidos = ['mei','simples_nacional','lucro_presumido','lucro_real','produtor_rural','isento'];
        return {
          id: uuid(),
          nome,
          cpf_cnpj: doc||null,
          tipo_pessoa: tipo.includes('fis')?'fisica':'juridica',
          regime_tributario: regimesValidos.includes(regime)?regime:(regime?'simples_nacional':null),
          whatsapp: wa||null,
          telefone: tel||null,
          email: email||null,
          endereco: end||null,
          tipo_cliente: ['rural','pf'].includes(tc)?tc:'urbano',
          observacoes: obs||null,
          ativo: true,
          created_at: new Date().toISOString(),
        };
      }).filter(Boolean);

      if (!_importCliDados.length) { toast('Nenhuma linha válida encontrada.','err'); return; }

      // Mostrar prévia
      const painel = document.getElementById('painelImportCli');
      document.getElementById('importCliCount').textContent = _importCliDados.length;
      document.getElementById('importCliResumo').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:4px">
          <div>📋 Total de linhas: <strong>${rows.length}</strong></div>
          <div>✅ Válidas: <strong>${_importCliDados.length}</strong></div>
          <div>❌ Ignoradas (sem nome): <strong>${rows.length - _importCliDados.length}</strong></div>
          <div>PJ: <strong>${_importCliDados.filter(c=>c.tipo_pessoa==='juridica').length}</strong> | PF: <strong>${_importCliDados.filter(c=>c.tipo_pessoa==='fisica').length}</strong></div>
        </div>`;

      // Montar tabela prévia (máx 10 linhas)
      const cols = ['nome','cpf_cnpj','tipo_pessoa','regime_tributario','whatsapp','email'];
      document.getElementById('importCliHead').innerHTML = cols.map(c=>`<th style="background:var(--surface2);padding:8px;white-space:nowrap">${c}</th>`).join('');
      document.getElementById('importCliBody').innerHTML = _importCliDados.slice(0,10).map(r=>
        `<tr>${cols.map(c=>`<td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis">${r[c]||'—'}</td>`).join('')}</tr>`
      ).join('') + (_importCliDados.length>10?`<tr><td colspan="${cols.length}" style="padding:8px;text-align:center;color:var(--text3)">... e mais ${_importCliDados.length-10} registros</td></tr>`:'');

      document.getElementById('importCliPrevia').innerHTML = `<strong>${file.name}</strong><br>${(file.size/1024).toFixed(1)} KB`;
      painel.style.display = 'block';
      painel.scrollIntoView({behavior:'smooth', block:'nearest'});
    } catch(err) {
      toast('Erro ao ler arquivo: '+err.message,'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Confirma e salva os clientes importados
async function confirmarImportacaoClientes() {
  if (!_importCliDados.length) { toast('Nenhum dado para importar','err'); return; }
  const sobrescrever = document.getElementById('importCliSobrescrever').checked;
  const btn = document.getElementById('btnConfirmarImport');
  btn.disabled = true; btn.textContent = 'Importando...';

  try {
    const existing = dbGet('clientes');
    const existingDocs = new Set(existing.map(c=>c.cpf_cnpj).filter(Boolean));
    let importados = 0, ignorados = 0, atualizados = 0;
    let lista = [...existing];

    for (const cli of _importCliDados) {
      if (cli.cpf_cnpj && existingDocs.has(cli.cpf_cnpj)) {
        if (sobrescrever) {
          const idx = lista.findIndex(c=>c.cpf_cnpj===cli.cpf_cnpj);
          if(idx>=0){lista[idx]={...lista[idx],...cli,id:lista[idx].id};atualizados++;}
        } else { ignorados++; }
      } else {
        lista.push(cli);
        importados++;
      }
    }

    dbSet('clientes', lista);

    // Sincronizar com Sheets
    if (sheetsConectado) {
      try { await sheetsPost({acao:'inserir_lote_replace',tabela:'CLIENTES',dados:lista}); }
      catch(e) { console.warn('Sync Sheets erro:', e); }
    }

    await loadCli();
    document.getElementById('painelImportCli').style.display = 'none';
    _importCliDados = [];
    toast(`✅ Importação concluída: ${importados} novos, ${atualizados} atualizados, ${ignorados} ignorados.`, 'ok');
  } catch(err) {
    toast('Erro na importação: '+err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Importar 0 clientes';
  }
}

// Limpar base de clientes
async function limparTodosClientes() {
  const total = dbGet('clientes').length;
  if (!total) { toast('Nenhum cliente cadastrado.','err'); return; }
  if (!confirm(`⚠️ ATENÇÃO!\n\nIsso vai apagar TODOS os ${total} clientes do sistema.\n\nDemandas vinculadas perderão a referência ao cliente.\n\nEsta ação NÃO pode ser desfeita.\n\nDigite CONFIRMAR para prosseguir.`)) return;
  const conf = prompt('Digite CONFIRMAR para apagar todos os clientes:');
  if (conf !== 'CONFIRMAR') { toast('Operação cancelada.','err'); return; }
  dbSet('clientes', []);
  allCli = [];
  if (sheetsConectado) {
    try { await sheetsPost({acao:'inserir_lote_replace',tabela:'CLIENTES',dados:[]}); }
    catch(e) {}
  }
  await loadCli();
  toast(`${total} clientes removidos.`, 'ok');
}


function filtCli(){
  const b=document.getElementById('cliBusca').value.toLowerCase();
  const t=document.getElementById('cliTipo').value;
  const reg=document.getElementById('cliRegime')?.value||'';
  const f=allCli.filter(c=>{
    const mb=!b||c.nome.toLowerCase().includes(b)||(c.cpf_cnpj||'').includes(b)||(c.email||'').toLowerCase().includes(b);
    return mb&&(!t||c.tipo_pessoa===t)&&(!reg||c.regime_tributario===reg);
  });
  const rg={simples_nacional:'Simples Nacional',lucro_presumido:'Lucro Presumido',lucro_real:'Lucro Real',mei:'MEI',isento:'Isento',produtor_rural:'Produtor Rural'};
  document.getElementById('cliTotal').textContent=f.length+' de '+allCli.length+' clientes';
  document.getElementById('cliTabela').innerHTML=f.length?f.map(c=>`<tr onclick="editCli('${c.id}')"><td><strong style="color:var(--accent)">${c.nome}</strong>${c.tipo_cliente==='rural'?'<span class="tag ta" style="margin-left:6px;font-size:10px">🌾 Rural</span>':''}</td><td style="font-size:12px;color:var(--text3);font-family:monospace">${c.cpf_cnpj||'—'}</td><td><span class="tag ${c.tipo_pessoa==='juridica'?'ts':'tg'}">${c.tipo_pessoa==='juridica'?'PJ':'PF'}</span></td><td style="font-size:12px">${rg[c.regime_tributario]||'—'}</td><td>${c.whatsapp?`<a href="https://wa.me/55${c.whatsapp}" target="_blank" onclick="event.stopPropagation()" style="color:var(--green);font-size:12px">📱 ${c.whatsapp}</a>`:'—'}</td><td style="font-size:12px;color:var(--text3)">${c.email||'—'}</td><td style="display:flex;gap:4px">
        <button class="btn btn-s" style="padding:4px 10px;font-size:12px" onclick="event.stopPropagation();verDemCli('${c.nome}')">📋 Dem.</button>
        ${U?.perfil==='gestor'?`<button class="btn btn-er" style="padding:4px 10px;font-size:12px" onclick="event.stopPropagation();excluirCliente('${c.id}','${c.nome}')">🗑️</button>`:''}
      </td></tr>`).join(''):'<tr><td colspan="6" class="vazio">Nenhum cliente.</td></tr>';}
function abrirModalCliente(){
  document.getElementById('mcId').value='';
  ['mcNome','mcDoc','mcWa','mcEmail','mcObs'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['mcTel','mcEnd'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('mcTP').value='juridica';
  document.getElementById('mcReg').value='';
  const tc=document.getElementById('mcTC');if(tc)tc.value='urbano';
  document.getElementById('mCliTit').textContent='Novo Cliente';
  om('mCli');
}
function editCli(id){
  const c=allCli.find(x=>x.id===id);if(!c)return;
  document.getElementById('mcId').value=c.id;
  document.getElementById('mcNome').value=c.nome||'';
  document.getElementById('mcTP').value=c.tipo_pessoa||'juridica';
  document.getElementById('mcDoc').value=c.cpf_cnpj||'';
  document.getElementById('mcReg').value=c.regime_tributario||'';
  document.getElementById('mcWa').value=c.whatsapp||'';
  const tel=document.getElementById('mcTel');if(tel)tel.value=c.telefone||'';
  document.getElementById('mcEmail').value=c.email||'';
  const tc=document.getElementById('mcTC');if(tc)tc.value=c.tipo_cliente||'urbano';
  const end=document.getElementById('mcEnd');if(end)end.value=c.endereco||'';
  document.getElementById('mcObs').value=c.observacoes||'';
  document.getElementById('mCliTit').textContent='Editar Cliente — '+c.nome;
  om('mCli');
}
function verDemCli(nome){ir('dem');document.getElementById('fBusca').value=nome;if(allDem.length)filtDem();else loadDem();}

let pDepSel2=null,pCatSel2=null;
async function loadParam(){
  const {data}=await sb.from('departamentos').select('*').order('ordem');
  const el=document.getElementById('pDeps');
  el.innerHTML=data?.length?data.map(d=>`
    <div onclick="selDep('${d.id}')" style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;cursor:pointer;border:1px solid ${pDepSel2===d.id?'var(--accent)':'var(--border)'};background:${pDepSel2===d.id?'var(--accent-pale)':'transparent'};margin-bottom:6px;transition:all .12s">
      <span style="font-size:18px;flex-shrink:0">${d.icone||'📋'}</span>
      <div style="width:8px;height:8px;border-radius:50%;background:${d.cor||'#888'};flex-shrink:0"></div>
      <span style="flex:1;font-size:13px;font-weight:500;color:${pDepSel2===d.id?'var(--accent)':'var(--text)'}">${d.nome}</span>
      <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:${d.ativo?'var(--green-pale)':'var(--surface2)'};color:${d.ativo?'var(--green)':'var(--text3)'};">${d.ativo?'Ativo':'Inativo'}</span>
    </div>`).join(''):'<div class="vazio" style="padding:20px;font-size:12px">Nenhum departamento. Clique em + Novo.</div>';
}
async function selDep(id){pDepSel2=id;pCatSel2=null;document.getElementById('btnNovaCat').style.display='inline-flex';await loadParam();const {data}=await sb.from('categorias').select('*').eq('departamento_id',id).order('ordem');const el=document.getElementById('pCats');el.innerHTML=data?.length?data.map(c=>`<div onclick="selCat('${c.id}')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid ${pCatSel2===c.id?'var(--sky)':'var(--border)'};background:${pCatSel2===c.id?'var(--sky-pale)':'transparent'};margin-bottom:6px"><span style="flex:1;font-size:13px;font-weight:500">${c.nome}</span></div>`).join(''):'<div class="vazio">Nenhuma.</div>';document.getElementById('pTipos').innerHTML='<div class="vazio">← Selecione uma categoria</div>';}
async function selCat(id){
  pCatSel2=id;
  document.getElementById('btnNovoTipo').style.display='inline-flex';
  await selDep(pDepSel2);
  const {data}=await sb.from('tipos_demanda').select('*').eq('categoria_id',id).order('nome');
  const el=document.getElementById('pTipos');
  el.innerHTML=data?.length?data.map(t=>`
    <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;background:var(--surface)">
      <span style="flex:1;font-size:13px;font-weight:500;color:var(--text)">${t.nome}</span>
      <span style="font-size:10px;font-weight:700;background:var(--amber-pale);color:#d97706;padding:2px 7px;border-radius:4px;font-family:monospace">${t.prefixo_numeracao}</span>
      <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--surface2);color:var(--text3)">${t.prioridade_padrao||'normal'}</span>
      <button onclick="excluirTipo('${t.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 4px;border-radius:4px;transition:all .12s" title="Excluir" onmouseover="this.style.background='var(--red-pale)';this.style.color='var(--red)'" onmouseout="this.style.background='none';this.style.color='var(--text3)'">×</button>
    </div>`).join(''):'<div class="vazio" style="padding:20px;font-size:12px">Nenhum tipo. Clique em + Novo.</div>';
}
async function excluirTipo(id){
  if(!confirm('Excluir este tipo de demanda?')) return;
  await sb.from('tipos_demanda').delete().eq('id',id);
  toast('Tipo excluído.','ok');
  await selCat(pCatSel2);
}
// ── Formulários inline de parâmetros ──────────────────────────────────────
function toggleFormDep(){const f=document.getElementById('formDep');f.style.display=f.style.display==='none'?'block':'none';if(f.style.display==='block')document.getElementById('newDepNome').focus();}
function toggleFormCat(){const f=document.getElementById('formCat');f.style.display=f.style.display==='none'?'block':'none';if(f.style.display==='block')document.getElementById('newCatNome').focus();}
function toggleFormTipo(){const f=document.getElementById('formTipo');f.style.display=f.style.display==='none'?'block':'none';if(f.style.display==='block')document.getElementById('newTipoNome').focus();}

async function salvarNovoDep(){
  const n=document.getElementById('newDepNome').value.trim();
  if(!n){toast('Informe o nome.','err');return;}
  const cor=document.getElementById('newDepCor').value||'#2563EB';
  const icone=document.getElementById('newDepIcone').value.trim()||'📋';
  await sb.from('departamentos').insert({nome:n,cor,icone,ativo:true,ordem:999,created_at:new Date().toISOString()});
  toast('Departamento "'+n+'" criado!','ok');
  document.getElementById('newDepNome').value='';
  document.getElementById('formDep').style.display='none';
  await loadParam();
  await loadDeps();
}
async function salvarNovaCat(){
  if(!pDepSel2){toast('Selecione um departamento','err');return;}
  const n=document.getElementById('newCatNome').value.trim();
  if(!n){toast('Informe o nome.','err');return;}
  await sb.from('categorias').insert({nome:n,departamento_id:pDepSel2,ativo:true,ordem:999,created_at:new Date().toISOString()});
  toast('Categoria "'+n+'" criada!','ok');
  document.getElementById('newCatNome').value='';
  document.getElementById('formCat').style.display='none';
  await selDep(pDepSel2);
}
async function salvarNovoTipo(){
  if(!pCatSel2){toast('Selecione uma categoria','err');return;}
  const n=document.getElementById('newTipoNome').value.trim();
  const pf=document.getElementById('newTipoPref').value.trim().toUpperCase().slice(0,6);
  const prio=document.getElementById('newTipoPrio').value||'normal';
  if(!n){toast('Informe o nome.','err');return;}
  if(!pf){toast('Informe o prefixo.','err');return;}
  await sb.from('tipos_demanda').insert({nome:n,categoria_id:pCatSel2,prefixo_numeracao:pf,prioridade_padrao:prio,ativo:true,ordem:999,created_at:new Date().toISOString()});
  toast('Tipo "'+n+'" criado!','ok');
  document.getElementById('newTipoNome').value='';
  document.getElementById('newTipoPref').value='';
  document.getElementById('formTipo').style.display='none';
  await selCat(pCatSel2);
}
// Manter compatibilidade (chamados de outros lugares)
async function novoDep(){toggleFormDep();}
async function novaCat(){toggleFormCat();}
async function novoTipo(){toggleFormTipo();}

async function loadUsers(){const {data}=await sb.from('profiles').select('*').order('nome');const g=document.getElementById('usersGrid');g.innerHTML=data?.length?data.map(u=>{const ini=u.nome.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(),ehV=u.id===U.id;return`<div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;${!u.ativo?'opacity:.55':''}"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div style="width:44px;height:44px;border-radius:10px;background:${u.perfil==='gestor'?'var(--green-pale)':'var(--accent-pale)'};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:${u.perfil==='gestor'?'var(--green)':'var(--accent)'}">${ini}</div><div><div style="font-size:15px;font-weight:600">${u.nome}${ehV?' <small style="color:var(--text3)">(você)</small>':''}</div><div style="font-size:12px;color:var(--text3)">Login: <strong>${u.usuario||u.email}</strong></div><span class="tag ${u.perfil==='gestor'?'tg':'ts'}" style="margin-top:4px">${u.perfil==='gestor'?'Gestor':'Colaborador'}</span>${!u.ativo?'<span class="tag tgr" style="margin-left:4px">Inativo</span>':''}</div></div><div style="display:flex;gap:6px"><button class="btn btn-s" style="flex:1;padding:6px;font-size:12px;justify-content:center" onclick="editUser2('${u.id}')">✏️ Editar</button>${!ehV?`<button class="btn ${u.ativo?'btn-er':'btn-ok'}" style="flex:1;padding:6px;font-size:12px;justify-content:center" onclick="toggleU('${u.id}',${u.ativo},'${u.nome}')">${u.ativo?'🔴 Inativar':'🟢 Ativar'}</button>`:''}</div></div>`;}).join(''):'<div class="loading">Nenhum usuário.</div>';}
function abrirModalUser(){
  editUser=false;
  // Mostrar campo de usuário (oculto na edição)
  const fg=document.getElementById('fgUsuario');
  if(fg) fg.style.display='';
  // Limpar campos
  ['muId','muNome','muUsuario','muSenha','muWa'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  // Textos
  document.getElementById('mUserTit').textContent='Novo Colaborador';
  document.getElementById('muBtn').textContent='✅ Salvar Colaborador';
  const hl=document.getElementById('muSenhaHint');
  if(hl) hl.textContent='🔑 Defina a senha que o colaborador usará para entrar.';
  const sl=document.getElementById('muSenhaLabel');
  if(sl) sl.textContent='Senha *';
  // Perfil padrão
  const pfEl=document.getElementById('muPerfil');
  if(pfEl) pfEl.value='colaborador';
  // Popular departamentos
  const dsel=document.getElementById('muDept');
  if(dsel){
    dsel.innerHTML='<option value="">Todos os departamentos</option>';
    deps.forEach(d=>dsel.innerHTML+=`<option value="${d.id}">${d.icone||''} ${d.nome}</option>`);
  }
  om('mUser');
}
async function editUser2(id){
  const fg=document.getElementById('fgUsuario');
  if(fg) fg.style.display='none';
  editUser=true;
  const {data:u}=await sb.from('profiles').select('*').eq('id',id).single();
  editUser=true;
  document.getElementById('muId').value=u.id;
  document.getElementById('muNome').value=u.nome;
  // muEmail removido
  // muEmail removido
  document.getElementById('muWa').value=u.whatsapp||'';
  document.getElementById('muPerfil').value=u.perfil;
  // Na edição mostrar campo de senha mas opcional
  document.getElementById('muSenhaSec').style.display='block';
  document.getElementById('muSenha').value='';
  document.getElementById('muSenha').placeholder='Nova senha (deixe em branco para não alterar)';
  document.getElementById('mUserTit').textContent='Editar Usuário';
  document.getElementById('muBtn').textContent='Salvar Alterações';
  om('mUser');
}
async function salvarUser(){
  const nome=document.getElementById('muNome').value.trim();
  const perfil=document.getElementById('muPerfil').value;
  const wa=document.getElementById('muWa').value.trim()||null;
  if(!nome){toast('Informe o nome','err');return;}

  // ── EDIÇÃO ──────────────────────────────────────────────────────────────
  if(editUser){
    const id=document.getElementById('muId').value;
    const novaSenha=document.getElementById('muSenha').value.trim();
    // Atualiza localmente
    const profs=dbGet('profiles');
    const idx=profs.findIndex(p=>p.id===id);
    if(idx>=0){
      profs[idx].nome=nome; profs[idx].perfil=perfil;
      if(wa) profs[idx].whatsapp=wa;
      if(novaSenha&&novaSenha.length>=6){
        profs[idx].senha_hash=await hashPass(novaSenha);
        profs[idx].primeiro_acesso=false;
      }
      dbSet('profiles',profs);
    }
    // Sincroniza com Sheets
    if(sheetsConectado){
      try{
        await sheetsPost({acao:'atualizar',tabela:'PROFILES',id,dados:profs[idx]});
      }catch(e){console.warn('Sync erro:',e);}
    }
    toast('Usuário "'+nome+'" atualizado!','ok');
    fm('mUser'); await loadUsers(); await loadCols(); return;
  }

  // ── CRIAÇÃO ──────────────────────────────────────────────────────────────
  const usuario=document.getElementById('muUsuario').value.trim();
  const senha=document.getElementById('muSenha').value.trim();
  if(!usuario){toast('Informe o nome de usuário para login','err');return;}
  if(!senha||senha.length<4){toast('A senha deve ter pelo menos 4 caracteres','err');return;}

  const btn=document.getElementById('muBtn');
  btn.disabled=true; btn.textContent='Criando...';

  // Verifica duplicata
  const profs=dbGet('profiles');
  const dup=profs.find(p=>(p.usuario||'').toLowerCase()===usuario.toLowerCase());
  if(dup){
    btn.disabled=false; btn.textContent='Criar Usuário';
    toast('Usuário "'+usuario+'" já existe!','err'); return;
  }

  // Cria localmente
  const novoId=uuid();
  const dept=document.getElementById('muDept')?.value||null;
  const novoProf={
    id:novoId,
    email:usuario.toLowerCase()+'@focco.local',
    usuario:usuario,
    nome,
    perfil:perfil||'colaborador',
    departamento_id:dept||null,
    senha_hash:await hashPass(senha),
    whatsapp:wa||'',
    ativo:true,
    primeiro_acesso:true,
    created_at:new Date().toISOString()
  };
  profs.push(novoProf);
  dbSet('profiles',profs);

  // Sincroniza com Sheets
  if(sheetsConectado){
    try{
      await sheetsPost({acao:'inserir',tabela:'PROFILES',dados:novoProf});
    }catch(e){console.warn('Sync erro:',e);}
  }

  btn.disabled=false; btn.textContent='Criar Usuário';
  toast('✅ '+nome+' criado! Login: '+usuario,'ok');
  fm('mUser'); await loadUsers(); await loadCols();
}
async function toggleU(id,ativo,nome){if(!confirm(`${ativo?'Inativar':'Reativar'} ${nome}?`))return;await sb.from('profiles').update({ativo:!ativo}).eq('id',id);toast(`${nome} ${ativo?'inativado':'reativado'}!`,'ok');await loadUsers();}

function buscaRapida(){const t=document.getElementById('busca').value.trim();if(t.length<2)return;ir('dem');document.getElementById('fBusca').value=t;if(allDem.length)filtDem();else loadDem();}
function om(id){document.getElementById(id).classList.add('open');}
function fm(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
let toastTmr;
function toast(msg,tipo=''){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show'+(tipo==='ok'?' ok':tipo==='err'?' err':'');clearTimeout(toastTmr);toastTmr=setTimeout(()=>el.classList.remove('show'),3500);}
document.getElementById('lEmail').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('lSenha').focus();});
document.getElementById('lSenha').addEventListener('keydown',e=>{if(e.key==='Enter')fazerLogin();});

// ir() unificado acima

// ══════════════════════════════════════════
// HELPERS DE DEMANDA POR DEPTO
// ══════════════════════════════════════════
async function getDemByDep(nomesDep) {
  const depIds = deps.filter(d => nomesDep.some(n => d.nome.includes(n))).map(d => d.id);
  if (!depIds.length) return [];
  const {data} = await sb.from('demandas')
    .select('id,numero,resumo,status,prioridade,ultima_movimentacao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),tipos_demanda(nome,prefixo_numeracao)')
    .in('departamento_atual_id', depIds)
    .not('status','in','(concluida,cancelada)')
    .order('ultima_movimentacao');
  return data || [];
}

async function getDemByPrefixos(prefixos) {
  const hj = new Date().toISOString().split('T')[0];
  const conds = prefixos.map(p => `numero.like.${p}-%`).join(',');
  const {data} = await sb.from('demandas')
    .select('id,numero,resumo,status,prioridade,ultima_movimentacao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome)')
    .not('status','in','(concluida,cancelada)')
    .order('ultima_movimentacao');
  return (data || []).filter(d => prefixos.some(p => d.numero?.startsWith(p+'-')));
}

function renderDemMini(lista, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!lista.length) { el.innerHTML = '<div class="vazio">Nenhuma demanda.</div>'; return; }
  const hj = new Date().toISOString().split('T')[0];
  el.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>Número</th><th>Cliente</th><th>Status</th><th>Inat.</th></tr></thead><tbody>
    ${lista.map(d => {
      const dias = Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000);
      const dc = dias>=5?'tr':dias>=2?'ta':'ts';
      return `<tr onclick="abrirDet('${d.id}')"><td><strong style="color:var(--sky)">${d.numero}</strong></td><td>${d.clientes?.nome||'—'}</td><td><span class="tag ${SC[d.status]||''}">${SL[d.status]||d.status}</span></td><td><span class="tag ${dc}">${dias}d</span></td></tr>`;
    }).join('')}
  </tbody></table></div>`;
}

// ══════════════════════════════════════════
// FISCAL
// ══════════════════════════════════════════
async function loadFiscal() {
  const [das, icm, iss, pfis] = await Promise.all([
    getDemByPrefixos(['DAS','PGD','DEF']),
    getDemByPrefixos(['ICM','SPF','GST','IST']),
    getDemByPrefixos(['ISS','NFS']),
    getDemByPrefixos(['PCF','EFD'])
  ]);
  const all = [...das, ...icm, ...iss, ...pfis];
  const hj = new Date().toISOString().split('T')[0];
  const venc7 = all.filter(d => d.prazo && d.prazo <= new Date(Date.now()+7*86400000).toISOString().split('T')[0]);
  document.getElementById('fk1').textContent = das.length;
  document.getElementById('fk2').textContent = venc7.length;
  document.getElementById('fk3').textContent = all.filter(d => d.prioridade === 'urgente').length;
  const {count:conc} = await sb.from('demandas').select('*',{count:'exact',head:true}).in('departamento_atual_id', deps.filter(d=>d.nome==='Escrita Fiscal').map(d=>d.id)).eq('status','concluida').gte('data_conclusao', new Date(new Date().setDate(1)).toISOString());
  document.getElementById('fk4').textContent = conc||0;
  renderDemMini(das, 'fiscalDAS');
  renderDemMini([...icm,...iss,...pfis], 'fiscalICMS');
  renderDemMini(all, 'fiscalTabela');
}

async function filtFiscal(pref) {
  const lista = await getDemByPrefixos([pref]);
  renderDemMini(lista, 'fiscalDAS');
}

// ══════════════════════════════════════════
// DEPARTAMENTO PESSOAL
// ══════════════════════════════════════════
async function loadDP() {
  const [adm, resc, fer, fol] = await Promise.all([
    getDemByPrefixos(['ADM','ADA','ADE']),
    getDemByPrefixos(['RSC','RJC','RPD','RAC','RMO']),
    getDemByPrefixos(['FER','FEC','ABP']),
    getDemByPrefixos(['FOL','T1P','T2P'])
  ]);
  const all = [...adm,...resc,...fer,...fol];
  document.getElementById('dpk1').textContent = all.length;
  document.getElementById('dpk2').textContent = adm.filter(d=>d.prioridade==='urgente'||d.prioridade==='alta').length;
  document.getElementById('dpk3').textContent = resc.length;
  const {count:conc} = await sb.from('demandas').select('*',{count:'exact',head:true}).in('departamento_atual_id', deps.filter(d=>d.nome.includes('Pessoal')).map(d=>d.id)).eq('status','concluida').gte('data_conclusao', new Date(new Date().setDate(1)).toISOString());
  document.getElementById('dpk4').textContent = conc||0;
  renderDemMini(adm, 'dpAdm');
  renderDemMini(resc, 'dpResc');
  renderDemMini(fer, 'dpFerias');
  renderDemMini(all, 'dpTabela');
}

// ══════════════════════════════════════════
// CONTABILIDADE
// ══════════════════════════════════════════
async function loadCont() {
  const [ecd, irpf, bal, fech] = await Promise.all([
    getDemByPrefixos(['ECD','ECF','ECR','ECC']),
    getDemByPrefixos(['IRF','IRR','IRP','CRL']),
    getDemByPrefixos(['BPA','DRE','BPF']),
    getDemByPrefixos(['FCM','FCA','LCT','CON','CBA'])
  ]);
  const all = [...ecd,...irpf,...bal,...fech];
  document.getElementById('ck1').textContent = all.length;
  document.getElementById('ck2').textContent = ecd.filter(d=>d.prioridade==='urgente'||d.prioridade==='alta').length;
  document.getElementById('ck3').textContent = irpf.length;
  const {count:conc} = await sb.from('demandas').select('*',{count:'exact',head:true}).in('departamento_atual_id', deps.filter(d=>d.nome==='Contabilidade').map(d=>d.id)).eq('status','concluida').gte('data_conclusao', new Date(new Date().setDate(1)).toISOString());
  document.getElementById('ck4').textContent = conc||0;
  renderDemMini([...ecd,...bal,...fech], 'contECD');
  renderDemMini(irpf, 'contIRPF');
  renderDemMini(all, 'contTabela');
}

// ══════════════════════════════════════════
// RURAL
// ══════════════════════════════════════════
async function loadRural() {
  const [ccir, itr, prod, arr] = await Promise.all([
    getDemByPrefixos(['CCR','CCA']),
    getDemByPrefixos(['ITR','IRR']),
    getDemByPrefixos(['CPR','RPR','APR']),
    getDemByPrefixos(['ARR','PAR'])
  ]);
  const all = [...ccir,...itr,...prod,...arr];
  const {count:cliRur} = await sb.from('clientes').select('*',{count:'exact',head:true}).eq('tipo_cliente','rural').eq('ativo',true);
  document.getElementById('rk1').textContent = cliRur||0;
  document.getElementById('rk2').textContent = itr.length;
  document.getElementById('rk3').textContent = ccir.length;
  const {count:conc} = await sb.from('demandas').select('*',{count:'exact',head:true}).in('departamento_atual_id', deps.filter(d=>d.nome.includes('Legal')).map(d=>d.id)).eq('status','concluida').gte('data_conclusao', new Date(new Date().setDate(1)).toISOString());
  document.getElementById('rk4').textContent = conc||0;
  renderDemMini([...ccir,...itr], 'ruralCCIR');
  renderDemMini([...prod,...arr], 'ruralProd');
  renderDemMini(all, 'ruralTabela');
}

// ══════════════════════════════════════════
// FINANCEIRO
