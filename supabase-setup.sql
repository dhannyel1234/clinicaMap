-- ══════════════════════════════════════════════════════
-- CLÍNICA – MAPA INTERATIVO
-- Execute este SQL no Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- Tabela principal de elementos do mapa
CREATE TABLE IF NOT EXISTS clinic_elements (
  id          BIGINT PRIMARY KEY,
  type        TEXT NOT NULL,          -- 'room', 'recepcao', 'sala', 'banheiro', 'corredor', 'text', 'hline', 'vline'
  x           FLOAT NOT NULL DEFAULT 0,
  y           FLOAT NOT NULL DEFAULT 0,
  w           FLOAT NOT NULL DEFAULT 110,
  h           FLOAT NOT NULL DEFAULT 90,
  rotation    FLOAT NOT NULL DEFAULT 0,
  z_index     INT   NOT NULL DEFAULT 1,
  name        TEXT  NOT NULL DEFAULT '',
  label       TEXT  NOT NULL DEFAULT '',
  status      TEXT  NOT NULL DEFAULT 'livre',   -- 'livre' | 'ocupado'
  room_type   TEXT  NOT NULL DEFAULT 'individual', -- 'individual' | 'suite'
  guest       TEXT  NOT NULL DEFAULT '',
  notes       TEXT  NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice por tipo para facilitar filtros
CREATE INDEX IF NOT EXISTS idx_clinic_elements_type ON clinic_elements(type);

-- Row Level Security (RLS) – permite acesso público ou autenticado
-- Para produção, configure políticas mais restritivas
ALTER TABLE clinic_elements ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (ajuste conforme sua necessidade de autenticação)
CREATE POLICY "Allow read" ON clinic_elements
  FOR SELECT USING (true);

-- Política de escrita (para autenticação, troque 'true' por 'auth.role() = ''authenticated'''
CREATE POLICY "Allow write" ON clinic_elements
  FOR ALL USING (true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinic_elements_updated
  BEFORE UPDATE ON clinic_elements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
