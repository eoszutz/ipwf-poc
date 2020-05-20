const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");
const ejs = require("ejs");
const http = require("http");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const _ = require("lodash");

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
  createDate: Date,
  endDate: Date,
  status: String,
  bodySteps: Number,
  reqBody: Object,
  activeProcess: {activeStep: Number,
    stepStarted: Date,
    stepParameter: String,
    stepValue: String,
    completed: Boolean},
  activeStep: Number,
  activeStepComplete: Boolean,
  totalSteps: Number,
  workflowStatus: String,
});
//dbLoginSchema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  karma: Number,
  accountType: String,
});

//parameter lookups
const parameterSchema = new mongoose.Schema({
  paramName: String,
});

userSchema.plugin(passportLocalMongoose);

//db post
const Contract = mongoose.model("Contract", contractSchema);
module.exports = Contract;

//db login
const User = mongoose.model("User", userSchema);
//db parameter
const Parameter = mongoose.model("Parameter", parameterSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

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
  User.register(
    { username: req.body.username, karma: 1000, accountType: "user" },
    req.body.password,
    function (err, registeredUser) {
      if (!err) {
        passport.authenticate("local")(req, res, function () {
          console.log("redirect step");
          res.redirect("/browse");
        });
      } else {
        res.redirect("/");
      }
    }
  );
});
//login post
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/browse",
    failureRedirect: "/",
  })
);

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

//-------------------------------------------------------------------------------------

//browse existing
app.get("/browse", (req, res) => {
  if (req.isAuthenticated()) {
    //public contracts
    Contract.find(
      { completed: false, recipient: null },
      (err, foundContracts) => {
        if (!err) {
          if (!foundContracts) {
            res.send("no open contracts");
          }
          //private assigned to user
          Contract.find(
            {
              completed: false,
              recipient: req.user.username,
              recipientMarkedComplete: false,
            },
            (err, foundMyContracts) => {
              if (!err) {
                if (!foundMyContracts) {
                  res.send("no open contracts");
                }
                //private submitted by user
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
                          userID: req.user.username,
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

//render update page
app.get("/complete", (req, res) => {
  if (req.isAuthenticated()) {
    Contract.find(
      { completed: false, status: "claimed", recipient: req.user.username },
      (err, assignedContracts) => {
        if (!err) {
          Contract.find(
            {
              completed: false,
              recipientMarkedComplete: true,
              originatorMarkedComplete: false,
              originator: req.user.username,
            },
            (err, submittedContracts) => {
              if (!err) {
                res.render("complete", {
                  assignedContract: assignedContracts,
                  submittedContract: submittedContracts,
                  userID: req.user.username,
                });
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
                    userID: req.user.username,
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

//create contract page
app.get("/new", (req, res) => {
  if (req.isAuthenticated()) {
    Parameter.find((err, parametersFound) => {
      if (!err) {
        res.render("new", {
          userID: req.user.username,
          parameters: parametersFound,
        });
      }
    });
  } else {
    res.redirect("/");
  }
});

//-------------------------------------------------------------------------------------------------
//post new contract
app.post("/newcontract", (req, res) => {
  //create contract object
  const contractData = new Contract({
    originator: req.user.username,
    title: req.body.titleText,
    completed: false,
    createDate: new Date(),
    status: "open",
    endDate: null,
    activeProcess: { activeStep: 0,
      stepStarted: null,
      stepParameter: null,
      stepValue: null,
      completed: null },
    activeStep: 1,
    activeStepComplete: false,
    totalSteps: req.body.totalSteps,
    reqBody: req.body.reqBody,
    //add hashing value here eventually>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  });
  contractData.save((err, contract) => {
    if (!err) {
      const contractID = contract.id;
      //call the routing function and pass saved _id
      loader(contractID); //should probably be separate server and turned into a post request instead
      //re-render new page
      res.redirect("/new");
    } else {
      console.log(err);
    }
  });
});
//-------------------------------------manual update on the update page -----------------------------
app.post("/updatecontract", (req, res) => {
  console.log(req.body._id);
  loader(req.body._id);
});

//-------------------------------------Components--------------------------(really need to break this up)---------------------
//load values into active step object within the document for engine to execute
function loader(id) {
  Contract.find({ _id: id }, (err, returnedContract) => {
    if (!err) {
      //read current step
      const currentStep = returnedContract[0].activeStep; //works
      //break up the json into variables so it can be read easier and recoded
      const currentParameter = "step" + currentStep;
      const activeStepKeyValue = returnedContract[0].reqBody[currentParameter];
      const key = Object.keys(activeStepKeyValue);
      const value = activeStepKeyValue[key];
      const stepStarted = new Date();
    //recreate a new sub doc
      const updateData = {activeProcess: {
        activeStep: currentStep,
        stepStarted: stepStarted,
        stepParameter: key[0],
        stepValue: value,
        completed: false}}

      //save values into activeprocess object of contract
      Contract.updateOne({_id: id},{$set: {activeProcess: {
        activeStep: currentStep,
        stepStarted: stepStarted,
        stepParameter: key[0],
        stepValue: value,
        completed: false}}}, function(err, res){
          if (!err){console.log(res)};
          console.log(err);
        })
    }
  });
}
//process the step that is loaded into the activestep
function executor(id) {
  Contract.find({ _id: id }, (err, returnedContract) => {
    
  })
}

//api compiler and router--------------------------

//-----------------------------------------------------------------------------------------------------------------
//post update to an assigned contract - recipient
app.post("/contract/completerec/:id", (req, res) => {
  const updateContractID = req.params.id;
  Contract.updateOne(
    { _id: updateContractID },
    { recipientMarkedComplete: true, status: "verification" },
    (err, updateEntry) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/complete");
    }
  );
});

//post update to an assigned contract - submitter
app.post("/contract/completeorig/:id", (req, res) => {
  const updateContractID = req.params.id;
  finalDate = new Date();
  Contract.updateOne(
    { _id: updateContractID },
    { originatortMarkedComplete: true, completed: true, endDate: finalDate },
    (err, updateEntry) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/complete");
    }
  );
  //finalization of contract>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>tdb
});

//claim a public contract
app.post("/contract/claim/:id", (req, res) => {
  const claimID = req.params.id;
  Contract.updateOne(
    { _id: claimID },
    { recipient: assignee, status: "claimed" },
    (err, updateEntry) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/browse");
    }
  );
});

//claim an assigned contract
app.post("/contract/accept/:id", (req, res) => {
  const claimID = req.params.id;
  Contract.updateOne(
    { _id: claimID },
    { status: "claimed" },
    (err, updateEntry) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/browse");
    }
  );
});

//middleware apps ---------------------------------------------------------------------------------------

//function to validate contract
const validator = function (req, res) {
  contractID = req.contractID;
  Contract.find({ contractID });
};

//function to escrow karma
const escrow = function (req, res) {};

//payout function
const payout = function (req, res) {};

//------------------------------------------------------------------------------------------------------

//server
app.listen(3000, () => console.log("server on 3000"));
