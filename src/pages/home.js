import React, { useEffect, useState } from "react";
import Grid from "@material-ui/core/Grid";
import axios from "axios";
import Scream from "./../components/Scream";

const Home = () => {
  const [screams, setScreams] = useState(null);
  console.log("screams", screams);

  useEffect(() => {
    axios
      .get("/screams")
      .then((res) => {
        setScreams(res.data);
      })
      .catch((err) => {
        console.log("error", err);
      });
  }, []);

  return (
    <Grid container spacing={8}>
      <Grid item sm={8} xs={12}>
        {screams ? (
          screams.map((scream, ind) => {
            return <Scream scream={scream} key={scream.screamId} />;
          })
        ) : (
          <p>loading...</p>
        )}
      </Grid>
      <Grid item sm={4} xs={12}>
        <p>Profile...</p>
      </Grid>
    </Grid>
  );
};

export default Home;
