// ══════════════════════════════════════════
// IMPRESSÃO PDF POR COLABORADOR
// ══════════════════════════════════════════
async function loadImpressao() {
  // Preencher select de colaboradores
  const sel = document.getElementById('impColaborador');
  sel.innerHTML = '<option value="">Todos os colaboradores</option>';
  cols.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
  // Datas padrão: início do mês até hoje
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  document.getElementById('impDtInicio').value = inicioMes.toISOString().split('T')[0];
  document.getElementById('impDtFim').value = hoje.toISOString().split('T')[0];
}

async function gerarImpressao() {
  const colId = document.getElementById('impColaborador').value;
  const status = document.getElementById('impStatus').value;
  const dtIni = document.getElementById('impDtInicio').value;
  const dtFim = document.getElementById('impDtFim').value;
  const colNome = colId ? cols.find(c=>c.id===colId)?.nome || 'Colaborador' : 'Todos os Colaboradores';

  let q = sb.from('demandas').select('numero,resumo,status,prioridade,created_at,ultima_movimentacao,data_conclusao,clientes(nome,whatsapp),profiles!demandas_responsavel_atual_id_fkey(nome),departamentos!demandas_departamento_atual_id_fkey(nome),tipos_demanda(nome)').order('created_at',{ascending:false});
  if (colId) q = q.eq('responsavel_atual_id', colId);
  if (status) q = q.eq('status', status);
  if (dtIni) q = q.gte('created_at', dtIni+'T00:00:00');
  if (dtFim) q = q.lte('created_at', dtFim+'T23:59:59');
  const {data} = await q;
  if (!data?.length) { toast('Nenhuma demanda encontrada para os filtros selecionados','err'); return; }

  const titulo = `Relatório de Demandas — ${colNome}`;
  const periodo = dtIni && dtFim ? `Período: ${new Date(dtIni+'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dtFim+'T12:00:00').toLocaleDateString('pt-BR')}` : '';
  const hoje = new Date().toLocaleString('pt-BR');
  const statusLabel = {aberta:'Aberta',em_andamento:'Em andamento',aguardando_aceite:'Ag. aceite',aguardando_cliente:'Ag. cliente',aguardando_orgao:'Ag. órgão',aguardando_gestor:'Ag. gestor',aguardando_conclusao:'Ag. conclusão',concluida:'Concluída',cancelada:'Cancelada'};
  const statusCor = {aberta:'#0099E5',em_andamento:'#00C48C',aguardando_cliente:'#F59E0B',aguardando_orgao:'#8B5CF6',aguardando_conclusao:'#00C48C',concluida:'#888',cancelada:'#EF4444'};
  const prioCor = {baixa:'#888',normal:'#0099E5',alta:'#F59E0B',urgente:'#EF4444'};

  // Agrupar por colaborador se "Todos"
  const grupos = {};
  data.forEach(d => {
    const resp = d.profiles?.nome || 'Sem responsável';
    if (!grupos[resp]) grupos[resp] = [];
    grupos[resp].push(d);
  });

  let html = '';
  Object.entries(grupos).forEach(([resp, dems]) => {
    html += `
      <div style="margin-bottom:24px">
        ${Object.keys(grupos).length > 1 ? `<div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;color:#1B2A6B;border-bottom:2px solid #1B2A6B;padding-bottom:6px;margin-bottom:12px">👤 ${resp} — ${dems.length} demanda(s)</div>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#1B2A6B;color:#fff">
              <th style="padding:8px;text-align:left">Número</th>
              <th style="padding:8px;text-align:left">Cliente</th>
              <th style="padding:8px;text-align:left">Serviço</th>
              <th style="padding:8px;text-align:left">Status</th>
              <th style="padding:8px;text-align:left">Prioridade</th>
              <th style="padding:8px;text-align:left">Abertura</th>
              <th style="padding:8px;text-align:left">Últ. mov.</th>
            </tr>
          </thead>
          <tbody>
            ${dems.map((d,i) => `<tr style="background:${i%2===0?'#f7f9fc':'#fff'}">
              <td style="padding:7px 8px;font-weight:700;color:#1B2A6B">${d.numero}</td>
              <td style="padding:7px 8px">${d.clientes?.nome||'—'}</td>
              <td style="padding:7px 8px;color:#4a5578">${d.tipos_demanda?.nome||d.resumo}</td>
              <td style="padding:7px 8px"><span style="background:${statusCor[d.status]||'#888'}22;color:${statusCor[d.status]||'#888'};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${statusLabel[d.status]||d.status}</span></td>
              <td style="padding:7px 8px"><span style="color:${prioCor[d.prioridade]||'#888'};font-weight:600;font-size:11px">⚡ ${d.prioridade}</span></td>
              <td style="padding:7px 8px;color:#4a5578">${new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
              <td style="padding:7px 8px;color:#4a5578">${Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000)}d atrás</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:8px;font-size:11px;color:#888;text-align:right">
          Total: ${dems.filter(d=>d.status==='concluida').length} concluídas · ${dems.filter(d=>d.status!=='concluida'&&d.status!=='cancelada').length} em aberto
        </div>
      </div>`;
  });

  document.getElementById('impPreviewTitulo').textContent = `${titulo} — ${data.length} demandas`;
  document.getElementById('impPreviewConteudo').innerHTML = `
    <div style="padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:16px">
      <div style="font-family:Syne,sans-serif;font-weight:700;font-size:18px;color:var(--navy)">${titulo}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">${periodo} · Gerado em ${hoje}</div>
    </div>
    ${html}
    <div style="margin-top:16px;padding:10px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text3);text-align:center">
      Total de demandas: <strong>${data.length}</strong> · 
      Concluídas: <strong>${data.filter(d=>d.status==='concluida').length}</strong> · 
      Em aberto: <strong>${data.filter(d=>d.status!=='concluida'&&d.status!=='cancelada').length}</strong>
    </div>`;
  document.getElementById('impPreview').style.display = 'block';
  document.getElementById('impPreview').scrollIntoView({behavior:'smooth'});
}

function imprimirPDF() {
  const conteudo = document.getElementById('impPreviewConteudo');
  if (!conteudo || document.getElementById('impPreview').style.display==='none') {
    toast('Gere o preview primeiro','err'); return;
  }
  const colNome = document.getElementById('impColaborador');
  const nomeColaborador = colNome.options[colNome.selectedIndex]?.text || 'Todos';
  const dtIni = document.getElementById('impDtInicio').value;
  const dtFim = document.getElementById('impDtFim').value;
  const periodo = dtIni && dtFim ? `${new Date(dtIni+'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dtFim+'T12:00:00').toLocaleDateString('pt-BR')}` : new Date().toLocaleDateString('pt-BR');

  const janela = window.open('','_blank');
  janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>Focco — Relatório ${nomeColaborador}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
      @page{size:A4 landscape;margin:15mm}
      @media print{body{padding:0}.no-print{display:none}}
      .header{border-bottom:3px solid #1B2A6B;padding-bottom:12px;margin-bottom:16px;display:flex;align-items:flex-start;justify-content:space-between}
      .logo{font-size:22px;font-weight:900;color:#1B2A6B;letter-spacing:-0.5px}
      .logo span{color:#0099E5}
      h2{font-size:14px;color:#1B2A6B;margin-bottom:2px}
      .meta{font-size:11px;color:#666}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
      th{background:#1B2A6B;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
      td{padding:5px 8px;border-bottom:1px solid #eee}
      tr:nth-child(even) td{background:#f7f9fc}
      .footer{border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#888;text-align:center;margin-top:16px}
      .grupo-titulo{font-weight:700;font-size:13px;color:#1B2A6B;border-bottom:2px solid #1B2A6B;padding-bottom:4px;margin:16px 0 8px}
      .btn-print{background:#1B2A6B;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:16px}
    </style>
  </head><body>
    <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
    <div class="header">
      <div>
        <div class="logo">Focco <span>Contabilidade</span></div>
        <div class="meta">Patrocínio — MG · foccocontabilidade.com.br</div>
      </div>
      <div style="text-align:right">
        <h2>Relatório de Demandas</h2>
        <div class="meta">Colaborador: <strong>${nomeColaborador}</strong></div>
        <div class="meta">Período: ${periodo}</div>
        <div class="meta">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
      </div>
    </div>
    ${conteudo.innerHTML}
    <div class="footer">
      Focco Contabilidade e Assessoria Empresarial · Patrocínio — MG · Sistema Operacional v1.0
    </div>
  </body></html>`);
  janela.document.close();
  setTimeout(() => janela.print(), 800);
}


// ══════════════════════════════════════════
// ABAS DE DEMANDAS
// ══════════════════════════════════════════
let abaAtual = 'aberta';

function trocarAba(aba) {
  abaAtual = aba;
  // Resetar fStatus para não conflitar com a aba
  const fSt = document.getElementById('fStatus');
  if(fSt) fSt.value = '';
  // Estilo das abas
  ['aberta','aprovacao','encerrada'].forEach(a=>{
    const cap = a.charAt(0).toUpperCase()+a.slice(1);
    const btn = document.getElementById('aba'+cap);
    const cnt = document.getElementById('cnt'+cap);
    if(btn){
      btn.style.color         = a===aba?'var(--accent)':'var(--text3)';
      btn.style.borderBottom  = a===aba?'2px solid var(--accent)':'2px solid transparent';
      btn.style.fontWeight    = a===aba?'600':'500';
    }
    if(cnt) cnt.style.background = a===aba?'var(--accent)':'var(--text3)';
  });
  filtDem();
}
