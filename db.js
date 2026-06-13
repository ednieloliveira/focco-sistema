// ═══════════════════════════════════════════
// Motor de query local + Sheets sync
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GOOGLE SHEETS SYNC LAYER
// ═══════════════════════════════════════════════════════════════
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwEmJwOGAApVylOglinMdUyhzSlyOnF9u8xwaGss1R5FX_krtHlqztMWRdG6WXzYO-Xw/exec';
const SYNC_TABLES = ['profiles','clientes','demandas','tramites','departamentos','categorias','tipos_demanda','proximas_acoes','pendencias'];
let sheetsConectado = false, syncRunning = false;

function updateSyncBadge(st) {
  let el = document.getElementById('syncBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncBadge';
    el.style.cssText = 'position:fixed;bottom:14px;left:calc(var(--sidebar-w) + 14px);font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;z-index:999;transition:all .3s;pointer-events:none';
    document.body.appendChild(el);
  }
  if (st === 'ok') { el.style.background = '#dcfce7'; el.style.color = '#15803d'; el.textContent = '● Sheets conectado'; }
  else if (st === 'sync') { el.style.background = '#dbeafe'; el.style.color = '#1d4ed8'; el.textContent = '↑ Sincronizando...'; }
  else { el.style.background = '#fee2e2'; el.style.color = '#dc2626'; el.textContent = '○ Offline'; }
}
async function sheetsGet(p={}) {
  const url = new URL(SCRIPT_URL);
  Object.entries(p).forEach(([k,v]) => url.searchParams.set(k,v));
  const r = await fetch(url.toString()); return r.json();
}
async function sheetsPost(body) {
  const r = await fetch(SCRIPT_URL, {method:'POST', body:JSON.stringify(body)}); return r.json();
}
async function syncFromSheets() {
  if (syncRunning) return; syncRunning = true; updateSyncBadge('sync');
  try {
    const r = await sheetsGet({acao:'carregar_tudo'});
    if (r.ok && r.dados) {
      const map = {profiles:'profiles',clientes:'clientes',demandas:'demandas',tramites:'tramites',
                   departamentos:'departamentos',categorias:'categorias',tipos_demanda:'tipos_demanda',
                   proximas_acoes:'proximas_acoes',pendencias:'pendencias'};
      Object.entries(map).forEach(([shKey, dbKey]) => {
        const shData = r.dados[shKey] || [];
        if (shData.length > 0) {
          const local = dbGet(dbKey);
          const shIds = new Set(shData.map(x => x.id));
          const onlyLocal = local.filter(x => !shIds.has(x.id));
          dbSet(dbKey, [...shData, ...onlyLocal]);
        }
      });
      sheetsConectado = true; updateSyncBadge('ok');
    }
  } catch(e) { sheetsConectado = false; updateSyncBadge('err'); }
  finally { syncRunning = false; }
}
async function sincronizarParaSheets() {
  if (!sheetsConectado) { toast('Sem conexão com Sheets', 'err'); return; }
  updateSyncBadge('sync');
  try {
    for (const t of SYNC_TABLES) {
      const d = dbGet(t);
      if (d.length > 0) await sheetsPost({acao:'inserir_lote_replace', tabela:t.toUpperCase(), dados:d});
    }
    updateSyncBadge('ok'); toast('Sincronizado com Google Sheets!', 'ok');
  } catch(e) { updateSyncBadge('err'); toast('Erro: '+e.message, 'err'); }
}
async function importarDoSheets() { await syncFromSheets(); toast('Dados importados do Sheets!', 'ok'); }
// Google Sheets sync desativado — sistema agora usa Supabase
// setInterval(() => { if (sheetsConectado && !syncRunning) syncFromSheets(); }, 5*60*1000);
function startSync() { /* desativado — usando Supabase */ }


function vwInatividade(){
  const dems=dbGet('demandas'),profs=dbGet('profiles'),clis=dbGet('clientes'),depts=dbGet('departamentos');
  return dems.filter(d=>!['concluida','cancelada'].includes(d.status)).map(d=>({
    ...d,dias_inatividade:Math.floor((Date.now()-new Date(d.ultima_movimentacao||d.created_at))/86400000),
    clientes:clis.find(c=>c.id===d.cliente_id)||null,
    profiles:profs.find(p=>p.id===d.responsavel_atual_id)||null,
    departamentos:depts.find(x=>x.id===(d.departamento_atual_id||d.departamento_id))||null,
  }));
}
function vwProxAcoesVencidas(){
  const acoes=dbGet('proximas_acoes'),dems=dbGet('demandas'),clis=dbGet('clientes'),profs=dbGet('profiles');
  const hj=new Date().toISOString().split('T')[0];
  return acoes.filter(a=>!a.concluida&&a.data_prevista<=hj).map(a=>{
    const d=dems.find(x=>x.id===a.demanda_id)||null;
    if(d)d.clientes=clis.find(c=>c.id===d.cliente_id)||null;
    return{...a,profiles:profs.find(p=>p.id===a.responsavel_id)||null,demandas:d};
  });
}
const JOIN_DEFS={
  demandas:{
    clientes:r=>dbGet('clientes').find(x=>x.id===r.cliente_id)||null,
    profiles:r=>dbGet('profiles').find(x=>x.id===r.responsavel_atual_id)||null,
    'profiles!demandas_responsavel_atual_id_fkey':r=>dbGet('profiles').find(x=>x.id===r.responsavel_atual_id)||null,
    departamentos:r=>{const a=dbGet('departamentos');return a.find(x=>x.id===(r.departamento_atual_id||r.departamento_id))||null;},
    'departamentos!demandas_departamento_atual_id_fkey':r=>{const a=dbGet('departamentos');return a.find(x=>x.id===(r.departamento_atual_id||r.departamento_id))||null;},
    categorias:r=>dbGet('categorias').find(x=>x.id===r.categoria_id)||null,
    tipos_demanda:r=>dbGet('tipos_demanda').find(x=>x.id===r.tipo_demanda_id)||null,
  },
  tramites:{
    profiles:r=>dbGet('profiles').find(x=>x.id===r.usuario_id)||null,
    // sem join em demandas para evitar recursão
  },
  proximas_acoes:{
    profiles:r=>dbGet('profiles').find(x=>x.id===r.responsavel_id)||null,
    'profiles!proximas_acoes_responsavel_id_fkey':r=>dbGet('profiles').find(x=>x.id===r.responsavel_id)||null,
    // sem join em demandas para evitar recursão
  },
  pendencias:{
    profiles:r=>dbGet('profiles').find(x=>x.id===r.responsavel_id)||null,
    // sem join em demandas para evitar recursão
  },
  aprovacoes:{
    profiles:r=>dbGet('profiles').find(x=>x.id===r.solicitado_por)||null,
    'profiles!aprovacoes_solicitado_por_fkey':r=>dbGet('profiles').find(x=>x.id===r.solicitado_por)||null,
    // sem join em demandas para evitar recursão
  },
  chat_mensagens:{profiles:r=>dbGet('profiles').find(x=>x.id===r.usuario_id)||null},
  whatsapp_mensagens:{
    demandas:r=>{const d=dbGet('demandas').find(x=>x.id===r.demanda_id);if(d){d.clientes=dbGet('clientes').find(c=>c.id===d.cliente_id)||null;}return d||null;},
    profiles:r=>dbGet('profiles').find(x=>x.id===r.enviada_por)||null,
  },
  demanda_responsaveis:{
    demandas:r=>{const d=dbGet('demandas').find(x=>x.id===r.demanda_id);if(d){d.clientes=dbGet('clientes').find(c=>c.id===d.cliente_id)||null;}return d||null;},
    profiles:r=>dbGet('profiles').find(x=>x.id===r.responsavel_id)||null,
  },
  notificacoes:{demandas:r=>dbGet('demandas').find(x=>x.id===r.demanda_id)||null},
  documentos:{profiles:r=>dbGet('profiles').find(x=>x.id===r.uploaded_by)||null},
};
function applyJoins(rows,table){
  const jd=JOIN_DEFS[table]||{};
  if(!Object.keys(jd).length)return rows;
  return rows.map(r=>{
    const row={...r};
    Object.entries(jd).forEach(([k,fn])=>{const base=k.split('!')[0];row[base]=fn(r);if(k.includes('!'))row[k]=row[base];});
    return row;
  });
}
class Query{
  constructor(t){this._t=t;this._sel='*';this._filters=[];this._notIn=[];this._in=[];this._is=[];this._order=[];this._lim=null;this._single=false;this._ins=null;this._upd=null;this._del=false;this._ups=null;this._upsOpts=null;this._cnt=false;this._head=false;}
  select(s,o){this._sel=s||'*';if(o?.count==='exact')this._cnt=true;if(o?.head)this._head=true;return this;}
  insert(d){this._ins=Array.isArray(d)?d:[d];return this;}
  update(d){this._upd=d;return this;}
  upsert(d,o){this._ups=Array.isArray(d)?d:[d];this._upsOpts=o;return this;}
  delete(){this._del=true;return this;}
  eq(f,v){this._filters.push({f,v,op:'eq'});return this;}
  neq(f,v){this._filters.push({f,v,op:'neq'});return this;}
  gte(f,v){this._filters.push({f,v,op:'gte'});return this;}
  lte(f,v){this._filters.push({f,v,op:'lte'});return this;}
  gt(f,v){this._filters.push({f,v,op:'gt'});return this;}
  lt(f,v){this._filters.push({f,v,op:'lt'});return this;}
  is(f,v){this._is.push({f,v});return this;}
  in(f,v){this._in.push({f,v});return this;}
  not(f,op,v){if(op==='in'){const vals=typeof v==='string'?v.replace(/[()]/g,'').split(',').map(s=>s.trim()):v;this._notIn.push({f,vals});}else{this._filters.push({f,v,op:'not_'+op});}return this;}
  ilike(f,v){this._filters.push({f,v,op:'ilike'});return this;}
  order(f,o){this._order.push({f,asc:o?.ascending!==false});return this;}
  limit(n){this._lim=n;return this;}
  single(){this._single=true;return this;}
  maybeSingle(){this._single=true;return this;}
  range(from,to){this._lim=to-from+1;return this;}
  then(res,rej){return this._exec().then(res,rej);}
  _match(r){
    for(const f of this._filters){
      const rv=r[f.f];
      if(f.op==='eq'&&rv!=f.v)return false;
      if(f.op==='neq'&&rv==f.v)return false;
      if(f.op==='not_eq'&&rv==f.v)return false;
      if(f.op==='gte'&&!(rv>=f.v))return false;
      if(f.op==='lte'&&!(rv<=f.v))return false;
      if(f.op==='gt'&&!(rv>f.v))return false;
      if(f.op==='lt'&&!(rv<f.v))return false;
      if(f.op==='ilike'){const pat=f.v.replace(/%/g,'.*');if(!new RegExp(pat,'i').test(rv||''))return false;}
    }
    for(const f of this._is){const v=r[f.f];if(f.v===null&&v!==null&&v!==undefined)return false;if(f.v!==null&&(v===null||v===undefined))return false;}
    for(const f of this._in){if(!f.v.includes(r[f.f]))return false;}
    for(const f of this._notIn){if(f.vals.includes(r[f.f]))return false;}
    return true;
  }
  async _exec(){
    try{
      const t=this._t,now=new Date().toISOString();
      if(t==='vw_demandas_inatividade'){
        let rows=vwInatividade().filter(r=>this._match(r));
        if(this._order.length)rows.sort((a,b)=>{for(const o of this._order){const d=o.asc?1:-1;if(a[o.f]<b[o.f])return -d;if(a[o.f]>b[o.f])return d;}return 0;});
        if(this._head)return{data:null,count:rows.length,error:null};
        if(this._lim)rows=rows.slice(0,this._lim);
        if(this._single)return{data:rows[0]||null,error:null};
        return{data:rows,error:null};
      }
      if(t==='vw_proximas_acoes_vencidas'){
        let rows=vwProxAcoesVencidas().filter(r=>this._match(r));
        if(this._lim)rows=rows.slice(0,this._lim);
        if(this._single)return{data:rows[0]||null,error:null};
        return{data:rows,error:null};
      }
      if(this._ins){
        let rows=dbGet(t);
        const inserted=this._ins.map(d=>{
          if(t==='clientes'&&d.cpf_cnpj){const dup=rows.find(x=>x.cpf_cnpj===d.cpf_cnpj);if(dup)throw new Error('duplicate key value violates unique constraint: clientes_cpf_cnpj_key (unique)');}
          return{...d,id:d.id||uuid(),created_at:d.created_at||now};
        });
        rows.push(...inserted);
        dbSet(t,rows);
        if(['tramites','pendencias','proximas_acoes','aprovacoes','chat_mensagens'].includes(t)){
          const did=inserted[0]?.demanda_id;
          if(did){const dems=dbGet('demandas');const i=dems.findIndex(x=>x.id===did);if(i>=0){dems[i].ultima_movimentacao=now;dbSet('demandas',dems);}}
        }
        if(this._single)return{data:inserted[0],error:null};
        return{data:inserted,error:null};
      }
      if(this._ups){
        let rows=dbGet(t);
        const onConflict=this._upsOpts?.onConflict||'id';
        const upserted=[];
        this._ups.forEach(d=>{
          const key=d[onConflict];
          const i=key!=null?rows.findIndex(x=>x[onConflict]==key):-1;
          if(i>=0){rows[i]={...rows[i],...d};upserted.push(rows[i]);}
          else{const r={...d,id:d.id||uuid(),created_at:d.created_at||now};rows.push(r);upserted.push(r);}
        });
        dbSet(t,rows);
        if(this._single)return{data:upserted[0],error:null};
        return{data:upserted,error:null};
      }
      if(this._upd){
        const rows=dbGet(t),updated=[];
        const final=rows.map(r=>{if(!this._match(r))return r;const u={...r,...this._upd};updated.push(u);return u;});
        dbSet(t,final);
        return{data:updated,error:null};
      }
      if(this._del){
        const rows=dbGet(t);
        const kept=rows.filter(r=>!this._match(r));
        const removed=rows.filter(r=>this._match(r));
        dbSet(t,kept);
        return{data:removed,error:null};
      }
      let rows=dbGet(t).filter(r=>this._match(r));
      rows=applyJoins(rows,t);
      if(this._order.length)rows.sort((a,b)=>{for(const o of this._order){const d=o.asc?1:-1;if(a[o.f]<b[o.f])return -d;if(a[o.f]>b[o.f])return d;}return 0;});
      const cnt=rows.length;
      if(this._head)return{data:null,count:cnt,error:null};
      if(this._lim)rows=rows.slice(0,this._lim);
      if(this._cnt)return{data:rows,count:cnt,error:null};
      if(this._single)return{data:rows[0]||null,error:null};
      return{data:rows,error:null};
    }catch(e){return{data:null,error:{message:e.message||String(e)}};}
  }
}
const _auth={
  _sess:(()=>{try{return JSON.parse(localStorage.getItem('focco_auth')||'null');}catch{return null;}})(),
  async getSession(){return{data:{session:this._sess},error:null};},
  async signInWithPassword({email,password}){
    // Busca usuario direto no Supabase
    const login=(email||'').toLowerCase().trim();
    const {data:profs,error:err}=await _sb.from('profiles').select('*').eq('ativo',true);
    if(err||!profs||!profs.length){
      return{data:{session:null,user:null},error:{message:'Erro ao conectar ao banco. Verifique sua conexao.'}};
    }
    const u=profs.find(p=>(
      (p.usuario||'').toLowerCase()===login||
      (p.nome||'').toLowerCase()===login||
      (p.email||'').toLowerCase()===login
    )&&p.ativo!==false);
    if(!u)return{data:{session:null,user:null},error:{message:'Usuario "'+login+'" nao encontrado. Verifique e tente novamente.'}};
    const h=await hashPass(password);
    // Primeiro acesso sem senha_hash — aceita qualquer senha e salva o hash
    if(!u.senha_hash){
      await _sb.from('profiles').update({senha_hash:h}).eq('id',u.id);
      u.senha_hash=h;
    }
    if(u.senha_hash!==h)return{data:{session:null,user:null},error:{message:'Senha incorreta. Verifique e tente novamente.'}};
    const sess={user:{id:u.id,email:u.email,user_metadata:{},app_metadata:{}}};
    this._sess=sess;
    localStorage.setItem('focco_auth',JSON.stringify(sess));
    return{data:{session:sess,user:sess.user},error:null};
  },
  async signOut(){this._sess=null;localStorage.removeItem('focco_auth');return{error:null};},
  async updateUser({password}){
    if(!this._sess)return{error:{message:'Nao autenticado'}};
    const h=await hashPass(password);
    await _sb.from('profiles').update({senha_hash:h,primeiro_acesso:false}).eq('id',this._sess.user.id);
    return{data:{user:{id:this._sess.user.id}},error:null};
  },
  onAuthStateChange(){return{data:{subscription:{unsubscribe:()=>{}}}};}
};
const _rpc={
  async fn_proximo_numero_demanda({p_tipo_id}){
    const tipos=dbGet('tipos_demanda');
    const tipo=tipos.find(t=>t.id===p_tipo_id);
    const pref=tipo?.prefixo_numeracao||'DEM';
    const ano=new Date().getFullYear();
    const dems=dbGet('demandas');
    const nums=dems.filter(d=>d.numero?.startsWith(pref+'-'+ano+'-')).map(d=>parseInt(d.numero.split('-')[2]||'0')).filter(n=>!isNaN(n));
    const next=(nums.length?Math.max(...nums):0)+1;
    return{data:pref+'-'+ano+'-'+String(next).padStart(4,'0'),error:null};
  },
  async fn_criar_usuario({p_email,p_senha,p_nome,p_perfil}){
    const profs=dbGet('profiles');
    if(profs.find(p=>p.email?.toLowerCase()===p_email?.toLowerCase()))return{data:null,error:{message:'E-mail já cadastrado'}};
    const novo={id:uuid(),email:p_email,usuario:p_email.split('@')[0]||p_nome.toLowerCase().replace(/\s+/g,''),nome:p_nome,perfil:p_perfil||'colaborador',senha_hash:await hashPass(p_senha),ativo:true,primeiro_acesso:true,created_at:new Date().toISOString()};
    profs.push(novo);
    dbSet('profiles',profs);
    return{data:{id:novo.id,sucesso:true},error:null};
  },
  async fn_redefinir_senha({p_user_id,p_nova_senha}){
    const profs=dbGet('profiles');
    const i=profs.findIndex(p=>p.id===p_user_id);
    if(i<0)return{data:null,error:{message:'Usuário não encontrado'}};
    profs[i].senha_hash=await hashPass(p_nova_senha);
    profs[i].primeiro_acesso=true;
    dbSet('profiles',profs);
    return{data:{sucesso:true},error:null};
  }
};
