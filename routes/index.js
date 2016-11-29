require('dotenv').config();
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


// from example
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var AWS = require('aws-sdk');
var colors = require('colors');

var AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
var AWS_REGION = process.env.AWS_REGION;
var COGNITO_IDENTITY_POOL_ID = process.env.COGNITO_IDENTITY_POOL_ID;;
var COGNITO_IDENTITY_ID, COGNITO_SYNC_TOKEN, AWS_TEMP_CREDENTIALS;
var cognitosync;
var IAM_ROLE_ARN = process.env.IAM_ROLE_ARN;
var COGNITO_SYNC_COUNT;
var COGNITO_DATASET_NAME = 'TEST_DATASET';

// test app
var FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
var FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
var FACEBOOK_TOKEN;
var FACEBOOK_USER = {
  id: '',
  first_name: '',
  gender: '',
  last_name: '',
  link: '',
  locale: '',
  name: '',
  timezone: 0,
  updated_time: '',
  verified: false
};
var userLoggedIn = false;

router.use(passport.initialize());
router.use(passport.session());

passport.use(new FacebookStrategy({
  clientID: FACEBOOK_APP_ID,
  clientSecret: FACEBOOK_APP_SECRET,
  callbackURL: 'http://localhost:8080/auth/facebook/callback'
}, function(accessToken, refreshToken, profile, done) {
  process.nextTick(function() {
    FACEBOOK_TOKEN = accessToken;
    FACEBOOK_USER = profile._json;
    userLoggedIn = true;
    done(null, profile);
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});
// /from example


/* GET Facebook page. */
router.get('/auth/facebook', passport.authenticate('facebook'));

/* GET Facebook callback page. */
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
  successRedirect: '/success',
  failureRedirect: '/error'
}));

/* GET Facebook success page. */
router.get('/success', function(req, res, next) {
  console.log('FACEBOOK_TOKEN:'.green + FACEBOOK_TOKEN);
  getCognitoID();
  res.send('Logged in as ' + FACEBOOK_USER.name + ' (id:' + FACEBOOK_USER.id + ').');
});

router.route('/sync')
  .put(function(req, res) {
    res.json({ message: 'Sync Put Started' });
  })
  .get(function(req, res) {

  });

/* GET Facebook error page. */
router.get('/error', function(req, res, next) {
  res.send("Unable to access Facebook servers. Please check internet connection or try again later.");
});

function getCognitoID(){
  // The parameters required to intialize the Cognito Credentials object.
  var params = {
    AccountId: AWS_ACCOUNT_ID, // required
    RoleArn: IAM_ROLE_ARN,  // required
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID, // required
    Logins: {
      'graph.facebook.com': FACEBOOK_TOKEN
    }
  };
  // set the Amazon Cognito region
  AWS.config.region = AWS_REGION;
  // initialize the Credentials object with our parameters
  AWS.config.credentials = new AWS.CognitoIdentityCredentials(params);

  // We can set the get method of the Credentials object to retrieve
  // the unique identifier for the end user (identityId) once the provider
  // has refreshed itself
  AWS.config.credentials.get(function(err) {
    if (err) console.log("credentials.get: ".red + err, err.stack); // an error occurred
      else{
        //AWS_TEMP_CREDENTIALS = AWS.config.credentials.data.Credentials;
        AWS_TEMP_CREDENTIALS = AWS.config.credentials;
        COGNITO_IDENTITY_ID = AWS.config.credentials.identityId;
        console.log("Cognito Identity Id: ".green + COGNITO_IDENTITY_ID);
        getCognitoSynToken();
      }
  });
}

function getCognitoSynToken(){
  // Other AWS SDKs will automatically use the Cognito Credentials provider
  // configured in the JavaScript SDK.
  cognitosync = new AWS.CognitoSync();
  cognitosync.listRecords({
    DatasetName: COGNITO_DATASET_NAME, // required
    IdentityId: COGNITO_IDENTITY_ID,  // required
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID  // required
  }, function(err, data) {
    if (err) console.log("listRecords: ".red + err, err.stack); // an error occurred
      else {
        console.log("listRecords: ".green + JSON.stringify(data));
        COGNITO_SYNC_TOKEN = data.SyncSessionToken;
        COGNITO_SYNC_COUNT = data.DatasetSyncCount;
        console.log("SyncSessionToken: ".green + COGNITO_SYNC_TOKEN);           // successful response
        console.log("DatasetSyncCount: ".green + COGNITO_SYNC_COUNT);
        addRecord();
      }
  });
}

function addRecord(){
  var params = {
    DatasetName: COGNITO_DATASET_NAME, // required
    IdentityId: COGNITO_IDENTITY_ID, // required
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID, // required
    SyncSessionToken: COGNITO_SYNC_TOKEN, // required
    RecordPatches: [
      {
        Key: 'USER_ID', // required
        Op: 'replace', // required
        SyncCount: COGNITO_SYNC_COUNT, // required
        //DeviceLastModifiedDate: new Date(),
        Value: FACEBOOK_USER.id
      }
    ]
  };
  console.log("UserID: ".cyan + FACEBOOK_USER.id);
  cognitosync.updateRecords(params, function(err, data) {
    if (err) console.log("updateRecords: ".red + err, err.stack); // an error occurred
    else{
      console.log("Value: ".green + JSON.stringify(data));           // successful response
      createS3();
    }
  });
}

function createS3(){
  var bucket = new AWS.S3({
    params: {
      Bucket: 'backspace-cognito-test'
    }
  });
  //Object key will be facebook-USERID#/FILE_NAME
  console.log('COGNITO_IDENTITY_ID: '.cyan + COGNITO_IDENTITY_ID);
  var objKey = COGNITO_IDENTITY_ID + '/test2.txt';
  var params = {
      Key: objKey,
      ContentType: 'text/plain',
      Body: "Hello!",
      ACL: 'public-read'
  };
  bucket.putObject(params, function (err, data) {
    if (err) {
        console.log('putObject: '.red + err);
    } else {
        console.log("Successfully uploaded data to your S3 bucket");
    }
  });
}

module.exports = router;
