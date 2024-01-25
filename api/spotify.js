
const dotenv = require('dotenv');
dotenv.config();

const pasipo_id = process.env.client_id;
const pasipo_secret = process.env.client_secret;
const redirect_uri = process.env.redirect_uri;

let pasipo = null;

// Uses Spotify api to first find a album result with the given query, returns early with null if no album is found
// If an album is found, returns a json object of various album data (search_result), which includes an album tracklist
async function albumSearch(album_query){
  if(pasipo == null || pasipo.expiry_time < Math.floor(Date.now() / 1000 )){
    pasipo = await authorize(null);
  }
  
  // Search for a single album
  const album_response = 
    await fetch(`https://api.spotify.com/v1/search?query=${album_query}&type=album`, 
      { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pasipo.access_token}`}
      });

  spotify_albums = await(await album_response.json());

  // Empty query or no albums found
  if(spotify_albums.error || !spotify_albums.albums.items.length){ 
    return null;
  }

  album = spotify_albums.albums.items[0];
  
  let artists = [];
  album.artists.forEach((artist) => artists.push({"name": artist.name, "id": artist.id}))

  const genre_response = await 
    fetch(`https://api.spotify.com/v1/artists/${album.artists[0].id}`,
      { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pasipo.access_token}`}
      });
  genres = (await (await genre_response.json())).genres;

  spotify_track_list = await tracklist(album.id, pasipo.access_token);
  let track_list = [];

  spotify_track_list.forEach((track) => {
    track_info = {
      "name": track.name,
      "id": track.id,
      "length": track.duration_ms, 
      "disc": track.disc_number, 
      "number": track.track_number
    };
    track_list.push(track_info);
  });

  search_result = { 
      "name": album.name,
      "id": album.id,  
      "url": album.external_urls["spotify"], 
      "cover": album.images[0].url,
      "popularity": album.popularity,
      "artists": artists,
      "genres": genres,
      "track_list": track_list
  };

  return search_result;
}

// Uses Spotify api to find the first 50 tracks of album_id, then loops through nesting "next" urls if they exist; returns the resulting track_list
async function tracklist(album_id){
  const response = await fetch(`https://api.spotify.com/v1/albums/${album_id}/tracks?limit=50`, 
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${pasipo.access_token}`
    }
  });

  result = await response.json();
  track_list = [];
  result.items.forEach((track) => {track_list.push(track)});

  if(result.next){
    while(result.next){
      const response = await fetch(result.next, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pasipo.access_token}`}
        });
      result = await response.json();
      result.items.forEach((track) => {track_list.push(track)});
    }
  }

  return track_list;
}

// Uses the Spotify api to obtain a new OAuth token
// A non null auth_code returns an "authorization code" token (user)
// A null auth_code returns a "client credential" token (pasipo)
async function authorize(auth_code){
  request = { 
      method: 'POST',        
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(pasipo_id + ':' + pasipo_secret).toString('base64'))
      }
    }

  if(auth_code){
    request.body = `grant_type=authorization_code&code=${auth_code}&redirect_uri=${redirect_uri}`;
  }else{
    request.body = `grant_type=client_credentials`;
  }
  
  const response = await fetch("https://accounts.spotify.com/api/token", request);
  token = await response.json();

  token["expiry_time"] = Math.floor(Date.now() / 1000) + token.expires_in - 10;

  return token;
}

exports.albumSearch = albumSearch;
exports.authorize = authorize;
