let player; // Service player
let player_interval; // Refreshes player token
let p_track_list;
let p_track;
let p_album;
let musicEvent;
let progress_interval; // Keeps progress bar in sync with service player
let progress = {time_pos: 0, time_end: 0};

document.addEventListener("player", async (event) => {
  switch(event.detail.action){
    case "start" :
      await fetch(`/player/player.html`).then( async(response) => {
        album_player.innerHTML = await response.text();
        album_player.addEventListener("click", playerUpdate);
        p_vol_bar.addEventListener("mousedown", trackVolume);
        window.addEventListener('mouseup', sendVolume);
      });
      sendEvent(musicEvent, {action: "start"});
    break;
    case "loadAlbum": loadAlbum(event.detail.data); break;
    case "setTrack": setTrack(event.detail.data); break;
    default: break;
  }
});

function playerUpdate(event){
  const target = event.target.closest('[id]');
  switch(target){
    case p_play: playTrack(); break;
    case p_next: nextSong(); break;
    case p_prev: prevSong(); break;
    case p_scr_bar: setTime(event); break;
    case p_title: setTime(event); break;
    case p_volume: toggleVolume(); break;
    default: break;
  }
}

function updatePlayer(state){
  if(!state){ return; }

  // State will always update time, but the progress bar only updates if a track
  // is playing to keep sync with the actual music service web player
  progress = {time_pos: state.time_pos, time_end: state.time_end };
  updateProgress();
  if(progress_interval){ clearInterval(progress_interval); }
  if(state.track_playing){ progress_interval = setInterval(updateProgress, 1000); }
  
  // Update the player's title based on if the user is looking at the album that the 
  // playing track is from. Also update the content's DOM if needed.
  p_track = p_track_list[state.track_id];
  if(p_track){
    p_title.innerHTML = `Disc ${p_track.disc} | Track ${p_track.number} | ${p_track.name} | ${state.album_name}`;
    sendEvent(updateJS, {script: "player", track_id: state.track_id});
  }else{
    p_title.innerHTML = `Remotely playing: ${state.track_name} by ${state.artist_name} | ${state.album_name}`;
  }

  // Play button image update
  const play_img = p_play.children[0];
  play_img.alt = state.track_playing ? "pause" : "play";
  play_img.src = `/player/${play_img.alt}.svg`;

  updateVolume();
}

function updateProgress(){
  const current = progress.time_pos; 
  const end = progress.time_end;

  p_progress.style.width = (current < end) ?  `${100 * current/end}%` : "100%";
  progress.time_pos = (current + 1000 < end) ? current + 1000 : end;

  p_start.innerHTML = dayjs(current).format("mm:ss");
  p_end.innerHTML = dayjs(end).format("mm:ss");
}


const playTrack = throttle(()=>{ sendEvent(musicEvent, {action: "play"}); }, 500);
const nextSong = throttle(()=>{ sendEvent(musicEvent, {action: "next"}); }, 500);
const prevSong = throttle(()=>{ sendEvent(musicEvent, {action: "prev"}); }, 500);

function setTime(event){
  const click_pos_ratio = event.offsetX / p_scr_bar.offsetWidth;
  const seek_time = Math.floor(progress.time_end * click_pos_ratio);
  sendEvent(musicEvent, {action: "seek", seek: seek_time});
}

function setTrack(track_num){
  sendEvent(musicEvent, {action: "load", album_id: p_album.id, track_pos: track_num});
}

let current_volume;

function setVolume(event){
  const vol_bar = p_vol_bar.getBoundingClientRect();

  switch(true){
    case (event.clientX < vol_bar.left): current_volume = 0; break;
    case (event.clientX > vol_bar.right): current_volume = 1; break;
    default: current_volume = (event.clientX - vol_bar.left) / vol_bar.width;
  }
  
  localSet("volume", current_volume);
  updateVolume();
}

function toggleVolume(){
  current_volume = current_volume == 0 ? parseFloat(localGet("volume")) : 0;
  updateVolume();
}

function trackVolume(event){
  setVolume(event);
  window.addEventListener('mousemove', setVolume);
}

function sendVolume(){
  window.removeEventListener('mousemove', setVolume);
  sendEvent(musicEvent, {action: "volume", volume: current_volume});
}

function updateVolume(){
  const volume_img = p_volume.children[0];
  let vol_num = "vol0";

  switch (true){
    case (current_volume > 0.66): vol_num = "vol3"; break;
    case (current_volume > 0.33): vol_num = "vol2"; break;
    case (current_volume > 0): vol_num = "vol1"; break;
  }

  volume_img.src = `/player/${vol_num}.svg`;
  p_vol_dot.style.left = `${Math.floor(100 * current_volume)}%`;
}

async function loadAlbum(load_album){
  current_volume = parseFloat(localGet("volume")) || 0.25;

  if(!p_album || p_album.id != load_album.id){
    p_album = load_album;
    p_track = load_album.track_list[0];
    p_track_list = {};
    load_album.track_list.forEach(track => {
      p_track_list[track.id] = track;
    });

    if(player){ sendEvent(musicEvent, {action: "update"}); }
  }
}

window.onbeforeunload = function()
{ 
    if(player){ sendEvent(musicEvent, {action: "disconnect"}); }
    if(player_interval){ clearInterval(player_interval); }
    if(progress_interval){ clearInterval(progress_interval); }
};

// Spotify functions
window.onSpotifyWebPlaybackSDKReady = async () =>{

  const loadSpotifyPlayer = async () => {
    if(player){ await player.disconnect() };
    const response = await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/token/spotify`);
    const token = await response.json();
    player = new Spotify.Player({
      name: 'Paispo Web Player',
      getOAuthToken: cb => { cb(token.access_token); },
      volume: parseFloat(localGet("volume")) / 3 || 0.25
    });

    player.addListener('ready', ({ device_id }) => {
      fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/loadplayer/spotify/${device_id}`)
    });

    player.addListener('player_state_changed', (state) => updateSpotifyPlayer(state));

    player.on('initialization_error', ({ message }) => {
      console.error('Failed to initialize', message);
    });
  
    player.on('authentication_error', () => {
      console.error('Failed to authenticate', message);
      loadSpotifyPlayer();
    });
  
    player.on('account_error', ({ message }) => {
      console.error('Failed to validate Spotify account', message);
    });
  
    player.on('playback_error', ({ message }) => {
      console.error('Failed to perform playback', message);
      loadSpotifyPlayer();
    });

    player.connect();
  }

  function updateSpotifyPlayer(state){
    const current_track = state.track_window.current_track;
    const player_state = {
      music_service: "spotify",
      track_playing: !state.paused,
      time_pos : state.position,
      time_end : state.duration,
      track_name : current_track.name,
      track_id: current_track.id,
      artist_name: current_track.artists[0].name,
      album_id: current_track.album.uri.split(":")[2],
      album_name: current_track.album.name,
      album_image: current_track.album.images[0]
    }
    updatePlayer(player_state);
  }

  function loadSpotifyTrack(album_id, track_pos){
     fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/loadtrack/spotify/${album_id}/${track_pos}`);
  };

  musicEvent = new CustomEvent("spotify", {detail: {}});

  document.addEventListener("spotify", async (event) => {
    const user = JSON.parse(sessionGet("current_user"));
    if(!user || !user.user_id || (user.active_token != "spotify")){ return; }

    switch(event.detail.action){
      case "start": 
        await loadSpotifyPlayer();
        if(player_interval){ clearInterval(player_interval); }
        player_interval = setInterval(loadSpotifyPlayer, 1000 * 60 * 59); // Reload player every 59 mins
      break;
      case "load": loadSpotifyTrack(event.detail.album_id, event.detail.track_pos); break;
      case "play": player.togglePlay(); break;
      case "next": player.nextTrack(); break;
      case "prev": player.previousTrack(); break;
      case "pause": player.pause(); break;
      case "resume": player.resume(); break;
      case "seek": player.seek(event.detail.seek); break;
      // Spotify's webplayer doesn't do sound normalization, so audio can be REALLY loud at 1, we reduce the sound with division
      case "volume": player.setVolume(event.detail.volume / 3); break; 
      case "update": player.getCurrentState().then((state) => updateSpotifyPlayer(state)); break;
      case "disconnect": player.disconnect(); break;
    }
  });
}