const functions = require('firebase-functions');

const admin = require("firebase-admin")
admin.initializeApp() //here we give sdk of project but it already knows 

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions


//Firebase now don't have free clound functionality 
//therefore I downgraded to nodejs 8 from 10
//It will be deprecated in march 2021 
//But we can again run our cloud functions after registering and paying

exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

exports.getScream = functions.https.onRequest((request,response)=>{
    
    admin.firestore().collection("screams")
    .get()
    .then(querySnapshot=>{
        let screams =[]
        querySnapshot.forEach(doc=>{
            screams.push(doc.data())
        })
        return response.json(screams)
    })
    .catch((err)=>{
        console.error("err",err)
    })
})


//as this is post request so get request is not allowed
//we will put a check here

exports.createStream = functions.https.onRequest((request,response)=>{
    if(request.method!=='POST'){
        return response.status(400).json({error:"Method not allowed "})
    }
    
    const newScream = {
        body : request.body.body,
        userHandler:request.body.userHandler,
        createdAt : admin.firestore.FieldValue.serverTimestamp()
    }

    admin.firestore()
    .collection("screams")
    .add(newScream)
    .then((doc)=>{
        response.json(`document ${doc.id} created successfully`)
    })
    .catch((err)=>{
        response.status(500).json({err:'something went wrong !!!'})
        console.error("create stream err",err)
    })
})

