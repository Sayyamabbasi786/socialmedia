const functions = require("firebase-functions");
const app = require("express")();
const FirebaseAuth = require("./util/fbAuth");

const cors = require("cors");
app.use(cors());

const { db } = require("./util/admin");

const {
  getAllScreams,
  postOneScream,
  getScream,
  deleteScream,
  likeScream,
  unLikeScream,
  commentOnScream,
} = require("./handlers/scream");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead,
} = require("./handlers/user");

//Firebase now don't have free clound functionality
//therefore I downgraded to nodejs 8 from 10
//It will be deprecated in march 2021
//But we can again run our cloud functions after registering and paying

//scream routes

app.get("/screams", getAllScreams);
// post one scream
//Express work such that we give second argument (function)
//based on that either a reponse will be send without
//running a code or it will run the code inside it
//just like a middleware
//In this case we are checking whether the person is authorized?
app.post("/scream", FirebaseAuth, postOneScream);
app.get("/scream/:screamId", getScream);
app.delete("/scream/:screamId", FirebaseAuth, deleteScream);

app.get("/scream/:screamId/like", FirebaseAuth, likeScream);
app.get("/scream/:screamId/unlike", FirebaseAuth, unLikeScream);

app.post("/scream/:screamId/comment", FirebaseAuth, commentOnScream);

// users route
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FirebaseAuth, uploadImage);
app.post("/user", FirebaseAuth, addUserDetails);
app.get("/user", FirebaseAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FirebaseAuth, markNotificationsRead);

//https://anywebsite.com/api for this pattern we add .api with exports

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate((snapshot) => {
    console.log("snapshot", snapshot);
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        console.log("doc", doc);
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .catch((err) => console.error(err));
  });

exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

//when user will change the image then his image url in
//scream should also be changes

exports.onUserImageChange = functions.firestore
  .document("/users/{userId}") //this mean when user with this
  .onUpdate((change) => {
    //user id (doc id) updated
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("image has changed");
      const batch = db.batch();
      return db
        .collection("screams")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onScreamDelete = functions.firestore
  .document("/screams/{screamId}")
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId; //context contain params
    const batch = db.batch();
    return db
      .collection("comments")
      .where("screamId", "==", screamId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("screamId", "==", screamId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("screamId", "==", screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
