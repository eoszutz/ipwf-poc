const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const http = require('http');


const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

//db-------------------------------------------------------------
//db connection
mongoose.connect("mongodb://localhost:27017/ipwfPOC", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
//contract schema
const contractSchema = new mongoose.Schema({
  originator: String,
  title: String,
  completed: Boolean,
  value: Number,
  type: String,
  recipient: String,
  startDate: Date,
  endDate: Date
});
//dbLoginSchema
const loginSchema = new mongoose.Schema({
  username: String,
  password: String,
  karma: Number
})
//db post
const Contract = mongoose.model("Contract", contractSchema);
//db login
const Login = mongoose.model("Login", loginSchema);

//---------------------------------------------------------------
//entry point login
app.get("/", (req, res) => {
  res.render("home", {status: "Please Log In"});
});

//browse existing
//test needs to be converted to true login variable >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
const assignee = "eoszutz";

app.get("/browse", (req, res) => {
  Contract.find({completed: false, type: {"$in":["public","bounty"]}}, (err, foundContracts) => {
    if(!err){
      if (!foundContracts){
        res.send("no open contracts")
      } 
      Contract.find({completed: false, recipient: assignee}, (err, foundMyContracts) => {
        if(!err){
          if (!foundMyContracts){
            res.send("no open contracts")
          } 
          Contract.find({completed: false, originator: assignee}, (err, subContracts) => {
            if(!err){
              if (!subContracts){
                res.send("no open contracts")
              } else {
                res.render("browse", {contracts: foundContracts, myContracts: foundMyContracts, subedContracts: subContracts});
              }
            }
          })
          }
      });
    }
  });
  
});

//update an assigned contract
app.get("/complete", (req, res) => {
  Contract.find({completed: false, recipient: assignee}, (err, userContracts) => {
    if(!err){
      res.render("complete", {contractName: userContracts})
    }
  })
});

//app.get:me
app.get("/account", (req, res) => {
      Contract.find({completed: true, recipient: assignee}, (err, compContracts) => {
        if(!err){
          if (!compContracts){
            res.send("no open contracts")
          } 
          Contract.find({completed: true, originator: assignee}, (err, createdContracts) => {
            if(!err){
              if (!createdContracts){
                res.send("no open contracts")
              } else {
                res.render("account", {finishedContracts: compContracts, crtdContracts: createdContracts});
              }
            }
          })
          }
      });
    });

 //create contract
 app.get("/new", (req, res) => {
  res.render("new");
});


//------------------------------------------------------------
//login
app.post("/login", (req, res) => {
  const loginUsername = req.body.userLogin;
  const loginPass = req.body.userPass;
  Login.findOne({username: loginUsername, password: loginPass}, function(err, foundLogin){
    if(!err) {
      if(!foundLogin){
        //if no login, create one with given data
        const login = new Login({
          username: req.body.userLogin,
          password: req.body.userPass
        });
        login.save(function(err){
          if(!err){
            //reload home
            res.render("home", {status: "no account found, created account. Please login"})
          }
        })
      } else { 
        //push user to browse screen
        res.redirect("/browse");
      }
    }
  })
  
})

//post new contract
app.post("/newcontract", (req, res) => {
  //pull variables from form
  const contractData = new Contract({
    originator: req.body.originator, 
    title: req.body.titleText, 
    completed: false, 
    value: req.body.valueField,
    type: req.body.contractType,
    recipient: req.body.recipientAcct,
    date: new Date() });
  //save object
  contractData.save( err => {
    if(!err) {
      //re-render new page
      res.redirect("/new");
    } else {console.log(err)}
  })
})



//post update to an assigned contract


//----------------------------------------------------------
//server value add/sub idk

//server
app.listen(3000, () => console.log("server on 3000"));
