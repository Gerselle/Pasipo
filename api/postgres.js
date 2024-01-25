const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// Make sure the variables here exist in your env file
const pool = new pg.Pool({
    user: process.env.pguser,
    host: process.env.pghost,
    database: process.env.pgdatabase,
    password: process.env.pgpassword,
    port: process.env.pgport
});

// Updates/creates the album table in the database with a new row of album data for album caching 
async function addAlbum(album){
    const client = await pool.connect();

    const create_table = `
        CREATE TABLE IF NOT EXISTS album(
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            url VARCHAR(255),
            cover VARCHAR(255),
            popularity INTEGER,
            artists JSONB[],
            genres  TEXT[],
            track_list JSONB[]
        );`;
    
    await client.query(create_table);

    await client.query(
        'INSERT INTO album(id, name, url, cover, popularity, artists, genres, track_list) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
         [album.id, album.name, album.url, album.cover, album.popularity, album.artists, album.genres, album.track_list]
    );

    await client.release();
}

// Updates/creates the search_query table with a new row [query, id]
async function addQuery(album_query, album_id){
    const client = await pool.connect();

    const create_table = `
        CREATE TABLE IF NOT EXISTS search_query(
            query VARCHAR(255) PRIMARY KEY,
            id VARCHAR(255)
    );`;

    await client.query(create_table);
    await client.query('INSERT INTO search_query(query, id) VALUES ($1, $2) ON CONFLICT (query) DO NOTHING', [album_query, album_id])
    await client.release();
}

// If the query already exists in the database, return the album that its linked to, else return null
// Given album_query and queries in the database currently need to match exactly to return an album
async function checkQuery(album_query){
    const client = await pool.connect();
    try{    
        const check = await client.query('SELECT * FROM search_query WHERE query = $1', [album_query]);
        const album_id = check.rows[0].id;
        album = await client.query(`SELECT * FROM album WHERE id = $1`, [album_id]);
        await client.release();
        return album.rows[0];
    }catch(error){
        await client.release();
        return null;
    }
}

exports.addAlbum = addAlbum;
exports.addQuery = addQuery;
exports.checkQuery = checkQuery;