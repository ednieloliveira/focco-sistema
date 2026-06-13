// ══════════════════════════════════════════
function exportarExcel(dados, nomeArquivo, nomeAba) {
  if (!dados || !dados.length) { toast('Nenhum dado para exportar','err'); return; }
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    // Estilo da largura das colunas
    const cols = Object.keys(dados[0]).map(k => ({ wch: Math.max(k.length, 15) }));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, nomeAba || 'Dados');
    XLSX.writeFile(wb, (nomeArquivo || 'focco_export') + '_' + new Date().toISOString().split('T')[0] + '.xlsx');
    toast('Excel exportado com sucesso!', 'ok');
    return true;
  } catch(e) {
    toast('Erro ao gerar Excel: ' + e.message, 'err');
    return false;
  }
}

function exportarExcelMultiAbas(abas, nomeArquivo) {
  // abas = [{nome, dados}, {nome, dados}]
  try {
    const wb = XLSX.utils.book_new();
    abas.forEach(aba => {
      if (!aba.dados?.length) return;
      const ws = XLSX.utils.json_to_sheet(aba.dados);
      const cols = Object.keys(aba.dados[0]).map(k => ({ wch: Math.max(k.length, 14) }));
      ws['!cols'] = cols;
      XLSX.utils.book_append_sheet(wb, ws, aba.nome.slice(0,31));
    });
    XLSX.writeFile(wb, (nomeArquivo||'focco') + '_' + new Date().toISOString().split('T')[0] + '.xlsx');
    toast('Excel gerado com sucesso!', 'ok');
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

// ─────────────────────────────────────────
// EXCEL — CLIENTES
// ─────────────────────────────────────────
async function exportarExcelClientes() {
  const {data} = await sb.from('clientes').select('*').eq('ativo',true).order('nome');
  if (!data?.length) { toast('Nenhum cliente para exportar','err'); return; }
  const regs = {simples_nacional:'Simples Nacional',lucro_presumido:'Lucro Presumido',lucro_real:'Lucro Real',mei:'MEI',isento:'Isento'};
  const dados = data.map(c => ({
    'Nome / Razão Social': c.nome,
    'CPF / CNPJ': c.cpf_cnpj||'',
    'Tipo de Pessoa': c.tipo_pessoa==='juridica'?'Pessoa Jurídica':'Pessoa Física',
    'Regime Tributário': regs[c.regime_tributario]||'',
    'WhatsApp': c.whatsapp||'',
    'E-mail': c.email||'',
    'Observações': c.observacoes||'',
    'Cadastrado em': new Date(c.created_at).toLocaleDateString('pt-BR')
  }));
  exportarExcel(dados, 'focco_clientes', 'Clientes');
}

// ─────────────────────────────────────────
// EXCEL — DEMANDAS
// ─────────────────────────────────────────
async function exportarExcelDemandas(filtroAba) {
  let q = sb.from('demandas').select('numero,resumo,descricao,status,prioridade,created_at,ultima_movimentacao,data_conclusao,prazo,clientes(nome,cpf_cnpj),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome),categorias(nome),tipos_demanda(nome)').order('created_at',{ascending:false});
  if (filtroAba==='aberta') q = q.not('status','in','(aguardando_conclusao,concluida,cancelada)');
  else if (filtroAba==='aprovacao') q = q.eq('status','aguardando_conclusao');
  else if (filtroAba==='encerrada') q = q.in('status',['concluida','cancelada']);
  const {data} = await q;
  if (!data?.length) { toast('Nenhuma demanda para exportar','err'); return; }
  const SLoc = {aberta:'Aberta',em_andamento:'Em andamento',aguardando_aceite:'Ag. aceite',aguardando_cliente:'Ag. cliente',aguardando_orgao:'Ag. órgão',aguardando_gestor:'Ag. gestor',aguardando_conclusao:'Ag. conclusão',concluida:'Concluída',cancelada:'Cancelada'};
  const dados = data.map(d => ({
    'Número': d.numero,
    'Cliente': d.clientes?.nome||'',
    'CPF/CNPJ': d.clientes?.cpf_cnpj||'',
    'Resumo': d.resumo,
    'Descrição': d.descricao||'',
    'Departamento': d.departamentos?.nome||'',
    'Categoria': d.categorias?.nome||'',
    'Tipo de Serviço': d.tipos_demanda?.nome||'',
    'Status': SLoc[d.status]||d.status,
    'Prioridade': d.prioridade,
    'Responsável': d.profiles?.nome||'',
    'Prazo': d.prazo?new Date(d.prazo+'T12:00:00').toLocaleDateString('pt-BR'):'',
    'Aberta em': new Date(d.created_at).toLocaleDateString('pt-BR'),
    'Última movimentação': new Date(d.ultima_movimentacao).toLocaleDateString('pt-BR'),
    'Concluída em': d.data_conclusao?new Date(d.data_conclusao).toLocaleDateString('pt-BR'):'',
    'Dias sem movimentação': Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000)
  }));
  const nome = filtroAba==='aberta'?'Em Aberto':filtroAba==='aprovacao'?'Ag Aprovação':filtroAba==='encerrada'?'Encerradas':'Todas';
  exportarExcel(dados, 'focco_demandas', 'Demandas — '+nome);
}

// ─────────────────────────────────────────
// EXCEL — RELATÓRIO COMPLETO (múltiplas abas)
// ─────────────────────────────────────────
async function exportarRelatorioCompleto() {
  toast('Gerando relatório completo...','');
  const [demR, cliR, colsR, pendR, tramR] = await Promise.all([
    sb.from('demandas').select('numero,resumo,status,prioridade,created_at,ultima_movimentacao,data_conclusao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome),tipos_demanda(nome)').order('created_at',{ascending:false}),
    sb.from('clientes').select('*').eq('ativo',true).order('nome'),
    sb.from('profiles').select('nome,email,perfil,ativo').order('nome'),
    sb.from('pendencias').select('*,demandas(numero,clientes(nome))').eq('resolvida',false),
    sb.from('tramites').select('descricao,tipo,created_at,demandas(numero),profiles(nome)').order('created_at',{ascending:false}).limit(500)
  ]);
  const SLoc={aberta:'Aberta',em_andamento:'Em andamento',aguardando_aceite:'Ag. aceite',aguardando_cliente:'Ag. cliente',aguardando_orgao:'Ag. órgão',aguardando_conclusao:'Ag. conclusão',concluida:'Concluída',cancelada:'Cancelada'};
  const abas = [
    { nome:'Demandas', dados:(demR.data||[]).map(d=>({'Número':d.numero,'Cliente':d.clientes?.nome||'','Status':SLoc[d.status]||d.status,'Prioridade':d.prioridade,'Responsável':d.profiles?.nome||'','Departamento':d.departamentos?.nome||'','Tipo':d.tipos_demanda?.nome||'','Aberta em':new Date(d.created_at).toLocaleDateString('pt-BR'),'Dias inat.':Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000)})) },
    { nome:'Clientes', dados:(cliR.data||[]).map(c=>({'Nome':c.nome,'CPF/CNPJ':c.cpf_cnpj||'','Tipo':c.tipo_pessoa==='juridica'?'PJ':'PF','Regime':c.regime_tributario||'','WhatsApp':c.whatsapp||'','Email':c.email||''})) },
    { nome:'Colaboradores', dados:(colsR.data||[]).map(c=>({'Nome':c.nome,'Email':c.email,'Perfil':c.perfil,'Ativo':c.ativo?'Sim':'Não'})) },
    { nome:'Pendências', dados:(pendR.data||[]).map(p=>({'Demanda':p.demandas?.numero||'','Cliente':p.demandas?.clientes?.nome||'','Tipo':p.tipo,'Descrição':p.descricao,'Vencimento':p.data_prevista?new Date(p.data_prevista+'T12:00:00').toLocaleDateString('pt-BR'):''})) },
    { nome:'Últimos Trâmites', dados:(tramR.data||[]).map(t=>({'Demanda':t.demandas?.numero||'','Colaborador':t.profiles?.nome||'','Tipo':t.tipo,'Descrição':t.descricao,'Data':new Date(t.created_at).toLocaleString('pt-BR')})) },
  ];
  exportarExcelMultiAbas(abas, 'focco_relatorio_completo');
}

// ─────────────────────────────────────────
// EXCEL — RELATÓRIO POR COLABORADOR
// ─────────────────────────────────────────
async function exportarExcelColaborador() {
  const colId = document.getElementById('impColaborador')?.value;
  const dtIni = document.getElementById('impDtInicio')?.value;
  const dtFim = document.getElementById('impDtFim')?.value;
  let q = sb.from('demandas').select('numero,resumo,status,prioridade,created_at,ultima_movimentacao,data_conclusao,prazo,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome),tipos_demanda(nome)').order('created_at',{ascending:false});
  if (colId) q = q.eq('responsavel_atual_id', colId);
  if (dtIni) q = q.gte('created_at', dtIni+'T00:00:00');
  if (dtFim) q = q.lte('created_at', dtFim+'T23:59:59');
  const {data} = await q;
  if (!data?.length) { toast('Nenhuma demanda encontrada','err'); return; }
  const SLoc={aberta:'Aberta',em_andamento:'Em andamento',aguardando_aceite:'Ag. aceite',aguardando_cliente:'Ag. cliente',aguardando_orgao:'Ag. órgão',aguardando_conclusao:'Ag. conclusão',concluida:'Concluída',cancelada:'Cancelada'};
  const dados = data.map(d=>({'Número':d.numero,'Cliente':d.clientes?.nome||'','Serviço':d.tipos_demanda?.nome||d.resumo,'Departamento':d.departamentos?.nome||'','Status':SLoc[d.status]||d.status,'Prioridade':d.prioridade,'Responsável':d.profiles?.nome||'','Prazo':d.prazo?new Date(d.prazo+'T12:00:00').toLocaleDateString('pt-BR'):'','Aberta em':new Date(d.created_at).toLocaleDateString('pt-BR'),'Dias inat.':Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000),'Concluída em':d.data_conclusao?new Date(d.data_conclusao).toLocaleDateString('pt-BR'):''}));
  const colNome = colId ? cols.find(c=>c.id===colId)?.nome||'Colaborador' : 'Todos';
  exportarExcel(dados, 'focco_'+colNome.toLowerCase().replace(/\s/g,'_'), 'Demandas');
}

// ─────────────────────────────────────────
// EXCEL — CALENDÁRIO FISCAL
// ─────────────────────────────────────────
function exportarExcelCalendario() {
  const obrig = getObrigacoesMes(calAno, calMes);
  const concl = JSON.parse(localStorage.getItem('focco_obrig_concl')||'[]');
  const hoje = new Date();
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const dados = obrig.map(o => {
    const key = calAno+'-'+calMes+'-'+o.id;
    const ok = concl.includes(key);
    const venc = new Date(calAno,calMes,o.dia);
    return {
      'Vencimento': String(o.dia).padStart(2,'0')+'/'+String(calMes+1).padStart(2,'0')+'/'+calAno,
      'Obrigação': o.nome,
      'Tipo': o.tipo,
      'Abrangência': o.abrang||'todos',
      'Status': ok?'Concluído':venc<hoje?'Atrasado':'Pendente',
      'Recorrência': o.recorr
    };
  });
  exportarExcel(dados, 'focco_calendario_'+nomesMes[calMes]+'_'+calAno, nomesMes[calMes]+' '+calAno);
}

// ─────────────────────────────────────────
// EXCEL — KANBAN
// ─────────────────────────────────────────
async function exportarExcelKanban() {
  const {data} = await sb.from('demandas').select('id,numero,resumo,status,prioridade,ultima_movimentacao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome)').not('status','in','(concluida,cancelada)').order('status');
  if (!data?.length) { toast('Nenhuma demanda em aberto','err'); return; }
  const SLoc={aberta:'Em Aberto',em_andamento:'Em Andamento',aguardando_aceite:'Ag. Aceite',aguardando_cliente:'Ag. Cliente',aguardando_orgao:'Ag. Órgão',aguardando_gestor:'Ag. Gestor',aguardando_conclusao:'Ag. Conclusão'};
  const dados = data.map(d=>({'Coluna Kanban':SLoc[d.status]||d.status,'Número':d.numero,'Cliente':d.clientes?.nome||'','Resumo':d.resumo,'Prioridade':d.prioridade,'Responsável':d.profiles?.nome||'','Departamento':d.departamentos?.nome||'','Dias inat.':Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000)}));
  exportarExcel(dados, 'focco_kanban', 'Kanban');
}

// ─────────────────────────────────────────
// EXCEL — PENDÊNCIAS
// ─────────────────────────────────────────
async function exportarExcelPendencias() {
  const {data} = await sb.from('pendencias').select('*,demandas(numero,resumo,clientes(nome)),profiles(nome)').eq('resolvida',false).order('created_at');
  if (!data?.length) { toast('Nenhuma pendência em aberto','err'); return; }
  const dados = data.map(p=>({'Demanda':p.demandas?.numero||'','Cliente':p.demandas?.clientes?.nome||'','Tipo':p.tipo.replace(/_/g,' '),'Descrição':p.descricao,'Vencimento':p.data_prevista?new Date(p.data_prevista+'T12:00:00').toLocaleDateString('pt-BR'):'','Criada em':new Date(p.created_at).toLocaleDateString('pt-BR')}));
  exportarExcel(dados, 'focco_pendencias', 'Pendências');
}


// ══════════════════════════════════════════
// EXCLUSÃO — DEMANDA (apenas gestor)
// ══════════════════════════════════════════
async function excluirDemanda(id, numero) {
  if (U?.perfil !== 'gestor') { toast('Apenas o gestor pode excluir demandas','err'); return; }
  if (!confirm(`⚠️ Excluir a demanda ${numero}?\n\nEsta ação é irreversível e removerá todos os trâmites, pendências e histórico desta demanda.`)) return;
  
  // Confirmar uma segunda vez
  const confirma = prompt(`Digite o número da demanda para confirmar: ${numero}`);
  if (confirma !== numero) { toast('Número incorreto. Exclusão cancelada.','err'); return; }

  toast('Excluindo...','');
  try {
    // Excluir na ordem correta (FK)
    await sb.from('whatsapp_mensagens').delete().eq('demanda_id', id);
    await sb.from('notificacoes').delete().eq('demanda_id', id);
    await sb.from('aprovacoes').delete().eq('demanda_id', id);
    await sb.from('documentos').delete().eq('demanda_id', id);
    await sb.from('chat_mensagens').delete().eq('demanda_id', id);
    await sb.from('agenda').delete().eq('demanda_id', id);
    await sb.from('pendencias').delete().eq('demanda_id', id);
    await sb.from('proximas_acoes').delete().eq('demanda_id', id);
    await sb.from('tramites').delete().eq('demanda_id', id);
    await sb.from('demanda_responsaveis').delete().eq('demanda_id', id);
    await sb.from('demanda_estatisticas').delete().eq('demanda_id', id);
    await sb.from('demandas').delete().eq('id', id);
    toast(`Demanda ${numero} excluída com sucesso!`,'ok');
    ir('dem');
    await loadDem();
  } catch(e) {
    toast('Erro ao excluir: '+e.message,'err');
  }
}

// ══════════════════════════════════════════
// EXCLUSÃO — CLIENTE (apenas gestor)
// ══════════════════════════════════════════
async function excluirCliente(id, nome) {
  if (U?.perfil !== 'gestor') { toast('Apenas o gestor pode excluir clientes','err'); return; }
  
  // Verificar se tem demandas vinculadas
  const {count} = await sb.from('demandas').select('*',{count:'exact',head:true}).eq('cliente_id', id).not('status','in','(concluida,cancelada)');
  if (count > 0) {
    toast(`❌ Não é possível excluir "${nome}" — possui ${count} demanda(s) em aberto.`,'err');
    return;
  }
  
  if (!confirm(`⚠️ Excluir o cliente "${nome}"?\n\nEsta ação é irreversível.`)) return;
  
  const {error} = await sb.from('clientes').delete().eq('id', id);
  if (error) { toast('Erro ao excluir: '+error.message,'err'); return; }
  toast(`Cliente "${nome}" excluído!`,'ok');
  await loadCli();
}


// ══════════════════════════════════════════
// IRPF
