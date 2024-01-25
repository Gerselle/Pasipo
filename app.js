const express = require('express');
const body_parser = require('body-parser');
const dotenv = require('dotenv');
const spotify = require('./api/spotify.js');
const postgres = require('./api/postgres.js');

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
  
  res.redirect("/");
});

app.get('/login', function(req, res) {
  res.redirect(process.env.authorization_request);
});

app.post('/search', async function(req, res){
  
  const query = req.body.album_query.toLowerCase();
  const check = await postgres.checkQuery(query);
  
  if(check){
    res.send(check);
  }else{
    const search_response = await spotify.albumSearch(query);
    if(search_response){
      await postgres.addAlbum(search_response);
      await postgres.addQuery(query, search_response.id);
      res.send(search_response);
    }else{
      res.send({name: null});
    }
  }

});

app.listen(port, () => console.log(`Listening on port ${port}.`));