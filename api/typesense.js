const ts = require('typesense')
const dotenv = require('dotenv');
dotenv.config();

let client = new ts.Client({
  'nodes': [{
    'host': process.env.tshost, 
    'port': process.env.tsport,      
    'protocol': 'http'  
  }],
  'apiKey': process.env.tsapikey,
  'connectionTimeoutSeconds': 2
})

let schema = {
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

async function addAlbum(album, query){

  // If collection exists, error will always occur, makes sure to always catch it
  try{await client.collections().create(schema);}catch{}
  
  try{
    await client.collections('albums').documents().create(album);
  }catch(e){
    // Common acronyms will be added as alias to specific album (DSotM => The Dark Side Of The Moon)
    album['aliases'].push(query);
    await client.collections('albums').documents(album.id).update(album);
  }
}

async function query(album_query){
  const query = {
    'q'         : album_query,
    'query_by'  : 'name,artists.name,track_list.name,aliases',
    'pre_segmented_query': true,
    'drop_tokens_threshold': 0
  }

  let query_result = await client.collections('albums').documents().search(query)
                                 .catch(e => {});

  if(!query_result) return                              
                              
  if(query_result.hits.length != 0){
    let response = [];
    for (const hit of query_result.hits){
      response.push(hit.document);
    }
    return response;
  }
}

exports.addAlbum = addAlbum;
exports.query = query;