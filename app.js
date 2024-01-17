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

app.get('/', (req, res) => {
  res.sendFile(__dirname + "\\public\\search.html");
});

app.get('/callback', (req, res) => {
  if(req.query.code){
    // Add this user's token to the database
    user = spotify.authorize(req.query.code);
  }
  
  res.redirect("/search");
});

app.get('/login', function(req, res) {
  res.redirect(process.env.authorization_request);
});

app.post('/search', async function(req, res){
  const search_response = await spotify.albumSearch(req.body.album_query);
  search_response ? res.send(search_response) : res.send({name: null});
});

app.listen(port, () => console.log(`Listening on port ${port}.`));
