(function () {
  const config = window.CYBERX_SUPABASE_CONFIG;
  const createClient = window.supabase?.createClient;
  if (!config?.url || !config?.anonKey || !createClient) {
    window.CyberXBackend = null;
    window.CyberXBackendReady = Promise.resolve(null);
    return;
  }

  try {
    const client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    window.CyberXBackend = { client };
    window.CyberXBackendReady = Promise.resolve(window.CyberXBackend);
  } catch {
    window.CyberXBackend = null;
    window.CyberXBackendReady = Promise.resolve(null);
  }
})();
