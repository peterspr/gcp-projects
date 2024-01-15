const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
// const loads = require('./loads');
const ds = require('./datastore');

const datastore = ds.datastore;

const BOAT = 'Boat';
const LOAD = 'Load';

router.use(bodyParser.json());

function post_boat(name, type, length, req) {
    let key = datastore.key(BOAT);
    // let self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
    const new_boat = {"name": name, "type": type, "length": length, "loads": [], "self": ""};
    return datastore.save({"key": key, "data": new_boat}).then( () => {return key});
}

function update_self_url(id, name, type, length, loads, self_url) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    const boat = {"id": id, "name": name, "type": type, "length": length, "loads": loads, "self": self_url};
    return datastore.update({"key": key, "data": boat});
}

function get_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key).then( (entities) => {
        return entities[0];
    });
}

function get_boat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then( (entities) => {
        return entities[0];
    });
}

// function get_boat_loads(id) {
//     const q = datastore.createQuery(BOAT);
//     return datastore.runQuery(q).then( (entities) => {
//         return entities[0].map(ds.fromDatastore);
//     });
// }

function get_boats(req) {
    const q = datastore.createQuery(BOAT).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    return datastore.runQuery(q).then( (entities) => {
        results.boats = entities[0].map(ds.fromDatastore);
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

function add_load(boat_id, old_boat, load_id, load) {
    const key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    const new_loads = old_boat.loads;
    new_loads.push({"id": load_id, "self": load.self});
    const boat = {"name": old_boat.name, "type": old_boat.type, "length": old_boat.length, "self": old_boat.self, "loads": new_loads};
    return datastore.update({"key": key, "data": boat});
}

function add_carrier(boat_id, old_boat, load_id, load) {
    const key = datastore.key([LOAD, parseInt(load_id, 10)]);
    const new_carrier = {"id": boat_id, "name": old_boat.name, "self": old_boat.self};
    const new_load = {"volume": load.volume, "item": load.item, "creation_date": load.creation_date, "carrier": new_carrier, "self": load.self};
    return datastore.update({"key": key, "data": new_load});
}

function remove_load(boat_id, boat, load_id) {
    const key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    const new_loads = boat.loads;
    const load_index = new_loads.findIndex(el => {
        return el.id = load_id;
    });
    new_loads.splice(load_index, 1);
    const new_boat = {"name": boat.name, "type": boat.type, "length": boat.length, "self": boat.self, "loads": new_loads};
    return datastore.update({"key": key, "data": new_boat});
}

function remove_carrier(load_id, load) {
    const key = datastore.key([LOAD, parseInt(load_id, 10)]);
    const new_load = {"volume": load.volume, "item": load.item, "creation_date": load.creation_date, "carrier": null, "self": load.self};
    return datastore.update({"key": key, "data": new_load});
}

function delete_boat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.delete(key);
}

// Create Boat
router.post('/', function(req, res) {
    if(req.body.name != undefined && req.body.type != undefined && req.body.length != undefined) {
        post_boat(req.body.name, req.body.type, req.body.length, req).then( key => {
            let self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
            update_self_url(key.id, req.body.name, req.body.type, req.body.length, [], self_url).then(
            res.status(201).json({"id": key.id, "name": req.body.name, "type": req.body.type, "length": req.body.length, "loads": [], "self": self_url}));
        });
    } else {
        res.status(400).json({"Error": 'The request object is missing at least one of the required attributes'});
    }
});

// Get Boat by id
router.get('/:id', function(req, res) {
    get_boat(req.params.id).then( (rec_boat) => {
        if(rec_boat != null) {
            rec_boat.id = req.params.id;
            res.status(200).json(rec_boat);
        } else {
            res.status(404).json({"Error": "No boat with this boat_id exists"});
        }
    });
});

router.get('/:boat_id/loads', function(req, res) {
    get_boat(req.params.boat_id).then( (rec_boat) => {
        if(rec_boat != null) {
            const load_list = {"loads": []};
            console.log(rec_boat.loads.length);
            for(var i = 0; i < rec_boat.loads.length; i++) {
                get_load(rec_boat.loads[i].id).then( (rec_load) => load_list['loads'].push(rec_load));
            }
            console.log(load_list);
            res.status(200).json(load_list);
        } else {
            res.status(404).json({"Error": "No boat with this boat_id exists"})
        }
    });
    console.log("stuck");
});


// Get Boats
router.get('/', function(req, res) {
    const boats = get_boats(req).then( (boats) => {
        res.status(200).json(boats);
    });
});

// Add load to boat

//  TODO: need to figure out how to call get_load from another file.
//        Need to complete the add_load function. 
router.put('/:boat_id/loads/:load_id', function(req, res) {
    get_boat(req.params.boat_id).then( (rec_boat) => {
        get_load(req.params.load_id).then( (rec_load) => {
            if(rec_boat != null && rec_load != null) {
                if(rec_load.carrier == null) {
                    add_load(req.params.boat_id, rec_boat, req.params.load_id, rec_load).then(
                        add_carrier(req.params.boat_id, rec_boat, req.params.load_id, rec_load).then(res.status(204).end()));
                } else {
                    res.status(403).json({"Error": "The load is already loaded on another boat"});
                }
            } else {
                res.status(404).json({"Error": "The specified boat and/or load does not exist"});
            }
        });
    });
});

// Delete Load from Boat
router.delete('/:boat_id/loads/:load_id', function(req, res) {
    get_boat(req.params.boat_id).then( (rec_boat) => {
        get_load(req.params.load_id).then( (rec_load) => {
            if(rec_boat != null && rec_load != null) {
                if(rec_boat.loads.some(e => e.id == req.params.load_id)) {
                    remove_load(req.params.boat_id, rec_boat, req.params.load_id).then(
                        remove_carrier(req.params.load_id, rec_load).then(res.status(204).end()));
                } else {
                    res.status(404).json({"Error": "No boat with this boat_id is loaded with the load with this load_id"});
                }
            } else {
                res.status(404).json({"Error": "No boat with this boat_id is loaded with the load with this load_id"});
            }
        });
    });
});

// Delete Boat
router.delete('/:id', function(req, res) {
    get_boat(req.params.id).then( (rec_boat) => {
        if(rec_boat != null) {
            rec_boat.loads.forEach(function(load) {
                get_load(load.id).then( (rec_load) => {
                    if(rec_load != null) {
                        remove_carrier(load.id, rec_load);
                    }
                });
            });
            delete_boat(req.params.id).then(res.status(204).end());
        } else {
            res.status(404).json({"Error": "No boat with this boat_id exists"});
        }
    });
});

module.exports = router;