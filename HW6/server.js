const express = require('express');
const app = express();

const path = require('path');

const axios = require('axios');

const bodyParser = require('body-parser');
const { response } = require('express');

app.use(bodyParser.json());

const router = express.Router();
app.use('/', router);

router.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, './views/index.html'));
});

router.get('/oauth', function(req, res) {
  const state = req.query.state;
  const code = req.query.code;
  console.log(code);

  if (state === "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") {
    
    const url = "https://oauth2.googleapis.com/token?code=" + code + "&client_id=791197776586-jnmbrdcv1mpkr46q1n62p96f6holhbam.apps.googleusercontent.com&client_secret=" + state + "&redirect_uri=http://assignment6-367319.uw.r.appspot.com/oauth&grant_type=authorization_code";

    const request = axios.request({url: url, method: 'POST'}, {
    }).then(function(response) {

      const info_url = "https://people.googleapis.com/v1/people/me?personFields=names";
      const bearer_token = "Bearer " + response.data.access_token;
      const token_request = axios.request({url:info_url, method: 'GET', headers:{Authorization: bearer_token}}, {
      }).then(function(info_response) {
        info_page = "givenName: " + info_response.data.names[0].givenName + " familyName: " + info_response.data.names[0].familyName + " state: " + state;
        res.send(info_page);
      }).catch(function(info_error) {
        console.log(info_error);
      });
    }).catch(function(error) {
      console.log(error);
    });

  }
});

router.post('/submit', function(req, res) {
  res.redirect("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=791197776586-jnmbrdcv1mpkr46q1n62p96f6holhbam.apps.googleusercontent.com&redirect_uri=http://assignment6-367319.uw.r.appspot.com/oauth&scope=profile&state=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");
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
