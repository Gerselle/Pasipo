const port = 45426;
// Login.html
const login = document.getElementById("login_button");

// Login button
if (login) {
  login.addEventListener("click", function () {
    fetch(`http://localhost:${port}/login`)
      .then((response) => response.text())
      .then((html) => {
        document.body.innerHTML = html;
      })
      .catch((error) => console.error("Error fetching new page:", error));
  });
}

// Search html
const album_search = document.getElementById("album_search");
if (album_search) {
  const album_query = document.getElementById("album_query");
  album_query.addEventListener("keyup", (event) => {
    if (event.key == "Enter") {
      search();
    }
  });
  album_search.addEventListener("click", search);
}

async function search() {
  album = await fetch(`http://localhost:${port}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ album_query: album_query.value }),
  }).then((response) => response.json());

  if (album.name) {
    const album_cover_update = `\n<a href=${album.url}><img class="album cover" src="${album.cover}" alt="${album.name}"></a>`;
    document.getElementById("album_cover").innerHTML = album_cover_update + "\n";

    let current_date = `${new Date().getMonth() + 1}/${new Date().getDate()}`;
    let album_table_update = 
      `\n<tr><th colspan="3"><center>
      ${current_date} - 
      ${album.name} - <b>
      ${album.artist}</b> - <i>
      ${album.genres.join(", ")}
      </i></center></th></tr>`;

    for (let i = 0; i < album.track_list.length; i++) {
      album_table_update += `\n<tr><td>${i + 1}</td><td>${album.track_list[i].name}</td></tr>`;
    }

    document.getElementById("album_table").innerHTML = album_table_update + "\n";
  } else {
    alert("Error in finding album");
  }
}
