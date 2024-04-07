let VIEWED_USER;
let PLAYING_ROW;
let SELECTED_ALBUM;
let SELECTED_DATE;
let CALENDAR_DATE;
let PRESEARCH = {};

async function start(){
  await dayListeners();
  await parseDayPath();
  if(!CURRENT_USER){ await updateCurrentUser(); }
}

document.addEventListener("update", async (update) => {
  if(update.detail.script === "day"){
    update.detail.start ? start() : await parseDayPath();
  }else if (update.detail.script === "player") {
    const track_id = update.detail.track_id;
    const new_playing_row = album_tracklist.querySelector(`[track_id="${track_id}"]`);
    setPlayingRow(new_playing_row);
  }
})

function setPlayingRow(new_row){
  if( !new_row ) { return; }
  if( PLAYING_ROW ){ PLAYING_ROW.classList.remove("playing"); }
  new_row.classList.add("playing");
  PLAYING_ROW = new_row;
}

docId("album_tracklist").addEventListener("click", async (event) => {
  const row = event.target.closest("tr");
  if(!row){ return; }

  switch(event.target.getAttribute("action")){
    case "save": saveTrack(row); break;
    case "star": starTrack(row); break;
    default: playTrack(row);
  }
});

function saveTrack(row){
  if(!row){ return; }
  const save = row.querySelector(`[action="save"]`);
  if(!save){ return; }

  save.classList.toggle("show");

  console.log(save);
}

function starTrack(row){
  if(!row){ return; }
  const star = row.querySelector(`[action="star"]`);
  if(!star){ return; }

  star.classList.toggle("show");

  console.log(star);
}

function playTrack(row){
  if(!row){ return; }
  const track_index = row.getAttribute("track_index");

  if(CURRENT_USER.active_token){
    setPlayingRow(row);
    sendEvent(playerEvent, {action: "setTrack", data: track_index});
    return;
  }

  if(PLAYING_ROW == row){
    WEBSITE_AUDIO.paused ? WEBSITE_AUDIO.play() : WEBSITE_AUDIO.pause();
    return;
  }

  const preview = SELECTED_ALBUM.track_list[track_index].preview;
  if(!preview){
    displayError(row, "No preview audio available for album.");
    return;
  }

  WEBSITE_AUDIO.volume = 0.25;
  WEBSITE_AUDIO.src = preview;
  WEBSITE_AUDIO.load();
  WEBSITE_AUDIO.play();
  setPlayingRow(row);
}


async function parseDayPath(){
  const path = window.location.pathname;
  let path_user = path.split("/")[1] || "local";
  const path_date = path.substring(path.indexOf("/", 2) + 1);
  const today = dayjs(path_date).isValid() ? dayjs(path_date) : dayjs();
  SELECTED_DATE = today.format("MMM DD, YYYY");
  CALENDAR_DATE = today.startOf('month').format("MMM DD, YYYY");
  SELECTED_ALBUM = await albumOfDate(SELECTED_DATE);
 
  if(path_user === "local"){
    VIEWED_USER = {is_current_user: true, user_name: CURRENT_USER.user_name};
  }else if (!VIEWED_USER || path_user !== VIEWED_USER.user_name){
    await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/viewing/${path_user}`)
          .then(async(response) => {
            let viewed_response = await response.json();
            if(viewed_response.error){
              viewed_response = {user_name: "local", albums: {}, ratings: {}};
              displayError(null, `User ${capitalize(path_user)} not found, redirecting...`);
              setTimeout(() => {
                window.location.pathname = `/local${today.format("/YYYY/M/D")}`
              }, ERROR_LENGTH);
            }
            VIEWED_USER = viewed_response;
          });
  }

  updateAlbum();
  updateCalendar();
}

function dayListeners(){
  // Handler for clicking on calendar dates
  docId("calendar").addEventListener("click", async function (event){
    const day = event.target.closest("div.day");
    if(day && day.getAttribute("date")){;
      SELECTED_DATE =  day.getAttribute("date");
      SELECTED_ALBUM = await albumOfDate(SELECTED_DATE);
      toggleCalendar();
    }
  });
}

function toggleNotes(notes){
  printDebug(notes)
}

docId("album_rating").addEventListener("mousemove", mouseRating);
docId("album_rating").addEventListener("mouseout", mouseRating);
docId("album_rating").addEventListener("mouseover", mouseRating);
docId("album_rating").addEventListener("click", mouseRating);
let CURRENT_RATING;
function mouseRating(event){
  if(!VIEWED_USER.is_current_user){ return; }

  switch(event.type){
    case "mousemove":
      let round = Math.round((event.offsetX/event.target.offsetWidth) * 10) * 10;
      docId("rating_level").style.width = `${round}%`;
    break;
    case "mouseover":
      CURRENT_RATING = docId("rating_level").style.width;
      break;
    case "mouseout":
      docId("rating_level").style.width = CURRENT_RATING;
      break;
    case "click":
      let new_rating = Math.round((event.offsetX/event.target.offsetWidth) * 10) * 10;
      CURRENT_RATING = `${new_rating}%`;
      updateRating([new_rating/10]);
    break;
  }
}

async function updateRating(rating){
  const album = await albumOfDate(SELECTED_DATE);
  fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "rating",
      action: "update",
      data: {
        id: album.id,
        rating: [parseInt(rating)]
      }
      })
    })
  dbAccess("user_ratings", {id:album.id, rating: rating}, "update");
}

async function albumOfDate(date){
  if(!date){ return null; }
  const user_date = await dbAccess("user_albums", date, "get");
  if(!user_date){ return null; }
  return await dbAccess("albums", user_date.id, "get") || await getAlbum(user_date.id, true);
}

async function getAlbum(album_id, db_checked = false){
  if(!album_id){ return null; }
  
  // If we already checked the database, don't check it again and instead check with server fetch
  let db_album = db_checked ? null : await dbAccess("albums", album_id, "get");
  return db_album ? db_album : await fetchAlbum(album_id);
  
  async function fetchAlbum(album_id){
    const response = await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/album/${album_id}`);
    const album = await response.json();
    return album.error ? null : album;
  }
}

async function moveDate(increment){
    const date = docId("date");
    let new_date = dayjs(SELECTED_DATE, "MMM DD, YYYY");
  
    new_date = increment ? new_date.add(1, 'day') : new_date.subtract(1, 'day');
  
    date.innerHTML = new_date.format("MMM DD, YYYY");
    SELECTED_DATE = date.innerHTML;

    SELECTED_ALBUM = await albumOfDate(SELECTED_DATE);

    updateAlbum();
}

function moveMonth(increment){
  let month = dayjs(CALENDAR_DATE, "MMM DD, YYYY");
  month = increment ? month.add(1, 'month') : month.subtract(1, 'month');
  CALENDAR_DATE = month.format("MMM DD, YYYY");
  updateCalendar();
}

async function setDate(date){
  // Require user to select a new album for each date
  SELECTED_ALBUM = await albumOfDate(date);
  SELECTED_DATE = date;
  updateAlbum();
  toggleCalendar();
}

async function updateCalendar(){
  let current_day = dayjs(CALENDAR_DATE).startOf('month');
  docId("months").innerHTML = `${current_day.format("MMM")}`;
  docId("years").innerHTML = `${current_day.format("YYYY")}`;
  const calendar_offset = current_day.day();
  const calendar_end = (current_day.daysInMonth() + calendar_offset) <= 35 ? 35 : 42;
  const month_end = current_day.endOf('month').add(1, 'day');
  const calendar_days = [];

  // Getting all the days of the month, all days will be json objects,
  // but only days with albums will have a non-null name/image
  for(let i = 0; !current_day.isSame(month_end, 'day'); i++){
    let album;

    if(VIEWED_USER.is_current_user){
      album = await albumOfDate(current_day.format("MMM DD, YYYY"));
    }else{
      album = await getAlbum(VIEWED_USER.albums[current_day.format("MMM DD, YYYY")]);
    }

    const selected = current_day.isSame(dayjs(SELECTED_DATE, "MMM DD, YYYY"));
    const day = {num: i + 1, selected: selected, date: current_day.format("MMM DD, YYYY")}

    if(album){
      day["name"] = album.name;
      day["image"] = album.image;
    }

    calendar_days[i] = day;
    current_day = current_day.add(1, 'day');
  }

  // calendar_offset is the day of the week the first day of the month is.
  const calendar = [];
  for(let i = calendar_offset; i < calendar_end; i++){
    calendar[i] = calendar_days[i - calendar_offset];
  }

  const calendar_element = docId("calendar_dates");
  calendar_element.innerHTML = "";

  for(let i = 0; i < calendar.length; i++){
    calendar_element.appendChild(dayChild(calendar[i]));
  }

  function dayChild(day_children){
    let day = document.createElement("div");
    day.className = "day";
    if(day_children){
      day.setAttribute("date", day_children.date);
      day.className = day.className + " clickable"
      if(day_children.selected){
        day.className = day.className + " focused";
      }

      const num = document.createElement("div");
      num.setAttribute("class", "num");
      num.innerHTML = day_children.num;
  
      day.appendChild(num);
      if(day_children.name != null){
        const img = document.createElement("img");
        img.setAttribute("src", day_children.image);
        img.setAttribute("alt", day_children.name);
        day.appendChild(img);
      }
    }    

    return day;
  }
}

function toggleCalendar(){
  updateAlbum();
  CALENDAR_DATE = dayjs(SELECTED_DATE).startOf('month').format("MMM DD, YYYY");
  updateCalendar();
  const calendar = docId("calendar");
  calendar.style.display = calendar.style.display === "none" ? "flex" : "none";
}

async function addAlbum(album){
  const current_album = await albumOfDate(SELECTED_DATE);

  if(current_album == null){
    if(userLoggedIn()){
      fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
      'method': "POST",
      'headers': { "Content-Type": "application/json" },
      'body': JSON.stringify({
        field: "album",
        action: "add",
        data: {
          id: album.id,
          date:  dayjs(SELECTED_DATE)
              }
        })
      });
    }
  }
}

async function sendAlbumUpdate(){
  if(SELECTED_ALBUM == null){return;}

  if(userLoggedIn()){
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "update",
      data: {
        id: SELECTED_ALBUM.id,
        date:  dayjs(SELECTED_DATE)
      }
    })
    })
  }

  dbAccess("user_albums", {date: SELECTED_DATE, id: SELECTED_ALBUM.id}, "update");
  updateAlbum(SELECTED_ALBUM);
}

async function sendAlbumDelete(){
  if(userLoggedIn()){
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "delete",
      data: {
        date:  dayjs(SELECTED_DATE)
      }
    })
    })
  }

  dbAccess("user_albums", SELECTED_DATE, "delete");
  updateAlbum();
}

// Search html
const album_search = docId("search_button");
const album_query = docId("search_bar");
const search_results = docId("search_results");
album_query.addEventListener("keyup", searchInput);
album_search.addEventListener("click", searchAlbum);
search_results.addEventListener("click", searchAlbum);
const debouncedSearch = debounce(async () => presearchAlbum(), 200);

async function searchInput(event){
  if(event.key == "Enter"){
    searchAlbum();
  }else if(album_query.value.length > 2){
    debouncedSearch();
  }else{
    search_results.innerHTML = "";
  }
}

async function presearchAlbum(){
  const query = {
    'q'         : album_query.value,
    'query_by'  : 'name,artists.name,track_list.name,aliases',
    'pre_segmented_query': true,
    'drop_tokens_threshold': 0
  }

  let query_result = await TS_CLIENT.collections('albums').documents().search(query).catch(e => {});            
  
  if(!query_result) return;
  PRESEARCH.albums = {};
  let results = "";

  query_result.hits.forEach(hit => {
    let album = hit.document;
    dbAccess("albums", album, "add");
    PRESEARCH.albums[album.id] = album;
    results += `\t<li album_id=${album.id}>${album.name} by ${album.artists[0].name}</li>\n`
  });

  search_results.innerHTML = results;
}

async function searchAlbum(event = null) {
  search_results.innerHTML = ""; // Clear search suggestions
  let album;

  if(event && event.target.nodeName === "LI"){
    album = PRESEARCH.albums[event.target.getAttribute("album_id")];
  }else{
    await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/search/${album_query.value}`)
          .then(async (response) => album = await response.json());
  }

  if(!VIEWED_USER.is_current_user){
    window.location.pathname = `${CURRENT_USER.user_name}/${dayjs(SELECTED_DATE).format("YYYY/M/D")}`;
  }

  if(!album.error){
    updateAlbum(album);
    await addAlbum(album);
    dbAccess("user_albums", {date: SELECTED_DATE, id: album.id}, "add");
    dbAccess("albums", album, "add");
    SELECTED_ALBUM = album;
  }else{
    displayError(docId("search"), "Error in finding album, please use another query term.");
  }
}

async function updateAlbum(set_album = null){
  if(!WEBSITE_AUDIO.paused){ WEBSITE_AUDIO.pause(); }

  const options_panel = docId("select");
  options_panel.style.display = "none";
  
  const current_album_info = docId("current_album");
  current_album_info.style.display = "none";

  const date = docId("date");
  date.innerHTML = SELECTED_DATE;

  const album_rating = docId("rating_level");
  let album;
  let rating;

  if(VIEWED_USER.is_current_user){
    const current_album = await albumOfDate(SELECTED_DATE);
    SELECTED_ALBUM = set_album ? set_album : current_album;
    album = SELECTED_ALBUM;
    
    if(current_album){
      const albums_differ = current_album.id !== album.id;      
      current_album_info.innerHTML = albums_differ ? `<span>Current Album: <i>${current_album.name}</i> by <b>${current_album.artists[0].name}</b></span>` : "";
      current_album_info.style.display = albums_differ ? "flex" : "none";
      options_panel.style.display = albums_differ ? "flex" : "none"; 
    }

    user_rating = album ? await dbAccess("user_ratings", album.id, "get") : null;
    rating = user_rating ? user_rating.rating : null;
  }else{
    const viewed_name = VIEWED_USER.profile_name || VIEWED_USER.user_name;
    date.innerHTML = `${capitalize(viewed_name)}'s ${SELECTED_DATE}`;
    const album_id = VIEWED_USER.albums[SELECTED_DATE];
    rating = VIEWED_USER.ratings[album_id];
    album = await dbAccess("albums", album_id, "get") || await getAlbum(VIEWED_USER.albums[SELECTED_DATE]);
    SELECTED_ALBUM = album;
  }

  album_rating.style.width = rating ? `${rating[0] * 10}%` : "0%";
  window.history.pushState({}, "", `/${VIEWED_USER.user_name}${dayjs(SELECTED_DATE).format("/YYYY/M/D")}`);

  displayAlbum(album);
}

async function displayAlbum(album){
  if(album){
    const album_img = docId("album_img");
    const album_artists = docId("album_artists");
    const album_title = docId("album_title");
    const album_genres = docId("album_genres");
  
    album_img.href = album.url;
    album_img.innerHTML = `
      \n<img src="${album.image}" alt="${album.name}">`;
    
    let artists = "";

    album.artists.forEach((artist, index) => {
      const comma = index == album.artists.length - 1 ? "" : ","; 
      artists += ` <a href="${artist.url}">${artist.name}${comma}</a>`;
    });
    album_artists.innerHTML = artists;
  
    album_title.innerHTML = album.name;
    album_title.href = album.url;

    let genres = capitalize(album.genres[0]) || "No genres";
    for(let i = 1; i < 3; i++){
      if(album.genres[i]){
        genres += `, ${capitalize(album.genres[i])}`;
      }
    } 
  
    album_genres.innerHTML = genres;
  
    const tracklist = docId("album_tracklist");
    tracklist.innerHTML = "";
  
    let tracklist_update = `<tr><th colspan="3" id="album_secret">${dayjs().format("MM/DD")} - ${album.name} - ${album.artists[0].name} - ${genres}</th></tr>\n\t\t`; 

    album.track_list.forEach(track => {
      const track_index = album.track_list.indexOf(track);

      tracklist_update += 
      ` <tr track_index=${track_index} track_id=${track.id}>
          <td class="num">${track_index + 1}</td>
          <td class="title">${track.name}</td>
          <td class="no-select icon star" action="star" title="Star ${track.name} on Pasipo"></td>
          <td class="no-select icon save" action="save" title="Save ${track.name} to ${capitalize(CURRENT_USER.active_token)}"></td>
          <td class="no-select num time">${dayjs(track.length).format("mm:ss")}</td>
        </tr>
      `
    });

    console.log(CURRENT_USER)

    tracklist.innerHTML = tracklist_update;
    sendEvent(playerEvent, {action: "loadAlbum", data: album});
  }

  docId("album").style.display = album ? "flex" : "none";
}