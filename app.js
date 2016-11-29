var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
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
  AWS.config.region = AWS_Region;
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

module.exports = app;
