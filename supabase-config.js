// =============================================================
// CONFIGURAÇÃO DO SUPABASE
// Substitua os valores abaixo com as credenciais do seu projeto
// =============================================================

const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

// Inicializa o cliente Supabase (disponível globalmente)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
