async function albumSearch(album_query, token){
  access_token = token;

  // Search for a single album
  const album_response = 
    await fetch(`https://api.spotify.com/v1/search?query=${album_query}&type=album`, { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`}
      });

  spotify_albums = await (await album_response.json());
  if(spotify_albums.error || !spotify_albums.albums.total){ // Empty query or no albums found
    return null;
  }

  album = spotify_albums.albums.items[0];

  // Tracklist of found album
  spotify_track_list = await tracklist(album.id, access_token);
  let track_list = [];

  spotify_track_list.forEach((track) => { 
      track_info = {
        "length": track.duration_ms, 
        "id": track.id, 
        "name": track.name, 
        "number": track.track_number
      };
      track_list.push(track_info);
    });

  // Genre of album's artist
  const genre_response = await 
    fetch(`https://api.spotify.com/v1/artists/${album.artists[0].id}`,{ 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`}
      });

  genres = (await (await genre_response.json())).genres;

  // Return json of album info
  search_result = { 
      "url": album.external_urls["spotify"], 
      "name": album.name, 
      "cover": album.images[0].url, 
      "artist": album.artists[0].name, 
      "genres": genres.slice(0,3), 
      "track_list": track_list
    };

  return search_result;
}

async function tracklist(album_id, access_token){
  // Grab first 50 tracks of album, then loop through nesting urls if they exist
  const response = await fetch(`https://api.spotify.com/v1/albums/${album_id}/tracks?limit=50`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`
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
            'Authorization': `Bearer ${access_token}`}
        });
      result = await response.json();
      result.items.forEach((track) => {track_list.push(track)});
    }
  }

  return track_list;
}

exports.albumSearch = albumSearch;
