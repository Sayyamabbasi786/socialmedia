const functions = require('firebase-functions');
const app = require('express')();
const FirebaseAuth = require("./util/fbAuth")


const {getAllScrems,postOneScream} = require("./handlers/scream")
const {signup,login} = require("./handlers/user")


//Firebase now don't have free clound functionality 
//therefore I downgraded to nodejs 8 from 10
//It will be deprecated in march 2021 
//But we can again run our cloud functions after registering and paying


//scream routes

app.get('/screams',getAllScrems)
// post one scream
//Express work such that we give second argument (function)
//based on that either a reponse will be send without 
//running a code or it will run the code inside it
//just like a middleware 
//In this case we are checking whether the person is authorized?
app.post('/scream',FirebaseAuth,postOneScream)

// users route
app.post('/signup',signup)
app.post('/login',login)


//https://anywebsite.com/api for this pattern we add .api with exports

exports.api = functions.https.onRequest(app)