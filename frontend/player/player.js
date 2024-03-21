let p_track_list;
let p_track;

document.addEventListener("player", (event) => {
  switch(event.detail.action){
    case "loadAlbum": loadAlbum(event.detail.data); break;
    case "setTrack": setTrack(event.detail.data); break;
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
    default: break;
  }
}

function nextSong(){
  p_track = p_track == p_track_list[p_track_list.length - 1] ? setTrack(0) : setTrack(p_track.number);
}

function prevSong(){
  p_track = p_track == p_track_list[0] ? setTrack(p_track_list.length - 1) : setTrack(p_track.number - 2);
}

let track_playing = null;
let track_time = 0;
let track_pos = 0;

function setTime(event){
  const click_pos_ratio = event.offsetX / p_scr_bar.offsetWidth;
  track_time = (p_track.length/1000) * click_pos_ratio;
  track_pos = 100 * click_pos_ratio;
  p_start.innerHTML = dayjs(0).second(track_time).format("mm:ss");
  p_progress.style.width = `${track_pos}%`;
  moveProgress();
}

function setTrack(track_num, autoplay = true){
  p_track = p_track_list[track_num];

  const p_titles = document.getElementsByClassName("p-title");
  for(let i = 0; i < p_titles.length; i++){
    p_titles[i].innerHTML = `Disc ${p_track.disc} | Track ${p_track.number} | ${p_track.name}`;
  }
  
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
  updatePlayButton();
}

function playTrack(){
  if(p_play.children[0].alt == "play"){
    if(track_time == 0){ moveProgress(); }
    track_playing = setInterval(moveProgress, 1000);
  }else{
    stopTrack();
  }

  sendEvent(updateJS, {script: "player", track_num: p_track_list.indexOf(p_track)});
  updatePlayButton();
}

function updatePlayButton(){
  const button_img = p_play.children[0];
  button_img.alt = track_playing ? "pause" : "play";
  button_img.src = `/player/${button_img.alt}.svg`;
}

function moveProgress(){
  if(track_pos >= 100 || track_time >= p_track.length / 1000){
    clearInterval(track_playing);
    p_progress.style.width = "100%";
    p_start.innerHTML = dayjs(p_track.length, "sss").format("mm:ss");
    nextSong();
  }else{
    track_pos = 100 * (track_time / (p_track.length/1000));
    p_progress.style.width = `${track_pos}%`;
    p_start.innerHTML = dayjs(0).second(track_time).format("mm:ss");
    track_time ++;
  }
}

async function loadAlbum(load_album){
  if(album_player.innerHTML.length == 0){
    await fetch(`/player/player.html`).then(async(response) => {
      album_player.innerHTML = await response.text();
      album_player.addEventListener("click", playerUpdate);
    });
  }

  if(load_album){
    p_track_list = load_album.track_list;
    setTrack(0, false);
  }
}