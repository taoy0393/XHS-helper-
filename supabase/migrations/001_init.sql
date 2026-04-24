-- configs table
CREATE TABLE configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  is_default       BOOLEAN DEFAULT false,
  target_audience  TEXT CHECK (char_length(target_audience) <= 500),
  tone_presets     TEXT[] DEFAULT '{}',
  tone_custom      TEXT CHECK (char_length(tone_custom) <= 300),
  reference_samples TEXT[] DEFAULT '{}',
  image_style_note TEXT,
  forbidden_words  TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_configs_user_id ON configs(user_id);

-- histories table
CREATE TABLE histories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text      TEXT NOT NULL,
  input_images    JSONB DEFAULT '[]',
  config_snapshot JSONB NOT NULL,
  output          JSONB NOT NULL,
  title_preview   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_histories_user_created ON histories(user_id, created_at DESC);

-- RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own configs" ON configs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE histories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own histories" ON histories
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-enforce max 10 configs per user
CREATE OR REPLACE FUNCTION check_config_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'config_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_config_limit
BEFORE INSERT ON configs
FOR EACH ROW EXECUTE FUNCTION check_config_limit();

-- Auto-trim histories to 200 per user
CREATE OR REPLACE FUNCTION trim_user_histories()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM histories
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM histories
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_history_insert
AFTER INSERT ON histories
FOR EACH ROW EXECUTE FUNCTION trim_user_histories();

-- updated_at auto-update for configs
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER configs_updated_at
BEFORE UPDATE ON configs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
