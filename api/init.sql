CREATE TABLE IF NOT EXISTS album(
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  image VARCHAR(255),
  url VARCHAR(255),
  genres TEXT[]
);

CREATE TABLE IF NOT EXISTS track(
  id VARCHAR(255) PRIMARY KEY,
  album_id VARCHAR(255),
  name VARCHAR(255),
  url VARCHAR(255),
  length INTEGER,
  disc INTEGER,
  number INTEGER
);

CREATE TABLE IF NOT EXISTS artist(
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  image VARCHAR(255),
  url VARCHAR(255),
  genres TEXT[]
);

CREATE TABLE IF NOT EXISTS artist_albums(
  joint_id VARCHAR(255) PRIMARY KEY,
  artist_id VARCHAR(255),
  album_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS pasipo_user(
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255),
  salthash VARCHAR(255),
  email VARCHAR(255),
  profile_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS pasipo(
  user_id UUID,
  date DATE,
  album_id VARCHAR(255),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS album_search(
  query VARCHAR(255) PRIMARY KEY,
  album_id VARCHAR(255)
);