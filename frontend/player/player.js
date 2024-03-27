let player;
let playerInterval;
let updateInterval;
let p_track_list;
let p_track;
let p_album;
let musicEvent;

document.addEventListener("player", (event) => {
  switch(event.detail.action){
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
  if(state){
    p_track = p_track_list[state.track_id];

    // Change play button
    const button_img = p_play.children[0];
    button_img.alt = state.track_playing ? "pause" : "play";
    button_img.src = `/player/${button_img.alt}.svg`;

    // Update start/end times of current track, and the progress bar itself
    p_progress.style.width = `${100 * state.time_pos/state.time_end}%`;
    p_start.innerHTML = dayjs(state.time_pos).format("mm:ss");
    p_end.innerHTML = dayjs(state.time_end).format("mm:ss");

    // Update title on the progress bar
    if(p_track){
      p_title.innerHTML = `Disc ${p_track.disc} | Track ${p_track.number} | ${p_track.name}`;
      sendEvent(updateJS, {script: "player", track_id: state.track_id});
    }else{
      p_title.innerHTML = `Remotely playing: ${state.track_name} by ${state.artist_name}`;
    }
  }
}

const playTrack = throttle(()=>{ sendEvent(musicEvent, {action: "play"}); }, 500);
const nextSong = throttle(()=>{ sendEvent(musicEvent, {action: "next"}); }, 500);
const prevSong = throttle(()=>{ sendEvent(musicEvent, {action: "prev"}); }, 500);

function setTime(event){
  const click_pos_ratio = event.offsetX / p_scr_bar.offsetWidth;
  const track_time = Math.floor(p_track.length * click_pos_ratio);
  sendEvent(musicEvent, {action: "seek", seek: track_time});
}

function setTrack(track_num, autoplay = true){
  sendEvent(musicEvent, {action: "load", album_id: p_album.id, track_pos: track_num});
  sendEvent(musicEvent, {action: "pause"});
  if(autoplay) { sendEvent(musicEvent, {action: "resume"}); }
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
  sendEvent(musicEvent, {action: "volume", volume: parseFloat(current_volume / 3)});
}

function toggleVolume(){
  current_volume = current_volume == 0 ? parseFloat(localGet("volume")): 0;
  sendEvent(musicEvent, {action: "volume", volume: parseFloat(current_volume / 3)});
}

function trackVolume(event){
  setVolume(event);
  window.addEventListener('mousemove', setVolume);
}

function sendVolume(){
  window.removeEventListener('mousemove', setVolume);
  updateVolume();
  sendEvent(musicEvent, {action: "volume", volume: parseFloat(localGet("volume") / 3)});
}

function updateVolume(){
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
    docId("album_player").style.display = "flex";
  }

  if(!p_album) { p_album = load_album }

  if(load_album){
    p_track_list = {};
    load_album.track_list.forEach(track => {
      p_track_list[track.id] = track;
    });

    current_volume = parseFloat(localGet("volume")) || 0.5;

    if(p_album.id != load_album.id){
      p_album = load_album;
      sendEvent(musicEvent, {action: "load", album_id: p_album.id, track_pos: 0});
    }
  }
}

window.onbeforeunload = function()
{ 
    console.log("Clearing Player")
    if(player){ sendEvent(musicEvent, {action: "disconnect"}); }
    if(playerInterval) { clearInterval(playerInterval); }
    if(updateInterval) { clearInterval(updateInterval); }
};

// Spotify functions
window.onSpotifyWebPlaybackSDKReady = async () =>{

  const user = JSON.parse(sessionGet("current_user"));
  if(!user || !user.user_id || (user.service != "spotify")){ return; }

  const loadSpotifyPlayer = async () => {
    if (player && player != "create") { await player.disconnect() };
    const response = await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/token/spotify`);
    const token = await response.json();
    player = new Spotify.Player({
      name: 'Paispo Web Player',
      getOAuthToken: cb => { cb(token.access_token); },
      volume: parseFloat(localGet("volume")) / 3 || 0.25
    });

    player.addListener('ready', ({ device_id }) => {
      fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/loadplayer/spotify/${device_id}`)
        .then(console.log('Ready with Device ID', device_id));
    });

    player.connect();
  }

  const updateState = async () => {
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
  }

  await function loadSpotifyTrack(album_id, track_pos = 0){
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/loadtrack/spotify/${album_id}/${track_pos}`);
  }

  musicEvent = new CustomEvent("spotify", {detail: {action : ""}});

  document.addEventListener("spotify", async (event) => {
    if(!player){
      player = "create";
      await loadSpotifyPlayer();
      if(playerInterval){ clearInterval(playerInterval); }
      playerInterval = setInterval(loadSpotifyPlayer, 1000 * 60 * 59);
    }

    if(player == "create") { return; }

    switch(event.detail.action){
      case "load":
        p_progress.style.width = "0%";
        p_start.innerHTML = "00:00"
        p_end.innerHTML = dayjs(p_album.track_list[0].length).format("mm:ss");
        const album_id = event.detail.album_id;
        const track_pos = event.detail.track_pos;
        await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/loadtrack/spotify/${album_id}/${track_pos}`);
      break;
      case "play": await player.togglePlay(); break;
      case "next": await player.nextTrack(); break;
      case "prev": await player.previousTrack(); break;
      case "pause": await player.pause(); break;
      case "resume": await player.resume(); break;
      case "seek": await player.seek(event.detail.seek); break;
      case "volume": await player.setVolume(event.detail.volume); break;
      case "disconnect": player.disconnect(); break;
    }
    updateState();
    if(!updateInterval){ updateInterval = setInterval(updateState, 1000)}
  });
}