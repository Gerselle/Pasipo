const SERVER_ADDRESS = "localhost";
const NODE_PORT = ":45426";
const TS_PORT = "8108";
const TS_KEY = "3jwW1SNDoqkmlxxtOUnvknUNYanh7S4h4TrKCE2791ydg1ep";

let client = new Typesense.Client({
  'nodes': [{
    'host': SERVER_ADDRESS,
    'port': TS_PORT,    
    'protocol': 'http'
  }],
  'apiKey': TS_KEY,
  'connectionTimeoutSeconds': 2
})

// Code for toggling the user login/signup panel
const access = document.getElementById("background_blur");
const profile = document.getElementById("profile");
const date = document.getElementById("date");

document.addEventListener("DOMContentLoaded", (event) => {
  toggleDarkMode(localStorage.getItem("color_mode"));
  const date = document.getElementById("date");
  const today = dayjs().format("MMM DD, YYYY");
  date.innerHTML = today;
  sessionStorage.setItem("calendar_date", dayjs(today).startOf('month').format("MMM DD, YYYY"));
  sessionStorage.setItem("selected_date", date.innerHTML);
  sessionStorage.setItem("calendar", JSON.stringify([]));

  if(localStorage.getItem("local_albums") == null){
    localStorage.setItem("local_albums", JSON.stringify({}));
  }

  displayUpdate();
});

async function moveDate(increment){
  // Require user to select a new album for each date
  sessionStorage.setItem("selected_album", null);

  const date = document.getElementById("date");
  let selected_date = dayjs(sessionStorage.getItem("selected_date"), "MMM DD, YYYY");

  selected_date = increment ? selected_date.add(1, 'day') : selected_date.subtract(1, 'day');

  date.innerHTML = selected_date.format("MMM DD, YYYY");
  sessionStorage.setItem("selected_date", date.innerHTML);

  displayUpdate();
}

async function moveMonth(increment){
  let month = dayjs(sessionStorage.getItem("calendar_date"), "MMM DD, YYYY");
  month = increment ? month.add(1, 'month') : month.subtract(1, 'month');
  sessionStorage.setItem("calendar_date", month.format("MMM DD, YYYY"));
  updateCalendar();
}

async function setDate(value){
  // Require user to select a new album for each date
  sessionStorage.setItem("selected_album", null);
  sessionStorage.setItem("selected_date", value);
  displayUpdate();
  toggleCalendar();
}

function updateCalendar(){
  let current = dayjs(sessionStorage.getItem("calendar_date")).startOf('month');
  document.getElementById("months").innerHTML = `${current.format("MMM")}`;
  document.getElementById("years").innerHTML = `${current.format("YYYY")}`;

  const calendar_offset = current.day();
  const month_end = current.endOf('month').add(1, 'day');
  const local_albums = JSON.parse(localStorage.getItem("local_albums"));
  const calendar_days = [];

  // Getting all the days of the month, all days will be json objects,
  // but only days with albums will have a non-null name/image
  for(let i = 0; !current.isSame(month_end, 'day'); i++){
    const selected = current.isSame(dayjs(sessionStorage.getItem("selected_date"), "MMM DD, YYYY"));
    let album = local_albums[current.format("MMM DD, YYYY")];
    let day = {num: i + 1, selected: selected, date: current.format("MMM DD, YYYY")}

    if(album){
      day["name"] = album.name;
      day["image"] = album.image
    }

    calendar_days[i] = day;
    current = current.add(1, 'day');
  }

  // calendar_offset is the day of the week the first day of the month is.
  const calendar = [];
  for(let i = calendar_offset; i < calendar_days.length + calendar_offset; i++){
    calendar[i] = calendar_days[i - calendar_offset];
  }

  function dayChild(day_children){
    let day = document.createElement("div");
    day.className = "day";
    if(day_children){
      day.setAttribute("onclick", `setDate("${day_children.date}")`);
      day.className = day.className + " clickable"
      if(day_children.selected){
        day.className = day.className + " focused";
      }
      
      if(day_children.name != null){
        const img = document.createElement("img");
        img.setAttribute("src", day_children.image);
        img.setAttribute("alt", day_children.name);
        day.appendChild(img);
      }
      
      const num = document.createElement("div");
      num.setAttribute("class", "num");
      num.innerHTML = day_children.num;
  
      day.appendChild(num);
    }    
    
    return day;
  }
  
  const calendar_element = document.getElementById("calendar_dates");
  calendar_element.innerHTML = "";
  
  for(let i = 0; i < 35; i++){
    calendar_element.appendChild(dayChild(calendar[i]));
  }
}

function toggleCalendar(){
  const selected_date = sessionStorage.getItem("selected_date");
  sessionStorage.setItem("calendar_date", dayjs(selected_date).startOf('month').format("MMM DD, YYYY"));
  const calendar = document.getElementById("calendar");
  calendar.style.display = calendar.style.display === "none" ? "flex" : "none";
  updateCalendar();
}

function displayUpdate(){
  const local_albums = JSON.parse(localStorage.getItem("local_albums"));
  const selected_date = sessionStorage.getItem("selected_date");
  const select = document.getElementById("select");
  const current = document.getElementById("current_album");
  const selected_album = local_albums[selected_date]; 

  if(selected_album){
    current.innerHTML = 
    `Current Album: <i>${selected_album.name}</i> by <b>${selected_album.artists[0].name}</b> `;
    displayAlbum(local_albums[selected_date]);
    select.style.display = "flex";
  }else{
    current.innerHTML = "";
    select.style.display = "none";
    document.getElementById("album_cover").innerHTML = "<a href=\'\"><img class=\" \" src=\"\" alt=\"\"></a>";
    document.getElementById("album_table").innerHTML = "";
    document.getElementById("date").innerHTML = selected_date;
  }
}

function toggleDarkMode(load_mode = null){
  if(load_mode){
    document.body.className = load_mode;
  }else{
    document.body.className = document.body.className === "dark" ? "light" : "dark";
  }
  localStorage.setItem("color_mode", document.body.className);

  // Updates profile color mode button
  const update = document.body.className === "dark" ? "light" : "dark";
  document.getElementById("mode").innerHTML = 
  update.charAt(0).toUpperCase() + update.slice(1) + " Mode";
}

function toggleAccess(){
  profile.style.display = false;
  access.style.display = access.style.display === "none" ? "flex" : "none";
}

function iconClick(){
  document.getElementById("authorize").innerHTML = 
  localStorage.getItem("authorized") === "true" ? "Log Out" : "Log In"
  profile.style.display = profile.style.display === "none" ? "flex" : "none";
}

async function updateAlbum(){
  const selected_album = JSON.parse(sessionStorage.getItem("selected_album"));
  const selected_date = sessionStorage.getItem("selected_date");

  if(selected_album == null){return;}

  let local_albums = JSON.parse(localStorage.getItem("local_albums"));

  if(localStorage.getItem("authorized") == "true"){
    fetch(`http://${SERVER_ADDRESS + NODE_PORT}/album/update`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      album: selected_album.id,
      date:  dayjs(selected_date, "MMM DD, YYYY")
    })
    }).then(async (response) => {

      const access_response = await response.json();
      console.log(access_response);
      
    });
  }
  local_albums[selected_date] = selected_album;
  localStorage.setItem("local_albums", JSON.stringify(local_albums));
  document.getElementById("current_album").innerHTML = `Current Album: <i>${local_albums[selected_date].name}</i> by <b>${local_albums[selected_date].artists[0].name}</b> `;
  displayAlbum(local_albums[selected_date]);
}

async function resetAlbum(){
  let local_albums = JSON.parse(localStorage.getItem("local_albums"));
  displayAlbum(local_albums[sessionStorage.getItem("selected_date")]);
}

async function deleteAlbum(){
  let local_albums = JSON.parse(localStorage.getItem("local_albums"));
  delete local_albums[sessionStorage.getItem("selected_date")];
  localStorage.setItem("local_albums", JSON.stringify(local_albums));
  displayUpdate();
}

async function requestAccess(event){
  access_request = {
    "value": event.value,
    "user_name": document.getElementById("user_name").value,
    "pass_word": document.getElementById("pass_word").value
  }

  if(event.value === "signup"){
    access_request["pass_confirm"] = document.getElementById("pass_confirm").value;
  } 
  
  fetch(`http://${SERVER_ADDRESS + NODE_PORT}/access`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify(access_request)
  }).then(async (response) => {

    const access_response = await response.json();

    if(access_response.error){
      alert(access_response.error);
    }else{
      access.style.display = "none";
      localStorage.setItem("authorized", "true");
    }
  });
}

async function authorize(){
  profile.style.display = "none";
  if(localStorage.getItem("authorized") === "true"){ // Logout if logged in
    fetch(`http://${SERVER_ADDRESS + NODE_PORT}/logout`).then(() => {
      localStorage.setItem("authorized", "false"); 
    });
  }else{ // Open login/signup panel
    toggleAccess();
  }
}

// Search html
const album_search = document.getElementById("search_button");
const album_query = document.getElementById("search_bar");
const search_results = document.getElementById("search_results");
album_query.addEventListener("keyup", searchInput);
album_search.addEventListener("click", getAlbum);
search_results.addEventListener("click", getAlbum);
const debounced_search = debounce(async () => searchAlbum(), 100);

async function searchInput(event){
  if(event.key == "Enter"){
    getAlbum();
  }else{
    if(album_query.value.length > 0){
      debounced_search();
    }else{
      search_results.innerHTML = "";
    }
  }
}

function debounce(func, timeout) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

async function searchAlbum(){
    const query = {
      'q'         : album_query.value,
      'query_by'  : 'name,artists.name,track_list.name,aliases',
      'pre_segmented_query': true,
      'drop_tokens_threshold': 0
    }

    let query_result = await client.collections('albums').documents().search(query)
                                   .catch(e => {});
    
    if(!query_result) return;
    let presearch = [];
    let results = "";
    
    if(query_result.hits.length){
      for(let i = 0; i < query_result.hits.length; i++){
        album = query_result.hits[i].document;
        presearch[i] = album;
        results += `\t<li id=${i}>${album.name} by ${album.artists[0].name}</li>\n`
      }  
    }

    search_results.innerHTML = results;
    sessionStorage.setItem("presearch", JSON.stringify(presearch));
}

async function getAlbum(event = null) {
  search_results.innerHTML = ""; // Clear search suggestions
  
  if(event && event.target.nodeName === "LI"){
    const presearch = JSON.parse(sessionStorage.getItem("presearch"));
    album = presearch[event.target.id];
  }else{
    album = await fetch(`http://${SERVER_ADDRESS + NODE_PORT}/search`, {
      'method': "POST",
      'headers': { "Content-Type": "application/json" },
      'body': JSON.stringify({ "album_query": album_query.value})
    }).then((response) => response.json());
  }

  if(album){
    let local_albums = JSON.parse(localStorage.getItem("local_albums"));
    if(local_albums == null){
      local_albums = {}
    }
    if(local_albums[date.innerHTML] == null){
      local_albums[date.innerHTML] = album;
      document.getElementById("select").style.display = "flex";
      localStorage.setItem("local_albums", JSON.stringify(local_albums));
    }

    sessionStorage.setItem("selected_album", JSON.stringify(album));
    displayAlbum(album);
  }
}

function displayAlbum(album){
  let cover = document.getElementById("album_cover");

  if(album.url == null || album.url == cover.href){
    alert("Error in finding album");
    return;
  }  

  const album_cover_update = `\n<a href=${album.url}><img class="album cover" src="${album.image}" alt="${album.name}"></a>`;
  cover.innerHTML = album_cover_update + "\n";

  let album_table_update = 
    `\n<tr><th colspan="3">
    ${dayjs().format("M/D")} - 
    ${album.name} - <b>
    ${album.artists[0].name}</b> - <i>
    ${album.genres.slice(0,3).join(", ")}
    </i></th></tr>`;

  for (let i = 0; i < album.track_list.length; i++) {
    album_table_update += `\n<tr><td>${i + 1}</td><td>${album.track_list[i].name}</td></tr>`;
  }

  document.getElementById("album_table").innerHTML = album_table_update + "\n";
}