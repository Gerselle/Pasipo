// Modules for node express requests/responses
const express = require("express");
const path = require("path");
const cors = require("cors");

// Module for .env variables
const dotenv = require("dotenv");
dotenv.config();

// Custom modules for API calls
const spotify = require("./backend/api/spotify.js");
const postgres = require("./backend/api/postgres.js");
const typesense = require("./backend/api/typesense.js");

// Custom modules for user authentication/sessions
const session = require("express-session");
const sessionStore = require("connect-pg-simple")(session);

const app = express();
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(cors());
app.use(express.json());

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

app.get("/album_id/:id", async function(req, res){
  res.send(await postgres.getAlbum(req.params.id));
});

app.get("/check", async function(req, res){
  res.send(await sessionUser(req.session));
});

async function sessionUser(session){
  let response = {user_id: null, user_name: "local"};
  if(session && session.user){
    const user = await refreshUser(session);
    response = {
      user_id : user.user_id,
      profile_image: user.profile_image,
      user_name: user.user_name,
      profile_name: user.profile_name,
      viewer_mode: user.viewer_mode,
      active_token: user.tokens[`${user.current_service}`] ? user.current_service : null
    }
  }
  return response;
}

async function refreshUser(session){
  if(session){ 
    session.user = await postgres.refreshUser(session.user.user_id);
    return session.user;
  }
}

app.get("/token/:service", async function(req, res){
  if(!req.session || !req.session.user){
    res.send({error: "No user to check for token."}); return;
  }

  const user = req.session.user;
  let token = await refreshToken(user, req.params.service);
  if(token){
    res.send({access_token: token.access_token, expiry_time: token.expiry_time});
  }else{
    res.send({error: `No token found for user.`});
  }
});

async function refreshToken(user, set_service = null){
  if(!user || !user.tokens){ return { error: `No user tokens found for token refresh.` }; }

  const service = set_service || user.current_service;

  let token = user.tokens[`${service}`];
  if(!token){ return { error: `No token for ${service} found for token refresh.`}; };

  if(token.expiry_time > Math.floor(Date.now()/1000)){ return token; }

  switch(service){
    case "spotify": token = await spotify.refreshToken(token); break;
    default : token = {error: "No service defined for token refresh." };
  }

  if(!token.error){
    await postgres.setToken(user.user_id, token, user.current_service);
  }

  return token;
}

app.get("/viewing/:viewed_user", async function(req, res){
  const current_user = req.session.user ? req.session.user.user_name : "local";
  res.send(await postgres.getViewedUser(req.params.viewed_user, current_user));
});

app.post("/action", async function(req, res){
  if(!req.session.user){ res.send({error: "User doesn't exist"}); return; }
  const user = await refreshUser(req.session);
  const field = req.body.field;
  const action = req.body.action;
  const data = req.body.data;

  switch(field){
    case "album":
      switch(action){
        case "pull":
          res.send(await postgres.pullUserAlbums(user));
          break;
        case "push":
          res.send(await postgres.pushUserAlbums(user, data));
          break;
        case "add":
          res.send(await postgres.addUserAlbum(user, data));
          break;
        case "update":
          res.send(await postgres.updateUserAlbum(user, data));
          break;
        case "delete":
          res.send(await postgres.deleteUserAlbum(user, data));
          break;
        default:
          res.send({error: "No valid album action provided."});
      }
      break;

    case "rating":
      switch(action){
        case "pull":
          res.send(await postgres.pullUserRatings(user));
          break;
        case "push":
          res.send(await postgres.pushUserRatings(user, data));
          break;
        case "update":
          res.send(await postgres.updateUserRating(user, data));
          break;
        default:
          res.send({error: "No valid rating action provided."});
      }
      break;

    default:
      res.send({error: "No update field provided."});
  }

});

app.get("/oauth/:service/:action", async function(req, res){
  const service = req.params.service;
  const action = req.params.action;

  if(!["login", "signup", "acquire"].includes(action)){
    res.send({error: "OAuth action is invalid."});
    return;
  }

  let user_id = req.session.user ? req.session.user.user_id : null;

  // When doing login/signup, user_id is irrelevant, this check only matters for acquire 
  if(action === "acquire" && !user_id){
    res.send({error: "No user to acquire token for."});
    return;
  }

  switch(service){
    case "spotify": res.send(await spotify.tokenUrl(user_id, action)); break;
    default: res.send({error: "Unknown music service."});
  }
});

app.get("/callback", async function(req, res){
  const split = req.query.state.split(":");
  const service = split[0];
  const user_id = split[1];
  const token_type = split[2];
  const code = req.query.code;
  let user_info;

  switch(service){
    case "spotify": user_info = await spotify.userInfo(code); break;
  }

  user_info.service = service;
  user_info.user_id = user_id;

  switch(token_type){
    case "acquire": await postgres.setToken(user_info); break;
    case "login": 
      const login = await postgres.loginToken(user_info);
      if(login && !login.error){ req.session.user = login; }
      break;
    case "signup":
      const signup = await postgres.signupToken(user_info, token);
      break;
  }

  res.redirect("/");
});

app.get("/loadplayer/:service/:device_id", async function(req, res){
  const user = req.session.user;
  if(user){
    const user_token = await refreshToken(user, req.params.service);
    switch(req.params.service){
      case "spotify": spotify.loadPlayer(req.params.device_id, user_token); break;
    }
  }
});

app.get("/loadtrack/:service/:album_id/:track_pos", async function(req, res){
  const user = req.session.user;
  if(user){
    const user_token = await refreshToken(user, req.params.service);
    switch(req.params.service){
      case "spotify": spotify.loadTrack(req.params.album_id, req.params.track_pos, user_token); break;
    }
  }
});

app.post("/access", async function(req, res) {
  let response = {error: "Issue with login/signup."};

  if(req.body.value === "login"){
    response = await postgres.login(req.body.user_name, req.body.pass_word);
  }else if(req.body.value === "signup"){
    response = await postgres.signup(req.body.user_name, req.body.pass_word, req.body.pass_confirm);
  }

  if(response.error){
    res.status(403).send(response);
  }else{
    req.session.user = response;
    res.send(await sessionUser(req.session));
  }
});

app.get("/logout", async function(req, res){
  if(req.session.user){
    req.session.destroy(async function(err){
      res.clearCookie("connect.sid", {path: "/"})
         .send(await sessionUser(req.session));
    });
  }else{
    res.redirect("/");
  }
});

app.post("/search", async function(req, res){
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

app.get("/*", (req, res) => {
  const parts = req.url.split("/");
  switch(parts[1]){
    case "templates":
      res.sendFile(__dirname + "/frontend/templates/404.html");
      break;
    case "js":
      res.sendFile(__dirname + "/frontend/js/404.js"); 
      break;
    case "css": 
      res.sendFile(__dirname + "/frontend/css/404.css");
      break;
    default:  
      res.sendFile(__dirname + "/frontend/index.html");
  }
});

const port = process.env.server_port;
app.listen(port, "0.0.0.0", () => console.log(`Listening at address ${process.env.server_ip} on port ${port}.`));
