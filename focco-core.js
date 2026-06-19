/* Focco Core - funcoes compartilhadas entre modulos */
(function(){
  const DB_PFX = 'focco_db_';
  const SB_URL = 'https://nambhrizjnhebqgfztux.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbWJocml6am5oZWJxZ2Z6dHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDUzMDIsImV4cCI6MjA5NjkyMTMwMn0.AeBCJetQQugrpDAaOPrEYgHor9irmosN8EWogCtPzSo';

  function dbGet(table){
    try{return JSON.parse(localStorage.getItem(DB_PFX + table) || '[]');}
    catch(e){return [];}
  }

  function dbSet(table, rows){
    localStorage.setItem(DB_PFX + table, JSON.stringify(Array.isArray(rows) ? rows : []));
  }

  function onlyDigits(value){
    return String(value || '').replace(/\D+/g, '');
  }

  function norm(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function uid(prefix='id'){
    if(crypto.randomUUID) return crypto.randomUUID();
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  async function sbFetch(table, params='select=*'){
    const url = `${SB_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json'
      }
    });
    if(!res.ok) throw new Error(await res.text());
    return res.json();
  }

  window.FoccoCore = { DB_PFX, SB_URL, SB_KEY, dbGet, dbSet, onlyDigits, norm, uid, sbFetch };
})();
