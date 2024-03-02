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
let databaseStorage;

document.addEventListener("DOMContentLoaded", async (event) => {

  toggleDarkMode(localStorage.getItem("color_mode"));
  date.innerHTML = dayjs().format("MMM DD, YYYY");
  sessionStorage.setItem("calendar_date", dayjs(date.innerHTML).startOf('month').format("MMM DD, YYYY"));
  sessionStorage.setItem("selected_date", date.innerHTML);
  sessionStorage.setItem("selected_album", null);
  if(localStorage.getItem("local_albums") == null){
    localStorage.setItem("local_albums", JSON.stringify({}));
  }

  fetch(`http://${SERVER_ADDRESS + NODE_PORT}/check`).then(async (response) => {
    localStorage.setItem("current_user", JSON.stringify(await response.json()));
  });
});

window.addEventListener("load", async (event) => {
  await dbStart();
  displayAlbum();
});

function dbStart(){
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("database", 1);

    request.onerror = (event) => {
      console.error(`Database error: ${event.target.errorCode}`);
    };
  
    request.onsuccess = (event) => {
      databaseStorage = event.target.result;
      resolve();
    };
  
    request.onupgradeneeded = async (event) => {
      const db = event.target.result;
      db.createObjectStore("albums", {keyPath: "id"});
      db.createObjectStore("user_albums", {keyPath: "date"});
    }
  });
}

function dbAccess(store, data, operation = null){
  return new Promise((resolve, reject) => { 
    if(operation){
        const transaction = databaseStorage.transaction([store], "readwrite");

        transaction.onerror = (event) => {
          resolve({error: `ObjectStore "${store}" ${operation} error:\n ${event.target.error}`});
        };
        
        const objectStore = transaction.objectStore(store);

          let request;
          switch(operation){
            case "get":
              request = objectStore.get(data);
              break;
            case "add":
              request = objectStore.add(data);
              break;
            case "update":
              request = objectStore.put(data);
              break;
            case "delete":
              request = objectStore.delete(data);
              break;
            default:
              resolve({error: `ObjectStore "${store}" access with invalid operation.`});
          }

          request.onsuccess = (event) =>{
            resolve(event.target.result);
          }

    }else{
      resolve({error: `ObjectStore "${store}" access with no operation.`});
    }
  });
}

async function albumOfDate(date){
  const album_date = await dbAccess("user_albums", date, "get");
  if(album_date){
    return await dbAccess("albums", album_date.id, "get");
  }else{
    return null;
  }
}

async function moveDate(increment){
  // Require user to select a new album for each date
  sessionStorage.setItem("selected_album", null);

  const date = document.getElementById("date");
  let selected_date = dayjs(sessionStorage.getItem("selected_date"), "MMM DD, YYYY");

  selected_date = increment ? selected_date.add(1, 'day') : selected_date.subtract(1, 'day');

  date.innerHTML = selected_date.format("MMM DD, YYYY");
  sessionStorage.setItem("selected_date", date.innerHTML);

  displayAlbum();
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
  displayAlbum();
  toggleCalendar();
}

async function updateCalendar(){
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
    let album = await albumOfDate(current.format("MMM DD, YYYY"));
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

  const calendar_element = document.getElementById("calendar_dates");
  calendar_element.innerHTML = "";

  for(let i = 0; i < 35; i++){
    calendar_element.appendChild(dayChild(calendar[i]));
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
}

function toggleCalendar(){
  const selected_date = sessionStorage.getItem("selected_date");
  sessionStorage.setItem("calendar_date", dayjs(selected_date).startOf('month').format("MMM DD, YYYY"));
  const calendar = document.getElementById("calendar");
  calendar.style.display = calendar.style.display === "none" ? "flex" : "none";
  updateCalendar();
}

async function displayUpdate(){
  const selected_date = sessionStorage.getItem("selected_date");
  const select = document.getElementById("select");
  const current_album = document.getElementById("current_album");
  const selected_album = await albumOfDate(sessionStorage.getItem("selected_date"));

  if(selected_album){
    current_album.innerHTML = 
    `Current Album: <i>${selected_album.name}</i> by <b>${selected_album.artists[0].name}</b> `;
    displayAlbum(selected_album);
    select.style.display = "flex";
  }else{
    document.getElementById("album_cover").innerHTML = "<a href=\'\"><img class=\" \" src=\"\" alt=\"\"></a>";
    document.getElementById("album_table").innerHTML = "";
    document.getElementById("date").innerHTML = selected_date; 
    current_album.innerHTML = "";
    select.style.display = "none";
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


async function addAlbum(album){
  const selected_date = sessionStorage.getItem("selected_date");
  const current_album = await albumOfDate(selected_date);

  if(current_album == null){
    if(localStorage.getItem("authorized") === "true"){
      fetch(`http://${SERVER_ADDRESS + NODE_PORT}/action`, {
      'method': "POST",
      'headers': { "Content-Type": "application/json" },
      'body': JSON.stringify({
        field: "album",
        action: "add",
        data: {
          album_id: album.id,
          date:  dayjs(selected_date)
              }
        })
      });
    }
  }
}

async function updateAlbum(){
  const selected_album = JSON.parse(sessionStorage.getItem("selected_album"));
  const selected_date = sessionStorage.getItem("selected_date");

  if(selected_album == null){return;}

  if(localStorage.getItem("authorized") == "true"){
    fetch(`http://${SERVER_ADDRESS + NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "update",
      data: {
        album_id: selected_album.id,
        date:  dayjs(selected_date)
      }
    })
    })
  }

  dbAccess("user_albums", {date: selected_date, id:selected_album.id}, "update");
  displayAlbum(selected_album);
}

async function resetAlbum(){
  displayAlbum();
}

async function deleteAlbum(){
  if(localStorage.getItem("authorized") == "true"){
    fetch(`http://${SERVER_ADDRESS + NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "delete",
      data: {
        date:  dayjs(sessionStorage.getItem("selected_date"))
      }
    })
    })
  }

  dbAccess("user_albums", sessionStorage.getItem("selected_date"), "delete");
  displayAlbum();
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
      localStorage.setItem("current_user", JSON.stringify(access_response));
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
        dbAccess("albums", album, "add");
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

  

  if(album.url){
    await addAlbum(album);
    dbAccess("user_albums", {date: date.innerHTML, id: album.id}, "add");
    dbAccess("albums", album, "add");
    sessionStorage.setItem("selected_album", JSON.stringify(album));
    displayAlbum(album);
  }else{
    alert("Error in finding album");
  }
}

async function displayAlbum(set_album){
  const selected_date = sessionStorage.getItem("selected_date");
  document.getElementById("date").innerHTML = selected_date;
  const current_album = document.getElementById("current_album");
  const select = document.getElementById("select");
  
  const cover = document.getElementById("album_cover");
  const table = document.getElementById("album_table");
  
  const album = set_album || await albumOfDate(sessionStorage.getItem("selected_date"));

  if(album){
    cover.innerHTML = `\n<a href=${album.url}><img class="album cover" src="${album.image}" alt="${album.name}"></a>`;

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

    table.innerHTML = album_table_update + "\n";
    const selected_album = await albumOfDate(selected_date);
    current_album.innerHTML = `Current Album: <i>${selected_album.name}</i> by <b>${selected_album.artists[0].name}</b> `;
    select.style.display = "flex";
  }else{
    cover.innerHTML = "<a href=\'\"><img class=\" \" src=\"\" alt=\"\"></a>";
    table.innerHTML = "";
    current_album.innerHTML = "";
    select.style.display = "none";
  }
}