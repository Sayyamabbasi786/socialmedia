const functions = require('firebase-functions');
const app = require('express')();
const firebase = require("firebase");

//why firebase admin ??
//May be to create API'S

const admin = require("firebase-admin");
admin.initializeApp() //here we give sdk of project but it already knows


var firebaseConfig = {
    apiKey: "AIzaSyCJeUgQQlsb1zwmmrTxhAMsjZ1bYVekzvk",
    authDomain: "socialapp-ef5cd.firebaseapp.com",
    databaseURL: "https://socialapp-ef5cd.firebaseio.com",
    projectId: "socialapp-ef5cd",
    storageBucket: "socialapp-ef5cd.appspot.com",
    messagingSenderId: "527967459488",
    appId: "1:527967459488:web:7e889529a12891cea651c5"
  };
 
  
  firebase.initializeApp(firebaseConfig);





//Firebase now don't have free clound functionality 
//therefore I downgraded to nodejs 8 from 10
//It will be deprecated in march 2021 
//But we can again run our cloud functions after registering and paying


app.get('/screams',(request,response)=>{

    admin.firestore().collection("screams")
    .orderBy("createdAt","desc")
    .get()
    .then(querySnapshot=>{
        let screams =[]
        querySnapshot.forEach(doc=>{
            screams.push({

                screamId:doc.id,
                body:doc.data().body,
                userHandler:doc.data().userHandler,
                createdAt:doc.data().createdAt

            })
        })
        return response.json(screams)
    })
    .catch((err)=>{
        console.error("err",err)
    })
})

//if we return next as function it means to allow or proceed the req
const FirebaseAuth=(req,res,next)=>{
    let idToken ;
    if(req.headers.authorization 
        && 
        req.headers.authorization.startsWith('Bearer '))
        {
            idToken = req.headers.authorization.split('Bearer ')[1]
        }
    else{
        return res.status(403).json({error:"Unauthorized"})
    }

    //Now verify token from our db

    admin.auth().verifyIdToken(idToken)
    .then((decodedToken)=>{
        req.user = decodedToken;
        console.log("decoded token",decodedToken)
        return admin.firestore().collection("users")
        .where("userId",'==',req.user.uid)
        .limit(1)
        .get();
    })
    .then((data)=>{
        req.user.handle = data.docs[0].data().handle;
        return next();
    })
    .catch((err)=>{
        return res.status(403).json(err)
    })

}

// post one scream
//Express work such that we give second argument (function)
//based on that either a reponse will be send without 
//running a code or it will run the code inside it
//just like a middleware 
//In this case we are checking whether the person is authorized?
app.post('/scream',FirebaseAuth,(request,response)=>{
  
    if(request.body.body.trim()===""){
        return res.status(400).json({body:"Body must not be empty"})
    }
    
    const newScream = {
        body : request.body.body,
        // request.user.handle comming from FirebaseAuth function
        //after authorization thats why we used that
        userHandler:request.user.handle, //request.body.userHandler
        createdAt : new Date().toISOString()
    }

    admin.firestore()
    .collection("screams")
    .add(newScream)
    .then((doc)=>{
        return response.json(`document ${doc.id} created successfully`)
    })
    .catch((err)=>{
        return response.status(500).json({err:'something went wrong !!!'})
        
    })
})

const isEmail = (email)=>{
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    if(email.match(regEx)) return true;
    else return false;

}


const isEmpty=(string)=>{
    if(string.trim()===""){
        return true
    }
    else {
        return false
    }
}

// signup route

let token;
let userId;
app.post('/signup',(request,response)=>{
    const newUser = {
      email: request.body.email,
      password: request.body.password,
      confirmPassword: request.body.confirmPassword,
      handle: request.body.handle,
    };

    let errors={};
    if(isEmpty(newUser.email)){
        errors.email = "Must not be empty"
    }
    else if(!isEmail(newUser.email)){
        errors.email = "Email must be valid email address"
    }

    if(isEmpty(newUser.password))  
    {
        errors.password = "Must not be empty"
    }

    if(newUser.password!==newUser.confirmPassword){
        errors.confirmPassword="Password must match"
    }

    if(isEmpty(newUser.handle))  
    {
        errors.handle = "Must not be empty"
    }


    if(Object.keys(errors).length>0) return response.status(400).json(errors)


    admin
      .firestore()
      .collection("users") //or 
      .doc(newUser.handle) //firestore.collection().doc(`/users/${newUser.handle}`)
      .get()                //.get().then()...
      .then((doc) => {
        if (doc.exists) {
            
            return response.status(400).json({handle:"Handle taken "})
        } else {
            
          return firebase
            .auth()
            .createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
      })
      .then((doc) => {
        userId=doc.user.uid;
          //token we need when we want to excess a protected route
        return doc.user.getIdToken();
      })
      .then((userToken) => {
        token = userToken
        
        const userCredentials={
            handle:newUser.handle,
            email:newUser.email,
            createdAt:new Date().toISOString(),
            userId:userId
        }
        
        return admin.firestore().collection("users")
        .doc(newUser.handle)
        .set(userCredentials);
        
      })
      .then(()=>{
         return response.status(201).json({ token });
      })
      .catch((err) => {
        if(err.code==="auth/email-already-in-use"){
            return response.status(400).json({ email: "Emails already exist" });
        }
        return response.status(500).json({ err: err.code });
      });

})


app.post('/login',(request,response)=>{

    const user = {
        email:request.body.email,
        password:request.body.password
    }


    let errors={}

    if(isEmpty(user.email)){
        errors.email = "Must not be empty"
    }
    if(isEmpty(user.password)){
        errors.password = "Must not be empty"
    }

    if(Object.keys(errors).length>0) return response.status(400).json(errors)

    firebase.auth()
    .signInWithEmailAndPassword(user.email,user.password)
    .then(doc=>{
        return doc.user.getIdToken()
    })
    .then((token)=>{
        return response.json({token})
    })
    .catch((err)=>{

        if(err.code==="auth/wrong-password"){
            return response.status(403)
            .json({general:"wrong credentials, please try again!"})
        }
        else return response.status(500).json({err:err.code})
    })
})


//https://anywebsite.com/api for this pattern we add .api with exports

exports.api = functions.https.onRequest(app)