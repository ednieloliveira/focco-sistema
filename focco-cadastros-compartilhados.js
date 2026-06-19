/* Cadastros compartilhados: clientes, usuarios e departamentos */
(function(){
  const Core = window.FoccoCore;
  if(!Core) return;

  function clientes(){
    return Core.dbGet('clientes');
  }

  function usuarios(){
    return Core.dbGet('profiles');
  }

  function departamentos(){
    return Core.dbGet('departamentos');
  }

  function clienteNome(idOuCodigo){
    const key = String(idOuCodigo || '');
    const item = clientes().find(c =>
      String(c.id || '') === key ||
      String(c.codigo || '') === key ||
      Core.onlyDigits(c.cpf_cnpj || c.documento || '') === Core.onlyDigits(key)
    );
    return item?.nome || item?.razao_social || '';
  }

  function auditoriaClientesDuplicados(lista){
    const rows = Array.isArray(lista) ? lista : clientes();
    const porDoc = new Map();
    const porNome = new Map();
    rows.forEach((c, index) => {
      const doc = Core.onlyDigits(c.cpf_cnpj || c.documento || c.cnpj_cpf || '');
      const nome = Core.norm(c.nome || c.razao_social || '');
      if(doc) porDoc.set(doc, [...(porDoc.get(doc) || []), { index, cliente:c }]);
      if(nome) porNome.set(nome, [...(porNome.get(nome) || []), { index, cliente:c }]);
    });
    const docs = [...porDoc.entries()].filter(([,v]) => v.length > 1);
    const nomes = [...porNome.entries()].filter(([,v]) => v.length > 1);
    return {
      total: docs.length + nomes.length,
      documentos: docs,
      nomes
    };
  }

  async function carregarBasicosDoSupabase(){
    const [clis, profs, depts] = await Promise.allSettled([
      Core.sbFetch('clientes', 'select=*'),
      Core.sbFetch('profiles_public', 'select=*'),
      Core.sbFetch('departamentos', 'select=*')
    ]);
    if(clis.status === 'fulfilled') Core.dbSet('clientes', clis.value || []);
    if(profs.status === 'fulfilled') Core.dbSet('profiles', profs.value || []);
    if(depts.status === 'fulfilled') Core.dbSet('departamentos', depts.value || []);
    return {
      clientes: clientes(),
      usuarios: usuarios(),
      departamentos: departamentos()
    };
  }

  window.FoccoCadastros = {
    clientes,
    usuarios,
    departamentos,
    clienteNome,
    auditoriaClientesDuplicados,
    carregarBasicosDoSupabase
  };
})();
