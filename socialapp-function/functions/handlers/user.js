const {admin} = require('../util/admin')

const config = require("../util/config");

const firebase = require("firebase")
firebase.initializeApp(config)

const {validateSignupData,validateSignInData} = require('../util/validators')

exports.signup = (request,response)=>{
    const newUser = {
      email: request.body.email,
      password: request.body.password,
      confirmPassword: request.body.confirmPassword,
      handle: request.body.handle,
    };

    const {valid,errors} = validateSignupData(newUser) 

    if(!valid) return response.status(400).json(errors)
    
    let token, userId;

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

}

exports.login = (request,response)=>{

    const user = {
        email:request.body.email,
        password:request.body.password
    }

    const {valid,errors} = validateSignInData(user) 

    if(!valid) return response.status(400).json(errors)


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
}

