let p_track_list;
let p_track;
let p_album;
let musicEvent;

document.addEventListener("player", (event) => {
  switch(event.detail.action){
    case "loadAlbum": loadAlbum(event.detail.data); break;
    case "setTrack": setTrack(event.detail.data); break;
    case "updatePlayer": updatePlayer(); break;
    default: break;
  }

  playerEvent.detail.action = null;
  playerEvent.detail.data = null;
});

function playerUpdate(event){
  const target = event.target.closest('[id]');
  switch(target){
    case p_play: playTrack(); break;
    case p_next: nextSong(); break;
    case p_prev: prevSong(); break;
    case p_scr_bar: setTime(event); break;
    case p_progress: setTime(event); break;
    case p_volume: toggleVolume(); break;
    default: break;
  }
}

function updatePlayer(state){
  if(state){
    // Change play button
    const button_img = p_play.children[0];
    button_img.alt = state.track_playing ? "pause" : "play";
    button_img.src = `/player/${button_img.alt}.svg`;

    // Update start/end times of current track, and the progress bar itself
    console.log(state.time_pos/state.time_end)
    p_progress.style.width = `${state.time_pos/state.time_end}%`;
    p_start.innerHTML = dayjs(state.time_pos).format("mm:ss");
    p_end.innerHTML = dayjs(state.time_end).format("mm:ss");

    // Update title on the progress bar
    if(p_album === state.album_id){
      p_track = p_track_list[p_track_ids.indexOf(state.id)]; 
      p_title.innerHTML = `Disc ${p_track.disc} | Track ${p_track.number} | ${p_track.name}`;
    }else{
      p_title.innerHTML = `Remotely playing: ${state.track_name} by ${state.artist_name}`;
    }
  }
}

// Both move through the tracklist, handling instances where the last song is moving to the first and vice versa.
// The p_track is updated to whatever track the tracklist moved to, and both functions are throttled to prevent spamming.
const nextSong = throttle(()=>{
  p_track = p_track == p_track_list[p_track_list.length - 1] ? setTrack(0) : setTrack(p_track_list.indexOf(p_track) + 1);
  sendEvent(musicEvent, {action: "next"});
}, 500);

const prevSong = throttle(()=>{
  p_track = p_track == p_track_list[0] ? setTrack(p_track_list.length - 1) : setTrack(p_track_list.indexOf(p_track) - 1);
  sendEvent(musicEvent, {action: "prev"});
}, 500);

let track_playing = null;
let track_time = 0;
let track_pos = 0;

function setTime(event){
  const click_pos_ratio = event.offsetX / p_scr_bar.offsetWidth;
  track_time = (p_track.length/1000) * click_pos_ratio;
  track_pos = 100 * click_pos_ratio;
  p_start.innerHTML = dayjs(0).second(track_time).format("mm:ss");
  p_progress.style.width = `${track_pos}%`;
  updateProgress();
}

function updateProgress(){
  if(track_pos >= 100 || track_time >= p_track.length / 1000){
    clearInterval(track_playing);
    p_progress.style.width = "100%";
    p_start.innerHTML = dayjs(p_track.length, "sss").format("mm:ss");
  }else{
    track_pos = 100 * (track_time / (p_track.length/1000));
    p_progress.style.width = `${track_pos}%`;
    p_start.innerHTML = dayjs(0).second(track_time).format("mm:ss");
    track_time ++;
  }
}

function setTrack(track_num, autoplay = true){
  p_track = p_track_list[track_num];
  
  p_start.innerHTML = "00:00";
  p_end.innerHTML = dayjs(p_track.length, "sss").format("mm:ss");
  stopTrack(true);
  if(autoplay) { playTrack(); }
  return p_track;
}

function stopTrack(reset = false){
  if(reset){
    p_start.innerHTML = "00:00";
    track_time = 0;
    track_pos = 0;
    p_progress.style.width = `${track_pos}%`;
  }

  clearTimeout(track_playing);
  track_playing = null;
  sendEvent(musicEvent, {action: "pause"});
}

function playTrack(){

  if(p_play.children[0].alt == "play"){
    if(track_time == 0){ updateProgress(); }
    track_playing = setInterval(updateProgress, 1000);
  }else{
    stopTrack();
  }

  sendEvent(musicEvent, {action: "resume"});
  sendEvent(updateJS, {script: "player", track_num: p_track_list.indexOf(p_track)});
}

let current_volume;
function setVolume(event){
  const vol_bar = p_vol_bar.getBoundingClientRect();

  switch(true){
    case (event.clientX < vol_bar.left): current_volume = 0; break;
    case (event.clientX > vol_bar.right): current_volume = 1; break;
    default: current_volume = (event.clientX - vol_bar.left) / vol_bar.width;
  }
  
  localSet("volume", (current_volume));
  updateVolume();
}

function toggleVolume(){
  current_volume = current_volume == 0 ? parseFloat(localGet("volume")): 0;
  sendVolume();
}

function trackVolume(event){
  setVolume(event);
  window.addEventListener('mousemove', setVolume);
}

function sendVolume(){
  window.removeEventListener('mousemove', setVolume);
  updateVolume(current_volume);
  sendEvent(musicEvent, {action: "volume"});
}

function updateVolume(set_vol = false){
  if(set_vol){ localSet("volume", set_vol); }

  const button_img = p_volume.children[0];
  let vol_img = "vol0";

  switch (true){
    case (current_volume > 0.66): vol_img = "vol3"; break;
    case (current_volume > 0.33): vol_img = "vol2"; break;
    case (current_volume > 0): vol_img = "vol1"; break;
  }
  button_img.src = `/player/${vol_img}.svg`;
  p_vol_dot.style.left = `${Math.floor(100 * current_volume)}%`;
}

async function loadAlbum(load_album){
  if(album_player.innerHTML.length == 0){
    await fetch(`/player/player.html`).then(async(response) => {
      album_player.innerHTML = await response.text();
      album_player.addEventListener("click", playerUpdate);
      p_vol_bar.addEventListener("mousedown", trackVolume);
      window.addEventListener('mouseup', sendVolume);
    });
  }

  if(load_album){
    p_track_list = load_album.track_list; 
    for(let i = 0; i < p_track_list.length; i++){
      p_track_ids[i] = p_track_list[i];
    }
    current_volume = parseFloat(localGet("volume")) || 0.5;
    setTrack(0, false);
    if(p_album !== load_album.id){
      p_album = load_album.id;
      sendEvent(musicEvent, {action: "load", album_id: load_album.id});
      sendEvent(musicEvent, {action: "pause"});
    }
  }
}

// Spotify functions
window.onSpotifyWebPlaybackSDKReady = async () =>{
  let device;
  const response = await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/token`);
  const token = await response.json();
  const player = new Spotify.Player({
    name: 'Paispo Web Player',
    getOAuthToken: cb => { cb(token.access_token); },
    volume: parseFloat(localGet("volume")) / 3 || 0.25
  });

  musicEvent = new CustomEvent("spotify", {detail: {action : ""}});

  document.addEventListener("spotify", (event) => {
    switch(event.detail.action){
      case "load": loadSpotifyAlbum(event.detail.album_id); break;
      case "play": player.togglePlay(); break;
      case "next": player.nextTrack(); break;
      case "prev": player.previousTrack(); break;
      case "pause": player.pause(); break;
      case "resume": player.resume(); break;
      case "volume": player.setVolume(parseFloat(localGet("volume")) / 3); break;
    }
    player.getCurrentState().then((state) => {
      if(!state){ return; }

      const player_state = {
        music_service: "spotify",
        track_playing: !state.paused,
        time_pos : state.position,
        time_end : state.duration,
        track_name : state.track_window.current_track.name,
        track_id: state.track_window.current_track.id,
        artist_name: state.track_window.current_track.artists[0].name,
        album_id: state.track_window.current_track.album.uri.split(":")[2]
      }

      updatePlayer(player_state);
    });
  });

  function loadSpotifyAlbum(album_id){
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/load/${album_id}`);
  }

  player.addListener('ready', ({ device_id }) => {
    device = device_id; 
    console.log('Ready with Device ID', device_id);
  });
  
  player.addListener('not_ready', ({ device_id }) => {
    console.log('Device ID has gone offline', device_id);
  });
  
  player.addListener('initialization_error', ({ message }) => {
    console.error(message);
  });

  player.addListener('authentication_error', ({ message }) => {
      console.error(message);
  });

  player.addListener('account_error', ({ message }) => {
      console.error(message);
  });

  player.connect();
}