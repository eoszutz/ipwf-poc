const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");
const ejs = require("ejs");
const http = require("http");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

//session setup-----------------------------------------------
app.use(
  session({
    secret: "secretsauce",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

//db-------------------------------------------------------------
//db connection
mongoose.connect(
  "mongodb+srv://admin-elliot:DmJpImqT86ORkzZh@cluster0-vgkaf.azure.mongodb.net/test?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
//contract schema
const contractSchema = new mongoose.Schema({
  originator: String,
  title: String,
  completed: Boolean,
  value: Number,
  type: String,
  recipient: String,
  startDate: Date,
  endDate: Date,
  status: String,
  expirationDate: Date,
  reqBody: Object,
});
//dbLoginSchema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);

//db post
const Contract = mongoose.model("Contract", contractSchema);
//db login
const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//test needs to be converted to true login variable >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const assignee = "eoszutz";
//---------------------------------------------------------------
//entry point login
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/browse");
  } else {
    res.render("home", { status: "Please Log In" });
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

//register post
app.post("/register", function (req, res) {
  User.register({ username: req.body.username }, req.body.password, function (
    err,
    registeredUser
  ) {
    if (!err) {
      passport.authenticate("local")(req, res, function () {
        console.log("redirect step");
        res.redirect("/browse");
      });
    } else {
      res.redirect("/");
    }
  });
});
//login post
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/browse",
    failureRedirect: "/",
  })
);

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

//-------------------------------------------------------------------------------------

//browse existing
app.get("/browse", (req, res) => {
  if (req.isAuthenticated()) {
    Contract.find(
      { completed: false, status: "open", type: { $in: ["public", "bounty"] } },
      (err, foundContracts) => {
        if (!err) {
          if (!foundContracts) {
            res.send("no open contracts");
          }
          Contract.find(
            { completed: false, recipient: req.user.username },
            (err, foundMyContracts) => {
              if (!err) {
                if (!foundMyContracts) {
                  res.send("no open contracts");
                }
                Contract.find(
                  { completed: false, originator: req.user.username },
                  (err, subContracts) => {
                    if (!err) {
                      if (!subContracts) {
                        res.send("no open contracts");
                      } else {
                        res.render("browse", {
                          contracts: foundContracts,
                          myContracts: foundMyContracts,
                          subedContracts: subContracts,
                          userID: req.user.username
                        });
                      }
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
  } else {
    res.redirect("/");
  }
});

//remder update page
app.get("/complete", (req, res) => {
  if (req.isAuthenticated()) {
  Contract.find(
    { completed: false, recipient: req.user.username },
    (err, userContracts) => {
      if (!err) {
        res.render("complete", { contractName: userContracts, userID: req.user.username });
      }
    }
  );
} else {
  res.redirect("/");
}
});

//account page
app.get("/account", (req, res) => {
  if (req.isAuthenticated()) {
  Contract.find(
    { completed: true, recipient: req.user.username },
    (err, compContracts) => {
      if (!err) {
        if (!compContracts) {
          res.send("no open contracts");
        }
        Contract.find(
          { completed: true, originator: req.user.username },
          (err, createdContracts) => {
            if (!err) {
              if (!createdContracts) {
                res.send("no open contracts");
              } else {
                res.render("account", {
                  finishedContracts: compContracts,
                  crtdContracts: createdContracts,
                  userID: req.user.username
                });
              }
            }
          }
        );
      }
    }
  );
} else {
  res.redirect("/");
}
});

//create contract
app.get("/new", (req, res) => {
  if (req.isAuthenticated()) {
  res.render("new", {userID: req.user.username});
} else {
  res.redirect("/");
}
});

//------------------------------------------------------------

//post new contract
app.post("/newcontract", (req, res) => {
  //pull variables from form and applies schema
  const contractData = new Contract({
    originator: req.user.username,
    title: req.body.titleText,
    completed: false,
    value: req.body.valueField,
    type: req.body.contractType,
    recipient: req.body.recipientAcct,
    startDate: new Date(),
    status: "open",
    expirationDate: req.body.expDate,
    reqBody: req.body.cbody,
  });
  //save object
  contractData.save((err) => {
    if (!err) {
      //re-render new page
      res.redirect("/new");
    } else {
      console.log(err);
    }
  });
});

//post update to an assigned contract
app.post("/contract/complete/:id", (req, res) => {
  const updateContractID = req.params.id;
  finalDate = new Date();
  Contract.updateOne(
    { _id: updateContractID },
    { completed: true, endDate: finalDate, status: "completed" },
    (err, updateEntry) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/complete");
    }
  );
});

//claim a contract
app.post("/contract/claim/:id", (req, res) => {
  const claimID = req.params.id;
  Contract.updateOne(
    { _id: claimID },
    { recipient: assignee, status: "claimed"},
    (err, updateEntry) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/browse");
    }
  );
});

//----------------------------------------------------------
//server value add/sub idk

//server
app.listen(3000, () => console.log("server on 3000"));
