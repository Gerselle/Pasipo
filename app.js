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


function sessionUser(session){
  let response = {user_id: null, user_name: "local"};
  if(session.authenticated && session.user){
    const user = session.user;
    response = { 
      user_id : user.user_id,
      profile_image: user.profile_image,
      user_name: user.user_name,
      profile_name: user.profile_name,
      viewer_mode: user.viewer_mode
    } 
  }
  return response;
}

app.get("/check", function(req, res){
  res.send(sessionUser(req.session)); 
});

app.get("/viewing/:viewed_user", async function(req, res){
  const current_user = req.session.user ? req.session.user.user_name : "local";
  res.send(await postgres.getViewedUser(req.params.viewed_user, current_user));
});

app.get("/album_id/:id", async function(req, res){
  res.send(await postgres.getAlbum(req.params.id));
});

app.post("/action", async function(req, res){
  if(req.session.authenticated){
    const session = req.session;
    const field = req.body.field;
    const action = req.body.action;
    const data = req.body.data;

    switch(field){
      case "album":
        switch(action){
          case "pull":
            res.send(await postgres.pullUserAlbums(session.user));
            break;
          case "push":
            res.send(await postgres.pushUserAlbums(session.user, data));
            break;
          case "add":
            res.send(await postgres.addUserAlbum(session.user, data));
            break;
          case "update":
            res.send(await postgres.updateUserAlbum(session.user, data));
            break;
          case "delete":
            res.send(await postgres.deleteUserAlbum(session.user, data));
            break;
          default:
            res.send({error: "No valid album action provided."});
        }
        break;

      case "rating":
        switch(action){
          case "pull":
            res.send(await postgres.pullUserRatings(session.user));
            break;
          case "push":
            res.send(await postgres.pushUserRatings(session.user, data));
            break;
          case "update":
            res.send(await postgres.updateUserRating(session.user, data));
            break;
          default:
            res.send({error: "No valid rating action provided."});
        }
        break;

      default:
        res.send({error: "No update field provided."});
    }
  }else{
    res.send({error: "User is not authenticated."})
  }
});


app.get("/callback", async function(req, res){
  if(req.query.code){
    // Add this user"s token to the database
    user = await spotify.authorize(req.query.code);
  }
  res.redirect("/");
});

app.get("/spotify", function(req, res) {
  res.redirect(process.env.authorization_request);
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
    req.session.authenticated = true;
    req.session.user = response;
    res.send(sessionUser(req.session));
  }
});

app.get("/logout", async function(req, res){
  if(req.session.authenticated){
    req.session.destroy(function(err){
      res.clearCookie("connect.sid", {path: "/"}).send(sessionUser(session));
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
