
const dotenv = require('dotenv');
dotenv.config();

const pasipo_id = process.env.client_id;
const pasipo_secret = process.env.client_secret;
const redirect_uri = process.env.redirect_uri;

let pasipo = null;


async function albumSearch(album_query){
  if(pasipo == null || pasipo.expiry_time < Math.floor(Date.now() / 1000 )){
    pasipo = await authorize(null);
  }
  
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
  for(const album_artist of album.artists){
    const artist_response = await fetch(`https://api.spotify.com/v1/artists/${album_artist.id}`,
    { 
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pasipo.access_token}`}
    });

    spotify_artist = await(await artist_response.json());

    artist_info = {
      "id": spotify_artist.id,
      "name": spotify_artist.name,
      "image": spotify_artist.images[0].url,
      "url": spotify_artist.external_urls["spotify"],
      "genres": spotify_artist.genres
    };
    artists.push(artist_info);
  };

  spotify_track_list = await tracklist(album.id, pasipo.access_token);
  let track_list = [];

  spotify_track_list.forEach((track) => {
    track_info = {
      "id": track.id,
      "name": track.name,
      "url": track.external_urls["spotify"],
      "length": track.duration_ms, 
      "disc": track.disc_number, 
      "number": track.track_number
    };
    track_list.push(track_info);
  });

  search_result = { 
      "id": album.id,
      "name": album.name,
      "image": album.images[0].url,
      "url": album.external_urls["spotify"],
      "artists": artists,
      "genres": artists[0].genres,
      "track_list": track_list
  };
  return search_result;
}


async function tracklist(album_id){
  const response = await fetch(`https://api.spotify.com/v1/albums/${album_id}/tracks?limit=50`, 
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${pasipo.access_token}`
    }
  });

  let result = await response.json();
  let track_list = result.items;

  if(result.next){
    while(result.next){
      const response = await fetch(result.next, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pasipo.access_token}`}
        });
      result = await response.json();
      track_list = track_list.concat(result.items);
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
