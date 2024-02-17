CREATE TABLE IF NOT EXISTS albums(
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  image VARCHAR(255),
  url VARCHAR(255),
  artists JSONB[],
  genres text[],
  track_list JSONB[]
);

CREATE TABLE IF NOT EXISTS users(
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name VARCHAR(255),
  pass_word VARCHAR(255),
  user_email VARCHAR(255),
  profile_name VARCHAR(255),
  user_token JSONB[]
);

CREATE TABLE IF NOT EXISTS pasipo(
  user_id UUID,
  date DATE,
  album_id VARCHAR(255),
  PRIMARY KEY (user_id, date)
);