const pg = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');
dotenv.config();

// Verify that the pool variables here exist in your env file
const pool = new pg.Pool({
    user: process.env.pguser,
    host: process.env.pghost,
    database: process.env.pgdatabase,
    password: process.env.pgpassword,
    port: process.env.pgport
});

// Update init.sql to use different names
async function initialize(){
    const client = await pool.connect();
    const file = fs.readFileSync('api/init.sql').toString();
    await client.query(file);
    await client.release();
}initialize(); // Keep initialize() here or bad things will happen 

async function addAlbum(album){
    const client = await pool.connect();
    const album_query = 
      `INSERT INTO albums(id, name, image, url, artists, genres, track_list)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`;
    
    await client.query(album_query, [album.id, album.name, album.image, album.url, album.artists, album.genres, album.track_list]);
    await client.release();
}

exports.addAlbum = addAlbum;