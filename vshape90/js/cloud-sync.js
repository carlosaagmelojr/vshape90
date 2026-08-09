/* ============================================================
   V-SHAPE 90 — cloud-sync.js
   Camada de conta/sync sobre o Supabase. O app continua funcionando
   100% offline sem isso — esta camada é ADITIVA: se o usuário nunca
   fizer login, nada muda no comportamento local.

   Injeção de dependência de propósito (client é passado em init(),
   não importado direto): permite testar toda a lógica de sync com um
   cliente Supabase FALSO (mesmo formato de métodos), sem precisar de
   rede real — importante porque este ambiente de desenvolvimento não
   tem acesso a supabase.co pra testar contra o serviço de verdade.
   Teste ponta a ponta contra o Supabase real é responsabilidade de
   quem for publicar (ver supabase/schema.sql e README).

   Limitação conhecida, documentada por decisão: a resolução de
   conflito é "last-write-wins" comparando timestamps — não é um
   merge de campo a campo. Se a mesma pessoa editar em dois
   aparelhos offline ao mesmo tempo, o mais recente sobrescreve o
   outro por completo. Pra um app de uso pessoal isso é aceitável;
   um merge real (CRDT ou por-campo) é trabalho de versão futura.
   ============================================================ */

const CloudSync = {
  client: null,
  user: null,
  _authListeners: [],

  /* Chamado uma vez, no boot do app, com a instância real do
     supabase-js (ou um cliente falso, em testes). */
  init(client) {
    this.client = client;
    if (client && client.auth && client.auth.onAuthStateChange) {
      client.auth.onAuthStateChange((_event, session) => {
        this.user = session ? session.user : null;
        this._authListeners.forEach(fn => fn(this.user));
      });
    }
  },

  onAuthChange(fn) {
    this._authListeners.push(fn);
  },

  isConfigured() {
    return !!this.client;
  },

  isLoggedIn() {
    return !!this.user;
  },

  async restoreSession() {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getSession();
    if (error) throw this._friendlyError(error);
    this.user = data.session ? data.session.user : null;
    return this.user;
  },

  async signUp(email, password) {
    if (!this.client) throw new Error('Sincronização não configurada neste dispositivo.');
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw this._friendlyError(error);
    this.user = data.user;
    return data.user;
  },

  async signIn(email, password) {
    if (!this.client) throw new Error('Sincronização não configurada neste dispositivo.');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw this._friendlyError(error);
    this.user = data.user;
    return data.user;
  },

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.user = null;
  },

  /* Traduz erros técnicos do Supabase pra mensagens que o usuário
     entende — nunca expor stack trace/erro de banco cru na tela. */
  _friendlyError(error) {
    const msg = (error && error.message || '').toLowerCase();
    if (msg.includes('invalid login credentials')) return new Error('E-mail ou senha incorretos.');
    if (msg.includes('already registered') || msg.includes('user already exists')) return new Error('Esse e-mail já tem uma conta. Tente entrar em vez de criar uma nova.');
    if (msg.includes('password') && msg.includes('6')) return new Error('A senha precisa ter pelo menos 6 caracteres.');
    if (msg.includes('email') && msg.includes('invalid')) return new Error('Digite um e-mail válido.');
    if (msg.includes('fetch') || msg.includes('network')) return new Error('Sem conexão com o servidor. Seus dados continuam salvos localmente.');
    return new Error('Não foi possível completar essa ação agora. Tente novamente em instantes.');
  },

  /* Envia o blob local pra nuvem (sobrescreve o que estiver lá). */
  async pushToCloud(localData) {
    if (!this.user) throw new Error('Você precisa estar logado pra sincronizar.');
    const { error } = await this.client
      .from('user_data')
      .upsert({ user_id: this.user.id, data: localData, updated_at: new Date().toISOString() });
    if (error) throw this._friendlyError(error);
    return true;
  },

  /* Busca o blob salvo na nuvem (ou null se esse usuário nunca sincronizou). */
  async pullFromCloud() {
    if (!this.user) throw new Error('Você precisa estar logado pra sincronizar.');
    const row = await this._fetchRow();
    return row ? row.data : null;
  },

  async _fetchRow() {
    const { data, error } = await this.client
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', this.user.id)
      .maybeSingle();
    if (error) throw this._friendlyError(error);
    return data;
  },

  /* Decide automaticamente entre local e nuvem por timestamp
     (last-write-wins — ver nota de limitação no topo do arquivo). */
  async syncMerge(localData, localModifiedAtISO) {
    if (!this.user) throw new Error('Você precisa estar logado pra sincronizar.');
    const cloudRow = await this._fetchRow();

    if (!cloudRow) {
      await this.pushToCloud(localData);
      return { action: 'pushed', reason: 'nada na nuvem ainda', data: localData };
    }

    const cloudTime = new Date(cloudRow.updated_at).getTime();
    const localTime = new Date(localModifiedAtISO).getTime();

    if (localTime >= cloudTime) {
      await this.pushToCloud(localData);
      return { action: 'pushed', reason: 'dado local é mais recente', data: localData };
    }
    return { action: 'pulled', reason: 'dado da nuvem é mais recente', data: cloudRow.data };
  }
};

if (typeof window !== 'undefined') { window.CloudSync = CloudSync; }
