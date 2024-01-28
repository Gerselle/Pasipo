const pg = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
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
      `INSERT INTO album(id, name, image, url, genres)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`;
    await client.query(album_query, [album.id, album.name, album.image, album.url, album.genres]);

    album.track_list.forEach(async(track) =>{
        const track_query =
        `INSERT INTO track(id, album_id, name, url, length, disc, number) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`;
        await client.query(track_query, [track.id, album.id, track.name, track.url, track.length, track.disc, track.number]);
    });

    album.artists.forEach(async(artist) => {
        const artist_query = 
            `INSERT INTO artist(id, name, image, url, genres)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`;        
        await client.query(artist_query, [artist.id, artist.name, artist.image, artist.url, artist.genres]); 

        const joint_id = artist.id + album.id;   
        await client.query('INSERT INTO artist_albums(joint_id, artist_id, album_id) VALUES ($1, $2, $3) ON CONFLICT (joint_id) DO NOTHING', [joint_id, artist.id, album.id]);
    });

    await client.release();
}

async function addQuery(album_query, album_id){
    const client = await pool.connect();
    await client.query('INSERT INTO album_search(query, album_id) VALUES ($1, $2) ON CONFLICT (query) DO NOTHING', [album_query, album_id])
    await client.release();
}

async function checkQuery(album_query){
    const client = await pool.connect();
    try{    
        const album_id = (await client.query('SELECT * FROM album_search WHERE query = $1', [album_query])).rows[0].album_id;
        album = (await client.query(`SELECT * FROM album WHERE id = $1`, [album_id])).rows[0];
        const artist_query = 
          `SELECT artist.*
           FROM artist
           JOIN artist_albums ON artist.id = artist_albums.artist_id
           WHERE artist_albums.album_id = $1`;
        album["artists"] = (await client.query(artist_query, [album_id])).rows;
        album["track_list"] = tracklist = (await client.query(`SELECT * FROM track WHERE album_id = $1`, [album_id])).rows;
        await client.release();
        return album;
    }catch(error){
        console.log(error);
        await client.release();
        return null;
    }
}

exports.addAlbum = addAlbum;
exports.addQuery = addQuery;
exports.checkQuery = checkQuery;