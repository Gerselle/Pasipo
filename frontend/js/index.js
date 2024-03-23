document.addEventListener("DOMContentLoaded", async (event) => {
  toggleDarkMode(localStorage.getItem("color_mode"));
  await dbStart();
  await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/check`)
  .then(async(response) => {
    const current_user = await response.json();
    sessionSet("current_user", JSON.stringify(current_user));
    docId("icon").innerHTML = current_user.user_name;
  });
});

// Simple helper functions
function updateContent(){ sendEvent(updateJS, {script: docId("content").value}); }
function sessionGet(key){return sessionStorage.getItem(key)};
function sessionSet(key, value){return sessionStorage.setItem(key, value)};
function localGet(key){return localStorage.getItem(key)};
function localSet(key, value){return localStorage.setItem(key, value)};

function debounce(func, timeout) {
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

function toggleDarkMode(load_mode = null){
  const old_mode =  localStorage.getItem("color_mode");
  let new_mode = load_mode ? load_mode : old_mode === "dark" ? "light" : "dark";
  document.body.className = new_mode;
  localStorage.setItem("color_mode", new_mode);
 
  // Updates profile color mode button
  const update = new_mode === "dark" ? "Light Mode" : "Dark Mode";
  docId("mode").innerHTML = update;
}

function iconClick(){
  docId("authorize").innerHTML = userLoggedIn() ? "Log Out" : "Log In";
  profile.style.display = profile.style.display === "none" ? "flex" : "none";
}

function capitalize(str){
  if(!str){ return ""; }
  let result = "";
  str.split(" ").forEach(word => {
    result += `${word[0].toUpperCase()}${word.slice(1)} `;
  });
  return result.slice(0, result.length - 1);
}

let databaseStorage;

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
      db.createObjectStore("user_ratings", {keyPath: "id"});
    }
  });
}

function dbAccess(store, data, operation = null){
  return new Promise((resolve, reject) => { 
    if(!data){resolve(null)};

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

// Code for toggling the user login/signup panel
const background_blur = docId("background_blur");
const profile = docId("profile");

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
      alert(access_response.error);
    }else{
      background_blur.style.display = "none";
      if(!userLoggedIn()){ // Local user logged into an account
        pushUser();
      }
      sessionSet("current_user", JSON.stringify(access_response));
      pullUser();
    }
  });
}

async function authorize(){
  profile.style.display = "none";
  if(userLoggedIn()){ // Logout if logged in
    pushUser();
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/logout`)
      .then(async (response) => {   
        const local = await response.json();
        sessionSet("current_user", JSON.stringify(local)); 
        clearUser();
        updateContent();
      });
  }else{ // Open login/signup panel
    toggleAccess();
  }
}

async function getToken(){
  fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/oauth/spotify`)
    .then(async (response) => {
      const redirect = await response.json();
      if(redirect.error){
        alert(redirect.error);
      }else{
        window.location.href = redirect.url;
      }
    });
}

function userLoggedIn(){
  return JSON.parse(sessionGet("current_user")).user_id ? true : false;
}

function clearUser(){
  dbAccess('user_ratings', null, 'clear');
  dbAccess('user_albums', null, 'clear');
}

async function toggleAccess(){
  background_blur.style.display = background_blur.style.display == "none" ? "flex" : "none";

  if(background_blur.style.display == "flex"){
    fetch(`/templates/login.html`)
    .then(async(response) => {
      const new_html = await response.text();
      docId("focus").innerHTML = new_html;
      background_blur.style.display = "flex";
    });
  }
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

    updateContent();
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


