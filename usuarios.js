// ═══════════════════════════════════════════
// Módulo de Usuários — Focco Sistema
// ═══════════════════════════════════════════

function gerarCodigoUsuario() {
  const ano = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `USR${ano}${rand}`;
}

async function loadUsers() {
  const { data } = await sb.from('profiles').select('*').order('nome');
  const grid = document.getElementById('usersGrid');
  if (!grid) return;

  if (!data || !data.length) {
    grid.innerHTML = '<div class="vazio">Nenhum usuário cadastrado.</div>';
    return;
  }

  const perfilLabel = { gestor:'Gestor', coordenador:'Coordenador', supervisor:'Supervisor', colaborador:'Colaborador' };
  const perfilCor   = { gestor:'tg', coordenador:'ts', supervisor:'tp', colaborador:'ta' };

  grid.innerHTML = data.map(u => {
    const ini    = u.nome.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
    const ehVoce = u.id === U.id;
    const perfil = perfilLabel[u.perfil] || u.perfil;
    const cor    = perfilCor[u.perfil] || 'tgr';
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);padding:18px;${!u.ativo?'opacity:.55':''}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:46px;height:46px;border-radius:12px;background:var(--accent-pale);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:var(--accent);flex-shrink:0">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text)">${u.nome}${ehVoce?' <small style="color:var(--text3);font-weight:400">(você)</small>':''}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${u.codigo_usuario?`Cód: <strong>${u.codigo_usuario}</strong> · `:''}Login: <strong>${u.usuario||'—'}</strong></div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            <span class="tag ${cor}">${perfil}</span>
            ${!u.ativo?'<span class="tag tgr">Inativo</span>':''}
            ${u.primeiro_acesso?'<span class="tag ta">⚠ Primeiro acesso</span>':''}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:var(--text3);margin-bottom:14px">
        <div>📧 ${u.email||'—'}</div>
        <div>📱 ${u.whatsapp||u.wa||'—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-s" style="flex:1;justify-content:center;font-size:12px" onclick="editUser2('${u.id}')">✏️ Editar</button>
        <button class="btn btn-s" style="flex:1;justify-content:center;font-size:12px" onclick="redefinirSenhaUser('${u.id}','${u.nome.split(' ')[0]}')">🔑 Senha</button>
        ${!ehVoce?`<button class="btn ${u.ativo?'btn-er':'btn-ok'}" style="flex:1;justify-content:center;font-size:12px" onclick="toggleU('${u.id}',${u.ativo},'${u.nome}')">${u.ativo?'🔴 Inativar':'🟢 Ativar'}</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function abrirModalUser() {
  document.getElementById('muId').value = '';
  document.getElementById('muNome').value = '';
  document.getElementById('muUsuario').value = '';
  document.getElementById('muSenha').value = '';
  document.getElementById('muWa').value = '';
  document.getElementById('muPerfil').value = 'colaborador';
  document.getElementById('mUserTit').textContent = 'Novo Usuário';
  document.getElementById('muSenhaSec').style.display = 'block';

  // Adicionar campos extras se existirem
  const muCod   = document.getElementById('muCodigo');
  const muEmail = document.getElementById('muEmailCorp');
  if (muCod)   muCod.value   = gerarCodigoUsuario();
  if (muEmail) muEmail.value = '';

  om('mUser');
}

async function editUser2(id) {
  const { data: u } = await sb.from('profiles').select('*').eq('id', id).single();
  if (!u) return;
  document.getElementById('muId').value      = u.id;
  document.getElementById('muNome').value    = u.nome || '';
  document.getElementById('muUsuario').value = u.usuario || '';
  document.getElementById('muSenha').value   = '';
  document.getElementById('muWa').value      = u.whatsapp || u.wa || '';
  document.getElementById('muPerfil').value  = u.perfil || 'colaborador';
  document.getElementById('mUserTit').textContent = 'Editar Usuário';
  document.getElementById('muSenhaSec').style.display = 'block';

  const muCod   = document.getElementById('muCodigo');
  const muEmail = document.getElementById('muEmailCorp');
  if (muCod)   muCod.value   = u.codigo_usuario || gerarCodigoUsuario();
  if (muEmail) muEmail.value = u.email || '';

  om('mUser');
}

async function salvarUser() {
  const id     = document.getElementById('muId').value;
  const nome   = document.getElementById('muNome').value.trim();
  const login  = document.getElementById('muUsuario').value.trim();
  const senha  = document.getElementById('muSenha').value;
  const whats  = document.getElementById('muWa').value.trim();
  const perfil = document.getElementById('muPerfil').value;

  const muCod   = document.getElementById('muCodigo');
  const muEmail = document.getElementById('muEmailCorp');
  const codigo  = muCod   ? muCod.value.trim()   : gerarCodigoUsuario();
  const email   = muEmail ? muEmail.value.trim()  : (login + '@focco.local');

  if (!nome || !login || !perfil) { toast('Preencha Nome, Login e Perfil','err'); return; }
  if (!id && !senha) { toast('Informe a senha para o novo usuário','err'); return; }

  const dados = {
    nome,
    email: email || (login + '@focco.local'),
    whatsapp: whats,
    usuario: login,
    perfil,
    codigo_usuario: codigo,
    ativo: true,
  };

  if (senha) {
    dados.senha_hash = await hashPass(senha);
    if (!id) dados.primeiro_acesso = true;
  }

  if (id) {
    const { error } = await sb.from('profiles').update(dados).eq('id', id);
    if (error) { toast('Erro: ' + error.message,'err'); return; }
    toast('Usuário atualizado!','ok');
  } else {
    dados.id         = uuid();
    dados.primeiro_acesso = true;
    dados.created_at = new Date().toISOString();
    const { error } = await sb.from('profiles').insert(dados);
    if (error) { toast('Erro: ' + error.message,'err'); return; }
    toast('Usuário criado!','ok');
  }

  fm('mUser');
  await loadUsers();
  await loadCols();
}

async function redefinirSenhaUser(id, nome) {
  const nova = prompt(`Nova senha para ${nome}:`);
  if (!nova || nova.length < 4) { toast('Senha muito curta (mínimo 4 caracteres)','err'); return; }
  const hash = await hashPass(nova);
  const { error } = await sb.from('profiles').update({ senha_hash: hash, primeiro_acesso: true }).eq('id', id);
  if (error) { toast('Erro: ' + error.message,'err'); return; }
  toast(`Senha de ${nome} redefinida!`,'ok');
}

async function toggleU(id, ativo, nome) {
  if (!confirm(`${ativo?'Inativar':'Reativar'} ${nome}?`)) return;
  await sb.from('profiles').update({ ativo: !ativo }).eq('id', id);
  toast(`${nome} ${ativo?'inativado':'reativado'}!`,'ok');
  await loadUsers();
}
