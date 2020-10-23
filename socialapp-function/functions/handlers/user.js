const { admin } = require("../util/admin");

const config = require("../util/config");

const firebase = require("firebase");
firebase.initializeApp(config);

const {
  validateSignupData,
  validateSignInData,
  reduceUserDetail,
} = require("../util/validators");

exports.signup = (request, response) => {
  const newUser = {
    email: request.body.email,
    password: request.body.password,
    confirmPassword: request.body.confirmPassword,
    handle: request.body.handle,
  };

  const { valid, errors } = validateSignupData(newUser);

  if (!valid) return response.status(400).json(errors);

  const noImg = "no-img.png";

  let token, userId;

  admin
    .firestore()
    .collection("users") //or
    .doc(newUser.handle) //firestore.collection().doc(`/users/${newUser.handle}`)
    .get() //.get().then()...
    .then((doc) => {
      if (doc.exists) {
        return response.status(400).json({ handle: "Handle taken " });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then((doc) => {
      userId = doc.user.uid;
      //token we need when we want to excess a protected route
      return doc.user.getIdToken();
    })
    .then((userToken) => {
      token = userToken;

      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
        userId: userId,
      };

      return admin
        .firestore()
        .collection("users")
        .doc(newUser.handle)
        .set(userCredentials);
    })
    .then(() => {
      return response.status(201).json({ token });
    })
    .catch((err) => {
      if (err.code === "auth/email-already-in-use") {
        return response.status(400).json({ email: "Emails already exist" });
      }
      return response.status(500).json({ general: "something went wrong!" });
    });
};

exports.login = (request, response) => {
  const user = {
    email: request.body.email,
    password: request.body.password,
  };

  const { valid, errors } = validateSignInData(user);

  if (!valid) return response.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then((doc) => {
      return doc.user.getIdToken();
    })
    .then((token) => {
      return response.json({ token });
    })
    .catch((err) => {
      //two status code related to login error
      // err.code === "auth/wrong-password"
      //err.code === "auth/user-not-found"
      return response
        .status(403)
        .json({ general: "wrong credentials, please try again!" });
    });
};

//add user Details

exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetail(req.body);
  firebase
    .firestore()
    .collection("users")
    .doc(req.user.handle) //req.user.handle coming from fbAuth function
    .update(userDetails) //all properties with data will be updated
    .then(() => {
      return res.json({ message: "Details added successfully!" });
    })
    .catch((err) => {
      console.log("err", err);
      return res.status(500).json({ error: err.code });
    });
};

//Get own user Detail

exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  firebase
    .firestore()
    .collection("users")
    .doc(req.user.handle)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return firebase
          .firestore()
          .collection("likes")
          .where("userHandle", "==", req.user.handle) //Doubt here
          .get();
      }
    })
    .then((data) => {
      userData.likes = [];
      data.forEach((doc) => {
        userData.likes.push(doc.data());
      });

      return firebase
        .firestore()
        .collection("notifications")
        .where("recipient", "==", req.user.handle)
        .orderBy("createdAt", "desc")
        .limit(10) //its upto to you don't limit
        .get();
    })
    .then((data) => {
      userData.notifications = [];
      data.forEach((doc) => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          screamId: doc.data().screamId,
          type: doc.data().type,
          read: doc.data().read,
          notificationsId: doc.id,
        });
      });
      return res.json(userData);
    })
    .catch((err) => {
      console.log("err", err);
      return res.status(500).json({ error: err.code });
    });
};

// Get any user's details
exports.getUserDetails = (req, res) => {
  let userData = {};
  firebase
    .firestore()
    .collection("users")
    .doc(req.params.handle)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.user = doc.data();
        return firebase
          .firestore()
          .collection("screams")
          .where("userHandle", "==", req.params.handle)
          .orderBy("createdAt", "desc")
          .get();
      } else {
        return res.status(404).json({ errror: "User not found" });
      }
    })
    .then((data) => {
      userData.screams = [];
      data.forEach((doc) => {
        userData.screams.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          screamId: doc.id,
        });
      });
      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

//added busboy lib for file uploading
//firebase can upload file directly to cloud storage
//May be it added because we are send through API not directly
//May be toturial is old and cloud storage is new, not confirmed !!!

//upload a profile image

exports.uploadImage = (req, res) => {
  const Busboy = require("busboy");
  const path = require("path"); //default node package
  const os = require("os"); //default
  const fs = require("fs");

  let imageFileName;
  let imageToBeUploaded = {};

  const busboy = new Busboy({
    headers: req.headers,
  });

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "wrong file submitted" });
    }

    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    imageFileName = `${Math.round(
      Math.random() * 10000000000
    )}.${imageExtension}`;
    const filePath = path.join(os.tmpdir(), imageFileName);

    imageToBeUploaded = { filePath, mimetype };

    file.pipe(fs.createWriteStream(filePath));
  });

  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return admin
          .firestore()
          .collection("users")
          .doc(req.user.handle)
          .update({
            imageUrl,
          });
      })
      .then(() => {
        return res.json({ messge: "Image uploaded successfully" });
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).json({ error: err.code });
      });
  });

  busboy.end(req.rawBody);
};

//we are receiving notification array.
//receiving notifications that are just read
exports.markNotificationsRead = (req, res) => {
  //batch used to update multiple documents
  let batch = firebase.firestore().batch();
  req.body.forEach((notificationId) => {
    const notification = firebase
      .firestore()
      .collection("notifications")
      .doc(notificationId);
    batch.update(notification, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.json({ message: "Notifications marked read" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
