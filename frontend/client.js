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
const background = document.getElementById("background_blur");
document.getElementById("profile").addEventListener("click", toggleAccess);

function toggleAccess(){
  background.style.display = background.style.display === "none" ? "flex" : "none";
  window.history.replaceState({}, "", "/");
}

async function requestAccess(event){
  access_request = {
    "value": event.value,
    "user_name": document.getElementById("user_name").value,
    "pass_word": document.getElementById("pass_word").value,
  }

  if(event.value === "signup"){
    access_request["pass_confirm"] = document.getElementById("pass_confirm").value;
  } 
  
  access_response = await fetch(`http://${SERVER_ADDRESS + NODE_PORT}/access`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify(access_request)
  }).then((response) => response.json());
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
    
    if(query_result.hits.length != 0){
      for(let i = 0; i < query_result.hits.length; i++){
        if(i == 10){
          break;
        }
        album = query_result.hits[i].document;
        presearch[i] = album;
        results += `\t<li id=${ i}>${album.name} by ${album.artists[0].name}</li>\n`
      }  
    }

    sessionStorage.setItem("presearch", JSON.stringify(presearch));

    search_results.innerHTML = results;
}

async function getAlbum(event = null, album = {url: null}) {

  // Clear search suggestions
  search_results.innerHTML = "";

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

  let cover = document.getElementById("album_cover");

  if(album.url == null || album.url == cover.href){
    alert("Error in finding album");
    return;
  }

  const album_cover_update = `\n<a href=${album.url}><img class="album cover" src="${album.image}" alt="${album.name}"></a>`;
  cover.innerHTML = album_cover_update + "\n";

  let current_date = `${new Date().getMonth() + 1}/${new Date().getDate()}`;
  let album_table_update = 
    `\n<tr><th colspan="3">
    ${current_date} - 
    ${album.name} - <b>
    ${album.artists[0].name}</b> - <i>
    ${album.genres.slice(0,3).join(", ")}
    </i></th></tr>`;

  for (let i = 0; i < album.track_list.length; i++) {
    album_table_update += `\n<tr><td>${i + 1}</td><td>${album.track_list[i].name}</td></tr>`;
  }

  document.getElementById("album_table").innerHTML = album_table_update + "\n";

}