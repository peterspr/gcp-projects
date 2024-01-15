const express = require('express');
const app = express();

const json2html = require('json-to-html');

const bodyParser = require('body-parser');
const { Datastore } = require('@google-cloud/datastore');

const projectId = 'elevated-apex-364017';
const datastore = new Datastore({projectId:projectId});

const BOAT = "Boat";

app.use(bodyParser.json());

const router = express.Router();
app.use('/', router);

function fromDatastore(item) {
  item.id = item[Datastore.KEY].id;
  return item;
}

function get_boats() {
  const q = datastore.createQuery(BOAT);
  return datastore.runQuery(q).then( (entities) => {
      return entities[0].map(fromDatastore);
    });
}

function get_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  // const entity = datastore.get(key);
  return datastore.get(key).then( (entities) => {
    return entities[0];
  });
}

function post_boat(name, type, length) {
  var key = datastore.key(BOAT);
  const new_boat = {"name": name, "type": type, "length": length, "self": ""};
  return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

function update_self_url(id, name, type, length, self_url) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = {"id": id, "name": name, "type": type, "length": length, "self": self_url};
  return datastore.update({"key": key, "data": boat});
}

function patch_boat(id, name, type, length, self_url) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = {"name": name, "type": type, "length": length, "self": self_url};
  return datastore.update({"key": key, "data": boat});
}

function put_boat(id, name, type, length) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = {"name": name, "type": type, "length": length};
  return datastore.update({"key": key, "data": boat}).then(() => {return key});
}

function delete_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  return datastore.delete(key);
}

router.get('/boats', function(req, res) {
  const boats = get_boats()
    .then( (boats) => {
      res.status(200).json(boats);
    });
});

router.get('/boats/:id', function(req, res) {
  get_boat(req.params.id).then( (rec_boat) => {
    const accepts = req.accepts(['application/json', 'text/html']);
    if(rec_boat != null) {
      if(!accepts) {
        res.status(406).json({"Error": 'Not Acceptable'});
        return;
      } else if(accepts === 'application/json') {
        res.status(200).json(rec_boat);
        return;
      } else if(accepts === 'text/html') {
        res.status(200).send(json2html(rec_boat).slice(1,-1));
        return;
      } else {
        res.status(500).send('Content type got messed up!');
        return;
      }
    } else {
      res.status(404).json({"Error": "No boat with this boat_id exists."});
      return;
    }
    });
});


// Boat creation restrictions
// - all attributes are defined and of the correct type
// - name is made up of A-Z, a-z characters or numbers, type is A-Z, a-z characters only.
// - No repeat names
// - Only accepts application/json data
// - Only returns application/json data
router.post('/boats', function(req, res) {
  if(req.get('content-type') != 'application/json') {
    res.status(415).json({"Error": 'Server only accepts application/json data.'});
    return;
  }
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
    return;
  }
  if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
    if(typeof(req.body.name) != "string" || typeof(req.body.type) != "string" || typeof(req.body.length) != "number") {
      res.status(400).json({"Error": "They variable type of one of the inputs is incorrect. name: string, type: string, length: number."});
      return;
    } else if(!(/^[A-Za-z0-9\ ]*$/.test(req.body.name))) {
      res.status(400).json({"Error": 'Boat name must be made up of only A-Z, a-z, or 0-9 characters.'});
      return;
    } else if(!(/^[A-Za-z\ ]*$/.test(req.body.type))) {
      res.status(400).json({"Error": 'Boat type must be made up of only A-Z or a-z characters.'});
      return;
    } else if(req.body.name.length > 30 || req.body.type.length > 30) {
      res.status(400).json({"Error": "Boat name and type must be a maximum of 30 characters long."});
      return;
    } else {
      get_boats().then( (boats) => {
        if(boats.some(e => e.name === req.body.name)) {
          res.status(403).json({"Error": 'A boat with the same name already exists.'});
          return;
        } else {
          post_boat(req.body.name, req.body.type, req.body.length).then( key => {
            let self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + key.id;
            update_self_url(key.id, req.body.name, req.body.type, req.body.length, self_url).then(
              res.status(201).json({"id": key.id, "name": req.body.name, "type": req.body.type, "length": req.body.length, "self": self_url}));
              return;
          });
        }
      });
    }
  } else {
    res.status(400).json({"Error": "The request object is missing at least one of the required attributes."});
    return;
  }
});

router.patch('/boats/:id', function(req, res) {
  if(req.get('content-type') !== 'application/json') {
    res.status(415).json({"Error": 'Server only accepts application/json data.'});
    return;
  }
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
    return;
  }
  if(req.body.hasOwnProperty('id')) {
    res.status(400).json({"Error": "Cannot edit the id of a boat."});
    return;
  }
  if(req.body.name == undefined && req.body.type == undefined && req.body.length == undefined) {
    res.status(400).json({"Error": 'The request object must have at least one altered attribute.'});
    return;
  }
  get_boat(req.params.id).then( (rec_boat) => {
    if(rec_boat != null) {
      const new_boat = {"id": req.params.id, "name": rec_boat.name, "type": rec_boat.type, "length": rec_boat.length, "self": rec_boat.self};
      if(req.body.type != undefined) {
        if(typeof(req.body.type) != "string") {
          res.status(400).json({"Error": "The boat type must be a string."});
          return;
        } else if(req.body.type.length > 30) {
          res.status(400).json({"Error": "Boat type must be a maximum of 30 characters long."});
          return;
        } else if(/^[A-Za-z\ ]*$/.test(req.body.type)) {
          new_boat.type = req.body.type;
        } else {
          res.status(400).json({"Error": 'Boat type must be made up of only A-Z or a-z characters.'});
          return;
        }
      }
      if(req.body.length != undefined) {
        if(typeof(req.body.length) != "number") {
          res.status(400).json({"Error": "The boat length must be a number."});
          return;
        } else {
          new_boat.length = req.body.length;
        }
      }
      if(req.body.name != undefined) {
        if(typeof(req.body.name) != "string") {
          res.status(400).json({"Error": "The boat name must be a string."});
          return;
        } else if(req.body.name.length > 30) {
          res.status(400).json({"Error": "Boat name must be a maximum of 30 characters long."});
          return;
        } else if(!(/^[A-Za-z0-9\ ]*$/.test(req.body.name))) {
          res.status(400).json({"Error": "Boat name must be made up of only A-Z, a-z, or 0-9 characters."});
          return;
        } else {
          get_boats().then( (boats) => {
            if(boats.some(e => e.name === req.body.name)) {
              res.status(403).json({"Error": 'A boat with the same name already exists.'});
              return;
            } else {
              new_boat.name = req.body.name;
              patch_boat(req.params.id, new_boat.name, new_boat.type, new_boat.length, new_boat.self).then(res.status(200).json(new_boat));
              return;
            }
          });
        }
      } else {
        patch_boat(req.params.id, new_boat.name, new_boat.type, new_boat.length, new_boat.self).then(res.status(200).json(new_boat));
        return;
      }
    } else {
      res.status(404).json({"Error": "No boat with this boat_id exists."});
      return;
    }
  });
});


router.put('/boats/:id', function(req, res) {
  if(req.get('content-type') !== 'application/json') {
    res.status(415).json({"Error": 'Server only accepts application/json data.'});
    return;
  }
  const accepts = req.accepts(['application/json']);
  if(!accepts) {
    res.status(406).json({"Error": "Not acceptable content type return."});
    return;
  }
  if(req.body.hasOwnProperty('id')) {
    res.status(400).json({"Error": "Cannot edit the id of a boat."});
    return;
  }
  if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
    if(typeof(req.body.name) != "string" || typeof(req.body.type) != "string" || typeof(req.body.length) != "number") {
      res.status(400).json({"Error": "The variable type of one of the inputs is incorrect. name: string, type: string, length: number"});
      return;
    } else if(!(/^[A-Za-z0-9\ ]*$/.test(req.body.name))) {
      res.status(400).json({"Error": 'Boat name must be made up of only A-Z, a-z, or 0-9 characters.'});
      return;
    } else if(!(/^[A-Za-z\ ]*$/.test(req.body.type))) {
      res.status(400).json({"Error": 'Boat type must be made up of only A-Z or a-z characters.'});
      return;
    }
    if(req.body.name.length > 30 || req.body.type.length > 30) {
      res.status(400).json({"Error": "Boat name and type must be a maximum of 30 characters long."});
      return;
    }
    get_boat(req.params.id).then( (rec_boat) => {
      if(rec_boat != null) {
        get_boats().then( (boats) => {
          if(boats.some(e => e.name === req.body.name)) {
            res.status(403).json({"Error": 'A boat with the same name already exists.'});
            return;
          } else {
            put_boat(req.params.id, req.body.name, req.body.type, req.body.length).then( (key) => {
              const self_url = req.protocol + "://" + req.get('host') + req.baseUrl + '/boats/' + key.id;
              res.location(self_url);
              res.status(303).json({"id": req.params.id, "name": req.body.name, "type": req.body.type, "length": req.body.length, "self": self_url});
              return;
            });
          };
        });
      } else {
        res.status(404).json({"Error": "No boat with this boat_id exists."});
        return;
      }
    });
  } else {
    res.status(400).json({"Error": 'The request object is missing at least one of the required attributes'});
    return;
  }
});

router.delete('/boats', function(req, res) {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

router.patch('/boats', function(req, res) {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

router.put('/boats', function(req, res) {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

router.delete('/boats/:id', function(req, res) {
  get_boat(req.params.id).then( (rec_boat) => {
    if(rec_boat != null) {
      delete_boat(req.params.id).then(res.status(204).end());
    } else {
      res.status(404).json({"Error": "No boat with this boat_id exists."});
    }
  });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
