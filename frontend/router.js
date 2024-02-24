document.addEventListener("click", (e) => {
  const target = e.target;
  if(!target.matches("a")){ return }
  e.preventDefault();
  route(e);
})

const title = "Pasipo"

const routes = {
  404:{
    template: "/templates/404.html", 
    title: `404 | ${title}`,
    description: ""
  },
  "/":{
    template: "/templates/home.html", 
    title: `Home | ${title}`,
    description: ""
  },
  "/signup":{
    template: "/templates/signup.html", 
    title: `Sign Up | ${title}`,
    description: ""
  },  
  "/login":{
    template: "/templates/login.html", 
    title: `Log In | ${title}`,
    description: ""
  },
  "/album":{
    template: "/templates/album.html", 
    title: `Albums | ${title}`,
    description: ""
  }
}

const unreachable = ["/login", "/signup", "/logout"];

async function route(event){
  event.preventDefault();
  url = event.target.getAttribute('href');

  if(!unreachable.includes(url)){
    window.history.pushState({}, "", event.target.href);
  }

  locationHandler(url);
}

async function locationHandler(location){
  if(!location){location = window.location.pathname;}

  if(location.length == 0){location = "/";}

  const route = routes[location] || routes[404];
  const html = await fetch(route.template).then((response) => response.text());
  document.title = route.title;

  const access = document.getElementById("background_blur");

  if(["/login", "/signup"].includes(location)){
    document.getElementById("access").innerHTML = html;
    access.style.display = "flex";
  }else{
    document.getElementById("content").innerHTML = html;
    access.style.display = "none";
  }

}

window.onpopstate = locationHandler();

locationHandler();