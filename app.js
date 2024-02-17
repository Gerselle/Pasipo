// Modules for node express requests/responses
const express = require('express');
const body_parser = require('body-parser');
const path = require("path");
const cors = require('cors');

// Module for .env variables
const dotenv = require('dotenv');
dotenv.config();

// Custom modules for Pasipo functionality 
const spotify = require('./api/spotify.js');
const postgres = require('./api/postgres.js');
const typesense = require('./api/typesense.js');

const app = express();
app.use(cors());
app.use(body_parser.json());
app.use(express.static(path.join(__dirname, 'frontend'), {index: false}));

app.get('/*', (req, res) => {
  res.sendFile(__dirname + "/frontend/index.html");
});

app.get('/callback', async function(req, res){
  if(req.query.code){
    // Add this user's token to the database
    user = await spotify.authorize(req.query.code);
  }
  res.redirect("/");
});

app.get('/spotify', function(req, res) {
  res.redirect(process.env.authorization_request);
});

app.post('/access', function(req, res) {
  res.send({
    "user_name": req.body.user_name,
    "pass_word": req.body.pass_word,
    "pass_confirm": req.body.pass_confirm,
    "value": req.body.value
  });
});

app.post('/search', async function(req, res){
  const query = req.body.album_query.toLowerCase();
  const check = await typesense.query(query);
  
  if(check){
    res.send(check[0]);
  }else{
    const search_response = await spotify.albumSearch(query);
    if(search_response){
      res.send(search_response);
      typesense.addAlbum(search_response, query);
      postgres.addAlbum(search_response);
    }else{
      res.send({url: null});
    }
  }
});

const port = process.env.server_port;
app.listen(port, '0.0.0.0', () => console.log(`Listening at address ${process.env.server_ip} on port ${port}.`));