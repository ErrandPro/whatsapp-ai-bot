const { createClient } = require('@supabase/supabase-js');
const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function useSupabaseAuthState(sessionId = 'main-session') {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('session_data')
    .eq('id', sessionId)
    .single();

  let creds, keys = {};

  if (data?.session_data) {
    const parsed = JSON.parse(JSON.stringify(data.session_data), BufferJSON.reviver);
    creds = parsed.creds;
    keys = parsed.keys || {};
  } else {
    creds = initAuthCreds();
  }

  const saveState = async () => {
    const session_data = JSON.parse(JSON.stringify({ creds, keys }, BufferJSON.replacer));

    const { error } = await supabase
      .from('whatsapp_sessions')
      .upsert({
        id: sessionId,
        session_data,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to save session to Supabase:', error.message);
    }
  };

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, console.log, saveState)
    },
    saveCreds: saveState
  };
}

module.exports = { useSupabaseAuthState };
