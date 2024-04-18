const typesense = require('typesense')
const dotenv = require('dotenv');
dotenv.config();

let CLIENT;

async function initialize(){
  CLIENT = new typesense.Client({
    'nodes': [{
      'host': process.env.tshost, 
      'port': process.env.tsport,      
      'protocol': 'http'  
    }],
    'apiKey': process.env.tsapikey,
    'connectionTimeoutSeconds': 2
  });

  const schema = {
    'name': 'albums',
    "enable_nested_fields": true,
    'fields': [
      {'name': 'id', 'type': 'string' },
      {'name': 'name', 'type': 'string' },
      {'name': 'artists.name', 'type': 'string[]'},
      {'name': 'track_list.name', 'type': 'string[]'},
      {'name': 'genres', 'type': 'string[]' },
      {'name': 'aliases', 'type': 'string[]'}
    ]
  }

  // If collection exists, error will always occur, makes sure to always catch it
  try{await CLIENT.collections().create(schema);}catch{}
}

initialize()
.then(console.log("Typesense server initialized correctly."))
.catch((error) => {console.log(`Typesense server failed to initialize due to the following error:\n${error}`)});

async function addAlbum(album, query){
  try{
    await CLIENT.collections('albums').documents().create(album);
  }catch(e){
    // Common acronyms will be added as alias to specific album (DSotM => The Dark Side Of The Moon)
    album['aliases'].push(query);
    await CLIENT.collections('albums').documents(album.id).update(album);
  }
}

async function query(query_term, query_field = "albums"){  
  const query = {
    'q': query_term,
    'pre_segmented_query': true,
    'drop_tokens_threshold': 0
  }

  switch(query_field){
    case "albums": query['query_by'] = 'name, artists.name, track_list.name, aliases'; break;
  }

  const query_result = await CLIENT.collections(query_field).documents().search(query).catch(e => {});

  if(!query_result) { return null; }
     
  if(query_result.hits.length != 0){
    let response = [];
    for (const hit of query_result.hits){
      response.push(hit.document);
    }
    return response;
  }
}

async function refreshAlbums(refreshed_albums){
  const response = await CLIENT.collections('albums').documents().delete({'filter_by': 'id:*'});

  if(!response.error){
    refreshed_albums.forEach( album => { addAlbum(album, album.id); });
  }
}

exports.addAlbum = addAlbum;
exports.query = query;

module.exports = {
  addAlbum, refreshAlbums, query
};