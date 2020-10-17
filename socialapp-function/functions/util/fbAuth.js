
const {admin} = require('./admin')

//if we return next as function it means to allow or proceed the req
module.exports =(req,res,next)=>{
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