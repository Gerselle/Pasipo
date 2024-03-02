const pg = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');
dotenv.config();


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
    const file = fs.readFileSync('backend/api/init.sql').toString();
    await client.query(file);
    client.release();
}

initialize(); 

async function query(query, values){
    return new Promise(async (resolve, reject) => {
        const client = await pool.connect();
        try{
            const response = await client.query(query, values);
            resolve(response);
        }catch(error){
            resolve({error: error});
        }
        client.release();
    });
}

// Pasipo Database
async function addAlbum(album){

    const album_query = 
      `INSERT INTO albums(id, name, image, url, artists, genres, track_list)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`;

    const album_values = [   
            album.id, 
            album.name,
            album.image,
            album.url,
            album.artists,
            album.genres, 
            album.track_list];
    
    query(album_query, album_values);

}

async function getAlbum(album_id){
    const album = await query("SELECT * FROM albums WHERE id=$1", [album_id]);
    return album.rows[0];
}

// User daily album info
async function pullUserAlbums(user){
    const albums = await query("SELECT * FROM pasipo WHERE user_id = $1", [user.user_id]);
    return albums.rows;
}

async function addUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album addition."}; }
    if(!data.album_id){ return {error: "No album provided for user album addition."}; }
    query('INSERT INTO pasipo(user_id, date, album_id) VALUES ($1, $2, $3)', [user.user_id, data.date, data.album_id]);
}

async function updateUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album update."}; }
    if(!data.album_id){ return {error: "No album provided for user album update."}; }
    deleteUserAlbum(user, data);
    addUserAlbum(user, data);
}

async function deleteUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album deletion."}; } 
    query('DELETE FROM pasipo WHERE user_id=$1 AND date=$2', [user.user_id, data.date]);
}

// User Authorization
async function hashPassword(pass_word, salt, length){
    return new Promise((resolve, reject) => {
        crypto.scrypt(pass_word, salt, length, async (err, hashed_pass_word) => {
            if(err) reject(err);
            else resolve(hashed_pass_word);
        });
    });
}

async function signup(user_name, pass_word, pass_confirm){
    user_name = user_name.toLowerCase();
    if(pass_word !== pass_confirm){
        return {error: "Passwords do not match, please try again."}
    }
    
    const salt = crypto.randomBytes(16);

    const hashed_pass_word = await hashPassword(pass_word, salt, 64);

    const signup = await query('INSERT INTO users(user_name, hashed_pass_word, salt) VALUES ($1, $2, $3)',
                        [user_name, hashed_pass_word, salt]);

    if(signup.error){
        return {error: `Username is already taken, please enter another.`}
    }

    const user = await login(user_name, pass_word);
    return user;

}

async function login(user_name, pass_word){ 
    user_name = user_name.toLowerCase();
    const users = await query('SELECT * FROM users WHERE user_name = $1', [user_name]);
    const user = users.rows[0];

    if(user){
        const hashed_pass_word = await hashPassword(pass_word, user.salt, 64);
        if(crypto.timingSafeEqual(hashed_pass_word, user.hashed_pass_word)){
            return user;
        }else{
            return {error: `Password is incorrect, please try again.`};
        }
    }else{
        return {error: `User ${user_name} not found.`};
    }
    
}

module.exports = {
    pool, 
    addAlbum, getAlbum,
    pullUserAlbums, addUserAlbum, updateUserAlbum, deleteUserAlbum,
    query, signup, login
};
