// ═══════════════════════════════════════════
// Autenticação + initDB
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// SUPABASE — Cliente Real (substitui o shim localStorage)
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://nambhrizjnhebqgfztux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbWJocml6am5oZWJxZ2Z6dHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDUzMDIsImV4cCI6MjA5NjkyMTMwMn0.AeBCJetQQugrpDAaOPrEYgHor9irmosN8EWogCtPzSo';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// sb = wrapper que usa Supabase mas mantém _auth e _rpc locais
// (autenticação continua local — sem Supabase Auth — para não quebrar o fluxo atual)
const sb = {
  from: (t) => _sb.from(t),
  auth: _auth,
  storage: _sb.storage,
  rpc: (fn, p) => {
    // Primeiro tenta RPC local (fn_criar_usuario, fn_redefinir_senha)
    if (_rpc[fn]) return Promise.resolve().then(() => _rpc[fn](p));
    // Depois tenta RPC remota no Supabase (fn_proximo_numero_demanda, etc.)
    return _sb.rpc(fn, p);
  }
};
async function resetarSistema(){
  if(!confirm('Isso vai limpar todos os dados locais e recriar o sistema do zero.\nDados no Google Sheets são preservados.\n\nContinuar?')) return;
  localStorage.clear();
  location.reload();
}

async function initDB(){
  // Se já tem profiles com senha configurada, não recria
  const existingProfiles = dbGet('profiles');
  if(existingProfiles.length>0 && existingProfiles[0].senha_hash) return;
  localStorage.removeItem('focco_auth');
  const adminHash=await hashPass('Edniel');
  const now=new Date().toISOString();
  const hash123=await hashPass('123456');
  dbSet('profiles',[
    {id:uuid(),email:'ednieloliveira@hotmail.com', usuario:'Gerente',     nome:'Edniel Oliveira',              perfil:'gestor',      senha_hash:adminHash,ativo:true,primeiro_acesso:false,created_at:now},
    {id:uuid(),email:'daniel@focco.local',          usuario:'Daniel',      nome:'Daniel Sebastião de Oliveira', perfil:'gestor',      senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'kamila@focco.local',          usuario:'Kamila',      nome:'Kamila Montadon Ladeira',      perfil:'gestor',      senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'juninho@focco.local',         usuario:'Juninho',     nome:'Humberto Raimundo de Souza Junior', perfil:'colaborador',senha_hash:hash123,ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'marialuiza@focco.local',      usuario:'Maria Luiza', nome:'Maria Luiza Melo dos Anjos',   perfil:'colaborador', senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'thiago@focco.local',          usuario:'Thiago',      nome:'Thiago Henrique Diniz',        perfil:'colaborador', senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'carol@focco.local',           usuario:'Carol',       nome:'Anna Caroline Ferreira',       perfil:'colaborador', senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'jozi@focco.local',            usuario:'Jozi',        nome:'Joziana Rosa',                 perfil:'colaborador', senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'luciana@focco.local',         usuario:'Luciana',     nome:'Luciana de Fatima Moreira',    perfil:'colaborador', senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
    {id:uuid(),email:'daniela@focco.local',         usuario:'Daniela',     nome:'Daniela Vieira Borges',        perfil:'colaborador', senha_hash:hash123,  ativo:true,primeiro_acesso:true, created_at:now},
  ]);
  const mkDep=(nome,cor,icone)=>({id:uuid(),nome,cor,icone:icone||'📋',ativo:true,ordem:0,created_at:now});
  const depts=[
    mkDep('Escrita Fiscal',          '#2563EB','💰'),
    mkDep('Departamento Pessoal',    '#7C3AED','👷'),
    mkDep('Contabilidade',           '#059669','📒'),
    mkDep('Rural',                   '#D97706','🌾'),
    mkDep('Legalização e Societário','#1D4ED8','🏢'),
    mkDep('Abertura de Empresas',    '#0891B2','🏗️'),
    mkDep('Despachante Imobiliário', '#0F9B6E','🏠'),
    mkDep('IRPF',                    '#DC2626','🧾'),
    mkDep('Parcelamentos e Regularização Fiscal','#9333EA','📑'),
    mkDep('Prefeitura e Alvarás',    '#EA580C','🏛️'),
    mkDep('Certidões e Documentações','#64748B','📜'),
    mkDep('Atendimento ao Cliente',  '#0EA5E9','🤝'),
  ];
  dbSet('departamentos',depts);
  const dMap={};depts.forEach(x=>dMap[x.nome]=x.id);
  const cats=[],tipos=[];
  const cat=(nome,dep)=>{const c={id:uuid(),nome,departamento_id:dMap[dep],ativo:true,ordem:0,created_at:now};cats.push(c);return c.id;};
  const tip=(nome,pref,catId)=>tipos.push({id:uuid(),nome,prefixo_numeracao:pref,categoria_id:catId,prioridade_padrao:'normal',ativo:true,ordem:0,created_at:now});

  // ── 1. ESCRITA FISCAL ────────────────────────────────────────────────────
  const efOb=cat('Obrigações Fiscais','Escrita Fiscal');
  tip('Apuração Simples Nacional','DAS',efOb);tip('Apuração ICMS','ICM',efOb);
  tip('Apuração ISS','ISS',efOb);tip('Apuração PIS','PIS',efOb);
  tip('Apuração COFINS','COF',efOb);tip('Apuração ICMS ST','CST',efOb);
  tip('Apuração DIFAL','DIF',efOb);tip('Conferência de Impostos','CFI',efOb);
  tip('Revisão Tributária','RVT',efOb);tip('Geração de Guias','GGU',efOb);
  tip('Retificação de Apurações','RTA',efOb);tip('Encerramento Fiscal Mensal','EFM',efOb);

  const efDoc=cat('Documentos Fiscais','Escrita Fiscal');
  tip('Emissão NF-e','NFE',efDoc);tip('Emissão NFC-e','NFC',efDoc);
  tip('Emissão NFS-e','NFS',efDoc);tip('Emissão CT-e','CTE',efDoc);
  tip('Cancelamento NF','CNF',efDoc);tip('Carta de Correção','CCE',efDoc);
  tip('Inutilização Numeração','INU',efDoc);tip('Correção XML','CXL',efDoc);
  tip('Manifestação Destinatário','MDE',efDoc);tip('Consulta Chaves NF','CNV',efDoc);

  const efFis=cat('Fiscalizações','Escrita Fiscal');
  tip('Atendimento Intimação Receita','AIR',efFis);tip('Atendimento Intimação Estadual','AIE',efFis);
  tip('Atendimento Intimação Municipal','AIM',efFis);tip('Defesa Administrativa','DEF',efFis);
  tip('Levantamento Documentos','LVD',efFis);tip('Auditoria Fiscal','ADF',efFis);
  tip('Regularização Pendências','RGP',efFis);tip('Resposta Fiscalização','RSF',efFis);

  // ── 2. DEPARTAMENTO PESSOAL ──────────────────────────────────────────────
  const dpAdm=cat('Admissão','Departamento Pessoal');
  tip('Cadastro Funcionário','CAF',dpAdm);tip('Registro eSocial','RES',dpAdm);
  tip('Contrato Trabalho','CTB',dpAdm);tip('Exame Admissional','EXA',dpAdm);
  tip('Cadastro Benefícios','CBN',dpAdm);tip('Inclusão Relógio Ponto','IRP',dpAdm);
  tip('Ficha Registro','FRG',dpAdm);

  const dpFol=cat('Folha de Pagamento','Departamento Pessoal');
  tip('Fechamento Folha','FOL',dpFol);tip('Recibo Pagamento','RPG',dpFol);
  tip('Pró-labore','PLB',dpFol);tip('Adiantamento Salarial','ADS',dpFol);
  tip('Desconto Faltas','DFL',dpFol);tip('Banco de Horas','BNH',dpFol);
  tip('Horas Extras','HEX',dpFol);tip('Adicional Noturno','ANT',dpFol);tip('DSR','DSR',dpFol);

  const dpFer=cat('Férias','Departamento Pessoal');
  tip('Programação Férias','PFR',dpFer);tip('Aviso Férias','AVF',dpFer);
  tip('Recibo Férias','RFR',dpFer);tip('Férias Coletivas','FRC',dpFer);tip('Venda de Férias','VDF',dpFer);

  const dpRsc=cat('Rescisão','Departamento Pessoal');
  tip('Pedido Demissão','PDM',dpRsc);tip('Dispensa Sem Justa Causa','DSJ',dpRsc);
  tip('Dispensa Com Justa Causa','DCJ',dpRsc);tip('Cálculo Rescisório','CRC',dpRsc);
  tip('Homologação','HMG',dpRsc);tip('FGTS Rescisório','FGR',dpRsc);

  // ── 3. CONTABILIDADE ─────────────────────────────────────────────────────
  const ctEsc=cat('Escrituração','Contabilidade');
  tip('Lançamento Contábil','LCT',ctEsc);tip('Classificação Contábil','CCT',ctEsc);
  tip('Importação Movimentos','IMV',ctEsc);tip('Conciliação Bancária','CBK',ctEsc);
  tip('Conciliação Cartão','CCR',ctEsc);tip('Conciliação Empréstimos','CEP',ctEsc);

  const ctDem=cat('Demonstrações','Contabilidade');
  tip('Balancete','BLC',ctDem);tip('Balanço Patrimonial','BLP',ctDem);
  tip('DRE','DRE',ctDem);tip('DMPL','DMP',ctDem);
  tip('Fluxo Caixa','FXC',ctDem);tip('Relatórios Gerenciais','RGC',ctDem);

  const ctObr=cat('Obrigações','Contabilidade');
  tip('ECD','ECD',ctObr);tip('ECF','ECF',ctObr);tip('IBGE','IBG',ctObr);
  tip('BACEN','BCN',ctObr);tip('Revisão Contábil','RVC',ctObr);tip('Fechamento Anual','FCA',ctObr);

  // ── 4. RURAL ─────────────────────────────────────────────────────────────
  const rlPr=cat('Produtor Rural','Rural');
  tip('Cadastro Produtor','CDP',rlPr);tip('Talão Produtor','TAP',rlPr);
  tip('Nota Fiscal Produtor','NFP',rlPr);tip('CAFIR','CAF',rlPr);tip('Atualização Dados','ATD',rlPr);

  const rlItr=cat('ITR','Rural');
  tip('Declaração ITR','ITR',rlItr);tip('Revisão ITR','RIT',rlItr);
  tip('Impugnação ITR','IGT',rlItr);tip('Cálculo ITR','CLT',rlItr);tip('Emissão DARF','DRF',rlItr);

  const rlIm=cat('Imóveis Rurais','Rural');
  tip('CCIR','CCR',rlIm);tip('CAR','CAR',rlIm);tip('ADA','ADA',rlIm);
  tip('Georreferenciamento','GRF',rlIm);tip('Certidões Rurais','CTR',rlIm);

  const rlGt=cat('Gestão Rural','Rural');
  tip('Livro Caixa Rural','LCR',rlGt);tip('Controle Café','CCF',rlGt);
  tip('Controle Gado','CGD',rlGt);tip('Controle Leite','CLT',rlGt);
  tip('Controle Grãos','CGR',rlGt);tip('Resultado Rural','RSR',rlGt);

  // ── 5. LEGALIZAÇÃO E SOCIETÁRIO ──────────────────────────────────────────
  const lgAlt=cat('Alterações','Legalização e Societário');
  tip('Alteração Endereço','ALE',lgAlt);tip('Alteração Capital','ALC',lgAlt);
  tip('Alteração CNAE','ALN',lgAlt);tip('Entrada Sócio','ENS',lgAlt);
  tip('Saída Sócio','SAS',lgAlt);tip('Transformação Empresarial','TRE',lgAlt);

  const lgEnc=cat('Encerramento','Legalização e Societário');
  tip('Baixa CNPJ','BCN',lgEnc);tip('Distrato Social','DIS',lgEnc);
  tip('Encerramento Municipal','EMP',lgEnc);tip('Encerramento Estadual','EES',lgEnc);

  const lgLic=cat('Licenças','Legalização e Societário');
  tip('Bombeiros','BMB',lgLic);tip('Vigilância Sanitária','VGS',lgLic);
  tip('Meio Ambiente','MAB',lgLic);tip('Licença Funcionamento','LFC',lgLic);

  // ── 6. ABERTURA DE EMPRESAS ──────────────────────────────────────────────
  const abPlan=cat('Planejamento','Abertura de Empresas');
  tip('Escolha CNAE','ECN',abPlan);tip('Escolha Regime','ERG',abPlan);tip('Viabilidade','VIA',abPlan);

  const abReg=cat('Registro','Abertura de Empresas');
  tip('Abertura CNPJ','ABE',abReg);tip('Inscrição Estadual','INE',abReg);
  tip('Inscrição Municipal','INM',abReg);tip('Alvará','ALV',abReg);

  const abPos=cat('Pós-Abertura','Abertura de Empresas');
  tip('Certificado Digital','CDG',abPos);tip('Procuração eCAC','PEC',abPos);
  tip('Enquadramento Simples','EQS',abPos);tip('Cadastro Bancário','CBK',abPos);

  // ── 7. DESPACHANTE IMOBILIÁRIO ───────────────────────────────────────────
  const imCV=cat('Compra e Venda','Despachante Imobiliário');
  tip('Contrato Compra Venda','CCV',imCV);tip('Escritura','ESC',imCV);
  tip('Registro Cartório','RCT',imCV);tip('Transferência Imóvel','TIM',imCV);

  const imRg=cat('Regularização','Despachante Imobiliário');
  tip('Averbação Construção','AVC',imRg);tip('Retificação Área','RTA',imRg);
  tip('Unificação Lotes','UNL',imRg);tip('Desmembramento','DES',imRg);tip('Usucapião','USC',imRg);

  const imCt=cat('Cartórios','Despachante Imobiliário');
  tip('Matrícula Atualizada','MAT',imCt);tip('Certidão Ônus Reais','COR',imCt);
  tip('Certidão Inteiro Teor','CIT',imCt);tip('Certidão Negativa','CNI',imCt);

  const imFin=cat('Financiamentos','Despachante Imobiliário');
  tip('Alienação Fiduciária','ALF',imFin);tip('Liberação Garantia','LBG',imFin);
  tip('Baixa Gravame','BGV',imFin);tip('Quitação Financiamento','QFN',imFin);

  // ── 8. IRPF ───────────────────────────────────────────────────────────────
  const irDec=cat('Declaração','IRPF');
  tip('IRPF Nova','IRP',irDec);tip('IRPF Retificadora','IRR',irDec);
  tip('Declaração Espólio','ESP',irDec);tip('Declaração Saída Definitiva','ISD',irDec);

  const irMal=cat('Malha Fina','IRPF');
  tip('Consulta Malha','CMH',irMal);tip('Correção Declaração','CDL',irMal);
  tip('Defesa Receita','DFR',irMal);tip('Levantamento Documentos','LVD',irMal);

  const irGc=cat('Ganho Capital','IRPF');
  tip('Venda Imóvel','GCI',irGc);tip('Venda Veículo','GCV',irGc);
  tip('Venda Participação','GCP',irGc);tip('Apuração GCAP','GCA',irGc);

  // ── 9. PARCELAMENTOS E REGULARIZAÇÃO FISCAL ───────────────────────────────
  const prRF=cat('Receita Federal','Parcelamentos e Regularização Fiscal');
  tip('Parcelamento Ordinário','PAO',prRF);tip('Reparcelamento','REP',prRF);tip('Negociação Débitos','NGD',prRF);

  const prPG=cat('PGFN','Parcelamentos e Regularização Fiscal');
  tip('Transação Tributária','TRT',prPG);tip('Dívida Ativa','DVA',prPG);tip('Regularizar CNPJ','RCJ',prPG);

  const prCert=cat('Certidões','Parcelamentos e Regularização Fiscal');
  tip('CND Federal','CND',prCert);tip('CPEN','CPN',prCert);tip('Regularização Pendências','RPN',prCert);

  // ── 10. PREFEITURA E ALVARÁS ──────────────────────────────────────────────
  const pfPref=cat('Prefeitura','Prefeitura e Alvarás');
  tip('Inscrição Municipal','INM',pfPref);tip('Atualização Cadastro','ATC',pfPref);tip('Baixa Municipal','BXM',pfPref);

  const pfAlv=cat('Alvarás','Prefeitura e Alvarás');
  tip('Funcionamento','ALF',pfAlv);tip('Publicidade','ALP',pfAlv);
  tip('Eventos','AEV',pfAlv);tip('Vigilância Sanitária','AVS',pfAlv);

  const pfISS=cat('ISS','Prefeitura e Alvarás');
  tip('Cadastro ISS','CIS',pfISS);tip('Declaração ISS','DIS',pfISS);tip('Regularização ISS','RIS',pfISS);

  // ── 11. CERTIDÕES E DOCUMENTAÇÕES ────────────────────────────────────────
  const cdCert=cat('Certidões','Certidões e Documentações');
  tip('Receita Federal','CRF',cdCert);tip('PGFN','CPG',cdCert);
  tip('Estadual','CES',cdCert);tip('Municipal','CMU',cdCert);
  tip('FGTS','CFG',cdCert);tip('Trabalhista','CTR',cdCert);
  tip('Falência e Concordata','CFC',cdCert);tip('Protesto','CPT',cdCert);

  const cdDoc=cat('Documentação','Certidões e Documentações');
  tip('Procuração','PCR',cdDoc);tip('Contrato Social','CTS',cdDoc);
  tip('Alteração Contratual','ACT',cdDoc);tip('Certificado Digital','CDG',cdDoc);tip('Arquivamento','ARQ',cdDoc);

  // ── 12. ATENDIMENTO AO CLIENTE ────────────────────────────────────────────
  const atSol=cat('Solicitações','Atendimento ao Cliente');
  tip('Dúvida Cliente','DVC',atSol);tip('Pedido Documento','PDD',atSol);
  tip('Consulta Tributária','CTX',atSol);tip('Consulta Trabalhista','CTH',atSol);

  const atFin=cat('Financeiro','Atendimento ao Cliente');
  tip('Emissão Boleto','EMB',atFin);tip('Segunda Via','SGV',atFin);
  tip('Renegociação','RNG',atFin);tip('Cobrança','COB',atFin);

  const atCom=cat('Comercial','Atendimento ao Cliente');
  tip('Proposta Comercial','PRC',atCom);tip('Novo Cliente','NVC',atCom);
  tip('Contrato Prestação Serviço','CPS',atCom);tip('Reajuste Honorários','RHN',atCom);

  const atOuv=cat('Ouvidoria','Atendimento ao Cliente');
  tip('Reclamação','RCL',atOuv);tip('Sugestão','SUG',atOuv);
  tip('Elogio','ELG',atOuv);tip('Pesquisa Satisfação','PST',atOuv);

  dbSet('categorias',cats);
  dbSet('tipos_demanda',tipos);
  ['clientes','demandas','tramites','pendencias','proximas_acoes','aprovacoes','chat_mensagens','notificacoes','documentos','whatsapp_mensagens','demanda_responsaveis','demanda_estatisticas','agenda'].forEach(t=>dbSet(t,[]));
}
let U,allDem=[],allCli=[],cols=[],deps=[];
let demId=null,pDepSel=null,pCatSel=null,editUser=false;
const SL={aberta:'Aberta',em_andamento:'Em andamento',aguardando_aceite:'Ag. aceite',aguardando_cliente:'Ag. cliente',aguardando_orgao:'Ag. órgão',aguardando_gestor:'Ag. gestor',aguardando_conclusao:'Ag. conclusão',concluida:'Concluída',cancelada:'Cancelada'};
const SC={aberta:'ts',em_andamento:'tg',aguardando_aceite:'ta',aguardando_cliente:'ta',aguardando_orgao:'tp',aguardando_gestor:'tn',aguardando_conclusao:'tg',concluida:'tgr',cancelada:'tr'};
const PC={baixa:'tgr',normal:'ts',alta:'ta',urgente:'tr'};
const TL={abertura:'Abertura',documento_recebido:'Doc. recebido',documento_solicitado:'Doc. solicitado',protocolo:'Protocolo',exigencia_recebida:'Exigência recebida',exigencia_respondida:'Exigência respondida',transferencia:'Transferência',aceite:'Aceite',pendencia_criada:'Pendência criada',pendencia_resolvida:'Pendência resolvida',aprovacao_solicitada:'Aprox. solicitada',aprovacao_concedida:'Aprovado',aprovacao_devolvida:'Devolvido',conclusao:'Conclusão',cancelamento:'Cancelamento',movimentacao_geral:'Movimentação'};
