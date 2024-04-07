let DATABASE_STORAGE;
let CURRENT_USER;
const WEBSITE_AUDIO = new Audio();
const ERROR_LENGTH = 3000;

document.addEventListener("DOMContentLoaded", async () => {
  toggleDarkMode(localStorage.getItem("color_mode"));
  await updateCurrentUser();
  await dbStart();
  await updateLayout();
});

// Current user will always either be the session's user or a local user.
async function updateCurrentUser(){
  await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/check`)
        .then( async (response) => { CURRENT_USER = await response.json(); })
        .catch(() => { CURRENT_USER = {user_id: null, user_name: "local"}; });
}

// Website graphic update functions
async function updateLayout(){
  sendEvent(updateJS, {script: docId("content").value});
  if(CURRENT_USER.profile_image){
    docId("icon").innerHTML = `<img src="${CURRENT_USER.profile_image}" alt="icon">`;
  }else{
    docId("icon").innerHTML = CURRENT_USER.user_name;
  }

  if(CURRENT_USER.active_token){ sendEvent(playerEvent, {action: "start"}); }
  player.style.display = CURRENT_USER.active_token ? "flex" : "none";
}

function setFocus(show_focus, focus_child){
  const focus = docId("focus");
  const layout = docId("layout");
  if(focus_child) { focus.innerHTML = focus_child; }
  focus.style.display = show_focus ? "flex" : "none";
  layout.style.filter = show_focus ? "blur(10px)" : "none";
}

function toggleDarkMode(load_mode = null){
  const old_mode = localStorage.getItem("color_mode");
  let new_mode;
  if(load_mode){
    new_mode = load_mode;
  }else{
    new_mode = old_mode === "dark" ? "light" : "dark";
  }
  document.body.className = new_mode;
  localStorage.setItem("color_mode", new_mode);
  
  docId("mode").innerHTML = new_mode === "dark" ? "Light Mode" : "Dark Mode";
}

function iconClick(){
  docId("authorize").innerHTML = userLoggedIn() ? "Log Out" : "Log In";
  docId("profile").style.display = docId("profile").style.display === "none" ? "flex" : "none";
}

async function toggleAccess(){
  setFocus(!isFocused());
  if(isFocused()){
    fetch(`/templates/login.html`)
    .then(async(response) => {
      const login_html = await response.text();
      setFocus(true, login_html);
    });
  }
}

// General helper functions
function printDebug(message){ console.log(message); }
function docId(id){ return id ? document.getElementById(id) : null; }
function sessionGet(key){return sessionStorage.getItem(key)};
function sessionSet(key, value){return sessionStorage.setItem(key, value)};
function localGet(key){return localStorage.getItem(key)};
function localSet(key, value){return localStorage.setItem(key, value)};
function userLoggedIn(){ return CURRENT_USER.user_id ? true : false; }
function isFocused(){ return docId("focus").style.display == "flex"; }

// Capitalizes the first letter of each word in the string
// e.g. "this is a string" => "This Is A String"
function capitalize(str){ 
  if(!str){ return ""; }
  let result = "";
  str.split(" ").forEach(word => {
    result += `${word[0].toUpperCase()}${word.slice(1)} `;
  });
  return result.slice(0, result.length - 1);
}

function debounce(func, timeout){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

function throttle(func, timeout) {
  let throttling = false;
  return (...args) => {
    if (!throttling) {
      throttling = true;
      func.apply(this, args);
      setTimeout(() => {
        throttling = false;
      }, timeout);
    }
  };
}

// Displays an error message box under the target element
function displayError(target, message){
  if(!docId("err_msg")){
    const element = target || document.body;
    element_pos = element.getBoundingClientRect();
    const error_div = document.createElement("div");
    Object.assign(error_div.style, {
      left: `${element_pos.x + element_pos.width/2}px`,
      top: `${element_pos.y + element_pos.height/2}px`,
    });

    error_div.id = "err_msg";
    error_div.className = "no-select error";
    error_div.innerHTML = message
    document.body.append(error_div);
  
    setTimeout(() => {
      err_msg.remove();
    }, ERROR_LENGTH);
  }
}

// IndexedDB functions
function dbStart(){
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("database", 1);

    request.onerror = (event) => {
      console.error(`Database error: ${event.target.errorCode}`);
    };
  
    request.onsuccess = (event) => {
      DATABASE_STORAGE = event.target.result;
      resolve();
    };
  
    request.onupgradeneeded = async (event) => {
      const db = event.target.result;
      db.createObjectStore("albums", {keyPath: "id"});
      db.createObjectStore("user_albums", {keyPath: "date"});
      db.createObjectStore("user_ratings", {keyPath: "id"});
    }
  });
}

function dbAccess(store, data, operation = null){
  return new Promise((resolve, reject) => { 
    if(!data){resolve(null)};

    if(operation){
        const transaction = DATABASE_STORAGE.transaction([store], "readwrite");
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
            case "clear":
              request = objectStore.clear();
              break;
            case "getAll":
              request = objectStore.getAll();
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

// User login/logout functions
async function requestAccess(event){
  access_request = {
    "value": event.value,
    "user_name": docId("user_name").value,
    "pass_word": docId("pass_word").value
  }

  if(event.value === "signup"){
    access_request["pass_confirm"] = docId("pass_confirm").value;
  } 
  
  fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/access`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify(access_request)
  }).then(async(response) => {
    const access_response = await response.json();

    if(access_response.error){
      displayError(docId("focus"), access_response.error);
    }else{
      setFocus(false);
      if(!userLoggedIn()){ pushUser(); } // Local user logged into an account
      CURRENT_USER = access_response;
      pullUser();
      updateLayout();
    }
  });
}

async function authorize(){
  docId("profile").style.display = "none";
  if(userLoggedIn()){ // Logout if logged in
    pushUser();
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/logout`)
      .then(async (response) => {   
        const local = await response.json();
        sendEvent(playerEvent, {action: "disconnect"});
        CURRENT_USER = local;
        clearUser();
        updateLayout();
      });
  }else{ // Open login/signup panel
    toggleAccess();
  }
}

async function oAuth(service, action){

  fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/oauth`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      service: service,
      action: action,
      current_path: window.location.pathname
      })
   }).then(async (response) => {
      const redirect = await response.json();
      if(redirect.error){
        displayError(docId("focus"), redirect.error);
      }else{
        window.location.href = redirect.url;
      }
    });
}

// User information functions
function clearUser(){
  dbAccess('user_ratings', null, 'clear');
  dbAccess('user_albums', null, 'clear');
}

async function pullUser(){
  fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "rating",
      action: "pull"
      })
    }).then(async (response) => {
      const user_ratings = await response.json();
      if(user_ratings.error == null){
        await dbAccess("user_ratings", null, "clear");
        user_ratings.forEach(user_rating => {
          dbAccess("user_ratings", {id: user_rating.album_id, rating: user_rating.rating}, "add");          
        });
      }
    });  

  await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "pull",
      })
    }).then(async (response) => {
      const user_albums = await response.json();
      if(user_albums.error == null){
        await dbAccess("user_albums", null, "clear");
        user_albums.forEach(user_album => {
        dbAccess("user_albums", {date: dayjs(user_album.date).format("MMM DD, YYYY"), id: user_album.album_id}, "add");
      });
      }
    });

    updateLayout();
}

async function pushUser(){
  if(userLoggedIn()){
    const user_albums =  await dbAccess("user_albums", null, "getAll");

    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "push",
      data: {
        user_albums: user_albums
        }
      })
    });

    const user_ratings =  await dbAccess("user_ratings", null, "getAll");

    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "rating",
      action: "push",
      data: {
        user_ratings: user_ratings
        }
      })
    });
  }
}