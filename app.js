// Modules for node express requests/responses
const express = require('express');
const body_parser = require('body-parser');
const path = require("path");

// Module for .env variables
const dotenv = require('dotenv');

// Custom modules for Pasipo functionality 
const spotify = require('./api/spotify.js');
const postgres = require('./api/postgres.js');
const typesense = require('./api/typesense.js');

const app = express();
app.use(express.static(path.join(__dirname, 'public'), { index : false }));
app.use(cors());
app.use(body_parser.json());
dotenv.config();

app.get('/', (req, res) => {
  res.sendFile(__dirname + "/public/search.html");
});

app.get('/callback', async function(req, res){
  if(req.query.code){
    // Add this user's token to the database
    user = await spotify.authorize(req.query.code);
  }
  res.redirect("/");
});

app.get('/login', function(req, res) {
  res.redirect(process.env.authorization_request);
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

const ip = process.env.server_ip;
const port = process.env.server_port;
app.listen(port, '0.0.0.0', () => console.log(`Listening at address ${process.env.server_ip} on port ${port}.`));