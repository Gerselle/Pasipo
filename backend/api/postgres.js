const pg = require("pg");
const fs = require("fs");
const dotenv = require("dotenv");
const crypto = require("crypto");
const dayjs = require("dayjs");
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
    const file = fs.readFileSync("backend/api/init.sql").toString();
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
    return album.rows.length > 0 ? album.rows[0] : {error: `No album found for id ${album_id}.`};
}

// Album/rating info of another user
async function getViewedUser(viewed_user, current_user){

    if(viewed_user === current_user){
        return {is_current_user: true, user_name: viewed_user};
    }

    const user_check = await query("SELECT * from users WHERE user_name = $1", [viewed_user]);
    if(user_check.rows.length != 0){
        const found_user = user_check.rows[0];
        const found_albums = await pullUserAlbums(found_user);
        const found_ratings = await pullUserRatings(found_user);
        const viewed_albums = {};
        const viewed_ratings = {};

        found_albums.forEach(found_album => {
            viewed_albums[dayjs(found_album.date).format("MMM DD, YYYY")] = found_album.album_id; 
        });

        found_ratings.forEach(found_rating => {
            viewed_ratings[found_rating.album_id] = found_rating.rating;
        });

        return {user_name: viewed_user,
                profile_name: found_user.profile_name,
                albums: viewed_albums,
                ratings: viewed_ratings
                };
    }else{
        return {error: `User "${viewed_user}" does not exist.`};
    }
}

// User daily album info
async function pullUserAlbums(user){
    const albums = await query("SELECT * FROM pasipo WHERE user_id = $1", [user.user_id]);
    return albums.rows;
}

async function pushUserAlbums(user, data){
    if(!data.user_albums){ return {error: "No albums provided for user album push."}; } 
        
    const conflicts = [];

    data.user_albums.forEach(async(album) =>{
        const insert = await addUserAlbum(user, album);
        if(insert.conflict){
            conflicts.push(insert.conflict);
        }
    });

    if(conflicts.length > 0){
        return {error: "One or more local albums had conflicts with remote albums.", conflicts: conflicts};
    }else{
        return {success: `Albums have be pushed with no conflicts.`};
    }
}

async function addUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album addition."}; }
    if(!data.id){ return {error: "No album provided for user album addition."}; }
    const conflict = await query("SELECT album_id FROM pasipo WHERE (user_id, date) = ($1, $2)", [user.user_id, data.date])
        
    if(conflict.rows[0] && conflict.rows[0].album_id !== data.id){
        return {error: `Album already exists for date ${data.date}.`,
                conflict: {date: data.date, local: data.id, remote: conflict.rows[0].album_id}}
    }else{
        await query(`INSERT INTO pasipo(user_id, date, album_id) VALUES ($1, $2, $3)`, [user.user_id, data.date, data.id]);
        return {success: `Album ${data.id} is added for date ${data.date}.`};
    }
}

async function updateUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album update."}; }
    if(!data.id){ return {error: "No album provided for user album update."}; }
    deleteUserAlbum(user, data);
    return addUserAlbum(user, data);
}

async function deleteUserAlbum(user, data){
    if(!data.date){ return {error: "No date provided for user album deletion."}; }
    query("DELETE FROM pasipo WHERE user_id=$1 AND date=$2", [user.user_id, data.date]);
    return {success: `Album is removed for date ${data.date}.`}
}

// User rating info
async function updateUserRating(user, data){
    if(!data.rating){ return {error: "No rating provided for user rating update."}; }
    if(!data.id){ return {error: "No album provided for user rating update."}; }

    old_rating = await query("SELECT * FROM ratings WHERE user_id=$1 AND album_id=$2", [user.user_id, data.id]);
    // album_rating = await query("SELECT rating_sum, rating_amount FROM albums WHERE id=$1", [data.id]);
    // console.log(album_rating);
    if(old_rating){
        rating_change = old_rating[0] - data.rating[0];
        // if(rating_change == 0) { return; } 
        // if(rating_change > 0){

        // }else if(rating_change < 0){

        // }
        query("DELETE FROM ratings WHERE user_id=$1 AND album_id=$2", [user.user_id, data.id]);
    }{
        album_rating = await query("SELECT ")
    }
    query(`INSERT INTO ratings(user_id, album_id, rating) VALUES ($1, $2, $3) ON CONFLICT(user_id, album_id) DO UPDATE SET rating = EXCLUDED.rating;`, [user.user_id, data.id, data.rating]);
    return {success: "Rating updated successfully."};
}

async function pushUserRatings(user, data){
    if(!data.user_ratings){ return {error: "No ratings provided for user ratings push."}; } 
    
    data.user_ratings.forEach(async(user_rating) => {
       updateUserRating(user, user_rating);
    });
}

async function pullUserRatings(user){
    const albums = await query("SELECT * FROM ratings WHERE user_id = $1", [user.user_id]);
    return albums.rows;
}

// User Authorization
async function hashPassword(pass_word, salt, length){
    return new Promise((resolve, reject) => {
        crypto.scrypt(pass_word, salt, length, (err, hashed_pass_word) => {
            resolve(hashed_pass_word);
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

    const signup = await query("INSERT INTO users(user_name, hashed_pass_word, salt, profile_name) VALUES ($1, $2, $3, $4)",
                        [user_name, hashed_pass_word, salt, user_name]);

    if(signup.error){
        return {error: `Username is already taken, please enter another.`}
    }

    return await login(user_name, pass_word);;
}

async function login(user_name, pass_word){ 
    user_name = user_name.toLowerCase();
    const users = await query("SELECT * FROM users WHERE user_name = $1", [user_name]);
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

async function refreshUser(user_id){
    const user = await query("SELECT * FROM users WHERE user_id=$1", [user_id]); 
    return user.rows.length > 0 ? user.rows[0] : {error: `User doesn't exist.`};
}

async function setToken(user_id, token, service){
    const user = await refreshUser(user_id);

    if(user.tokens){
        user.tokens[`${service}`] = token;
    }else{
        user.tokens = {[service] : token}
    }

    await query(`UPDATE users SET tokens = $1 WHERE user_id = $2`, [user.tokens, user_id]);
}

module.exports = {
    pool, 
    addAlbum, getAlbum, getViewedUser,
    pullUserAlbums, pushUserAlbums, 
    addUserAlbum, updateUserAlbum, deleteUserAlbum,
    pullUserRatings, pushUserRatings, updateUserRating,
    query, signup, login, refreshUser,
    setToken
};
