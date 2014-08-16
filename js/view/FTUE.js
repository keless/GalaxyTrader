//0) ftue progress
function ftue_step() {
  var ftueState = localStorage.getItem("ftue");

	console.log("ftue_step  " + ftueState );

  if(!ftueState){
    //1) welcome message
    ftue_welcome();
  }
  else if(ftueState == "step1") {
    //2) create corporation form (themed)
    EventBus.ui.dispatch({evtName:"ftueCreateCorporation"});
  }
  else if( ftueState == "step2") {
    //3) message acquiring first agent and ship
    ftue_first_ship();
  }
  else if( ftueState == "step3") {
    //4) give first agent and ship
    EventBus.ui.dispatch({evtName:"ftueCreateAgent"});
  }
  else if( ftueState == "step4") {
    //5) first actions and goals
    ftue_after_first_ship();
  }

  //x) first actions and goals
}

function ftue_welcome(){
  game_pause();

  var text = "Welcome to Galaxy Trader. After starting your own Corporation your goal is to begin making money by trading commodities between space stations. Buy low and sell high!";
  var diag = new FormDialog(jQuery("#content"));
  show_text_dialog(jQuery("#content"), "Welcome", text, "Begin", "ftueWelcomeOk");
}


function ftue_first_ship(){
  game_pause();

  var text = "Along with 2000 credits, you're being given a ship and a captain to pilot it. ";
  var diag = new FormDialog(jQuery("#content"));
  show_text_dialog(jQuery("#content"), "Your First Ship", text, "Make it so!", "ftueFirstShipOk");
}

function ftue_after_first_ship(){
  game_pause();

  var text = "The left side of your screen is the map showing the locations you've discovered, and your current location in green.\
<hr>The right side of your screen is the current system display, listing the Factories and Stations you can interact with; \
the Star Gates you can travel through; and the Vessels present in the system, including yours.\
<hr>Your currently selected Agent is listed in the HUD at the top, and your Corporation's balance of credits is in the upper right.";
  var diag = new FormDialog(jQuery("#content"));
  show_text_dialog(jQuery("#content"), "Main Screen Turn On", text, "Interesting", "ftueAfterFirstShip");
}


function init_ftue_handlers() {
  EventBus.ui.addListener("ftueWelcomeOk", function(evt){
    localStorage.setItem("ftue", "step1"); //save ftue progress

    ftue_step(); //move to next step immeditely
  });

	EventBus.ui.addListener("ftueCreateCorporation", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		var randName = randCorpNames[getRand(0, randCorpNames.length-1)];

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Articles of Incorporation",
			successEvtName:"FtueCorporationOk",
			elements:[
        {type:"text", value:"The name of the corporation is:"},
				{type:"strInput", value:randName, name:"name" },
        {type:"text", value:"The purpose of the corporation is to engage in any lawful act or activity for which a corporation may be organized under General Corporation Law."},
        {type:"text", value:"The initial assests of the company are: 2000 credits"},
        {type:"text", value:"By signing below you hereby acknoledge the information in this document to be true and binding."},
        {type:"strInput", value:"", label:"Signature:", name:"signature" }
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("FtueCorporationOk", function(evt){
		var isPlayer = true ;
		var name = evt.name;

		console.log("create corp " + name);
		var corporation = new CorporationModel();
		corporation.initializeWithJson({name:name});
		corporation.incCredits(2000);

		Service.get("galaxy").addCorporation(corporation);
		if(isPlayer) {
			Service.get("player").setCorporation(corporation);
		}

    localStorage.setItem("ftue", "step2"); //save ftue progress

		window.currentDialog = null;
		game_restart_from_pause();

    //ftue_step(); //move to next step
	});

  EventBus.ui.addListener("ftueFirstShipOk", function(evt){
    localStorage.setItem("ftue", "step3"); //save ftue progress

    ftue_step(); //move to next step immeditely
  });

  EventBus.ui.addListener("ftueCreateAgent", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		var randName = randAgentNames[getRand(0, randAgentNames.length-1)];
    var randShipName = randShipNames[getRand(0, randShipNames.length-1)];

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Hire Agent",
			successEvtName:"FtueAgentOk",
			elements:[
        {type:"text", value:"Your first captain and buying agent--"},
				{type:"strInput", value:randName, name:"name" },
        {type:"text", value:"Will be piloting the Firefly class transport vessel--"},
        {type:"strInput", value:randShipName, name:"shipName" }
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("FtueAgentOk", function(evt){
		var corporation = Service.get("player").getCorporation();
		var name = evt.name;
    var shipName = evt.shipName;
    var locationId = Service.get("player").currentLocation;
    var location = Service.get("galaxy").getLocation(locationId);

		console.log("create agent " + name);
		var agent = new AgentModel();
		agent.initializeWithJson({name:name});
		corporation.addAgent(agent);
		window.player.setActiveUserAgent(agent);

    console.log("create vessel " + shipName);
		var vessel = new VesselModel();
		vessel.initializeWithJson({name:shipName, type:"vtFFt1"});
		location.addVessel(vessel);
		agent.setVessel(vessel);
		vessel.setOwner(agent);

		game_save();
    localStorage.setItem("ftue", "step4"); //save ftue progress

		window.currentDialog = null;
		game_start(); //resume

    ftue_step();
	});

  EventBus.ui.addListener("ftueAfterFirstShip", function(evt){
    localStorage.setItem("ftue", "step5"); //save ftue progress

		game_start(); //resume
    ftue_step(); //move to next step immeditely
  });

}
