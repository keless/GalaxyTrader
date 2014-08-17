game_create = function()
{
	//LOAD DATA
  CommodityType.loadTypesWithJson( data["commodityTypes"] );
  FactoryType.loadTypesWithJson( data["factoryTypes"] );
  StationType.loadTypesWithJson( data["stationTypes"] );
  VesselType.loadTypesWithJson( data["vesselTypes"] );

	//instanciate singletons
	new AudioManager();
	window.hud = new PlayerHud();
  window.map = new MapView();

  //handle buy/sell interactions
  window.onPurchaseClickRcv = function(evt) {
    var locId = window.player.currentLocation;
		var sellMode = false; //because we're buying
    window.startPurchaseDialog(sellMode, evt.cid, locId, evt.factId);
  }
  EventBus.ui.addListener("factOutputClicked", window.onPurchaseClickRcv.bind(window));

  window.onSellClickRcv = function(evt) {
    var locId = window.player.currentLocation;
		var sellMode = true; //because we're selling
    window.startPurchaseDialog(sellMode, evt.cid, locId, evt.factId);
  }
  EventBus.ui.addListener("factInputClicked", window.onSellClickRcv.bind(window));

  window.onTradeClickRcv = function(evt) {
    var locId = window.player.currentLocation;

    window.startTradeDialog(evt.cid, evt.qty, evt.pricePerUnit, locId, evt.statId);
  }
  EventBus.ui.addListener("tradeCmdyClicked", window.onTradeClickRcv.bind(window));

  //handle system travel event
  window.onDestinationRcv = function(evt) {
    var destination = evt.value;

		//ensure destination is adjacent (and not equal to) current location
		if( destination == window.player.currentLocation ) return; //already there

		var currLocModel = window.galaxy.getLocation( window.player.currentLocation );
		if(jQuery.inArray(destination, currLocModel.destinations) == -1) {
      //not adjacent-- check special case where destination has no connections

      var targetLocation = window.galaxy.getLocation( destination );
      if( targetLocation.destinations.length != 0 )
      return; //not adjacent and not special case
    }

		//move userAgent to destination
		if( window.player.activeUserAgent ) {
			window.player.activeUserAgent.actionMoveToLocation( destination );
		}

    //clear view
    window.clearView();
    window.player.setCurrentLocation( destination );
    window.createView();
  }
  EventBus.game.addListener("destination", window.onDestinationRcv.bind(window));

	EventBus.game.addListener("activeAgentSelected", function(evt){
		if(!window.player) return; //if called during player init, ignore

		var agent = evt.agent;
		if(!agent) return;
		var location = agent.getLocation();
		if(!location) return;
		var destination = location.id;
		if(!destination) return; //also could be called from first agent creation

		//switch current location to new agent's location
		if( window.player.getCurrentLocation() == destination ) {
			return; //already at appropriate location, do nothing
		}

		console.log("active agent selected, moving view to " + destination);
    //clear view
    window.clearView();
    window.player.setCurrentLocation( destination );
	//why isnt this working? xxx
    window.createView();
	});

  window.clearView = function() {
		if(!window.currentLocationView) return;

		window.currentLocationView.destroy();
		window.currentLocationView = null;

    //save the event handlers attached to these from being removed by jQuery.empty();
    window.hud.getDiv().detach();
    window.map.getDiv().detach();

    jQuery("#content").empty();
  }
  window.createView = function() {
		jQuery("#content").append( window.hud.getDiv() );
    jQuery("#content").append( window.map.getDiv());

    var location = window.galaxy.getLocation( window.player.currentLocation );
    window.map.setCurrentLocation( location );

		if(location) { //be extra fault tolerant during THE REMAKING
			var lv = new LocationView();
    	lv.updateFromModel( location, true );
    	window.currentLocationView = lv;
    	jQuery("#content").append(lv.getDiv());
		}
		jQuery("#content").append("<br>");

  }

	//show buy/sell dialogs
	window.startPurchaseDialog = function( bSellMode, cid, locId, factId ) {
		var location = window.galaxy.getLocation(locId);
		var factory = location.getFactory(factId);

		var ppu = 0;
		var qty = 0;
		var vessel = window.player.activeUserAgent.vessel;
		var maxQty = 0;
		if( !bSellMode ) {
			//buy from factory
			var offer = factory.getCommodityUnitsAvailable(cid);
			ppu = offer.pricePerUnit;
			qty = offer.qtyAvailable;

			//cap by amt user can pay for
			var maxCash = window.player.activeUserAgent.getNumCredits();
			maxQty = Math.floor( maxCash / ppu);
			maxQty = Math.min( maxQty, qty );
			//cap by empty cargo space
			var cargoSpace = vessel.getAvailableVolume();

			maxQty = Math.min( maxQty, cargoSpace );
		}else {
			//sell to factory
			var offer = factory.getInputCommodityUnitsNeeded(cid);
			ppu = offer.pricePerUnit;
			qty = offer.qtyNeeded;

			//cap at amt user has in cargo, or amt factory can hold
			var cargoQty = vessel.getCargoQty( cid );
      //console.log("Vessel cargo qty " + cargoQty)
			maxQty = Math.min( cargoQty, qty );
		}

		if( maxQty == 0 ) return; //you have not enough minerals

		//if app is running
		if( window.UpdateLoopInterval != null ) {
			//pause app because of modal
			game_pause();
		}

		//create and show modal
		var diag = new PurchaseDialog(jQuery("#content"), bSellMode);
		diag.initWithCidQtyPriceFactoryAndElem( cid, maxQty, ppu, locId, factId);
		window.currentDialog = diag;
	}

  window.startTradeDialog = function( cid, qty, ppu, locId, statId ) {
    var vessel = window.player.activeUserAgent.vessel;
    var location = window.galaxy.getLocation(locId);
    var station = location.getStation(statId);
    var vQty = vessel.getCargoQty( cid );
    var sQty = station.getCommodityUnitsAvailable( cid ).qtyAvailable;

    if( vQty == 0 && sQty == 0 ) return; //you have not enough minerals

		//if app is running
		if( window.UpdateLoopInterval != null ) {
			//pause app because of modal
			game_pause();
		}

		//create and show modal
		var diag = new TradeDialog(jQuery("#content"));
		diag.initWithCidQtyPriceFactoryAndElem( cid, vQty, sQty, ppu, locId, statId);
		window.currentDialog = diag;
  }

  //handle buy dialog events
  EventBus.ui.addListener("DialogCancel", function(evt) {
    window.currentDialog = null;
    game_start(); //resume
  });

  EventBus.ui.addListener("PurchaseDialogOk", function(evt) {
    //buy/sell items for UserAgentModel

    var dialog = window.currentDialog;
    var lid = dialog.locId;
    var fid = dialog.factId;
    var cid = dialog.cid;
    var ppu = dialog.pricePerUnit;
    var qty = dialog.qty;
    var agent = window.player.activeUserAgent;
    var vid = agent.vessel.id;

		if( dialog.sellMode ){
			//vid, lid, fid, cid, qty, ppu, buyAgent - diff order than BUY mode
			window.galaxy.actionSellFromVesselToFactory(vid, lid, fid, cid, qty, ppu, agent );
			EventBus.sfx.dispatch({evtName:"play", file:"audio/sfx_sell.mp3"});
		}else {
			//lid, fid, vid, cid, qty, ppu, buyAgent - diff order than SELL mode
			window.galaxy.actionSellToVesselFromFactory(vid, lid, fid, cid, qty, ppu, agent);
			EventBus.sfx.dispatch({evtName:"play", file:"audio/sfx_buy.mp3"});
		}

    window.currentDialog = null;
    game_start(); //resume
  });

	EventBus.ui.addListener("TradeDialogOk", function(evt) {
    var dialog = window.currentDialog;
    var lid = dialog.locId;
    var sid = dialog.statId;
    var cid = dialog.cid;
    var ppu = dialog.pricePerUnit;
    var qty = Math.abs(dialog.qty);
    var agent = window.player.activeUserAgent;
    var vid = agent.vessel.id;

		if( dialog.sellMode ){
			//vid, lid, fid, cid, qty, ppu, buyAgent - diff order than BUY mode
			window.galaxy.actionSellFromVesselToStation(vid, lid, sid, cid, qty, ppu, agent );
			EventBus.sfx.dispatch({evtName:"play", file:"audio/sfx_sell.mp3"});
		}else {
			//lid, fid, vid, cid, qty, ppu, buyAgent - diff order than SELL mode
			window.galaxy.actionSellToVesselFromStation(vid, lid, sid, cid, qty, ppu, agent);
			EventBus.sfx.dispatch({evtName:"play", file:"audio/sfx_buy.mp3"});
		}

    window.currentDialog = null;
		game_start(); //resume
	});

	//handle save request
	EventBus.game.addListener("requestSaveGame", function(evt) {
		//console.log("auto save");
		game_save();
	});

	//handle menu events
	init_menu_handlers();
  //handle ftue events
  init_ftue_handlers();

  //setup simulation update loop
  //  note: you still have to call window.runUpdateLoop() to begin
  window.lastUpdateTick = 0;
  window.runUpdateLoop = function() {
    window.lastUpdateTick = (new Date()).getTime();
    window.UpdateLoopInterval = setInterval( window.UpdateLoop, 30 );  } //30ms = ~33fps
  window.stopUpdateLoop = function() {
    clearInterval( window.UpdateLoopInterval ); window.UpdateLoopInterval = null; }

	//load from world_seed or save, and begin simulation
	game_load();
}

game_restart_from_pause = function()
{
	  game_start(); //resume

		//save and reload
		game_save();
		game_load();
}

game_export = function()
{
	game_save();
	var jsonStr = localStorage.getItem("save");

	//NOTE: save game data too large for this, gets truncated
	//window.prompt("Copy to clipboard: Ctrl+C, Enter", jsonStr);

	//temporary measure
	jQuery("#content").append(jsonStr);
}

game_start = function()
{
	if( window.UpdateLoopInterval == null ) {
  	window.runUpdateLoop();
	}
}

game_pause = function()
{
	if( window.UpdateLoopInterval != null ) {
		window.stopUpdateLoop();
	}
}

game_save = function()
{
	var galaxy = window.galaxy.toJson();
	//var ui = { currentLocation: window.currentLocation };
	var player = window.player.toJson();
	var json = { galaxy:galaxy, player:player };
	localStorage.setItem("save", JSON.stringify( json ));
	//console.log("saved data to local storage")
}

game_load = function()
{
	console.log("load data from local storage")

	var json = null;

	var ignoreSaveGame = false;
	if(ignoreSaveGame) {
		console.log("HACK: skipping load from file during THE REMAKING")
		//json = world_seed;
    localStorage.removeItem("ftue");
		json = genesis(random_template);
	}else {
		json = JSON.parse( localStorage.getItem("save") );
		if(!json) {
      localStorage.removeItem("ftue");
			json = genesis(random_template);
		}
	}

	game_init( json );

  game_start();

  ftue_step();
}

game_reset = function( )
{
	console.log("reset simulation to start");
	localStorage.removeItem("save");
  localStorage.removeItem("ftue");

	game_load();
}

game_init = function( seed )
{
	var galaxy = new GalaxySim();
	galaxy.initializeWithJson( seed["galaxy"] );
	window.galaxy = galaxy;

	var player = new PlayerModel();
	player.initializeWithJson( seed["player"] );
	window.player = player;

  window.hud.updateFromModel( player.getCorporation(), true );
  window.map.initializeWithGalaxySim( galaxy );

	//create view
	window.clearView();
	window.createView();
}

window.UpdateLoop = function()
{
  arguments.callee.minTickPeriod = 1;

  var ct = (new Date()).getTime();  //have to call new each frame to get current time
  var dt = ct - window.lastUpdateTick;
  window.lastUpdateTick = ct;

	var dtSeconds = dt / 1000.0;

  window.galaxy.update(dtSeconds);

}

init_menu_handlers = function()
{
  EventBus.ui.addListener("menuNuke", function(evt){ game_reset(); });
	EventBus.ui.addListener("menuPause", function(evt){ game_pause(); });
	EventBus.ui.addListener("menuResume", function(evt){ game_start(); });
	EventBus.ui.addListener("menuSaveGame", function(evt){ game_save(); });
	EventBus.ui.addListener("menuLoadGame", function(evt){ game_load(); });

  EventBus.ui.addListener("menuExportGame", function(evt) {
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		//create and show modal
		var diag = new TextAreaDialog(jQuery("#content"));
    diag.initWithTitleAndText( "Export", localStorage.getItem("save"), "DialogCancel" );
		diag.getDiv().css({width:"200px", height:"450px"});
		window.currentDialog = diag;
  });

  EventBus.ui.addListener("menuImportGame", function(evt) {
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		//create and show modal
		var diag = new TextAreaDialog(jQuery("#content"));
    diag.initWithTitleAndText( "Import", "", "ImportDialogOk" );
		window.currentDialog = diag;
  });
  EventBus.ui.addListener("ImportDialogOk", function(evt) {
    var strJson = evt.text;

    console.log("import strJson: " + strJson);
    if( JSON.parse( strJson ) ){
      localStorage.setItem("save", strJson);
    }

    window.currentDialog = null;
    game_start(); //resume

    game_load();
  });

  EventBus.ui.addListener("menuCreateLocation", function(evt) {
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		var x = (window.map.scroll.x + window.map.w_h );
    var y = (window.map.scroll.y + window.map.h_h );
		var randName = randLocationNames[getRand(0, randLocationNames.length-1)];

		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Location",
			successEvtName:"CreateLocationDialogOk",
			elements:[
				{type:"strInput", value:randName, label:"Name:", name:"name" },
				{type:"intInput", value:x, label:"x Coord:", name:"x" },
				{type:"intInput", value:y, label:"y Coord:", name:"y" }
			]
			});

		window.currentDialog = diag;
  });
  EventBus.ui.addListener("CreateLocationDialogOk", function(evt) {
    var name = evt.name;
    var x = evt.x;
    var y = evt.y;

    console.log("create new location " + name + " at " + x + "," + y);
    var newLoc = new LocationModel();
    newLoc.initializeWithJson({ name:name, loc:{ x:x, y:y }});
    window.galaxy.addLocation(newLoc);

		window.player.setCurrentLocation( newLoc.id ); //move to new location

    window.currentDialog = null;
    game_start(); //resume

		//save and reload
		game_save();
		game_load();
  });

  EventBus.ui.addListener("menuCreateDestination", function(evt) {
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		var destinations = [];
		jQuery.each(window.galaxy.locations, function(key, value){
			destinations.push({value:value.id, text:value.name});
		});

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Destination",
			successEvtName:"CreateDestinationOk",
			elements:[
				//{type:"strInput", value:"destinationId", label:"Destination:", name:"destination" }
				{type:"select", values:destinations, label:"Destination:", name:"destination"}
			]
			});
		window.currentDialog = diag;
  });
  EventBus.ui.addListener("CreateDestinationOk", function(evt) {
		var destId = evt.destination;
		var currLocationId = window.player.currentLocation;
		var currLocation = window.galaxy.getLocation(currLocationId);
		var targetLocation = window.galaxy.getLocation(destId);

		var success = false;
		//make sure dest exists,
		//make sure dest is not current location,
		//make sure dest does not exist already on current location
		if( !targetLocation || destId == currLocationId || currLocation.destinations.indexOf(destId) != -1 ) {
			console.log("invalid destination");
		}else {
			console.log("add destination " + destId);
			//attach bi-directionally
			currLocation.destinations.push(destId);
			targetLocation.destinations.push(currLocationId);

			success = true;
		}

    window.currentDialog = null;
    game_start(); //resume

		if(success) {
			game_restart_from_pause();
		}
  });


	EventBus.ui.addListener("menuCreateFactory", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		var types = [];
		jQuery.each(FactoryType.prototype.g_types, function(key, value){
			types.push({value:value.id, text:value.name});
		});

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Factory",
			successEvtName:"CreateFactoryOk",
			elements:[
				{type:"select", values:types, label:"Type:", name:"type"}
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("CreateFactoryOk", function(evt){
		var factType = evt.type;

		var currLocation = window.galaxy.getLocation( window.player.currentLocation );

		var factory = new FactoryModel();
		factory.initializeWithJson({type:factType});

		currLocation.addFactory(factory);

		window.currentDialog = null;
    game_restart_from_pause();
	});

	EventBus.ui.addListener("menuCreateStation", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

    var types = [];
		jQuery.each(StationType.prototype.g_types, function(key, value){
			types.push({value:value.id, text:value.name});
		});

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Station",
			successEvtName:"CreateStationOk",
			elements:[
        {type:"select", values:types, label:"Type:", name:"type"}
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("CreateStationOk", function(evt){
		var statType = evt.type;

		var currLocation = window.galaxy.getLocation( window.player.currentLocation );

		var station = new StationModel();
		station.initializeWithJson({type:statType});

		currLocation.addStation(station);

		window.currentDialog = null;
    game_restart_from_pause();
	});

	EventBus.ui.addListener("menuCreateCorporation", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

    var isPlayerValues = [{value:true, text:"YES"}, {value:false, text:"NO"}];
		var randName = randCorpNames[getRand(0, randCorpNames.length-1)];

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Corporation",
			successEvtName:"CreateCorporationOk",
			elements:[
        {type:"select", values:isPlayerValues, label:"IsPlayer:", name:"isPlayer"},
				{type:"strInput", value:randName, label:"Name:", name:"name" }
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("CreateCorporationOk", function(evt){
		var isPlayer = (evt.isPlayer === "true") ; //comes in as string from a select element
		var name = evt.name;

		console.log("create corp " + name);
		var corporation = new CorporationModel();
		corporation.initializeWithJson({name:name});
		corporation.incCredits(2000);

		window.galaxy.addCorporation(corporation);
		if(isPlayer) {
			window.player.setCorporation(corporation);
		}
		window.currentDialog = null;
		game_restart_from_pause();
	});

	EventBus.ui.addListener("menuCreateAgent", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

    var corporations = [];
		jQuery.each(window.galaxy.corporations, function(key, value){
			corporations.push({value:value.id, text:value.name});
		});
		if( corporations.length == 0 ) return; //no corps to add agent to

		var randName = randAgentNames[getRand(0, randAgentNames.length-1)];

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Agent",
			successEvtName:"CreateAgentOk",
			elements:[
        {type:"select", values:corporations, label:"Add To:", name:"corp"},
				{type:"strInput", value:randName, label:"Name:", name:"name" }
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("CreateAgentOk", function(evt){
		var corporationId = evt.corp;
		var corporation = window.galaxy.getCorporation(corporationId);
		var name = evt.name;

		console.log("create agent " + name);
		var agent = new AgentModel();
		agent.initializeWithJson({name:name});

		corporation.addAgent(agent);

		if( corporation == window.player.getCorporation() ) {
			window.player.setActiveUserAgent(agent);
		}

		window.currentDialog = null;
		game_start(); //resume
	});

	EventBus.ui.addListener("menuCreateVessel", function(evt){
    //if app is running, pause it
		if( window.UpdateLoopInterval != null ) { game_pause(); }

		var types = [];
		jQuery.each(VesselType.prototype.g_types, function(key, value){
			types.push({value:value.id, text:value.name});
		});
		if( types.length == 0 ) return; //no vessel types availale

		var agents = [];
		jQuery.each(window.galaxy._allAgents, function(key, value){
			agents.push({value:value.id, text:value.name});
		});
		if( agents.length == 0 ) return; //no agents to add vessel to

		var locations = [];
		jQuery.each(window.galaxy.locations, function(key, value){
			locations.push({value:value.id, text:value.name});
		});
		if( locations.length == 0 ) return; //no locations to add vessel to

		var randName = randShipNames[getRand(0, randShipNames.length-1)];

		//create and show modal
		var diag = new FormDialog(jQuery("#content"));
		diag.initWithJson({
			title:"Create Vessel",
			successEvtName:"CreateVesselOk",
			elements:[
				{type:"select", values:agents, label:"Agent:", name:"agent"},
				{type:"select", values:types, label:"Type:", name:"type"},
				{type:"select", values:locations, label:"Loc:", name:"location"},
				{type:"strInput", value:randName, label:"Name:", name:"name" }
			]
			});
		window.currentDialog = diag;
	});
	EventBus.ui.addListener("CreateVesselOk", function(evt){
		var name = evt.name;
		var agentId = evt.agent;
		var agent = window.galaxy.getAgent( agentId );
		var vesselTypeId = evt.type;
		var locationId = evt.location;
		var location = window.galaxy.getLocation(locationId);

		if(!location) return; //invalid location

		if(agent.vessel) {
			console.log("error: agent "+agent.id+" already controls a vessel")
			return;
		}

		console.log("create vessel " + name);
		var vessel = new VesselModel();
		vessel.initializeWithJson({name:name, type:vesselTypeId});
		location.addVessel(vessel);
		agent.setVessel(vessel);

		window.currentDialog = null;
		game_start(); //resume
	});

}
