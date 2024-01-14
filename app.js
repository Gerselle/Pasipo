const express = require('express');
const body_parser = require('body-parser');
const dotenv = require('dotenv');
const spotify = require('./api/spotify.js');

const app = express();
const path = require("path");
app.use(express.static(path.join(__dirname, 'public'), { index : false }));
app.use(body_parser.json());
dotenv.config();

const port = process.env.server_port;
const pasipo_id = process.env.client_id;
const pasipo_secret = process.env.client_secret;

const redirect_uri = `http://localhost:${port}/callback`;
const auth_url = "https://accounts.spotify.com/authorize?";
const token_url = "https://accounts.spotify.com/api/token";
const api_url = "https://api.spotify.com/v1/";

let user = null;
let pasipo = null; // Authorization information

app.get('/', (req, res) => {
  res.sendFile(__dirname + "\\public\\search.html");
});

app.get('/callback', (req, res) => {
  const code = req.query.code || null;
  user = authorize(code);
  res.redirect("/search");
});

app.get('/login', function(req, res) {
  const scope = 'user-read-private playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
  res.redirect(`${auth_url}client_id=${pasipo_id}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}`);
});

async function authorize(code){
  request = { 
      method: 'POST',        
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(pasipo_id + ':' + pasipo_secret).toString('base64'))
      }
    }

  if(code){
    request.body = `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`;
  }else{
    request.body = `grant_type=client_credentials`;
  }
  
  const response = await fetch(token_url, request);
  token = await response.json();

  token["expiry_time"] = Math.floor(Date.now() / 1000) + token.expires_in - 10;

  return token;
}

app.post('/search', async function(req, res){

  if(pasipo == null || pasipo.expiry_time < Math.floor(Date.now() / 1000 )){
    pasipo = await authorize(null);
  }

  const search_response = await spotify.albumSearch(req.body.album_query, pasipo.access_token);
  search_response ? res.send(search_response) : res.send({name: null});
});

app.listen(port, () => console.log(`Listening on port ${port}.`));
