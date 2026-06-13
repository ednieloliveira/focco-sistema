// ═══════════════════════════════════════════
// Utilitários + importação
// ═══════════════════════════════════════════

// salvarCli — versão completa com todos os campos
async function salvarCli() {
  const nome = document.getElementById('mcNome').value.trim();
  if(!nome){toast('Informe o nome do cliente','err');return;}
  const payload = {
    nome,
    tipo_pessoa:       document.getElementById('mcTP').value,
    tipo_cliente:      document.getElementById('mcTC')?.value || 'urbano',
    cpf_cnpj:          document.getElementById('mcDoc').value.replace(/\D/g,'').trim()||null,
    regime_tributario: document.getElementById('mcReg').value||null,
    whatsapp:          document.getElementById('mcWa').value.replace(/\D/g,'').trim()||null,
    telefone:          document.getElementById('mcTel')?.value.trim()||null,
    email:             document.getElementById('mcEmail').value.trim()||null,
    endereco:          document.getElementById('mcEnd')?.value.trim()||null,
    observacoes:       document.getElementById('mcObs').value.trim()||null,
    ativo:             true,
  };
  const id = document.getElementById('mcId').value;
  if(id) {
    const {error} = await sb.from('clientes').update(payload).eq('id',id);
    if(error){toast('Erro: '+error.message,'err');return;}
  } else {
    const {error} = await sb.from('clientes').insert(payload);
    if(error){
      toast('Erro: '+(error.message.includes('unique')?'CPF/CNPJ já cadastrado.':error.message),'err');
      return;
    }
  }
  toast(id?'Cliente "'+nome+'" atualizado!':'Cliente "'+nome+'" cadastrado!','ok');
  fm('mCli');
  await loadCli();
}

// Corrigir salvarCliRap para não usar crCliente
async function salvarCliRap() {
  const nome = document.getElementById('crNome').value.trim();
  if(!nome){toast('Informe o nome','err');return;}
  const {data,error} = await sb.from('clientes').insert({
    nome,
    tipo_pessoa: document.getElementById('crTipo').value,
    tipo_cliente: 'urbano',
    cpf_cnpj: document.getElementById('crDoc').value.trim()||null,
    whatsapp: document.getElementById('crWa').value.trim()||null,
    created_by: U.id
  }).select().single();
  if(error){toast('Erro: '+error.message,'err');return;}
  const sel = document.getElementById('ndCli'),opt = document.createElement('option');
  opt.value = data.id; opt.textContent = data.nome;
  sel.appendChild(opt); sel.value = data.id;
  toast(`"${data.nome}" cadastrado!`,'ok');
  fm('mCliRap');
}


// ══════════════════════════════════════════
// UTILITÁRIOS — IMPORTAÇÃO DOMÍNIO SISTEMAS
// ══════════════════════════════════════════
let impHistorico = JSON.parse(localStorage.getItem('focco_imp_hist')||'[]');
let dadosCliImportar = [];
let xmlDadosExportar = [];

function trocarUtab(aba) {
  ['clientes','fiscal','dp','contabil','xml','hist'].forEach(a => {
    const body = document.getElementById('utab-'+a+'-body');
    const btn = document.getElementById('utab-'+a);
    if (body) body.style.display = a===aba ? 'block' : 'none';
    if (btn) {
      btn.style.color = a===aba ? 'var(--sky)' : 'var(--text3)';
      btn.style.borderBottom = a===aba ? '2px solid var(--sky)' : '2px solid transparent';
    }
  });
  if (aba==='hist') renderImpHistorico();
}

function handleDropUtil(e, tipo) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (tipo==='cli') lerArquivoClientes(file);
  else if (tipo==='fiscal') lerArquivoFiscal(file);
  else if (tipo==='dp') lerArquivoDP(file);
  else if (tipo==='cont') lerArquivoCont(file);
  else if (tipo==='xml') lerArquivoXML(file);
}

// ─────────────────────────────────────────
// LEITURA DE CSV
// ─────────────────────────────────────────
function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return { headers:[], rows:[] };
  // Detectar separador
  const sep = linhas[0].includes(';') ? ';' : ',';
  const headers = linhas[0].split(sep).map(h => h.replace(/"/g,'').trim());
  const rows = linhas.slice(1).map(l => {
    const vals = l.split(sep).map(v => v.replace(/"/g,'').trim());
    const obj = {};
    headers.forEach((h,i) => obj[h] = vals[i]||'');
    return obj;
  });
  return { headers, rows };
}

// ─────────────────────────────────────────
// LEITURA DE EXCEL (sem biblioteca externa)
// ─────────────────────────────────────────
async function lerExcel(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Tentar ler como texto primeiro (CSV disfarçado de Excel)
        const texto = e.target.result;
        if (typeof texto === 'string') {
          resolve(parseCSV(texto));
          return;
        }
        resolve(null);
      } catch(err) { resolve(null); }
    };
    // Se for xlsx real, tentar como texto (versões antigas do Excel podem funcionar)
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      reader.readAsText(file, 'ISO-8859-1');
    }
  });
}

// ─────────────────────────────────────────
// MAPEAMENTO AUTOMÁTICO DE COLUNAS DO DOMÍNIO
// ─────────────────────────────────────────
const MAPA_DOMINIO_CLIENTES = {
  // Variações de nomes que o Domínio usa
  nome: ['nome','razao_social','razão social','nome/razão social','cliente','nome cliente','razao social','empresa'],
  cpf_cnpj: ['cpf','cnpj','cpf/cnpj','cpf_cnpj','documento','cgc','inscricao federal'],
  whatsapp: ['whatsapp','celular','telefone','fone','tel','telefone celular','cel'],
  email: ['email','e-mail','e mail','correio'],
  tipo_pessoa: ['tipo','tipo pessoa','tipo_pessoa','pf/pj','pessoa'],
  regime: ['regime','regime tributario','regime_tributario','enquadramento','tributacao'],
  codigo: ['codigo','código','cod','cod.','código cliente','id'],
};

function detectarColuna(headers, campo) {
  const sinonimos = MAPA_DOMINIO_CLIENTES[campo] || [];
  for (const h of headers) {
    const hn = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    for (const s of sinonimos) {
      const sn = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if (hn === sn || hn.includes(sn) || sn.includes(hn)) return h;
    }
  }
  return null;
}

// ─────────────────────────────────────────
// IMPORTAR CLIENTES
// ─────────────────────────────────────────
async function lerArquivoClientes(file) {
  if (!file) return;
  const el = document.getElementById('impCliStatus');
  el.innerHTML = '<span style="color:var(--sky)">⏳ Lendo arquivo...</span>';
  
  const resultado = await lerExcel(file);
  if (!resultado || !resultado.rows.length) {
    el.innerHTML = '<span style="color:var(--red)">❌ Não foi possível ler o arquivo. Verifique o formato.</span>';
    return;
  }

  const { headers, rows } = resultado;
  
  // Detectar colunas automaticamente
  const mapa = {
    nome: detectarColuna(headers, 'nome'),
    cpf_cnpj: detectarColuna(headers, 'cpf_cnpj'),
    whatsapp: detectarColuna(headers, 'whatsapp'),
    email: detectarColuna(headers, 'email'),
    tipo_pessoa: detectarColuna(headers, 'tipo_pessoa'),
    regime: detectarColuna(headers, 'regime'),
    codigo: detectarColuna(headers, 'codigo'),
  };

  // Mostrar mapeamento
  document.getElementById('impCliMapa').innerHTML = `
    <div style="margin-bottom:10px;font-size:13px;font-weight:600;color:var(--navy)">Colunas detectadas no arquivo:</div>
    ${Object.entries(mapa).map(([campo, coluna]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:12px;color:var(--text2);font-weight:500">${campo}</span>
        <span class="tag ${coluna?'tg':'tr'}" style="font-size:11px">${coluna || '❌ Não encontrada'}</span>
      </div>`).join('')}
    <div style="margin-top:12px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Coluna de nome (obrigatória):</div>
      <select class="fi" id="mapaColNome" style="margin-bottom:0">
        ${headers.map(h=>`<option value="${h}" ${h===mapa.nome?'selected':''}>${h}</option>`).join('')}
      </select>
    </div>
    <div style="margin-top:8px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Coluna CPF/CNPJ:</div>
      <select class="fi" id="mapaColDoc" style="margin-bottom:0">
        <option value="">Não importar</option>
        ${headers.map(h=>`<option value="${h}" ${h===mapa.cpf_cnpj?'selected':''}>${h}</option>`).join('')}
      </select>
    </div>
    <div style="margin-top:8px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Coluna WhatsApp/Telefone:</div>
      <select class="fi" id="mapaColWa" style="margin-bottom:0">
        <option value="">Não importar</option>
        ${headers.map(h=>`<option value="${h}" ${h===mapa.whatsapp?'selected':''}>${h}</option>`).join('')}
      </select>
    </div>
    <div style="margin-top:8px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Coluna Regime Tributário:</div>
      <select class="fi" id="mapaColReg" style="margin-bottom:0">
        <option value="">Não importar</option>
        ${headers.map(h=>`<option value="${h}" ${h===mapa.regime?'selected':''}>${h}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-p" style="width:100%;justify-content:center;margin-top:12px" onclick="previewClientesDominio()">👁️ Gerar Preview</button>
  `;

  // Salvar dados globais
  window._impCliRows = rows;
  window._impCliHeaders = headers;
  
  el.innerHTML = `<span style="color:var(--green)">✅ Arquivo lido! ${rows.length} registros encontrados. Ajuste o mapeamento e clique em "Gerar Preview".</span>`;
}

function previewClientesDominio() {
  const rows = window._impCliRows || [];
  if (!rows.length) { toast('Carregue um arquivo primeiro','err'); return; }
  
  const colNome = document.getElementById('mapaColNome')?.value;
  const colDoc = document.getElementById('mapaColDoc')?.value;
  const colWa = document.getElementById('mapaColWa')?.value;
  const colReg = document.getElementById('mapaColReg')?.value;

  if (!colNome) { toast('Selecione a coluna de nome','err'); return; }

  // Mapear regime tributário
  function mapReg(val) {
    if (!val) return null;
    const v = val.toLowerCase();
    if (v.includes('simples')||v.includes('sn')) return 'simples_nacional';
    if (v.includes('mei')) return 'mei';
    if (v.includes('presumido')) return 'lucro_presumido';
    if (v.includes('real')) return 'lucro_real';
    if (v.includes('isento')) return 'isento';
    return null;
  }

  dadosCliImportar = rows.filter(r => r[colNome]?.trim()).map(r => ({
    nome: r[colNome]?.trim(),
    cpf_cnpj: colDoc ? (r[colDoc]?.replace(/\D/g,'')||null) : null,
    whatsapp: colWa ? (r[colWa]?.replace(/\D/g,'')||null) : null,
    regime_tributario: colReg ? mapReg(r[colReg]) : null,
    tipo_pessoa: r[colNome]?.trim().length > 40 ? 'juridica' : 'juridica',
    tipo_cliente: 'urbano',
    created_by: U.id
  }));

  document.getElementById('impCliPreviewTit').textContent = `Preview — ${dadosCliImportar.length} clientes para importar`;
  document.getElementById('impCliPreview').innerHTML = `
    <div style="overflow-x:auto"><table>
      <thead><tr><th>#</th><th>Nome / Razão Social</th><th>CPF / CNPJ</th><th>WhatsApp</th><th>Regime</th></tr></thead>
      <tbody>${dadosCliImportar.slice(0,50).map((c,i)=>`<tr>
        <td style="color:var(--text3)">${i+1}</td>
        <td><strong>${c.nome}</strong></td>
        <td style="font-size:12px;color:var(--text3)">${c.cpf_cnpj||'—'}</td>
        <td style="font-size:12px;color:var(--text3)">${c.whatsapp||'—'}</td>
        <td><span class="tag ts" style="font-size:10px">${c.regime_tributario||'—'}</span></td>
      </tr>`).join('')}
      ${dadosCliImportar.length>50?`<tr><td colspan="5" style="text-align:center;color:var(--text3);font-size:12px">... e mais ${dadosCliImportar.length-50} registros</td></tr>`:''}
      </tbody>
    </table></div>`;
  document.getElementById('impCliPreviewCard').style.display = 'block';
  document.getElementById('impCliPreviewCard').scrollIntoView({behavior:'smooth'});
}

async function importarClientesDominio() {
  if (!dadosCliImportar.length) { toast('Gere o preview primeiro','err'); return; }
  const btn = document.getElementById('btnImportarCli');
  btn.disabled = true; btn.textContent = 'Importando...';
  
  let importados = 0, ignorados = 0, erros = 0;
  const LOTE = 50;
  
  for (let i = 0; i < dadosCliImportar.length; i += LOTE) {
    const lote = dadosCliImportar.slice(i, i+LOTE);
    const { error } = await sb.from('clientes').upsert(lote, {
      onConflict: 'cpf_cnpj',
      ignoreDuplicates: false
    });
    if (error) {
      // Inserir um por um para identificar duplicatas
      for (const cli of lote) {
        const { error: e2 } = await sb.from('clientes').insert(cli);
        if (e2) { if (e2.message.includes('unique')) ignorados++; else erros++; }
        else importados++;
      }
    } else importados += lote.length;
    
    btn.textContent = `Importando... ${Math.min(i+LOTE, dadosCliImportar.length)}/${dadosCliImportar.length}`;
  }
  
  // Registrar histórico
  impHistorico.push({
    data: new Date().toISOString(), tipo: 'Clientes', formato: 'CSV/Excel',
    total: dadosCliImportar.length, importados, ignorados, erros
  });
  localStorage.setItem('focco_imp_hist', JSON.stringify(impHistorico));
  
  btn.disabled = false; btn.textContent = '⬆️ Importar para o Sistema';
  toast(`✅ ${importados} clientes importados! ${ignorados} duplicatas ignoradas.`,'ok');
  dadosCliImportar = [];
  document.getElementById('impCliPreviewCard').style.display = 'none';
  await loadCli();
}

// ─────────────────────────────────────────
// IMPORTAR FISCAL
// ─────────────────────────────────────────
function atualizarInstrucoesFiscal() {
  const tipo = document.getElementById('impFiscalTipo').value;
  const hint = document.getElementById('impFiscalHint');
  const msgs = {
    apuracao: 'CSV ou Excel com apurações mensais',
    nfe: 'XML de NF-e emitidas pelo Domínio',
    sped: 'Arquivo TXT do SPED Fiscal (EFD)',
    pgdas: 'CSV exportado do PGDAS-D'
  };
  if (hint) hint.textContent = msgs[tipo]||'CSV, XML, TXT';
}

async function lerArquivoFiscal(file) {
  if (!file) return;
  const el = document.getElementById('impFiscalStatus');
  el.innerHTML = '<span style="color:var(--sky)">⏳ Analisando arquivo...</span>';
  const tipo = document.getElementById('impFiscalTipo').value;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const texto = e.target.result;
    let resultado = null;

    if (tipo === 'nfe' || file.name.endsWith('.xml')) {
      resultado = analisarXMLNFe(texto, 'nfe');
    } else if (tipo === 'sped' || (file.name.endsWith('.txt') && texto.startsWith('|0000|'))) {
      resultado = analisarSPED(texto, 'efd');
    } else {
      const parsed = parseCSV(texto);
      resultado = {
        tipo: 'apuracao', total: parsed.rows.length,
        resumo: `${parsed.rows.length} registros encontrados`,
        dados: parsed.rows.slice(0,20),
        headers: parsed.headers
      };
    }

    const elR = document.getElementById('impFiscalResultado');
    if (!resultado) { elR.innerHTML = '<div class="vazio">Formato não reconhecido.</div>'; return; }
    
    elR.innerHTML = `
      <div style="background:var(--green-pale);border-radius:8px;padding:12px;margin-bottom:14px">
        <div style="font-weight:700;color:#00956a;margin-bottom:4px">✅ Arquivo lido com sucesso</div>
        <div style="font-size:13px;color:#00956a">${resultado.resumo}</div>
      </div>
      ${resultado.dados ? `<div style="overflow-x:auto"><table>
        <thead><tr>${(resultado.headers||Object.keys(resultado.dados[0]||{})).slice(0,6).map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${resultado.dados.slice(0,10).map(r=>`<tr>${(resultado.headers||Object.keys(r)).slice(0,6).map(h=>`<td style="font-size:12px">${r[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>` : ''}
    `;
    
    el.innerHTML = `<span style="color:var(--green)">✅ Análise concluída!</span>`;
    
    impHistorico.push({ data: new Date().toISOString(), tipo: 'Fiscal ('+tipo+')', formato: file.name.split('.').pop().toUpperCase(), total: resultado.total||0, importados: 0, ignorados: 0, erros: 0 });
    localStorage.setItem('focco_imp_hist', JSON.stringify(impHistorico));
  };
  reader.readAsText(file, 'ISO-8859-1');
}

// ─────────────────────────────────────────
// LEITOR DE XML (NF-e, NFS-e, CT-e)
// ─────────────────────────────────────────
function analisarXMLNFe(texto, tipo) {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(texto, 'text/xml');
    
    // NF-e
    const nfes = xml.querySelectorAll('NFe, nfeProc');
    if (nfes.length > 0 || xml.querySelector('nNF')) {
      const nNF = xml.querySelector('nNF')?.textContent || '—';
      const dhEmi = xml.querySelector('dhEmi')?.textContent || '—';
      const cnpjEmit = xml.querySelector('emit CNPJ')?.textContent || '—';
      const xNomeEmit = xml.querySelector('emit xNome')?.textContent || '—';
      const cnpjDest = xml.querySelector('dest CNPJ,dest CPF')?.textContent || '—';
      const xNomeDest = xml.querySelector('dest xNome')?.textContent || '—';
      const vNF = xml.querySelector('vNF')?.textContent || '0';
      const nItens = xml.querySelectorAll('det').length;
      
      // Itens da NF-e
      const itens = [];
      xml.querySelectorAll('det').forEach(det => {
        itens.push({
          'Item': det.getAttribute('nItem')||'',
          'Descrição': det.querySelector('xProd')?.textContent||'',
          'NCM': det.querySelector('NCM')?.textContent||'',
          'CFOP': det.querySelector('CFOP')?.textContent||'',
          'Qtd': det.querySelector('qCom')?.textContent||'',
          'Vlr Unit': det.querySelector('vUnCom')?.textContent||'',
          'Vlr Total': det.querySelector('vProd')?.textContent||''
        });
      });
      
      return {
        tipo: 'nfe', total: 1,
        resumo: `NF-e Nº ${nNF} | Emitente: ${xNomeEmit} | Destinatário: ${xNomeDest} | Valor: R$ ${parseFloat(vNF).toLocaleString('pt-BR',{minimumFractionDigits:2})} | ${nItens} item(ns)`,
        headers: ['Item','Descrição','NCM','CFOP','Qtd','Vlr Unit','Vlr Total'],
        dados: itens
      };
    }
    return { tipo: 'xml_generico', total: 1, resumo: 'XML lido mas tipo não identificado como NF-e padrão.', dados: null };
  } catch(e) {
    return { tipo: 'erro', total: 0, resumo: 'Erro ao ler XML: '+e.message, dados: null };
  }
}

// ─────────────────────────────────────────
// LEITOR DE SPED (EFD, ECD, ECF, eSocial)
// ─────────────────────────────────────────
function analisarSPED(texto, tipo) {
  const linhas = texto.split(/\r?\n/).filter(l => l.startsWith('|'));
  const registros = {};
  const dados = [];
  
  linhas.forEach(linha => {
    const campos = linha.split('|').filter((_, i) => i > 0);
    const reg = campos[0];
    if (!registros[reg]) registros[reg] = 0;
    registros[reg]++;
  });

  // Extrair info do registro 0000
  const reg0000 = linhas.find(l => l.startsWith('|0000|'));
  const campos0000 = reg0000 ? reg0000.split('|') : [];
  
  Object.entries(registros).slice(0,20).forEach(([reg, qtd]) => {
    dados.push({ 'Registro': reg, 'Quantidade de linhas': qtd });
  });

  return {
    tipo: 'sped', total: linhas.length,
    resumo: `SPED com ${linhas.length} linhas · ${Object.keys(registros).length} tipos de registro · Período: ${campos0000[4]||'—'} a ${campos0000[5]||'—'} · CNPJ: ${campos0000[8]||'—'}`,
    headers: ['Registro','Quantidade de linhas'],
    dados
  };
}

// ─────────────────────────────────────────
// LEITOR XML GERAL
// ─────────────────────────────────────────
async function lerArquivoXML(file) {
  if (!file) return;
  const el = document.getElementById('impXMLStatus');
  el.innerHTML = '<span style="color:var(--sky)">⏳ Analisando arquivo...</span>';
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const texto = e.target.result;
    let resultado = null;
    
    if (file.name.endsWith('.xml')) {
      resultado = analisarXMLNFe(texto, 'auto');
    } else if (file.name.endsWith('.txt')) {
      resultado = analisarSPED(texto, 'auto');
    }
    
    if (!resultado) { el.innerHTML = '<span style="color:var(--red)">❌ Formato não reconhecido.</span>'; return; }
    
    xmlDadosExportar = resultado.dados || [];
    document.getElementById('xmlResultadoTit').textContent = `${resultado.tipo.toUpperCase()} — ${resultado.total} registros`;
    document.getElementById('xmlResultado').innerHTML = `
      <div style="background:var(--green-pale);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#00956a">
        ✅ ${resultado.resumo}
      </div>
      ${resultado.dados?.length ? `<div style="overflow-x:auto"><table>
        <thead><tr>${(resultado.headers||[]).map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${resultado.dados.map(r=>`<tr>${(resultado.headers||Object.keys(r)).map(h=>`<td style="font-size:12px">${r[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>` : ''}
    `;
    document.getElementById('xmlResultadoCard').style.display = 'block';
    el.innerHTML = '<span style="color:var(--green)">✅ Análise concluída!</span>';
    
    impHistorico.push({ data: new Date().toISOString(), tipo: resultado.tipo.toUpperCase(), formato: file.name.split('.').pop().toUpperCase(), total: resultado.total||0, importados:0, ignorados:0, erros:0 });
    localStorage.setItem('focco_imp_hist', JSON.stringify(impHistorico));
  };
  reader.readAsText(file, 'ISO-8859-1');
}

function exportarXMLResultado() {
  if (!xmlDadosExportar.length) { toast('Nenhum dado para exportar','err'); return; }
  const headers = Object.keys(xmlDadosExportar[0]);
  const rows = xmlDadosExportar.map(r => headers.map(h => r[h]||''));
  downloadCSV(headers, rows, `focco_xml_${new Date().toISOString().split('T')[0]}.csv`);
  toast('Exportado com sucesso!','ok');
}

// ─────────────────────────────────────────
// IMPORTAR DP
// ─────────────────────────────────────────
async function lerArquivoDP(file) {
  if (!file) return;
  const el = document.getElementById('impDPStatus');
  el.innerHTML = '<span style="color:var(--sky)">⏳ Lendo arquivo...</span>';
  const resultado = await lerExcel(file);
  if (!resultado?.rows.length) { el.innerHTML = '<span style="color:var(--red)">❌ Arquivo vazio ou formato inválido.</span>'; return; }
  const tipo = document.getElementById('impDPTipo').value;
  const { headers, rows } = resultado;
  document.getElementById('impDPResultado').innerHTML = `
    <div style="background:var(--green-pale);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#00956a">✅ ${rows.length} registros encontrados</div>
    <div style="overflow-x:auto"><table>
      <thead><tr>${headers.slice(0,6).map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.slice(0,10).map(r=>`<tr>${headers.slice(0,6).map(h=>`<td style="font-size:12px">${r[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div style="margin-top:12px;font-size:12px;color:var(--text3)">Exibindo primeiros 10 de ${rows.length} registros. Tipo: ${tipo}</div>
  `;
  el.innerHTML = `<span style="color:var(--green)">✅ ${rows.length} registros lidos!</span>`;
  impHistorico.push({ data:new Date().toISOString(), tipo:'DP ('+tipo+')', formato:file.name.split('.').pop().toUpperCase(), total:rows.length, importados:0, ignorados:0, erros:0 });
  localStorage.setItem('focco_imp_hist', JSON.stringify(impHistorico));
}

// ─────────────────────────────────────────
// IMPORTAR CONTÁBIL
// ─────────────────────────────────────────
async function lerArquivoCont(file) {
  if (!file) return;
  const el = document.getElementById('impContStatus');
  el.innerHTML = '<span style="color:var(--sky)">⏳ Lendo arquivo...</span>';
  const reader = new FileReader();
  reader.onload = (e) => {
    const texto = e.target.result;
    let resultado = null;
    if (file.name.endsWith('.txt') && texto.includes('|0000|')) {
      resultado = analisarSPED(texto, 'ecd');
    } else {
      const parsed = parseCSV(texto);
      resultado = { tipo:'contabil', total:parsed.rows.length, resumo:`${parsed.rows.length} lançamentos`, headers:parsed.headers, dados:parsed.rows.slice(0,10) };
    }
    document.getElementById('impContResultado').innerHTML = `
      <div style="background:var(--green-pale);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#00956a">✅ ${resultado.resumo}</div>
      ${resultado.dados?.length ? `<div style="overflow-x:auto"><table>
        <thead><tr>${(resultado.headers||[]).slice(0,6).map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${resultado.dados.map(r=>`<tr>${(resultado.headers||Object.keys(r)).slice(0,6).map(h=>`<td style="font-size:12px">${r[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>` : ''}
    `;
    el.innerHTML = '<span style="color:var(--green)">✅ Arquivo analisado!</span>';
    impHistorico.push({ data:new Date().toISOString(), tipo:'Contábil', formato:file.name.split('.').pop().toUpperCase(), total:resultado.total||0, importados:0, ignorados:0, erros:0 });
    localStorage.setItem('focco_imp_hist', JSON.stringify(impHistorico));
  };
  reader.readAsText(file, 'ISO-8859-1');
}

// ─────────────────────────────────────────
// HISTÓRICO DE IMPORTAÇÕES
// ─────────────────────────────────────────
function renderImpHistorico() {
  const el = document.getElementById('impHistorico');
  if (!impHistorico.length) { el.innerHTML = '<div class="vazio">Nenhuma importação realizada ainda.</div>'; return; }
  el.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Formato</th><th>Total</th><th>Importados</th><th>Ignorados</th><th>Erros</th></tr></thead>
    <tbody>${impHistorico.slice().reverse().map(h=>`<tr>
      <td>${new Date(h.data).toLocaleString('pt-BR')}</td>
      <td>${h.tipo}</td>
      <td><span class="tag ts" style="font-size:10px">${h.formato}</span></td>
      <td>${h.total}</td>
      <td><span style="color:var(--green);font-weight:600">${h.importados}</span></td>
      <td><span style="color:var(--amber);font-weight:600">${h.ignorados}</span></td>
      <td><span style="color:var(--red);font-weight:600">${h.erros}</span></td>
    </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function limparHistoricoImp() {
  if (!confirm('Limpar todo o histórico de importações?')) return;
  impHistorico = [];
  localStorage.setItem('focco_imp_hist', JSON.stringify(impHistorico));
  renderImpHistorico();
  toast('Histórico limpo!','ok');
}


// ══════════════════════════════════════════
// EXPORTAÇÃO EXCEL — FUNÇÃO UNIVERSAL
