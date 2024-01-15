const express = require('express');
const app = express();

const path = require('path');

const axios = require('axios');

const bodyParser = require('body-parser');
const { response } = require('express');

app.use(bodyParser.json());
const { Datastore } = require('@google-cloud/datastore');

const jwt = require('express-jwt');
const {OAuth2Client} = require('google-auth-library');

const projectId = 'finalproject-370123';
const datastore = new Datastore({projectId:projectId});

const router = express.Router();
app.use('/', router);

const OWNER = "Owner";
const BOAT = "Boat";
const LOAD = "Load";

function fromDatastore(item) {
  item.id = item[Datastore.KEY].id;
  return item;
}

const client = new OAuth2Client("164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com");

router.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, './views/index.html'));
});

router.get('/oauth', function(req, res) {
  const state = req.query.state;
  const code = req.query.code;

  if (state === "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") {
    const url = "https://oauth2.googleapis.com/token?code=" + code + "&client_id=164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com&client_secret=" + state + "&redirect_uri=http://finalproject-370123.uw.r.appspot.com/oauth&grant_type=authorization_code";
    const request = axios.request({url: url, method: 'POST'}, {
    }).then(function(response) {
      const info_url = "https://people.googleapis.com/v1/people/me?personFields=names";
      const bearer_token = "Bearer " + response.data.access_token;
      const jwt = response.data.id_token;
      const token_request = axios.request({url:info_url, method: 'GET', headers:{Authorization: bearer_token}}, {
      }).then(function(info_response) {
        const ticket = client.verifyIdToken({
          idToken: jwt,
          audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
        }).then( (ticket) => {
          const payload = ticket.getPayload();
          const owner = payload['sub'];
          get_owners().then( (owners) => {
            if(!(owners.some(e => e.owner === owner))) {
              post_owner(owner).then( key => {
                info_page = "givenName: " + info_response.data.names[0].givenName + " familyName: " + info_response.data.names[0].familyName + " state: " + state + " JWT: " + jwt + " owner/unique_id/sub: " + owner;
                res.send(info_page);
              });
            } else {
              info_page = "givenName: " + info_response.data.names[0].givenName + " familyName: " + info_response.data.names[0].familyName + " state: " + state + " JWT: " + jwt + " owner/unique_id/sub: " + owner;
              res.send(info_page);
            }
          });
        });
      }).catch(function(info_error) {
        console.log(info_error);
      });
    }).catch(function(error) {
      console.log(error);
    });
  }
});

router.post('/submit', function(req, res) {
  res.redirect("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com&redirect_uri=http://finalproject-370123.uw.r.appspot.com/oauth&scope=profile&state=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");
});

function post_owner(owner) {
  var key = datastore.key(OWNER);
  const new_owner = {"owner": owner};
  return datastore.save({"key":key, "data":new_owner}).then(() => {return key});
}

function get_owners() {
  const q = datastore.createQuery(OWNER);
  return datastore.runQuery(q).then( (entities) => {
      return entities[0].map(fromDatastore);
    });
}

router.get('/users', function(req, res) {
  get_owners().then( (owners) => {
    res.json(owners);
  });
});

// function delete_owner(id) {
//   const key = datastore.key([OWNER, parseInt(id, 10)]);
//   return datastore.delete(key);
// }

// router.delete('/users/:user_id', function(req, res) {
//   get_owners().then( (owners) => {
//     if(owners.some(e => e.id === req.params.user_id)) {
//       delete_owner(req.params.user_id).then(res.status(204).end());
//     } else {
//       res.status(404).json({"Error": "No owner with this owner_id exists."});
//     }
//   });
// });

function post_boat(name, type, length, owner) {
  var key = datastore.key(BOAT);
  const new_boat = {"name": name, "type": type, "length": length, "owner": owner, "loads": []};
  return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

router.post('/boats', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.headers.authorization != undefined) {
      var token = "";
      var items = req.headers.authorization.split(/[ ]+/);
      if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
          token = items[1];
      }
      const ticket = client.verifyIdToken({
        idToken: token,
        audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
      }).then( (ticket) => {
        const payload = ticket.getPayload();
        const owner = payload['sub'];
        if(owner != undefined) {
          if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
            post_boat(req.body.name, req.body.type, req.body.length, owner).then( key => {
              get_boat(key.id).then( (boat) => {
                boat.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + key.id;
                boat.id = key.id;
                res.status(201).json(boat);
              });
            });
          } else {
            res.status(400).json({"Error": "The request object is missing at least one of the required attributes."});
          }
        }
        else {
          res.status(401).json({"Error": 'The Authentication provided failed.'});
        }
      }).catch((e) => {
        console.log(e);
        res.status(401).json({"Error": 'The Authentication provided failed.'});
      });
    } else {
      res.status(401).json({"Error": 'The Authentication provided failed.'});
    }
  }
});

function get_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  return datastore.get(key).then( (entities) => {
      return entities[0];
  });
}

router.get('/boats/:boat_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.headers.authorization != undefined) {
      var token = "";
      var items = req.headers.authorization.split(/[ ]+/);
      if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
          token = items[1];
      }
      const ticket = client.verifyIdToken({
        idToken: token,
        audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
      }).then( (ticket) => {
        payload = ticket.getPayload();
        const owner = payload['sub'];
        get_boat(req.params.boat_id).then( (boat) => {
          if(boat != null) {
            if(boat.owner === owner) {
              boat.id = req.params.boat_id;
              boat.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + boat.id;
              res.status(200).json(boat);
            } else {
              res.status(403).json({"Error": "You do not own this boat."});
            }
          } else {
            res.status(404).json({"Error": 'No boat with this boat_id exists'});
          }
        }).catch((e) => {
          console.log(e);
          res.status(403).json({"Error": 'You do not own this boat.'});
        });
      }).catch((e) => {
        res.status(401).json({"Error": 'The Authentication provided failed.'});
      });
    } else {
      res.status(401).json({"Error": 'The Authentication provided failed.'});
    }
  }
});

function get_boats(req, owner) {
  const q = datastore.createQuery(BOAT).filter('owner', '=', owner).limit(5);
  const results = {};
  if(Object.keys(req.query).includes("cursor")) {
      q = q.start(req.query.cursor);
  }
  return datastore.runQuery(q).then( (entities) => {
      results.boats = entities[0].map(fromDatastore);
      if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS) {
          results.next = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats" + "?cursor=" + entities[1].endCursor;
      }
      return results;
  });
}

router.get('/boats', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.headers.authorization != undefined) {
      var token = "";
      var items = req.headers.authorization.split(/[ ]+/);
      if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
          token = items[1];
      }
      const ticket = client.verifyIdToken({
        idToken: token,
        audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
      }).then( (ticket) => {
        payload = ticket.getPayload();
        const owner = payload['sub'];
        get_boats(req, owner).then( (results) => {
          results.boats.forEach((boat) => {
            boat.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + boat.id;
          });
          res.status(200).json(results);
        }).catch((e) => {
          console.log(e);
          res.status(401).json({"Error": 'The Authentication provided failed.'});
        });
      }).catch((e) => {
        console.log(e);
        res.status(401).json({"Error": 'The Authentication provided failed.'});
      });
    } else {
      res.status(401).json({"Error": 'The Authentication provided failed.'});
    }
  }
});


function patch_boat(id, name, type, length, owner, loads) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = {"name": name, "type": type, "length": length, "owner": owner, "loads": loads};
  return datastore.update({"key": key, "data": boat}).then(() => {return key});
}

router.patch('/boats/:boat_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.headers.authorization != undefined) {
      var token = "";
      var items = req.headers.authorization.split(/[ ]+/);
      if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
          token = items[1];
      }
      const ticket = client.verifyIdToken({
        idToken: token,
        audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
      }).then( (ticket) => {
        const payload = ticket.getPayload();
        const owner = payload['sub'];
        if(owner != undefined) {
          get_boat(req.params.boat_id).then( (boat) => {
            if(boat != null) {
              if(boat.owner === owner) {
                if(req.body.name != undefined || req.body.type != undefined || req.body.length != undefined) {
                  let name = req.body.name != undefined ? req.body.name : boat.name;
                  let type = req.body.type != undefined ? req.body.type : boat.type;
                  let length = req.body.length != undefined ? req.body.length : boat.length;
                  patch_boat(req.params.boat_id, name, type, length, boat.owner, boat.loads).then( (key) => {
                    let self_url = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + key.id;
                    res.status(200).json({"id": key.id, "name": name, "type": type, "length": length, "owner": boat.owner, "loads": boat.loads, "self": self_url});
                  });
                } else {
                  res.status(400).json({"Error": "The request object must have at least one altered attribute."});
                }
              } else {
                res.status(403).json({"Error": 'You do not own this boat.'});
              }
            } else {
              res.status(404).json({"Error": 'No boat with this boat_id exists'});
            }
          });
        }
        else {
          res.status(401).json({"Error": 'The Authentication provided failed.'});
        }
      }).catch((e) => {
        console.log(e);
        res.status(401).json({"Error": 'The Authentication provided failed.'});
      });
    } else {
      res.status(401).json({"Error": 'The Authentication provided failed.'});
    }
  }
});

function put_boat(id, name, type, length, owner, loads) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = {"name": name, "type": type, "length": length, "owner": owner, "loads": loads};
  return datastore.update({"key": key, "data": boat}).then(() => {return key});
}

router.put('/boats/:boat_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.headers.authorization != undefined) {
      var token = "";
      var items = req.headers.authorization.split(/[ ]+/);
      if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
          token = items[1];
      }
      const ticket = client.verifyIdToken({
        idToken: token,
        audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
      }).then( (ticket) => {
        const payload = ticket.getPayload();
        const owner = payload['sub'];
        if(owner != undefined) {
          get_boat(req.params.boat_id).then( (boat) => {
            if(boat != null) {
              if(boat.owner === owner) {
                if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
                  put_boat(req.params.boat_id, req.body.name, req.body.type, req.body.length, boat.owner, boat.loads).then( (key) => {
                    let self_url = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + key.id;
                    res.status(200).json({"id": key.id, "name": req.body.name, "type": req.body.type, "length": req.body.length, "owner": boat.owner, "loads": boat.loads, "self": self_url});
                  });
                } else {
                  res.status(400).json({"Error": "The request object is missing at least one of the required attributes."});
                }
              } else {
                res.status(403).json({"Error": 'You do not own this boat.'});
              }
            } else {
              res.status(404).json({"Error": 'No boat with this boat_id exists'});
            }
          });
        }
        else {
          res.status(401).json({"Error": 'The Authentication provided failed.'});
        }
      }).catch((e) => {
        console.log(e);
        res.status(401).json({"Error": 'The Authentication provided failed.'});
      });
    } else {
      res.status(401).json({"Error": 'The Authentication provided failed.'});
    }
  }
});

function delete_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  return datastore.delete(key);
}

router.delete('/boats/:boat_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.headers.authorization != undefined) {
      var token = "";
      var items = req.headers.authorization.split(/[ ]+/);
      if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
          token = items[1];
      }
      const ticket = client.verifyIdToken({
        idToken: token,
        audience: "164449634842-38pm01oo08lk87jpu0nghmlj7npp5n6r.apps.googleusercontent.com"
      }).then( (ticket) => {
        const payload = ticket.getPayload();
        const owner = payload['sub'];
        if(owner != undefined) {
          get_boat(req.params.boat_id).then( (boat) => {
            if(boat != null) {
              if(boat.owner === owner) {
                let num_loads = boat.loads.length;
                let num_removed = 0;
                if(num_loads > 0) {
                  boat.loads.forEach( (load_id) => {
                    get_load(load_id.id).then( (load) => {
                      remove_carrier(load, load_id.id).then( (removed) => {
                        num_removed++;
                        if(num_loads == num_removed) {
                          delete_boat(req.params.boat_id).then(res.status(204).end());
                        }
                      });
                    });
                  });
                } else {
                  delete_boat(req.params.boat_id).then(res.status(204).end());
                }
              } else {
                res.status(403).json({"Error": 'You do not own this boat.'});
              }
            } else {
              res.status(404).json({"Error": 'No boat with this boat_id exists'});
            }
          });
        }
        else {
          res.status(401).json({"Error": 'The Authentication provided failed.'});
        }
      }).catch((e) => {
        console.log(e);
        res.status(401).json({"Error": 'The Authentication provided failed.'});
      });
    } else {
      res.status(401).json({"Error": 'The Authentication provided failed.'});
    }
  }
});

function get_loads(req) {
  const q = datastore.createQuery(LOAD).limit(5);
  const results = {};
  if(Object.keys(req.query).includes("cursor")) {
      q = q.start(req.query.cursor);
  }
  return datastore.runQuery(q).then( (entities) => {
      results.loads = entities[0].map(fromDatastore);
      if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS) {
          results.next = req.protocol + "://finalproject-370123.uw.r.appspot.com/loads" + "?cursor=" + entities[1].endCursor;
      }
      return results;
  });
}

router.get('/loads', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    get_loads(req).then( (results) => {
      results.loads.forEach((load) => {
        load.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/loads/" + load.id;
      });
      res.status(200).json(results);
    });
  }
});

function get_load(id) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  return datastore.get(key).then( (entities) => {
      return entities[0];
  });
}

router.get('/loads/:load_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    get_load(req.params.load_id).then( (load) => {
      if(load != null) {
        load.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/loads/" + req.params.load_id;
        load.id = req.params.load_id;
        res.status(200).json(load);
      } else {
        res.status(404).json({"Error": "No load with this load_id exists"});
      }
    });
  }
});

function post_load(volume, item, creation_date) {
  let key = datastore.key(LOAD);
  const new_load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": null};
  return datastore.save({"key": key, "data": new_load}).then( () => {return key});
}

router.post('/loads', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.body.volume != undefined && req.body.item != undefined && req.body.creation_date != undefined) {
        post_load(req.body.volume, req.body.item, req.body.creation_date).then( key => {
          const self_url = req.protocol + "://finalproject-370123.uw.r.appspot.com/loads/" + key.id;
          res.status(201).json({"id": key.id, "volume": req.body.volume, "item": req.body.item, "creation_date": req.body.creation_date, "carrier": null, "self": self_url});
        });
    } else {
        res.status(400).json({"Error": 'The request object is missing at least one of the required attributes'});
    }
  }
});

function patch_load(id, volume, item, creation_date, carrier) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  const load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": carrier};
  return datastore.update({"key": key, "data": load}).then(() => {return key});
}

router.patch('/loads/:load_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.body.volume != undefined || req.body.item != undefined || req.body.creation_date != undefined) {
      get_load(req.params.load_id).then( (load) => {
        if(load != null) {
          let volume = req.body.volume != undefined ? req.body.volume : load.volume;
          let item = req.body.item != undefined ? req.body.item : load.item;
          let creation_date = req.body.creation_date != undefined ? req.body.creation_date : load.creation_date;
          patch_load(req.params.load_id, volume, item, creation_date, load.carrier).then( (key) => {
            let self_url = req.protocol + "://finalproject-370123.uw.r.appspot.com/loads/" + key.id;
            res.status(200).json({"id": key.id.toString(), "volume": volume, "item": item, "creation_date": creation_date, "carrier": load.carrier, "self": self_url});
          });
        } else {
          res.status(404).json({"Error": 'No load with this load_id exists'});
        }
      });
    } else {
      res.status(400).json({"Error": "The request object must have at least one altered attribute."});
    }
  }
});

function put_load(id, volume, item, creation_date, carrier) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  const load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": carrier};
  return datastore.update({"key": key, "data": load}).then(() => {return key});
}

router.put('/loads/:load_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    if(req.body.volume != undefined && req.body.item != undefined && req.body.creation_date != undefined) {
      get_load(req.params.load_id).then( (load) => {
        if(load != null) {
          put_load(req.params.load_id, req.body.volume, req.body.item, req.body.creation_date, load.carrier).then( (key) => {
            let self_url = req.protocol + "://finalproject-370123.uw.r.appspot.com/loads/" + key.id;
            res.status(200).json({"id": key.id.toString(), "volume": req.body.volume, "item": req.body.item, "creation_date": req.body.creation_date, "carrier": load.carrier, "self": self_url});
          });
        } else {
          res.status(404).json({"Error": 'This load does not exist'});
        }
      });
    } else {
      res.status(400).json({"Error": "The request object is missing all of the changeable attributes."});
    }
  }
});

function delete_load(id) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  return datastore.delete(key);
}

router.delete('/loads/force/:load_id', function(req,res) {
  delete_load(req.params.load_id).then(res.status(204).end());
});

router.delete('/loads/:load_id', function(req, res) {
  get_load(req.params.load_id).then( (load) => {
      if(load != null) {
        if(load.carrier != null) {
          get_boat(load.carrier.id).then( (boat) => {
            remove_load(boat, load.carrier.id, req.params.load_id).then( new_boat => {
              delete_load(req.params.load_id).then(res.status(204).end());
            });
          });
        } else {
          delete_load(req.params.load_id).then(res.status(204).end());
        }
      } else {
          res.status(404).json({"Error": "No load with this load_id exists"});
      }
  });
});

function add_carrier(old_load, old_boat, load_id, boat_id) {
  const key = datastore.key([LOAD, parseInt(load_id, 10)]);
  const boat_self = "http" + "://finalproject-370123.uw.r.appspot.com/loads/" + boat_id;
  const carrier = {"id": boat_id, "self": boat_self};
  const load = {"volume": old_load.volume, "item": old_load.item, "creation_date": old_load.creation_date, "carrier": carrier};
  return datastore.update({"key": key, "data": load});
}

function add_load(old_boat, old_load, load_id, boat_id) {
  const key = datastore.key([BOAT, parseInt(boat_id, 10)]);
  const new_loads = old_boat.loads;
  const load_self = "http" + "://finalproject-370123.uw.r.appspot.com/loads/" + load_id;
  new_loads.push({"id": load_id, "self": load_self});
  const boat = {"name": old_boat.name, "type": old_boat.type, "length": old_boat.length, "owner": old_boat.owner, "loads": new_loads};
  return datastore.update({"key": key, "data": boat});
}

// Relational endpoints
router.put('/boats/:boat_id/loads/:load_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    get_boat(req.params.boat_id).then( (boat) => {
      if(boat != null) {
        get_load(req.params.load_id).then( (load) => {
          if(load != null) {
            if(load.carrier == null) {
              add_carrier(load, boat, req.params.load_id, req.params.boat_id).then((new_load) => {
                console.log('added carrier')
                add_load(boat, load, req.params.load_id, req.params.boat_id).then((new_boat) => {
                  get_boat(req.params.boat_id).then( (filled_boat) => {
                    filled_boat.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + req.params.boat_id;
                    res.status(200).json(filled_boat);
                  });
                });
              });
            } else {
              res.status(403).json({"Error": "This load already has a carrier."});
            }
          } else {
            res.status(404).json({"Error": 'Incorrect load_id or boat_id'});
          }
        });
      } else {
        res.status(404).json({"Error": 'Incorrect load_id or boat_id'});
      }
    });
  }
});

function remove_load(boat, boat_id, load_id) {
  const key = datastore.key([BOAT, parseInt(boat_id, 10)]);
  const new_loads = boat.loads;
  const load_index = new_loads.findIndex(el => {
      return el.id = load_id;
  });
  new_loads.splice(load_index, 1);
  const new_boat = {"name": boat.name, "type": boat.type, "length": boat.length, "owner": boat.owner, "loads": new_loads};
  return datastore.update({"key": key, "data": new_boat});
}

function remove_carrier(load, load_id) {
  const key = datastore.key([LOAD, parseInt(load_id, 10)]);
  const new_load = {"volume": load.volume, "item": load.item, "creation_date": load.creation_date, "carrier": null};
  return datastore.update({"key": key, "data": new_load});
}

router.delete('/boats/:boat_id/loads/:load_id', function(req, res) {
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
  } else {
    get_boat(req.params.boat_id).then( (boat) => {
      if(boat != null) {
        get_load(req.params.load_id).then( (load) => {
          if(load != null) {
            if(load.carrier != null) {
              if(load.carrier.id === req.params.boat_id) {
                remove_carrier(load, req.params.load_id).then( (new_load) => {
                  remove_load(boat, req.params.boat_id, req.params.load_id).then( (new_boat) => {
                    new_boat.self = req.protocol + "://finalproject-370123.uw.r.appspot.com/boats/" + new_boat.id;
                    res.status(204).end();
                  });
                });
              } else {
                res.status(403).json({"Error": "Load carrier does not match boat_id"});
              }
            } else {
              res.status(403).json({"Error": "Load carrier does not match boat_id"});
            }
          } else {
            res.status(404).json({"Error": 'Incorrect load_id or boat_id'});
          }
        });
      } else {
        res.status(404).json({"Error": 'Incorrect load_id or boat_id'});
      }
    });
  }
});

router.post('/boats/:boat_id', function(req, res) {
  res.set('Accept', 'GET, PATCH, PUT, DELETE');
  res.status(405).end();
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
