const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');

const datastore = ds.datastore;

const BOAT = 'Boat';
const LOAD = 'Load';

router.use(bodyParser.json());

function post_load(volume, item, creation_date, req) {
    let key = datastore.key(LOAD);
    const new_load = {"volume": volume, "item": item, "creation_date": creation_date, "carrier": null, "self": ""};
    return datastore.save({"key": key, "data": new_load}).then( () => {return key});
}

function update_self_url(id, volume, item, creation_date, carrier, self_url) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    const load = {"id": id, "volume": volume, "item": item, "creation_date": creation_date, "carrier": carrier, "self": self_url};
    return datastore.update({"key": key, "data": load});
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

function get_loads(req) {
    const q = datastore.createQuery(LOAD).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    return datastore.runQuery(q).then( (entities) => {
        results.loads = entities[0].map(ds.fromDatastore);
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

function delete_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.delete(key);
}

// Create Load
router.post('/', function(req, res) {
    if(req.body.volume != undefined && req.body.item != undefined && req.body.creation_date != undefined) {
        post_load(req.body.volume, req.body.item, req.body.creation_date, req).then( key => {
            let self_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
            update_self_url(key.id, req.body.volume, req.body.item, req.body.creation_date, null, self_url).then(
            res.status(201).json({"id": key.id, "volume": req.body.volume, "item": req.body.item, "creation_date": req.body.creation_date, "carrier": null, "self": self_url}));
        });
    } else {
        res.status(400).json({"Error": 'The request object is missing at least one of the required attributes'});
    }
});


// Get Load by id
router.get('/:id', function(req, res) {
    get_load(req.params.id).then( (rec_load) => {
        if(rec_load != null) {
            rec_load.id = req.params.id;
            res.status(200).json(rec_load);
        } else {
            res.status(404).json({"Error": "No load with this load_id exists"});
        }
    });
});

// Get Load
router.get('/', function(req, res) {
    const loads = get_loads(req).then( (loads) => {
        res.status(200).json(loads);
    });
});


// Delete Load
router.delete('/:id', function(req, res) {
    get_load(req.params.id).then( (rec_load) => {
        if(rec_load != null) {
            get_boat(rec_load.carrier.id).then( (rec_boat) => {
                remove_load(rec_load.carrier.id, rec_boat, req.params.id);
            });
            delete_load(req.params.id).then(res.status(204).end());
        } else {
            res.status(404).json({"Error": "No load with this load_id exists"});
        }
    });
});


// module.exports = { get_load };
module.exports = router;