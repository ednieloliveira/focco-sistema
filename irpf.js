// ═══════════════════════════════════════════
// IRPF + sidebar
// ═══════════════════════════════════════════

// ══════════════════════════════════════════
async function loadIRPF() {
  const prefIRPF = ['IRF','IRP','CRL','IRR','MFI','CSF','GCI','GCA','GCH','PLF','OTF'];
  const [decl, malha, gcap] = await Promise.all([
    getDemByPrefixos(['IRF','IRP','CRL','IRR']),
    getDemByPrefixos(['MFI']),
    getDemByPrefixos(['GCI','GCA','GCH'])
  ]);
  const all = [...decl,...malha,...gcap,...await getDemByPrefixos(['CSF','PLF','OTF'])];
  document.getElementById('irpfk1').textContent = all.filter(d=>d.prioridade==='urgente').length;
  document.getElementById('irpfk2').textContent = all.length;
  document.getElementById('irpfk3').textContent = malha.length;
  const im = new Date(); im.setDate(1);
  const {count:conc} = await sb.from('demandas').select('*',{count:'exact',head:true})
    .in('departamento_atual_id', deps.filter(d=>d.nome==='IRPF').map(d=>d.id))
    .eq('status','concluida').gte('data_conclusao',im.toISOString());
  document.getElementById('irpfk4').textContent = conc||0;
  renderDemMini(decl, 'irpfDecl');
  renderDemMini(malha, 'irpfMalha');
  renderDemMini(all, 'irpfTabela');
}

async function exportarExcelIRPF() {
  const prefixos = ['IRF','IRP','CRL','IRR','MFI','CSF','GCI','GCA','GCH','PLF','OTF'];
  const {data} = await sb.from('demandas').select('numero,resumo,status,prioridade,created_at,ultima_movimentacao,clientes(nome),profiles!demandas_responsavel_atual_id_fkey(nome),tipos_demanda(nome)').not('status','in','(concluida,cancelada)').order('created_at',{ascending:false});
  const lista = (data||[]).filter(d => prefixos.some(p => d.numero?.startsWith(p+'-')));
  if (!lista.length) { toast('Nenhuma demanda IRPF','err'); return; }
  const SLoc={aberta:'Aberta',em_andamento:'Em andamento',aguardando_cliente:'Ag. cliente',aguardando_conclusao:'Ag. conclusão',concluida:'Concluída'};
  exportarExcel(lista.map(d=>({'Número':d.numero,'Cliente':d.clientes?.nome||'','Tipo':d.tipos_demanda?.nome||d.resumo,'Status':SLoc[d.status]||d.status,'Prioridade':d.prioridade,'Responsável':d.profiles?.nome||'','Aberta em':new Date(d.created_at).toLocaleDateString('pt-BR'),'Dias inat.':Math.floor((Date.now()-new Date(d.ultima_movimentacao))/86400000)})), 'focco_irpf', 'IRPF');
}

function toggleSidebar(){
  const sb=document.querySelector('.sidebar');
  const ov=document.getElementById('sbOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('on');
}
function _closeSidebarMobile(){
  if(window.innerWidth<=900){
    const sb=document.querySelector('.sidebar');
    const ov=document.getElementById('sbOverlay');
    if(sb&&sb.classList.contains('open')){sb.classList.remove('open');}
    if(ov&&ov.classList.contains('on')){ov.classList.remove('on');}
  }
}

// ═══════════════════════════════════════════════════════════════
// CALENDÁRIO TRIBUTÁRIO DO DASHBOARD
// Baseado na Agenda Tributária da Receita Federal
// ═══════════════════════════════════════════════════════════════
let dashCalAno = new Date().getFullYear();
let dashCalMesAtual = new Date().getMonth();

// ═══════════════════════════════════════════════════════════════
// CALENDÁRIO TRIBUTÁRIO DINÂMICO — v2
// Obrigações cadastradas pelo usuário com cálculo inteligente
// ═══════════════════════════════════════════════════════════════

// Feriados Nacionais fixos (MM-DD)
const FERIADOS_NACIONAIS = [
  '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'
];

