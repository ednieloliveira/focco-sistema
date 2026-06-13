// ═══════════════════════════════════════════
// Motor de banco local + utilitários base
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MOTOR DE BANCO LOCAL — substitui Supabase (offline, localStorage)
// ═══════════════════════════════════════════════════════════════
function uuid(){return crypto.randomUUID?crypto.randomUUID():[...Array(36)].map((_,i)=>[8,12,16,20].includes(i)?'-':i===12?'4':i===16?(Math.random()*4|0|8).toString(16):(Math.random()*16|0).toString(16)).join('');}
async function hashPass(p){const e=new TextEncoder().encode(p+'focco$k');const b=await crypto.subtle.digest('SHA-256',e);return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
const DB_PFX='focco_db_';
function dbGet(t){try{return JSON.parse(localStorage.getItem(DB_PFX+t)||'[]');}catch{return[];}}
function dbSet(t,d){localStorage.setItem(DB_PFX+t,JSON.stringify(d));}

