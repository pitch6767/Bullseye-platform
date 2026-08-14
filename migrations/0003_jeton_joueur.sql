ALTER TABLE joueurs ADD COLUMN jeton TEXT;
CREATE UNIQUE INDEX idx_joueurs_jeton ON joueurs (jeton);
