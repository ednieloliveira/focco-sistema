// ═══════════════════════════════════════════
// Calendário fiscal + obrigações
// ═══════════════════════════════════════════

document.addEventListener('click', e => {
  const panel = document.getElementById('notifPanel');
  const sino = document.getElementById('sinoBell');
  if (notifAberto && panel && !panel.contains(e.target) && !sino.contains(e.target)) {
    panel.style.display = 'none';
    notifAberto = false;
  }
});

// Polling de notificações a cada 30 segundos
setInterval(() => { if (U) carregarNotificacoes(); }, 30000);

// ══════════════════════════════════════════
// CALENDÁRIO FISCAL
// ══════════════════════════════════════════
let calAno = new Date().getFullYear();
let calMes = new Date().getMonth(); // 0-11
let calDiaSel = null;
let obrigacoes = JSON.parse(localStorage.getItem('focco_obrigacoes') || '[]');

// Obrigações padrão do escritório contábil
// Sem obrigações pré-cadastradas — cadastre pelo botão + Nova Obrigação
const OBRIG_PADRAO = [];

// ── Feriados ──────────────────────────────────────────────────────────────────
const FERIADOS_NACIONAIS_FIXOS = [
  '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'
];

function getFeriadosAno(ano) {
  const fixos = new Set(FERIADOS_NACIONAIS_FIXOS.map(f => `${ano}-${f}`));
  const municipais = JSON.parse(localStorage.getItem('focco_feriados')||'[]');
  municipais.forEach(f => {
    if (f.ano === 0) {
      // recorrente — pega só MM-DD
      const mmdd = f.data.slice(5);
      fixos.add(`${ano}-${mmdd}`);
    } else {
      fixos.add(f.data);
    }
  });
  return fixos;
}

function calcDiaVencimento(ano, mes, diaBase, regra) {
  const maxDia = new Date(ano, mes+1, 0).getDate();
  let dia = Math.min(diaBase, maxDia);
  const feriados = getFeriadosAno(ano);

  if (regra === 'postergar') {
    while (!isDiaUtil(ano, mes, dia, feriados)) {
      dia++;
      if (dia > maxDia) { dia = 1; mes++; if (mes > 11) { mes = 0; ano++; } }
    }
    return dia;
  }
  if (regra === 'antecipar') {
    while (!isDiaUtil(ano, mes, dia, feriados)) {
      dia--;
      if (dia < 1) { mes--; if (mes < 0) { mes = 11; ano--; } dia = new Date(ano, mes+1, 0).getDate(); }
    }
    return dia;
  }
  if (regra === 'ultimo_util') {
    dia = new Date(ano, mes+1, 0).getDate();
    while (!isDiaUtil(ano, mes, dia, feriados)) dia--;
    return dia;
  }
  if (regra === 'dias_uteis') {
    let count = 0, d = 1;
    while (count < diaBase && d <= maxDia) {
      if (isDiaUtil(ano, mes, d, feriados)) count++;
      if (count < diaBase) d++;
    }
    return Math.min(d, maxDia);
  }
  return dia; // fixo
}

function getObrigacoesMes(ano, mes) {
  // Combina padrões + cadastradas pelo usuário
  const custom = JSON.parse(localStorage.getItem('focco_obrigacoes')||'[]');
  // Remover padrões que foram substituídos por versão customizada (mesmo id)
  const customIds = new Set(custom.map(o=>o.id));
  const padrao = OBRIG_PADRAO.filter(o=>!customIds.has(o.id));
  const todasObrig = [...padrao, ...custom];

  const resultado = [];
  todasObrig.forEach(ob => {
    let incluir = false;
    const recorr = ob.recorr || ob.recorrencia || 'mensal';

    if (recorr === 'mensal') {
      incluir = true;
    } else if (recorr === 'trimestral') {
      incluir = [0,3,6,9].includes(mes);
    } else if (recorr === 'anual') {
      // suporte ob.mes (1-based antigo) e ob.mes_base (0-based novo)
      const mesOb = ob.mes_base !== undefined ? ob.mes_base : (ob.mes !== undefined ? ob.mes-1 : -1);
      incluir = mesOb === mes;
    } else if (recorr === 'meses_especificos') {
      const meses = (ob.meses||'').split(',').map(Number);
      incluir = meses.includes(mes);
    } else if (recorr === 'unica') {
      const d = new Date(ob.venc+'T12:00:00');
      incluir = d.getFullYear() === ano && d.getMonth() === mes;
    }

    if (!incluir) return;

    const regra = ob.regra || 'fixo';
    const diaBase = parseInt(ob.dia) || 1;
    const diaReal = calcDiaVencimento(ano, mes, diaBase, regra);

    const venc = new Date(ano, mes, diaReal);
    resultado.push({
      ...ob,
      dia: diaReal,
      diaBase,
      regra,
      vencData: venc
    });
  });

  return resultado.sort((a, b) => a.dia - b.dia);
}


// ── Abre modal de nova obrigação a partir do calendário ──────────────────────
function abrirNovaObrigacaoCal(id) {
  const mObrigTit = document.getElementById('mObrigTit');
  if(mObrigTit) mObrigTit.textContent = id ? '✏️ Editar Obrigação' : '📋 Nova Obrigação';
  ['obId','obNome','obSigla','obObs'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  const obDia=document.getElementById('obDia'); if(obDia) obDia.value='';
  const obCor=document.getElementById('obCor'); if(obCor) obCor.value='#0099E5';
  const obRegra=document.getElementById('obRegra'); if(obRegra) obRegra.value='postergar';
  const obTipo=document.getElementById('obTipo'); if(obTipo) obTipo.value='federal';
  const obRec=document.getElementById('obRecorrencia'); if(obRec) obRec.value='mensal';
  const fgMes=document.getElementById('fgMesBase'); if(fgMes) fgMes.style.display='none';
  const fgEsp=document.getElementById('fgMesesEsp'); if(fgEsp) fgEsp.style.display='none';

  if(id) {
    const custom = JSON.parse(localStorage.getItem('focco_obrigacoes')||'[]');
    const ob = [...OBRIG_PADRAO,...custom].find(o=>o.id===id);
    if(ob){
      document.getElementById('obId').value=ob.id;
      document.getElementById('obNome').value=ob.nome||'';
      document.getElementById('obSigla').value=ob.sigla||ob.nome?.slice(0,6)||'';
      document.getElementById('obDia').value=ob.dia||ob.diaBase||'';
      document.getElementById('obCor').value=ob.cor||'#0099E5';
      if(obRegra) obRegra.value=ob.regra||'fixo';
      if(obTipo) obTipo.value=ob.tipo||'federal';
      const rec=ob.recorr||ob.recorrencia||'mensal';
      if(obRec) obRec.value=rec;
      if(rec==='anual'&&fgMes) fgMes.style.display='';
      if(rec==='meses_especificos'&&fgEsp) fgEsp.style.display='';
    }
  }
  om('mObrigacao');
}
function renderListaFeriados2(){
  const el=document.getElementById('ferLista');
  if(!el) return;
  const lista=JSON.parse(localStorage.getItem('focco_feriados')||'[]');
  el.innerHTML=lista.length?lista.map(f=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${f.nome}</div>
        <div style="font-size:11px;color:var(--text3)">${new Date(f.data+'T12:00:00').toLocaleDateString('pt-BR')}${f.ano===0?' · Recorrente todo ano':''}</div>
      </div>
      <button onclick="excluirFeriado('${f.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:18px;line-height:1">×</button>
    </div>`).join('')
  :'<div style="padding:14px;font-size:12px;color:var(--text3);text-align:center">Nenhum feriado municipal cadastrado.</div>';
}

// Sobrescrever salvarObrigacao para usar localStorage focco_obrigacoes
const _salvarObrigacaoOrig = salvarObrigacao;


// ═══════════════════════════════════════════════════════════════
// IMPORTAÇÃO DE OBRIGAÇÕES E FERIADOS — Excel/CSV
// ═══════════════════════════════════════════════════════════════

// ── Template de Obrigações ────────────────────────────────────────────────────
function baixarTemplateObrigacoes() {
  if(typeof XLSX==='undefined'){toast('Aguarde o sistema carregar...','err');return;}
  const wb = XLSX.utils.book_new();
  const cabecalho = [['nome','sigla','dia_base','regra','tipo','recorrencia','mes_anual','obs']];
  const exemplos = [
    ['DAS — Simples Nacional','DAS','20','postergar','federal','mensal','','Apenas empresas do Simples'],
    ['FGTS','FGTS','7','postergar','trabalhista','mensal','',''],
    ['GPS — INSS Empregador','GPS','20','antecipar','federal','mensal','',''],
    ['IRRF — Retido na Fonte','IRRF','20','antecipar','federal','mensal','',''],
    ['PIS/COFINS','PIS/COF','25','antecipar','federal','mensal','','Lucro Real'],
    ['ISS Municipal','ISS','15','fixo','municipal','mensal','',''],
    ['DCTF','DCTF','15','fixo','federal','mensal','',''],
    ['eSocial — Folha','eSocial','7','postergar','trabalhista','mensal','',''],
    ['ICMS — MG','ICMS','20','fixo','estadual','mensal','',''],
    ['IRPJ/CSLL — Trim.','IRPJ','ultimo_util','ultimo_util','federal','trimestral','','Mar/Jun/Set/Dez'],
    ['ECF — Anual','ECF','31','postergar','federal','anual','7','Julho'],
    ['DIRF — Anual','DIRF','28','postergar','federal','anual','2','Fevereiro'],
    ['IRPF — Anual','IRPF','30','postergar','federal','anual','4','Abril'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...cabecalho,...exemplos]);
  ws['!cols']=[{wch:35},{wch:10},{wch:10},{wch:14},{wch:14},{wch:14},{wch:10},{wch:35}];

  // Aba de instruções
  const inst = XLSX.utils.aoa_to_sheet([
    ['INSTRUÇÕES — Obrigações Tributárias'],[''],
    ['CAMPO','VALORES ACEITOS'],
    ['nome','Nome completo da obrigação'],
    ['sigla','Abreviação (ex: DAS, FGTS, IRRF)'],
    ['dia_base','Número do dia (1 a 31)'],
    ['regra','fixo | postergar | antecipar | dias_uteis | ultimo_util'],
    ['','  fixo = data exata sem ajuste'],
    ['','  postergar = se não útil, avança para próximo dia útil (ex: DAS)'],
    ['','  antecipar = se não útil, volta para dia útil anterior (ex: IRRF, INSS)'],
    ['','  dias_uteis = conta apenas dias úteis a partir do dia 1'],
    ['','  ultimo_util = último dia útil do mês'],
    ['tipo','federal | estadual | municipal | trabalhista | contabil'],
    ['recorrencia','mensal | trimestral | anual | meses_especificos'],
    ['mes_anual','Para recorrência ANUAL: número do mês (1=Jan, 2=Fev ... 12=Dez)'],
    ['obs','Observação livre'],
  ]);
  inst['!cols']=[{wch:16},{wch:60}];
  XLSX.utils.book_append_sheet(wb,ws,'Obrigações');
  XLSX.utils.book_append_sheet(wb,inst,'Instruções');
  XLSX.writeFile(wb,'Focco_Template_Obrigacoes.xlsx');
  toast('Template baixado!','ok');
}

// ── Importar Obrigações ───────────────────────────────────────────────────────
function importarObrigacoes(input) {
  const file=input.files[0]; if(!file) return; input.value='';
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){toast('Planilha vazia.','err');return;}

      const regrasValidas=['fixo','postergar','antecipar','dias_uteis','ultimo_util'];
      const tiposValidos=['federal','estadual','municipal','trabalhista','contabil'];
      const recorrValidas=['mensal','trimestral','anual','meses_especificos','unica'];
      const cores={'federal':'#0099E5','estadual':'#EF4444','municipal':'#F59E0B','trabalhista':'#8B5CF6','contabil':'#00C48C'};

      let importados=0, erros=[];
      const lista=JSON.parse(localStorage.getItem('focco_obrigacoes')||'[]');
      const existingNomes=new Set(lista.map(o=>o.nome.toLowerCase()));

      rows.forEach((r,i)=>{
        const nome=String(r.nome||r.Nome||r.NOME||'').trim();
        const dia=parseInt(r.dia_base||r.dia||r.DIA||0);
        if(!nome){erros.push('Linha '+(i+2)+': nome vazio');return;}
        if(!dia||dia<1||dia>31){erros.push('Linha '+(i+2)+': dia inválido ('+dia+')');return;}
        if(existingNomes.has(nome.toLowerCase())){return;} // ignora duplicatas
        const regra=String(r.regra||'fixo').toLowerCase().trim();
        const tipo=String(r.tipo||'federal').toLowerCase().trim();
        const recorr=String(r.recorrencia||r.recorr||'mensal').toLowerCase().trim();
        const mesAnual=parseInt(r.mes_anual||r.mes||0)||0;
        const nova={
          id:'u'+Date.now()+Math.random().toString(36).slice(2,6),
          nome,
          sigla:String(r.sigla||r.SIGLA||nome.slice(0,6)).toUpperCase().trim(),
          dia, diaBase:dia,
          regra:regrasValidas.includes(regra)?regra:'fixo',
          tipo:tiposValidos.includes(tipo)?tipo:'federal',
          recorr:recorrValidas.includes(recorr)?recorr:'mensal',
          recorrencia:recorrValidas.includes(recorr)?recorr:'mensal',
          mes_base:mesAnual>0?mesAnual-1:0,
          mes:mesAnual,
          abrang:'todos',
          obs:String(r.obs||r.OBS||'').trim(),
          cor:cores[tipo]||'#0099E5',
          ativo:true,
          created_at:new Date().toISOString()
        };
        lista.push(nova);
        existingNomes.add(nome.toLowerCase());
        importados++;
      });

      lista.sort((a,b)=>a.dia-b.dia);
      localStorage.setItem('focco_obrigacoes',JSON.stringify(lista));
      obrigacoes=lista;
      renderCalendario();
      let msg='✅ '+importados+' obrigação(ões) importada(s).';
      if(erros.length) msg+=' ⚠️ '+erros.length+' ignorada(s).';
      toast(msg,'ok');
    }catch(e){toast('Erro ao ler arquivo: '+e.message,'err');}
  };
  reader.readAsArrayBuffer(file);
}

// ── Template de Feriados ──────────────────────────────────────────────────────
function baixarTemplateFeriados() {
  if(typeof XLSX==='undefined'){toast('Aguarde...','err');return;}
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([
    [['data','nome','recorrente']],
    ['2026-06-29','São Pedro e São Paulo','não'],
    ['2026-08-15','Assunção de Nossa Senhora','não'],
    ['2026-09-08','Aniversário de Patrocínio','sim'],
    ['2026-11-20','Consciência Negra','não'],
  ]);
  // Instrução na mesma aba
  ws['A1']={v:'data',t:'s'}; ws['B1']={v:'nome',t:'s'}; ws['C1']={v:'recorrente',t:'s'};
  ws['!cols']=[{wch:14},{wch:36},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,'Feriados');
  const inst=XLSX.utils.aoa_to_sheet([
    ['INSTRUÇÕES — Feriados'],[''],
    ['data','Data no formato AAAA-MM-DD  (ex: 2026-09-08)'],
    ['nome','Nome do feriado'],
    ['recorrente','"sim" = repete todo ano nesta data  |  "não" = apenas neste ano'],
    [''],
    ['Feriados Nacionais já incluídos automaticamente:'],
    ['01/01','Ano Novo'],['21/04','Tiradentes'],['01/05','Dia do Trabalho'],
    ['07/09','Independência'],['12/10','N. Sra. Aparecida'],['02/11','Finados'],
    ['15/11','Proclamação da República'],['20/11','Consciência Negra'],['25/12','Natal'],
  ]);
  inst['!cols']=[{wch:14},{wch:50}];
  XLSX.utils.book_append_sheet(wb,inst,'Instruções');
  XLSX.writeFile(wb,'Focco_Template_Feriados.xlsx');
  toast('Template de feriados baixado!','ok');
}

// ── Importar Feriados ─────────────────────────────────────────────────────────
function importarFeriados(input) {
  const file=input.files[0]; if(!file) return; input.value='';
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){toast('Planilha vazia.','err');return;}
      const lista=JSON.parse(localStorage.getItem('focco_feriados')||'[]');
      const existentes=new Set(lista.map(f=>f.data));
      let importados=0;
      rows.forEach(r=>{
        const data=String(r.data||r.DATA||r.Data||'').trim();
        const nome=String(r.nome||r.NOME||r.Nome||'').trim();
        if(!data||!nome||existentes.has(data)) return;
        const recorr=String(r.recorrente||r.RECORRENTE||'não').toLowerCase().trim();
        const ano=recorr==='sim'||recorr==='s'||recorr==='true'?0:new Date(data+'T12:00:00').getFullYear();
        lista.push({id:'f'+Date.now()+Math.random().toString(36).slice(2,5),data,nome,ano});
        existentes.add(data);
        importados++;
      });
      lista.sort((a,b)=>a.data.localeCompare(b.data));
      localStorage.setItem('focco_feriados',JSON.stringify(lista));
      renderListaFeriados2();
      renderCalendario();
      toast('✅ '+importados+' feriado(s) importado(s).','ok');
    }catch(e){toast('Erro: '+e.message,'err');}
  };
  reader.readAsArrayBuffer(file);
}

// ── Limpar todos os feriados municipais ───────────────────────────────────────
function limparFeriados(){
  if(!confirm('Apagar todos os feriados municipais cadastrados?')) return;
  localStorage.removeItem('focco_feriados');
  renderListaFeriados2();
  renderCalendario();
  toast('Feriados removidos.','ok');
}

// ── Limpar todas as obrigações customizadas ───────────────────────────────────
function limparObrigacoes(){
  if(!confirm('Apagar todas as obrigações cadastradas? O calendário ficará vazio.')) return;
  localStorage.removeItem('focco_obrigacoes');
  obrigacoes=[];
  renderCalendario();
  toast('Obrigações removidas.','ok');
}


function mesAnterior() { calMes--; if (calMes < 0) { calMes = 11; calAno--; } renderCalendario(); }
function mesProximo()  { calMes++; if (calMes > 11) { calMes = 0; calAno++; } renderCalendario(); }
function mesAtual()    { calAno = new Date().getFullYear(); calMes = new Date().getMonth(); renderCalendario(); }

function renderCalendario() {
  const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('calMesAno').textContent = `${nomesMes[calMes]} de ${calAno}`;

  const obrig = getObrigacoesMes(calAno, calMes);
  const hoje = new Date();
  const hj = hoje.toISOString().split('T')[0];

  // KPIs
  const vencidos = obrig.filter(o => o.vencData < hoje && o.vencData.toDateString() !== hoje.toDateString());
  const venceHoje = obrig.filter(o => o.vencData.toDateString() === hoje.toDateString());
  const fim7d = new Date(hoje); fim7d.setDate(fim7d.getDate()+7);
  const semana = obrig.filter(o => o.vencData > hoje && o.vencData <= fim7d);
  const concl = (JSON.parse(localStorage.getItem('focco_obrig_concl')||'[]')).filter(c => c.startsWith(`${calAno}-${calMes}-`));
  document.getElementById('calVencidos').textContent = vencidos.length;
  document.getElementById('calHoje').textContent = venceHoje.length;
  document.getElementById('calSemana').textContent = semana.length;
  document.getElementById('calConcluidos').textContent = concl.length;

  // Grade do calendário
  const primeiroDia = new Date(calAno, calMes, 1).getDay();
  const ultimoDia = new Date(calAno, calMes+1, 0).getDate();
  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  let grade = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:8px">
    ${diasSemana.map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:4px">${d}</div>`).join('')}
  </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;

  // Células vazias antes do primeiro dia
  for (let i = 0; i < primeiroDia; i++) {
    grade += `<div style="padding:4px;min-height:40px"></div>`;
  }

  // Carregar feriados do mês para marcar no grid
  const feriadosAno = getFeriadosAno(calAno);

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataStr = `${calAno}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const obrigDia = obrig.filter(o => o.dia === dia);
    const isHoje = dataStr === hj;
    const isSel = calDiaSel === dia;
    const passado = new Date(calAno, calMes, dia) < hoje && !isHoje;
    const temVenc = obrigDia.length > 0;
    const isFeriado = feriadosAno.has(dataStr);
    const dow = new Date(calAno, calMes, dia).getDay();
    const isFimSem = dow === 0 || dow === 6;

    // Cor de fundo
    let bgColor = 'transparent';
    if(isSel) bgColor = 'var(--sky)';
    else if(isHoje) bgColor = 'var(--navy)';
    else if(isFeriado) bgColor = '#FEF3C7'; // amarelo claro
    else if(isFimSem) bgColor = '#F8F9FA';  // cinza muito leve

    let bgHover = isSel?'var(--sky)':isHoje?'var(--navy)':'var(--sky-pale)';
    let borderColor = temVenc&&!isSel?'var(--amber)':isFeriado&&!isSel?'#FCD34D':'transparent';
    let textColor = isSel||isHoje?'#fff':isFimSem?'var(--text3)':passado?'var(--text3)':'var(--text)';

    // Tooltip com nome do feriado
    const feriadoNome = isFeriado ? (() => {
      const municipais = JSON.parse(localStorage.getItem('focco_feriados')||'[]');
      const nac = {'01-01':'Ano Novo','04-21':'Tiradentes','05-01':'Dia do Trabalho',
        '09-07':'Independência','10-12':'N.Sra.Aparecida','11-02':'Finados',
        '11-15':'Proclamação da República','11-20':'Consciência Negra','12-25':'Natal'};
      const mmdd = dataStr.slice(5);
      if(nac[mmdd]) return nac[mmdd];
      const mun = municipais.find(f=>f.data===dataStr||(f.ano===0&&f.data.slice(5)===mmdd));
      return mun?.nome||'Feriado';
    })() : '';

    grade += `<div onclick="selecionarDia(${dia})" title="${isFeriado?'🗓️ '+feriadoNome:''}" style="
      padding:4px;min-height:48px;border-radius:6px;cursor:pointer;
      background:${bgColor};
      border:1px solid ${borderColor};
      transition:all .15s;position:relative
    " onmouseover="this.style.background='${bgHover}'" onmouseout="this.style.background='${bgColor}'">
      <div style="font-size:12px;font-weight:${isHoje||isSel?700:temVenc?600:400};color:${textColor};text-align:center;line-height:1.2">
        ${dia}${isFeriado&&!isHoje?'<div style="font-size:7px;color:#D97706;font-weight:700;line-height:1;margin-top:1px">FER</div>':''}
      </div>
      ${obrigDia.slice(0,2).map(o=>`<div style="font-size:9px;background:${isSel?'rgba(255,255,255,.3)':o.cor||'var(--sky)'};color:#fff;border-radius:3px;padding:1px 3px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.sigla||o.nome.slice(0,8)}</div>`).join('')}
      ${obrigDia.length>2?`<div style="font-size:9px;color:${isSel?'#fff':'var(--text3)'};text-align:center">+${obrigDia.length-2}</div>`:''}
    </div>`;
  }
  grade += '</div>';
  document.getElementById('calGrade').innerHTML = grade;
  renderCalObrig();
}

function selecionarDia(dia) {
  calDiaSel = dia;
  renderCalendario();

  const dt = new Date(calAno, calMes, dia);
  const diaSemana = dt.toLocaleDateString('pt-BR',{weekday:'long'});
  const dataStr = `${calAno}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

  document.getElementById('calDiaTitulo').textContent =
    `${dia}/${String(calMes+1).padStart(2,'0')} — ${diaSemana.charAt(0).toUpperCase()+diaSemana.slice(1)}`;

  let html = '';
  let temAlgo = false;

  // ── 1. FERIADO ──────────────────────────────────────────────────────────────
  const nomeFer = getNomeFeriado(calAno, calMes, dia);
  if(nomeFer) {
    temAlgo = true;
    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#FEF9C3;border-radius:8px;border:1px solid #FCD34D;margin-bottom:6px">
      <span style="font-size:22px;flex-shrink:0">🗓️</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#92400E">${nomeFer}</div>
        <div style="font-size:11px;color:#D97706;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Feriado</div>
      </div>
    </div>`;
  }

  // ── 2. OBRIGAÇÕES FISCAIS ────────────────────────────────────────────────────
  const obrig = getObrigacoesMes(calAno, calMes).filter(o => o.dia === dia);
  const concl = JSON.parse(localStorage.getItem('focco_obrig_concl')||'[]');
  if(obrig.length) {
    temAlgo = true;
    html += `<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 4px">📋 Obrigações Fiscais</div>`;
    html += obrig.map(o => {
      const key = `${calAno}-${calMes}-${o.id}`;
      const ok = concl.includes(key);
      const REGRA = {fixo:'Fixo',postergar:'Posterga',antecipar:'Antecipa',dias_uteis:'Dias Úteis',ultimo_util:'Último Útil'};
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);margin-bottom:4px;background:${ok?'var(--surface2)':'var(--surface)'}">
        <div style="width:10px;height:10px;border-radius:50%;background:${o.cor||'var(--sky)'};flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;${ok?'text-decoration:line-through;color:var(--text3)':''}">${o.nome}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            ${o.tipo} ${o.regra&&o.regra!=='fixo'?'· '+REGRA[o.regra]:''}
            ${o.abrang&&o.abrang!=='todos'?'· '+o.abrang:''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;background:var(--surface2);color:var(--text3)">${o.sigla||''}</span>
          <button onclick="toggleObrigConcl('${key}')" style="background:${ok?'var(--green-pale)':'var(--surface)'};border:1px solid ${ok?'#6ee7b7':'var(--border)'};border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;color:${ok?'#00956a':'var(--text2)'}">
            ${ok?'✅ Feito':'Concluir'}
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // ── 3. COMPROMISSOS ──────────────────────────────────────────────────────────
  const todosComp = JSON.parse(localStorage.getItem('focco_compromissos')||'[]');
  const compsNoDia = todosComp.filter(c => {
    const cd = new Date(c.data+'T12:00:00');
    return cd.getFullYear()===calAno && cd.getMonth()===calMes && cd.getDate()===dia && c.usuario_id===U?.id;
  }).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));

  if(compsNoDia.length) {
    temAlgo = true;
    const tipoIcon = {reuniao:'🤝',prazo:'⏰',visita:'🏢',ligacao:'📞',treinamento:'📚',interno:'📋',outro:'📌'};
    html += `<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 4px">📅 Compromissos</div>`;
    html += compsNoDia.map(c => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);margin-bottom:4px;background:var(--surface)">
        <span style="font-size:20px;flex-shrink:0">${tipoIcon[c.tipo]||'📌'}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${c.titulo}</div>
          ${c.hora?`<div style="font-size:12px;color:var(--accent);font-weight:600">🕐 ${c.hora}</div>`:''}
          ${c.participantes?`<div style="font-size:11px;color:var(--text3)">👤 ${c.participantes}</div>`:''}
          ${c.descricao?`<div style="font-size:11px;color:var(--text3)">${c.descricao}</div>`:''}
        </div>
        <button onclick="excluirCompCal('${c.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:0 2px" title="Excluir">×</button>
      </div>`).join('');
  }

  // ── 4. Botão adicionar compromisso ───────────────────────────────────────────
  html += `<div style="margin-top:8px">
    <button onclick="abrirCompCal(${dia})" class="btn btn-s" style="width:100%;justify-content:center;font-size:12px">
      + Adicionar compromisso neste dia
    </button>
  </div>`;

  if(!temAlgo) {
    html = `<div class="vazio" style="padding:16px">Nenhum evento neste dia.</div>
    <div style="margin-top:8px">
      <button onclick="abrirCompCal(${dia})" class="btn btn-s" style="width:100%;justify-content:center;font-size:12px">
        + Adicionar compromisso
      </button>
    </div>`;
  }

  document.getElementById('calDiaObrig').innerHTML = html;
}

// Abrir compromisso com dia pré-preenchido no calendário fiscal
function abrirCompCal(dia) {
  const data = `${calAno}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  document.getElementById('compData').value = data;
  document.getElementById('compHora').value = '09:00';
  document.getElementById('compTitulo').value = '';
  document.getElementById('compPart').value = '';
  document.getElementById('compDesc').value = '';
  document.getElementById('compTipo').value = 'reuniao';
  om('mCompromisso');
  // Após salvar, atualizar o dia no calendário fiscal
  window._compCalDia = dia;
}

// Excluir compromisso e atualizar painel
function excluirCompCal(id) {
  if(!confirm('Excluir este compromisso?')) return;
  let comps = JSON.parse(localStorage.getItem('focco_compromissos')||'[]');
  comps = comps.filter(c=>c.id!==id);
  localStorage.setItem('focco_compromissos', JSON.stringify(comps));
  selecionarDia(calDiaSel);
  renderCalendario();
  toast('Compromisso excluído.','ok');
}

function toggleObrigConcl(key) {
  let concl = JSON.parse(localStorage.getItem('focco_obrig_concl')||'[]');
  if (concl.includes(key)) concl = concl.filter(k=>k!==key);
  else concl.push(key);
  localStorage.setItem('focco_obrig_concl', JSON.stringify(concl));
  renderCalendario();
  if (calDiaSel) selecionarDia(calDiaSel);
}

function renderCalObrig() {
  const tipo = document.getElementById('calFiltroTipo')?.value || '';
  const obrig = getObrigacoesMes(calAno, calMes).filter(o => !tipo || o.tipo === tipo);
  const concl = JSON.parse(localStorage.getItem('focco_obrig_concl')||'[]');
  const hoje = new Date();
  const totalDias = new Date(calAno, calMes+1, 0).getDate();
  const el = document.getElementById('calListaCompleta');
  if (!el) return;

  // Montar feriados do mês para exibir na lista
  const feriados = [];
  if(!tipo) { // só mostra feriados se não há filtro de tipo
    for(let d=1; d<=totalDias; d++) {
      const n = getNomeFeriado(calAno, calMes, d);
      if(n) feriados.push({dia:d, nome:n});
    }
  }

  // Combinar obrigações + feriados ordenados por dia
  const ferIdSet = new Set();
  const itens = [];
  feriados.forEach(f => { itens.push({...f, _feriado:true}); ferIdSet.add(f.dia); });
  obrig.forEach(o => itens.push({...o, _feriado:false}));
  itens.sort((a,b) => a.dia===b.dia ? (a._feriado?-1:1) : a.dia-b.dia);

  if(!itens.length) { el.innerHTML='<div class="vazio">Nenhuma obrigação encontrada.</div>'; return; }

  el.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Regra / Abrangência</th><th>Status</th><th></th></tr></thead>
    <tbody>${itens.map(o => {
      if(o._feriado) {
        const dt2 = new Date(calAno, calMes, o.dia);
        const passou = dt2 < hoje && dt2.toDateString()!==hoje.toDateString();
        return `<tr style="background:#FFFBEB">
          <td><strong style="color:#D97706">${String(o.dia).padStart(2,'0')}/${String(calMes+1).padStart(2,'0')}</strong><div style="font-size:10px;color:var(--text3)">${dt2.toLocaleDateString('pt-BR',{weekday:'short'})}</div></td>
          <td><span style="font-size:14px">🗓️</span> <strong style="color:#92400E">${o.nome}</strong></td>
          <td><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF3C7;color:#D97706">feriado</span></td>
          <td style="font-size:12px;color:var(--text3)">—</td>
          <td>${passou?'<span class="tag ta">Passou</span>':'<span class="tag tgr">—</span>'}</td>
          <td></td>
        </tr>`;
      }
      const key = `${calAno}-${calMes}-${o.id}`;
      const ok = concl.includes(key);
      const venc = new Date(calAno, calMes, o.dia);
      const atrasado = venc < hoje && venc.toDateString() !== hoje.toDateString() && !ok;
      return `<tr>
        <td><strong style="color:${atrasado?'var(--red)':'var(--navy)'}">${String(o.dia).padStart(2,'0')}/${String(calMes+1).padStart(2,'0')}</strong><div style="font-size:10px;color:var(--text3)">${venc.toLocaleDateString('pt-BR',{weekday:'short'})}</div></td>
        <td style="${ok?'text-decoration:line-through;color:var(--text3)':''}">${o.nome}</td>
        <td><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${o.tipo==='federal'?'var(--sky-pale)':o.tipo==='trabalhista'?'var(--purple-pale)':o.tipo==='municipal'?'var(--amber-pale)':o.tipo==='estadual'?'var(--red-pale)':'var(--green-pale)'};color:${o.tipo==='federal'?'var(--sky)':o.tipo==='trabalhista'?'var(--purple)':o.tipo==='municipal'?'#d97706':o.tipo==='estadual'?'var(--red)':'#00956a'}">${o.tipo}</span></td>
        <td style="font-size:12px;color:var(--text3)">${o.abrang||'todos'}</td>
        <td>${ok?'<span class="tag tg">✅ Concluído</span>':atrasado?'<span class="tag tr">⚠️ Atrasado</span>':'<span class="tag ts">Pendente</span>'}</td>
        <td><button onclick="toggleObrigConcl('${key}')" style="background:none;border:none;cursor:pointer;font-size:18px">${ok?'↩':'✓'}</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function abrirModalObrigacao() {
  document.getElementById('obNome').value = '';
  document.getElementById('obObs').value = '';
  const hoje = new Date();
  document.getElementById('obVenc').value = `${calAno}-${String(calMes+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  om('mObrig');
}

// ══════════════════════════════════════════
// CHECKLIST AUTOMÁTICO POR TIPO DE DEMANDA
// ══════════════════════════════════════════
const CHECKLISTS = {
  'ABE': ['Verificar viabilidade de nome', 'Redigir Contrato Social', 'Coletar assinaturas dos sócios', 'Registrar na Junta Comercial', 'Emitir CNPJ na Receita Federal', 'Inscrição Municipal (Alvará)', 'Inscrição Estadual (se necessário)', 'Enquadramento tributário', 'Entregar documentos ao cliente'],
  'MEI': ['Verificar atividade permitida para MEI', 'Acessar Portal do Empreendedor', 'Realizar cadastro MEI', 'Emitir CCMEI', 'Orientar sobre obrigações mensais', 'Entregar documentos ao cliente'],
  'ALS': ['Coletar dados do novo sócio', 'Redigir Alteração Contratual', 'Conferir dados com Contrato atual', 'Coletar assinaturas', 'Registrar na Junta Comercial', 'Atualizar no CNPJ / Receita Federal', 'Atualizar inscrições estaduais/municipais'],
  'ALE': ['Verificar novo endereço', 'Redigir alteração de endereço', 'Registrar na Junta Comercial', 'Atualizar CNPJ', 'Atualizar Alvará Municipal', 'Atualizar Inscrição Estadual'],
  'ALR': ['Verificar regime atual', 'Analisar melhor opção tributária', 'Elaborar planilha comparativa', 'Solicitar mudança de regime', 'Comunicar ao cliente'],
  'RSC': ['Coletar data de demissão', 'Calcular verbas rescisórias', 'Homologar rescisão', 'Gerar guias de pagamento', 'Dar baixa no eSocial (S-2299)', 'Entregar TRCT assinado'],
  'ADM': ['Coletar documentos do funcionário', 'Verificar exame admissional', 'Cadastrar no eSocial (S-2200)', 'Registrar na CTPS', 'Gerar ficha de registro', 'Entregar documentação ao empregado'],
  'FOL': ['Coletar informações do mês', 'Lançar horas extras e faltas', 'Calcular folha de pagamento', 'Gerar holerites', 'Gerar DARF IRRF', 'Gerar GPS INSS', 'Enviar para aprovação'],
  'DAS': ['Acessar PGDAS-D', 'Verificar faturamento do período', 'Apurar DAS', 'Gerar boleto', 'Enviar ao cliente'],
  'ICM': ['Coletar livros fiscais', 'Apurar ICMS do período', 'Gerar GIA/GIA-ST', 'Gerar DARE', 'Enviar ao cliente'],
  'IRF': ['Coletar documentos do cliente', 'Verificar rendimentos', 'Lançar deduções', 'Simular imposto', 'Transmitir declaração', 'Guardar recibo de entrega'],
  'IRP': ['Coletar documentos de atividade rural', 'Levantar receitas e despesas rurais', 'Calcular resultado da atividade rural', 'Integrar com IRPF geral', 'Transmitir declaração'],
  'ECD': ['Coletar lançamentos contábeis', 'Conciliar contas bancárias', 'Fechar balancete', 'Gerar arquivo ECD', 'Validar no PVA', 'Transmitir ao SPED'],
  'ECF': ['Levantar ECF do período', 'Preencher partes do ECF', 'Calcular IRPJ/CSLL', 'Validar no PVA', 'Transmitir ao SPED'],
  'BPA': ['Conciliação bancária completa', 'Lançamentos finais', 'Fechar balanço patrimonial', 'Elaborar DRE', 'Revisar com contador', 'Assinar e arquivar'],
  'ITR': ['Coletar dados do imóvel rural', 'Verificar área aproveitável', 'Calcular VTN', 'Preencher DITR', 'Transmitir declaração', 'Gerar DARF ITR'],
  'CCR': ['Coletar matrícula do imóvel', 'Acessar sistema INCRA', 'Verificar dados cadastrais', 'Atualizar informações', 'Emitir taxa', 'Emitir CCIR', 'Entregar ao cliente'],
  'CPR': ['Coletar documentos pessoais', 'Coletar documentos da propriedade', 'Preencher requerimento', 'Protocolar na SEFAZ', 'Acompanhar processamento', 'Retirar cartão', 'Entregar ao cliente'],
  'ARR': ['Qualificar as partes', 'Descrever a área rural', 'Definir prazo do arrendamento', 'Definir valor e condições', 'Redigir contrato', 'Coletar assinaturas', 'Reconhecer firma em cartório', 'Arquivar cópia'],
};

async function abrirChecklist(demandaId, numero) {
  document.getElementById('mChecklistTit').textContent = `Checklist — ${numero}`;
  document.getElementById('mChecklistBody').innerHTML = '<div class="loading">Carregando...</div>';
  om('mChecklist');
  
  // Buscar tipo da demanda
  const {data:dem} = await sb.from('demandas').select('tipos_demanda(prefixo_numeracao,nome)').eq('id', demandaId).single();
  const pref = dem?.tipos_demanda?.prefixo_numeracao;
  const nomeTipo = dem?.tipos_demanda?.nome || '';
  const itens = CHECKLISTS[pref] || [];
  
  // Carregar checklist salvo
  const key = `focco_cl_${demandaId}`;
  let concl = JSON.parse(localStorage.getItem(key)||'[]');
  
  if (!itens.length) {
    document.getElementById('mChecklistBody').innerHTML = `<div class="vazio">Checklist não definido para ${nomeTipo}.<br>O prefixo "${pref}" não tem checklist padrão.</div>`;
    return;
  }
  
  const pct = Math.round(concl.length / itens.length * 100);
  document.getElementById('mChecklistBody').innerHTML = `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;color:var(--text2)">Progresso</span>
        <span style="font-size:13px;font-weight:700;color:${pct===100?'var(--green)':'var(--navy)'}">${concl.length}/${itens.length} — ${pct}%</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${pct===100?'var(--green)':'var(--sky)'};height:8px;width:${pct}%;border-radius:4px;transition:width .3s"></div>
      </div>
    </div>
    ${itens.map((item, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <input type="checkbox" id="cl_${i}" ${concl.includes(i)?'checked':''} onchange="toggleCheckItem('${demandaId}',${i},${itens.length})" style="width:16px;height:16px;accent-color:var(--sky);cursor:pointer;flex-shrink:0">
        <label for="cl_${i}" style="font-size:13px;cursor:pointer;${concl.includes(i)?'text-decoration:line-through;color:var(--text3)':''};flex:1">${item}</label>
        ${concl.includes(i)?'<span style="color:var(--green);font-size:14px">✓</span>':''}
      </div>
    `).join('')}
    ${pct===100?'<div style="background:var(--green-pale);border-radius:8px;padding:12px;text-align:center;margin-top:12px"><span style="font-size:20px">🎉</span><div style="font-weight:600;color:#00956a;margin-top:4px">Checklist 100% concluído!</div></div>':''}
  `;
}

function toggleCheckItem(demandaId, idx, total) {
  const key = `focco_cl_${demandaId}`;
  let concl = JSON.parse(localStorage.getItem(key)||'[]');
  if (concl.includes(idx)) concl = concl.filter(i=>i!==idx);
  else concl.push(idx);
  localStorage.setItem(key, JSON.stringify(concl));
  // Atualizar visual sem recarregar tudo
  const pct = Math.round(concl.length/total*100);
  const label = document.querySelector(`label[for="cl_${idx}"]`);
  if (label) label.style.textDecoration = concl.includes(idx)?'line-through':'none';
}

