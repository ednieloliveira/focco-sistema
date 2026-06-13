// ═══════════════════════════════════════════
// init, login, navegação, loadUser
// ═══════════════════════════════════════════

async function init(){
  // Recupera sessão salva no localStorage
  const sessStr = localStorage.getItem('focco_auth');
  if(sessStr){
    try{
      const sess = JSON.parse(sessStr);
      if(sess && sess.user){
        const {data:prof} = await _sb.from('profiles').select('*').eq('id',sess.user.id).eq('ativo',true).single();
        if(prof){
          await loadUser(sess.user);
          return;
        }
      }
    }catch(e){}
  }
  showLogin();
}
function showLogin(){document.getElementById('pgLogin').style.display='flex';document.getElementById('pgApp').style.display='none';}
async function fazerLogin(){
  const email=document.getElementById('lEmail').value.trim();
  const senha=document.getElementById('lSenha').value;
  const btn=document.getElementById('lBtn');
  const err=document.getElementById('loginErr');
  err.classList.remove('show');
  if(!email||!senha){err.textContent='Preencha o usuário e a senha.';err.classList.add('show');return;}
  btn.disabled=true; btn.textContent='Entrando...';
  const {data,error}=await sb.auth.signInWithPassword({email,password:senha});
  if(error){
    btn.disabled=false; btn.textContent='Entrar no Sistema';
    err.textContent=error.message.includes('Invalid')?'Usuário ou senha incorretos.':error.message;
    err.classList.add('show'); return;
  }
  // Verificar se é primeiro acesso
  const {data:profCheck} = await _sb.from('profiles').select('*').eq('id',data.user.id).single();
  if(profCheck && profCheck.primeiro_acesso===true) {
    window._userPendenteTroca = data.user;
    window._profPendenteTroca = profCheck;
    btn.disabled=false; btn.textContent='Entrar no Sistema';
    document.getElementById('telaLoginNormal').style.display='none';
    document.getElementById('telaTrocaSenha').style.display='block';
    const msg = document.querySelector('#telaTrocaSenha .login-p');
    if(msg) msg.textContent = 'Olá, '+profCheck.nome.split(' ')[0]+'! Defina sua senha pessoal antes de continuar.';
    return;
  }
  await loadUser(data.user);
}

function cancelarTrocaSenha(){
  document.getElementById('telaTrocaSenha').style.display='none';
  document.getElementById('telaLoginNormal').style.display='block';
  document.getElementById('tNovaSenha').value='';
  document.getElementById('tConfSenha').value='';
  document.getElementById('trocaErr').classList.remove('show');
  window._userPendenteTroca=null;
  window._profPendenteTroca=null;
}
async function trocarSenhaObrigatoria() {
  const nova = document.getElementById('tNovaSenha').value;
  const conf = document.getElementById('tConfSenha').value;
  const err  = document.getElementById('trocaErr');
  const btn  = document.getElementById('tBtn');
  err.classList.remove('show');

  if(!nova || nova.length < 4) {
    err.textContent='A senha deve ter pelo menos 4 caracteres.';
    err.classList.add('show'); return;
  }
  if(nova !== conf) {
    err.textContent='As senhas não conferem. Digite novamente.';
    err.classList.add('show'); return;
  }

  btn.disabled=true; btn.textContent='Salvando...';

  try {
    const prof = window._profPendenteTroca;
    if(!prof) throw new Error('Sessão expirada. Faça login novamente.');

    const {error} = await sb.auth.updateUser({password: nova});
    if(error) throw new Error(error.message);

    toast('Senha definida com sucesso!','ok');
    btn.disabled=false; btn.textContent='Salvar e Entrar';

    await loadUser(window._userPendenteTroca);
    window._userPendenteTroca = null;
    window._profPendenteTroca = null;

  } catch(e) {
    err.textContent = e.message||'Erro ao salvar senha.';
    err.classList.add('show');
    btn.disabled=false; btn.textContent='Salvar e Entrar';
  }
}
async function loadUser(user){
  const {data:p}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(!p){showLogin();return;}
  U=p;
  const ini=p.nome.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('sbAv').textContent=ini;
  document.getElementById('sbNome').textContent=p.nome;
  document.getElementById('sbPerfil').textContent=p.perfil==='gestor'?'Gestor':'Colaborador';
  document.getElementById('topAv').textContent=ini;
  const _sg=document.getElementById('secGestor');if(_sg)_sg.style.display=p.perfil==='gestor'?'block':'none';
  document.getElementById('pgLogin').style.display='none';
  document.getElementById('pgApp').style.display='block';
  const h=new Date().getHours();
  document.getElementById('dSauda').textContent=(h<12?'Bom dia':h<18?'Boa tarde':'Boa noite')+', '+p.nome.split(' ')[0]+' 👋';
  document.getElementById('dData').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · Focco Contabilidade';
  await Promise.all([loadCols(),loadDeps()]);
  fillGlobSelects();
  await loadDash();
  carregarNotificacoes();
}
async function fazerLogout(){
  if(!confirm('Deseja sair do sistema?')) return;
  await sb.auth.signOut();
  U = null;
  const lEmail=document.getElementById('lEmail');
  const lSenha=document.getElementById('lSenha');
  const lBtn=document.getElementById('lBtn');
  if(lEmail) lEmail.value='';
  if(lSenha) lSenha.value='';
  if(lBtn){ lBtn.disabled=false; lBtn.textContent='Entrar no Sistema'; }
  const telaLogin=document.getElementById('telaLoginNormal');
  const telaTroca=document.getElementById('telaTrocaSenha');
  if(telaLogin) telaLogin.style.display='block';
  if(telaTroca) telaTroca.style.display='none';
  document.getElementById('loginErr')?.classList.remove('show');
  showLogin();
}
async function loadCols(){const {data}=await sb.from('profiles').select('id,nome').eq('ativo',true).order('nome');cols=data||[];}
async function loadDeps(){
  const {data}=await sb.from('departamentos').select('*').eq('ativo',true).order('ordem');
  deps=data||[];
  const s=document.getElementById('fDep'),s2=document.getElementById('ndDep');
  deps.forEach(d=>{s.innerHTML+=`<option value="${d.id}">${d.nome}</option>`;s2.innerHTML+=`<option value="${d.id}">${d.nome}</option>`;});
}
function fillGlobSelects(){
  ['ndResp','pResp','aResp','trResp'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML=id==='pResp'?'<option value="">Ninguém</option>':'<option value="">Selecione...</option>';
    cols.forEach(c=>{el.innerHTML+=`<option value="${c.id}" ${c.id===U.id?'selected':''}>${c.nome}</option>`;});
  });
  const sd=document.getElementById('trDep');if(sd){sd.innerHTML='<option value="">Selecione...</option>';deps.forEach(d=>{sd.innerHTML+=`<option value="${d.id}">${d.nome}</option>`;});}
  const am=new Date();am.setDate(am.getDate()+2);const as=am.toISOString().split('T')[0];
  ['ndAcaoD','pData','aData'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.value)el.value=as;});
}

function ir(p,el){
  document.querySelectorAll('.pg').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('pg-'+p);
  if(pg)pg.classList.add('on');
  const n=el||document.getElementById('nav-'+p);if(n)n.classList.add('active');
  const titulos={dash:'Dashboard',caixa:'Minha Caixa',kanban:'Kanban',dem:'Central de Processos',
    det:'Detalhe da Demanda',cli:'Clientes',param:'Parâmetros',users:'Usuários',
    cal:'Calendário Fiscal',fiscal:'Escrita Fiscal',dp:'Departamento Pessoal',
    cont:'Contabilidade',rural:'Rural',irpf:'IRPF',financeiro:'Financeiro',
    relatorios:'Relatórios',whatsapp:'WhatsApp'};
  document.getElementById('pgTitle').textContent=titulos[p]||p;
  if(p==='dash'){loadDash();renderDashCal();}
  else if(p==='caixa')loadCaixa();
  else if(p==='dem')loadDem();
  else if(p==='cli')loadCli();
  else if(p==='param')loadParam();
  else if(p==='depts')loadDeptsPage();
  else if(p==='fiscal')loadFiscal();
  else if(p==='dp')loadDP();
  else if(p==='cont')loadCont();
  else if(p==='rural')loadRural();
  else if(p==='leg')loadLeg();
  else if(p==='abertura')loadAbertura();
  else if(p==='imob')loadImob();
  else if(p==='irpf')loadIRPF();
  else if(p==='parc')loadParc();
  else if(p==='pref')loadPref();
  else if(p==='certs')loadCerts();
  else if(p==='atend')loadAtend();
  else if(p==='users'){loadUsers();}
  else if(p==='financeiro')loadFinanceiro();
  else if(p==='relatorios'){initRelatorios();}
  else if(p==='whatsapp')loadWAHistorico();
  else if(p==='cal')renderCalendario();
  else if(p==='kanban')loadKanban();
  else if(p==='utilitarios'){trocarUtab('clientes');}
  else if(p==='backup'){loadBackupResumo();registrarHistoricoBackup();}
  else if(p==='impressao')loadImpressao();
}
