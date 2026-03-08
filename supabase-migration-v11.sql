-- ═══════════════════════════════════════
-- Migration v11: Leghe (Leagues)
-- ═══════════════════════════════════════

-- Tabella leghe
CREATE TABLE IF NOT EXISTS leghe (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  creator_id uuid REFERENCES auth.users ON DELETE SET NULL,
  round_start int NOT NULL DEFAULT 1,
  round_end int NOT NULL DEFAULT 24,
  is_public boolean NOT NULL DEFAULT true,
  invite_code text UNIQUE,
  is_generale boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Tabella membri
CREATE TABLE IF NOT EXISTS lega_members (
  lega_id uuid REFERENCES leghe ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (lega_id, user_id)
);

-- Lega Generale (auto, tutti, tutta la stagione)
INSERT INTO leghe (id, name, round_start, round_end, is_public, is_generale)
VALUES ('00000000-0000-0000-0000-000000000001', 'Lega Generale', 1, 24, true, true)
ON CONFLICT (id) DO NOTHING;

-- Backfill: aggiungi tutti gli utenti esistenti alla Lega Generale
INSERT INTO lega_members (lega_id, user_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM auth.users
ON CONFLICT DO NOTHING;

-- Trigger: nuovi utenti entrano automaticamente nella Lega Generale
CREATE OR REPLACE FUNCTION auto_join_lega_generale()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lega_members (lega_id, user_id)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_join_lega ON auth.users;
CREATE TRIGGER on_auth_user_created_join_lega
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_join_lega_generale();

-- ═══ RLS ═══

ALTER TABLE leghe ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere leghe pubbliche/generali + leghe a cui appartengono
CREATE POLICY "leghe_read" ON leghe FOR SELECT USING (
  is_public = true OR is_generale = true OR
  creator_id = auth.uid() OR
  id IN (SELECT lega_id FROM lega_members WHERE user_id = auth.uid())
);

-- Utenti autenticati possono creare leghe
CREATE POLICY "leghe_insert" ON leghe FOR INSERT WITH CHECK (auth.uid() = creator_id);

ALTER TABLE lega_members ENABLE ROW LEVEL SECURITY;

-- Utenti autenticati possono vedere i membri delle leghe
CREATE POLICY "lega_members_read" ON lega_members FOR SELECT USING (auth.uid() IS NOT NULL);

-- Utenti possono unirsi (inserire se stessi)
CREATE POLICY "lega_members_insert" ON lega_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Utenti possono uscire (eliminare se stessi)
CREATE POLICY "lega_members_delete" ON lega_members FOR DELETE USING (auth.uid() = user_id);

-- ═══ RPC: Classifica per lega ═══

CREATE OR REPLACE FUNCTION classifica_lega(p_lega_id uuid)
RETURNS TABLE(
  user_id uuid,
  team_principal_name text,
  scuderia_name text,
  total_points numeric,
  last_weekend_points numeric
) AS $$
DECLARE
  v_round_start int;
  v_round_end int;
  v_last_round int;
BEGIN
  SELECT l.round_start, l.round_end INTO v_round_start, v_round_end
  FROM leghe l WHERE l.id = p_lega_id;

  SELECT COALESCE(MAX(ws.round), 0) INTO v_last_round
  FROM weekend_scores ws
  JOIN lega_members lm ON ws.user_id = lm.user_id AND lm.lega_id = p_lega_id
  WHERE ws.round BETWEEN v_round_start AND v_round_end;

  RETURN QUERY
  SELECT
    lm.user_id,
    p.team_principal_name,
    p.scuderia_name,
    COALESCE(SUM(ws.total_points), 0)::numeric as total_points,
    COALESCE(MAX(CASE WHEN ws.round = v_last_round THEN ws.total_points END), 0)::numeric as last_weekend_points
  FROM lega_members lm
  JOIN profiles p ON p.id = lm.user_id
  LEFT JOIN weekend_scores ws ON ws.user_id = lm.user_id AND ws.round BETWEEN v_round_start AND v_round_end
  WHERE lm.lega_id = p_lega_id
  GROUP BY lm.user_id, p.team_principal_name, p.scuderia_name
  ORDER BY total_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
