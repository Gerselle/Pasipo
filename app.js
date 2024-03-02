// Modules for node express requests/responses
const express = require('express');
const path = require("path");
const cors = require('cors');

// Module for .env variables
const dotenv = require('dotenv');
dotenv.config();

// Custom modules for API calls
const spotify = require('./backend/api/spotify.js');
const postgres = require('./backend/api/postgres.js');
const typesense = require('./backend/api/typesense.js');

// Custom modules for user authentication/sessions
const session = require("express-session");
const sessionStore = require("connect-pg-simple")(session);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend'), {index: false}));

app.use(session({
  store: new sessionStore({
    pool : postgres.pool,
    createTableIfMissing: true
  }),
  secret: process.env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  secure: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));


function sessionUser(session){
  let user = {user_id: null};
  if(session.authenticated && session.user){
    user = { 
      user_id : session.user.user_id
    } 
  }
  return user;
}

app.get('/check', function(req, res){
  res.send(sessionUser(req.session)); 
});

app.get('/user_albums', async function(req, res){
  if(res.session.authenticated){

  }else{
    res.send({albums: null})
  }
});

app.post('/action', function(req, res){
  const session = req.session;
  const field = req.body.field;
  const action = req.body.action;
  const data = req.body.data;

  if(session.authenticated){
    switch(field){
      case "album":
        switch(action){
          case "add":
            res.send(postgres.addUserAlbum(session.user, data));
            break;
          case "update":
            res.send(postgres.updateUserAlbum(session.user, data));
            break;
          case "delete":
            res.send(postgres.deleteUserAlbum(session.user, data));
            break;
          default:
            res.send({error: "No valid album action provided."});
        }

        break;
      default:
        res.send({error: "No update field provided."});
    }
  }else{
    res.send({error: "User is not authenticated."})
  }
});

app.get('/:user_name/:year/:month/:day', (req, res) =>{
  
  const {user_name, year, month, day} = req.params;
  if(req.session.user){
    if(req.session.user.user_name == user_name){

    }else{ // User is looking at another user
      
    }

  }else{ // Guest user
    res.send({msg: `Guest user viewing ${user_name}'s `});
  } 

  console.log({ user_name, year, month, day });
  res.send({msg: "Attempt to view user's day."})
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

app.post('/access', async function(req, res) {
  let response = {error: "Issue with login/signup."};

  if(req.body.value === "login"){
    response = await postgres.login(req.body.user_name, req.body.pass_word);
  }else if(req.body.value === "signup"){
    response = await postgres.signup(req.body.user_name, req.body.pass_word, req.body.pass_confirm);
  }


  if(response.error){
    res.status(403).send(response);
  }else{
    req.session.authenticated = true;
    req.session.user = response;
    res.send(sessionUser(req.session));
  }
});

app.get('/logout', async function(req, res){
  if(req.session.authenticated){
    req.session.destroy(function(err){
      res.clearCookie('connect.sid', {path: "/"}).send('Cleared session cookie.');
    });
  }else{
    res.sendFile(__dirname + "/frontend/index.html");
  }
});

app.post('/search', async function(req, res){
  const query = req.body.album_query.toLowerCase();
  const check_ts = await typesense.query(query);
  
  if(check_ts){
    res.send(check_ts[0]);
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

app.get('/*', (req, res) => {
  res.sendFile(__dirname + "/frontend/index.html");
});

const port = process.env.server_port;
app.listen(port, '0.0.0.0', () => console.log(`Listening at address ${process.env.server_ip} on port ${port}.`));