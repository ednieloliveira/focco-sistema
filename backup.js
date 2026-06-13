// ═══════════════════════════════════════════
// Backup e histórico
// ═══════════════════════════════════════════

// ══════════════════════════════════════════
// PRAZOS LEGAIS NO DETALHE DA DEMANDA
// ══════════════════════════════════════════
function getPrazoLegal(prefixo) {
  const prazos = {
    'DAS': 'Vence todo dia 20',
    'FOL': 'Folha: até dia 5',
    'FGTS': 'FGTS: até dia 7',
    'ADM': 'Registrar em até 48h',
    'RSC': 'Pagar em até 10 dias',
    'ECD': 'Entrega: último dia útil de junho',
    'ECF': 'Entrega: último dia útil de julho',
    'IRF': 'IRPF: até 30 de abril',
    'ITR': 'ITR: até 30 de setembro',
    'ICM': 'ICMS: até dia 15',
    'ISS': 'ISS: até dia 15',
  };
  return prazos[prefixo] || null;
}

// ══════════════════════════════════════════
// renderDet — override removido (causava loop infinito)

// ir() unificado acima

// Inicializar calendário quando carregar
function initCalendario() {
  calAno = new Date().getFullYear();
  calMes = new Date().getMonth();
}


// ══════════════════════════════════════════
// BACKUP
// ══════════════════════════════════════════
let backupHistList = JSON.parse(localStorage.getItem('focco_backup_hist')||'[]');

async function loadBackupResumo() {
  const el = document.getElementById('backupResumo');
  el.innerHTML = '<div class="loading">Carregando...</div>';
  const [
    {count:cli}, {count:dem}, {count:tram},
    {count:pend}, {count:users}, {count:tipos}
  ] = await Promise.all([
    sb.from('clientes').select('*',{count:'exact',head:true}).eq('ativo',true),
    sb.from('demandas').select('*',{count:'exact',head:true}),
    sb.from('tramites').select('*',{count:'exact',head:true}),
    sb.from('pendencias').select('*',{count:'exact',head:true}),
    sb.from('profiles').select('*',{count:'exact',head:true}),
    sb.from('tipos_demanda').select('*',{count:'exact',head:true})
  ]);
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${[
        ['👥','Clientes ativos',cli||0,'tg'],
        ['📋','Total de demandas',dem||0,'ts'],
        ['📝','Trâmites registrados',tram||0,'tn'],
        ['⏳','Pendências',pend||0,'ta'],
        ['👤','Colaboradores',users||0,'tp'],
        ['🗂️','Tipos de serviço',tipos||0,'ts'],
      ].map(([ic,nm,vl,cl])=>`
        <div style="background:var(--surface2);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">${ic}</span>
          <div><div style="font-family:Syne,sans-serif;font-weight:800;font-size:20px;color:var(--navy)">${vl}</div><div style="font-size:12px;color:var(--text3)">${nm}</div></div>
        </div>`).join('')}
    </div>
    <div style="margin-top:14px;padding:10px 14px;background:var(--sky-pale);border-radius:8px;font-size:13px;color:var(--sky)">
      💡 Faça backup regularmente para não perder dados. Salve em nuvem (Google Drive, OneDrive) ou pen drive.
    </div>`;
}

function registrarHistoricoBackup() {
  const el = document.getElementById('backupHistorico');
  if (!backupHistList.length) {
    el.innerHTML = '<div class="vazio">Nenhum backup realizado ainda.</div>';
    return;
  }
  el.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Arquivo</th><th>Registros</th></tr></thead>
    <tbody>${backupHistList.slice().reverse().slice(0,20).map(b=>`<tr>
      <td>${new Date(b.data).toLocaleString('pt-BR')}</td>
      <td><span class="tag ts">${b.tipo}</span></td>
      <td style="font-size:12px;color:var(--text3)">${b.arquivo}</td>
      <td>${b.registros}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function backupCompleto() {
  const el = document.getElementById('backupStatus');
  el.textContent = 'Coletando dados...';
  try {
    const [clientes, demandas, tramites, pendencias, proxAcoes, profiles, tipos, cats, deps] = await Promise.all([
      sb.from('clientes').select('*'),
      sb.from('demandas').select('*'),
      sb.from('tramites').select('*'),
      sb.from('pendencias').select('*'),
      sb.from('proximas_acoes').select('*'),
      sb.from('profiles').select('id,nome,email,perfil,ativo,whatsapp'),
      sb.from('tipos_demanda').select('*'),
      sb.from('categorias').select('*'),
      sb.from('departamentos').select('*'),
    ]);
    const backup = {
      versao: '1.0', gerado_em: new Date().toISOString(),
      sistema: 'Focco Contabilidade', usuario: U?.nome,
      dados: {
        clientes: clientes.data||[], demandas: demandas.data||[],
        tramites: tramites.data||[], pendencias: pendencias.data||[],
        proximas_acoes: proxAcoes.data||[], colaboradores: profiles.data||[],
        tipos_demanda: tipos.data||[], categorias: cats.data||[],
        departamentos: deps.data||[]
      }
    };
    const total = Object.values(backup.dados).reduce((s,v)=>s+v.length,0);
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const data = new Date().toISOString().split('T')[0];
    const nome = `focco_backup_${data}.json`;
    a.href = url; a.download = nome; a.click();
    // Registrar histórico
    backupHistList.push({data:new Date().toISOString(), tipo:'Completo JSON', arquivo:nome, registros:total});
    localStorage.setItem('focco_backup_hist', JSON.stringify(backupHistList));
    registrarHistoricoBackup();
    el.innerHTML = `<span style="color:var(--green)">✅ Backup completo! ${total} registros exportados.</span>`;
    toast('Backup realizado com sucesso!','ok');
  } catch(e) { el.innerHTML = `<span style="color:var(--red)">❌ Erro: ${e.message}</span>`; }
}

async function backupClientes() {
  const {data} = await sb.from('clientes').select('nome,cpf_cnpj,tipo_pessoa,tipo_cliente,regime_tributario,whatsapp,email,observacoes,created_at').order('nome');
  if (!data?.length) { toast('Nenhum cliente encontrado','err'); return; }
  const cols = ['Nome','CPF/CNPJ','Tipo Pessoa','Tipo Cliente','Regime','WhatsApp','Email','Observações','Criado em'];
  const rows = data.map(c=>[c.nome,c.cpf_cnpj||'',c.tipo_pessoa,c.tipo_cliente,c.regime_tributario||'',c.whatsapp||'',c.email||'',c.observacoes||'',new Date(c.created_at).toLocaleDateString('pt-BR')]);
  downloadCSV(cols, rows, `focco_clientes_${new Date().toISOString().split('T')[0]}.csv`);
  backupHistList.push({data:new Date().toISOString(), tipo:'Clientes CSV', arquivo:`focco_clientes_${new Date().toISOString().split('T')[0]}.csv`, registros:data.length});
  localStorage.setItem('focco_backup_hist', JSON.stringify(backupHistList));
  registrarHistoricoBackup();
  toast(`${data.length} clientes exportados!`,'ok');
}

async function backupDemandas() {
  const {data} = await sb.from('demandas').select('numero,resumo,status,prioridade,created_at,data_conclusao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome),tipos_demanda(nome)').order('created_at');
  if (!data?.length) { toast('Nenhuma demanda encontrada','err'); return; }
  const cols = ['Número','Cliente','Resumo','Status','Prioridade','Responsável','Departamento','Tipo','Aberta em','Concluída em'];
  const rows = data.map(d=>[d.numero,d.clientes?.nome||'',d.resumo,d.status,d.prioridade,d.profiles?.nome||'',d.departamentos?.nome||'',d.tipos_demanda?.nome||'',new Date(d.created_at).toLocaleDateString('pt-BR'),d.data_conclusao?new Date(d.data_conclusao).toLocaleDateString('pt-BR'):'']);
  downloadCSV(cols, rows, `focco_demandas_${new Date().toISOString().split('T')[0]}.csv`);
  backupHistList.push({data:new Date().toISOString(), tipo:'Demandas CSV', arquivo:`focco_demandas_${new Date().toISOString().split('T')[0]}.csv`, registros:data.length});
  localStorage.setItem('focco_backup_hist', JSON.stringify(backupHistList));
  registrarHistoricoBackup();
  toast(`${data.length} demandas exportadas!`,'ok');
}

async function backupColaboradores() {
  const {data} = await sb.from('profiles').select('nome,email,perfil,ativo,whatsapp,created_at').order('nome');
  if (!data?.length) { toast('Nenhum colaborador encontrado','err'); return; }
  const cols = ['Nome','Email','Perfil','Ativo','WhatsApp','Cadastrado em'];
  const rows = data.map(c=>[c.nome,c.email,c.perfil,c.ativo?'Sim':'Não',c.whatsapp||'',new Date(c.created_at).toLocaleDateString('pt-BR')]);
  downloadCSV(cols, rows, `focco_colaboradores_${new Date().toISOString().split('T')[0]}.csv`);
  backupHistList.push({data:new Date().toISOString(), tipo:'Colaboradores CSV', arquivo:`focco_colaboradores_${new Date().toISOString().split('T')[0]}.csv`, registros:data.length});
  localStorage.setItem('focco_backup_hist', JSON.stringify(backupHistList));
  registrarHistoricoBackup();
  toast(`${data.length} colaboradores exportados!`,'ok');
}

function downloadCSV(cols, rows, nome) {
  const csv = [cols.join(','), ...rows.map(r=>r.map(v=>'"'+(String(v||'').replace(/"/g,'""'))+'"').join(','))].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
}

