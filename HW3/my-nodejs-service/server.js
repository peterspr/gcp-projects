const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const { Datastore } = require('@google-cloud/datastore');

const projectId = 'assignment3-367403';
const datastore = new Datastore({projectId:projectId});

const BOAT = "Boat";
const SLIP = "Slip";

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
  console.log(key);
    const new_boat = {"name": name, "type": type, "length": length};
    return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

function patch_boat(id, name, type, length) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = {"name": name, "type": type, "length": length};
  return datastore.update({"key": key, "data": boat});
}

function delete_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  return datastore.delete(key);
}

router.get('/boats', function(req, res) {
  const boats = get_boats()
    .then( (boats) => {
    console.log(boats);
      res.status(200).json(boats);
    });
});

router.get('/boats/:id', function(req, res) {
  get_boat(req.params.id)
    .then( (rec_boat) => {
      console.log(rec_boat);
      if(rec_boat != null) {
        res.status(200).json(rec_boat);
      } else {
        res.status(404).json({"Error": "No boat with this boat_id exists"});
      }
    });
});

// router.get('/boats/:id', function(req, res) {
//   get_boat(req.params.id)
// });

router.post('/boats', function(req, res) {
  console.log(req.body);
  if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
    post_boat(req.body.name, req.body.type, req.body.length).then( key => {res.status(201).json({"id": key.id, "name": req.body.name, "type": req.body.type, "length": req.body.length})});
  } else {
    res.status(400).json({"Error": 'The request object is missing at least one of the required attributes'});
  }
});

router.patch('/boats/:id', function(req, res) {
  if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
    get_boat(req.params.id)
    .then( (rec_boat) => {
      console.log(rec_boat);
      if(rec_boat != null) {
        patch_boat(req.params.id, req.body.name, req.body.type, req.body.length).then(res.status(200).json({"name": req.body.name, "type": req.body.type, "length": req.body.length}));
      } else {
        res.status(404).json({"Error": "No boat with this boat_id exists"});
      }
    });
  } else {
    res.status(400).json({"Error": 'The request object is missing at least one of the required attributes'});
  }
});

// {"name": req.body.name, "type": req.body.type, "length": req.body.length}

router.delete('/boats/:id', function(req, res) {
  get_boat(req.params.id).then( (rec_boat) => {
    if(rec_boat != null) {
      get_slips().then( (slips) => {
        slips.forEach(function(slip) {
          if(slip.current_boat == req.params.id) {
            boat_departs(slip.id, slip.number);
          }
        });
      });
      delete_boat(req.params.id).then(res.status(204).end());
    } else {
      res.status(404).json({"Error": "No boat with this boat_id exists"});
    }
  });
});

function get_slips() {
  const q = datastore.createQuery(SLIP);
  return datastore.runQuery(q).then( (entities) => {
      return entities[0].map(fromDatastore);
    });
}

function get_slip(id) {
  const key = datastore.key([SLIP, parseInt(id, 10)]);
  // const entity = datastore.get(key);
  return datastore.get(key).then( (entities) => {
    return entities[0];
  });
}

function post_slip(number) {
  var key = datastore.key(SLIP);
  console.log(key);
    const new_slip = {"number": number, "current_boat": null};
    return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}


function boat_arrives(slip_id, slip_number, boat_id) {
  const key = datastore.key([SLIP, parseInt(slip_id, 10)]);
  const slip = {"number": slip_number, "current_boat": boat_id};
  return datastore.update({"key": key, "data": slip});
}

function boat_departs(slip_id, slip_number) {
  const key = datastore.key([SLIP, parseInt(slip_id, 10)]);
  const slip = {"number": slip_number, "current_boat": null}
  return datastore.update({"key": key, "data": slip});
}

function delete_slip(id) {
  const key = datastore.key([SLIP, parseInt(id, 10)]);
  return datastore.delete(key);
}

router.get('/slips', function(req, res) {
  const slips = get_slips()
  .then( (slips) => {
  console.log(slips);
    res.status(200).json(slips);
  });
});

router.get('/slips/:id', function(req, res) {
  get_slip(req.params.id)
  .then( (rec_slip) => {
    console.log(rec_slip);
    if(rec_slip != null) {
      res.status(200).json(rec_slip);
    } else {
      res.status(404).json({"Error": "No slip with this slip_id exists"});
    }
  });
});

router.post('/slips', function(req, res) {
  console.log(req.body);
  if(req.body.number != undefined) {
    post_slip(req.body.number).then( key => {res.status(201).json({"id": key.id, "number": req.body.number, "current_boat": null})});
  } else {
    res.status(400).json({"Error": 'The request object is missing the required number'});
  }
});

router.put('/slips/:slip_id/:boat_id', function(req, res) {
  get_slip(req.params.slip_id).then( (rec_slip) => {
    get_boat(req.params.boat_id).then( (rec_boat) => {
      if(rec_slip != null && rec_boat != null) {
        if(rec_slip.current_boat != null) {
          res.status(403).json({"Error": "The slip is not empty"});
        } else {
          boat_arrives(req.params.slip_id, rec_slip.number, req.params.boat_id).then(res.status(204).end());
        }
      } else {
        res.status(404).json({"Error": "The specified boat and/or slip does not exist"});
      }
    });
  });
});

router.delete('/slips/:slip_id/:boat_id', function(req, res) {
  get_slip(req.params.slip_id).then( (rec_slip) => {
    get_boat(req.params.boat_id).then( (rec_boat) => {
      if(rec_slip != null && rec_boat != null && rec_slip.current_boat == req.params.boat_id) {
        boat_departs(req.params.slip_id, rec_slip.number).then(res.status(204).end());
      } else {
        res.status(404).json({"Error":  "No boat with this boat_id is at the slip with this slip_id"});
      }
    });
  });
});

router.delete('/slips/:id', function(req, res) {
  get_slip(req.params.id).then( (rec_slip) => {
    if(rec_slip != null) {
      delete_slip(req.params.id).then(res.status(204).end());
    } else {
      res.status(404).json({"Error": "No slip with this slip_id exists"});
    }
  });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

// app.get('/submit', (req, res) => {
//     res.sendFile(path.join(__dirname, '/views/form.html'));
// });

// app.post('/submit', (req, res) => {
//     console.log({
//         name: req.body.name,
//         message: req.body.message
//     });
//     res.send(req.body.name + ': ' + req.body.message);
// });

