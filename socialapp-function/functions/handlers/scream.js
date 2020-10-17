
const {admin} = require("../util/admin")

exports.getAllScrems = (request,response)=>{

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
}

exports.postOneScream = (request,response)=>{
  
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
}