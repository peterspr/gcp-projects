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

const projectId = 'assignment-7-368120';
const datastore = new Datastore({projectId:projectId});

const router = express.Router();
app.use('/', router);

const BOAT = "Boat";

function fromDatastore(item) {
  item.id = item[Datastore.KEY].id;
  return item;
}

const client = new OAuth2Client("745210724001-147663msfccj4vkpvs83r1ph0eh60cme.apps.googleusercontent.com");

router.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, './views/index.html'));
});

router.get('/oauth', function(req, res) {
  const state = req.query.state;
  const code = req.query.code;
  console.log(code)

  if (state === "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") {
    const url = "https://oauth2.googleapis.com/token?code=" + code + "&client_id=745210724001-147663msfccj4vkpvs83r1ph0eh60cme.apps.googleusercontent.com&client_secret=" + state + "&redirect_uri=http://assignment-7-368120.uw.r.appspot.com/oauth&grant_type=authorization_code";
    const request = axios.request({url: url, method: 'POST'}, {
    }).then(function(response) {
      const info_url = "https://people.googleapis.com/v1/people/me?personFields=names";
      const bearer_token = "Bearer " + response.data.access_token;
      const jwt = response.data.id_token;
      // console.log(bearer_token);
      const token_request = axios.request({url:info_url, method: 'GET', headers:{Authorization: bearer_token}}, {
      }).then(function(info_response) {
        info_page = "givenName: " + info_response.data.names[0].givenName + " familyName: " + info_response.data.names[0].familyName + " state: " + state + " JWT: " + jwt;
        res.send(info_page);
        // res.json(info_response.data)
      }).catch(function(info_error) {
        console.log(info_error);
      });
    }).catch(function(error) {
      console.log(error);
    });
  }
});

router.post('/submit', function(req, res) {
  res.redirect("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=745210724001-147663msfccj4vkpvs83r1ph0eh60cme.apps.googleusercontent.com&redirect_uri=http://assignment-7-368120.uw.r.appspot.com/oauth&scope=profile&state=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");
});

function post_boat(name, type, length, public, owner) {
  var key = datastore.key(BOAT);
  const new_boat = {"name": name, "type": type, "length": length, "public": public, "owner": owner};
  return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

router.post('/boats', function(req, res) {
  if(req.headers.authorization != undefined) {
    var token = "";
    var items = req.headers.authorization.split(/[ ]+/);
    if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
        token = items[1];
    }
    const ticket = client.verifyIdToken({
      idToken: token,
      audience: "745210724001-147663msfccj4vkpvs83r1ph0eh60cme.apps.googleusercontent.com"
    }).then( (ticket) => {
      const payload = ticket.getPayload();
      console.log(payload);
      const owner = payload['sub'];
      if(owner != undefined) {
        post_boat(req.body.name, req.body.type, req.body.length, req.body.public, owner).then( key => {
            res.status(201).json({"id": key.id});
        });
      }
      else {
        res.status(401).json({"Error": 'The Authentication provied failed.'});
      }
    }).catch((e) => {
      console.log(e);
      res.status(401).end();
    });
  } else {
    res.status(401).end();
  }
});

function get_boats() {
  const q = datastore.createQuery(BOAT);
  return datastore.runQuery(q).then( (entities) => {
      return entities[0].map(fromDatastore);
    });
}

router.get('/owners/:owner_id/boats', function(req, res) {
  const boats = get_boats()
    .then( (boats) => {
      var owners_public = [];
      boats.forEach((boat) => {
        if(boat.owner == req.params.owner_id && boat.public) {
          owners_public.push(boat);
        }
      });
      res.status(200).json(owners_public);
    });
});



router.get('/unsecure_boats', function(req, res) {
  const boats = get_boats()
    .then( (boats) => {
      res.status(200).json(boats);
    });
});

router.get('/boats', function(req, res) {
  if(req.headers.authorization != undefined) {
    var token = "";
    var items = req.headers.authorization.split(/[ ]+/);
    if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
        token = items[1];
    }
    const ticket = client.verifyIdToken({
      idToken: token,
      audience: "745210724001-147663msfccj4vkpvs83r1ph0eh60cme.apps.googleusercontent.com"
    }).then( (ticket) => {
    const boats = get_boats()
      .then( (boats) => {
        payload = ticket.getPayload();
        const owner = payload['sub'];
        console.log(owner);
        get_boats().then( (boats) => {
            var owners_boats = [];
            boats.forEach((boat) => {
              if(boat.owner == owner) {
                owners_boats.push(boat);
              }
            });
            res.status(200).json(owners_boats);
        });
      });
    }).catch((e) => {
      get_boats().then( (boats) => {
        var public_boats = [];
        boats.forEach( (boat) => {
          if(boat.public) {
            public_boats.push(boat);
          }
        });
        res.status(200).json(public_boats);
      });
    });
  } else {
    get_boats().then( (boats) => {
      var public_boats = [];
      boats.forEach( (boat) => {
        if(boat.public) {
          public_boats.push(boat);
        }
      });
      res.status(200).json(public_boats);
    });
  }
});

function get_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  // const entity = datastore.get(key);
  return datastore.get(key).then( (entities) => {
    return entities[0];
  });
}

function delete_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  return datastore.delete(key);
}

router.delete('/boats/:id', function(req, res) {
  var token = "";
  if(req.headers.authorization == undefined) {
    res.status(401).end();
  } else {
    var items = req.headers.authorization.split(/[ ]+/);
    if (items.length > 1 && items[0].trim().toLowerCase() == "bearer") {
        token = items[1];
    }
    const ticket = client.verifyIdToken({
      idToken: token,
      audience: "745210724001-147663msfccj4vkpvs83r1ph0eh60cme.apps.googleusercontent.com"
    }).then( (ticket) => {
      payload = ticket.getPayload();
      const owner = payload['sub'];
      if(owner != undefined) {
        get_boat(req.params.id).then( (boat) => {
          if(boat != null) {
            if(boat.owner == owner) {
              delete_boat(req.params.id).then(res.status(204).end());
            } else {
              res.status(403);
            }
          } else {
            res.status(403).end();
          }
        });
      }
      else {
        res.status(401).json({"Error": 'The Authentication provied failed.'});
      }
    }).catch((e) => {
      console.log(e);
      res.status(401).end();
    });
  }
});


router.delete('/unsecure_boats/:id', function(req, res) {
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
