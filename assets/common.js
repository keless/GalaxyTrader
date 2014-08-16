game_create = function()
{
	//LOAD DATA
  CommodityType.loadTypesWithJson( data["commodityTypes"] );
  FactoryType.loadTypesWithJson( data["factoryTypes"] );
  StationType.loadTypesWithJson( data["stationTypes"] );
  VesselType.loadTypesWithJson( data["vesselTypes"] );

	//instanciate singletons
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
		}else {
			//lid, fid, vid, cid, qty, ppu, buyAgent - diff order than SELL mode
			window.galaxy.actionSellToVesselFromFactory(vid, lid, fid, cid, qty, ppu, agent);
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
		}else {
			//lid, fid, vid, cid, qty, ppu, buyAgent - diff order than SELL mode
			window.galaxy.actionSellToVesselFromStation(vid, lid, sid, cid, qty, ppu, agent);
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
;//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php
//     from https://github.com/broofa/node-uuid

(function() {
  var _global = this;

  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required
  var _rng;

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  //
  // Moderately fast, high quality
  if (typeof(_global.require) == 'function') {
    try {
      var _rb = _global.require('crypto').randomBytes;
      _rng = _rb && function() {return _rb(16);};
    } catch(e) {}
  }

  if (!_rng && _global.crypto && crypto.getRandomValues) {
    // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
    //
    // Moderately fast, high quality
    var _rnds8 = new Uint8Array(16);
    _rng = function whatwgRNG() {
      crypto.getRandomValues(_rnds8);
      return _rnds8;
    };
  }

  if (!_rng) {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var  _rnds = new Array(16);
    _rng = function() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return _rnds;
    };
  }

  // Buffer class to use
  var BufferClass = typeof(_global.Buffer) == 'function' ? _global.Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  if (typeof define === 'function' && define.amd) {
    // Publish as AMD module
    define(function() {return uuid;});
  } else if (typeof(module) != 'undefined' && module.exports) {
    // Publish as node.js module
    module.exports = uuid;
  } else {
    // Publish as global (in browsers)
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    };

    _global.uuid = uuid;
  }
}).call(this);
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format

var BaseView = Class.create({
	initialize: function(){
		this.div = null;
		this.updateTarget = null;
	},
	destroy: function() {
    //remove any listeners, destroy any children
    this.setUpdateTarget(null);
  },
	updateFromModel: function( model, setAsUpdateTarget ) {
		 if(setAsUpdateTarget) {
      this.setUpdateTarget( model );
    }

		this._updateFromModel( model );
	},
	_updateFromModel: function( model ) {
		console.log("TODO: override _updateFromModel in base class");
	},
  getDiv: function() {
    //note: be sure to append this div to something on the HTML view tree or this element wont be visible
    return this.div;
  },
	setUpdateTarget: function( target ) {

    if( this.updateTarget != null ) {
			this._detachTarget( this.updateTarget );
    }

    this.updateTarget = target;
    if(target == null) return;

		this._attachTarget( target );
  },
	_detachTarget: function( target ) {
		console.log("TODO: override _dettachTarget in base class");
		//EX: target.removeListener("updateEvtName", this.onUpdateFunction.bind(this) );
	},
	_attachTarget: function( target ) {
		console.log("TODO: override _attachTarget in base class");
		//EX: target.addListener("updateEvtName", this.onUpdateFunction.bind(this) );
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js


var EventBus = Class.create({
  initialize : function( strBusName ) {
    this.listeners = {};
		this.busName = strBusName;
		this.logToConsole = false;
  },
  g_eventBuses : {},
  addListener : function( strEventName, callbackFunction ) {
    if(! this.listeners[strEventName] )
    {
      this.listeners[strEventName] = [];
    }
    this.listeners[strEventName].push(callbackFunction);
  },
  removeListener : function( strEventName, callbackFunction ) {
    if(! this.listeners[strEventName] ) return; //nothing to remove

    var idx = this.listeners[strEventName].indexOf( callbackFunction );
    this.listeners[strEventName].splice( idx, 1 );
  },
  //note: expects evtObj.evtName to be the strEventName to send to
  dispatch : function( evtObj ) {
    if(!evtObj.evtName) { console.log("abort dispatch event -- no evtName %O", evtObj); return; }

		if(this.logToConsole) {
			console.log("EB["+this.busName+"] "+evtObj.evtName+":%O", evtObj);
		}

    if(!this.listeners[evtObj.evtName] ) return; //no one listening

    this.listeners[evtObj.evtName].forEach(function(ele, idx, arr){
      ele( evtObj ); //dispatch the event
    });
  }
});

//global accessor
EventBus.get = function( strBusName )
{
  if( !EventBus.prototype.g_eventBuses[strBusName] ) {
    EventBus.prototype.g_eventBuses[strBusName] = new EventBus( strBusName ); //create new
  }
  return EventBus.prototype.g_eventBuses[strBusName];
}

//default channels
EventBus.game = EventBus.get("game");
EventBus.ui = EventBus.get("ui");
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

Generic use input form modal dialog

init json format:
{
title:"Dialog title",
succesEvtName:"OnSuccessEvt",
elements:[
  {type:"text", value:"some text" },
	{type:"intInput", value:343039, label:"someVar:", name:"varName" },
	{type:"strInput", value:"default value", label:"someVar2:", name:"varName2" },
	{type:"select", values:[{value:"someval", text:"Visible text"}], default:0, label:"someVar2:" name:"varName3"}
]
}

events sent
ui:<successEvtName>: { dialog:this, text: someText }
ui:"DialogCancel": { dialog:this }

*/

var FormDialog = Class.create({
	initialize: function( parentHtmlElement ) {
		this.parent = parentHtmlElement;
    this.cancelled = false;
	},
  initWithJson: function( json ) {
    this.cancelled = false;
    var blockThis = this;

		var title = json["title"];
		var successEvtName = json["successEvtName"];
		this.elements = [];
		this.elementDivs = [];

		this.div = jQuery("<div>");

		var div = null;
		var lbl = null;
		jQuery.each( json["elements"], function(idx, value){
			if(value.label) lbl = jQuery("<p>"+value.label+"</p>").css("display", "inline-block");
			switch(value.type){
				case "text":
					div = jQuery("<p>"+value.value+"</p>");
					break;
				case "select":

					div = create_select_div(value.values)
					break;
				case "intInput":
				case "strInput":
					div = jQuery("<input type='text'class='text ui-widget-content ui-corner-all'>").val(value.value);
					break;
				default:
					return true; //continue;
			}
			blockThis.elements.push( value );
			blockThis.elementDivs.push( div );
			if(lbl) blockThis.div.append(lbl);
			blockThis.div.append(div).append("<br>");
		});

    jQuery(this.parentHtmlElement).append(this.div);

    this.div.dialog({
      modal: true,
      title:title,
      buttons: {
        Ok: function() {
					this.done = true;
					var evt = {evtName:successEvtName, dialog:blockThis};
					jQuery.each(blockThis.elements, function(idx, value){
						switch(value.type){
							case "select":
								evt[ value.name ] = blockThis.elementDivs[idx].val();
								break;
							case "intInput":
								evt[ value.name ] = parseInt( blockThis.elementDivs[idx].val() );
								break;
							case "strInput":
								console.log("get strInput " + value.name + " " + blockThis.elementDivs[idx].val());
								evt[ value.name ] = blockThis.elementDivs[idx].val();
								break;
						}
					});
          EventBus.ui.dispatch(evt);
					jQuery(this).dialog("close");
        },
				Cancel: function() {
          //behave same as cancel 'x' button
					this.done = true;
					blockThis.cancelled = true;
					EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					jQuery(this).dialog("close");
				}

      },
			close: function() {
					if( !this.done ) {
            blockThis.cancelled = true;
						EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					}
				}
    });

	},
	getDiv: function() {
		return this.div;
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/* example json:
 { name: "root",
 		opts:[
			{ name: "alpha",
				opts:[
					{ name: "beta", evt:"menuBeta", icon:"ui-icon-power" },
					{ name: "gamma", evt:"menuGamma" }
				]
			},
			{ name: "delta", evt:"menuDelta" },
			{	name: "epsilon", evt:"menuEpsilon" }
		]
 }
*/

var MenuView = Class.create({
	initializeWithJson: function( json ){
		this.div = this._parseRootMenuNode(json);

		var blockThis = this;
		//convert to menu
		this.div.menu({
			select: function(evt, ui){
				var evtName = ui.item.attr("name");
				if(!evtName) return;
				EventBus.ui.dispatch({evtName:evtName});
			},
			blur: function(evt, ui){
				//close the menu
				//console.log("TODO: menu lost focus, close");
				//blockThis.div.toggle(false);
			}
		});

		this.div.show().focus();
	},
	destroy: function(){
		this.div.remove();
	},
	_parseRootMenuNode: function( json ) {
		//first root node is special case (since it doesnt display a name)
		var name = json["name"];

		var root = jQuery("<ul>", {name:name });

		var blockThis = this;
		jQuery.each( json["opts"], function(key, value){
			var child = blockThis._rParseJsonMenuNode( value );
			root.append(child);
		});

		return root;
	},
	//recursive
	_rParseJsonMenuNode: function( json ) {
		var name = json["name"];
		var evtName = json["evt"];
		var root = jQuery("<li>", {name:evtName });

		if( json.hasOwnProperty("icon") ) {
			var iconSpan = jQuery("<span class='ui-icon "+json["icon"]+"'></span>");
			root.append(iconSpan);
		}

		root.append( name );

		if( json.hasOwnProperty("opts") ) {
			//this is a menu branch
			var subMenu = this._parseRootMenuNode( json );
			root.append(subMenu);
		}

		return root;
	},
	getDiv: function(){
		return this.div;
	}

})
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js

var Service = Class.create({
  initialize: function() {
  },
  g_services : []
});

//class methods for getting types
Service.get = function( serviceName  )
{
  return Service.prototype.g_services[ serviceName ];
}

Service.add = function( serviceName, service )
{
	Service.prototype.g_services[ serviceName ] = service;
}
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

ui:<successEvtName>: { dialog:this, text: someText }
ui:"DialogCancel": { dialog:this }

*/

var TextAreaDialog = Class.create({
	initialize: function( parentHtmlElement ) {
		this.parent = parentHtmlElement;
    this.cancelled = false;
	},
  initWithTitleAndText: function( title, text, successEvtName ) {
    this.cancelled = false;
    var blockThis = this;

		var ta = jQuery("<textArea class='text ui-widget-content'>").css({width:"100%", height:"100%",
																																			margin:0, border:0, resize:'none'});
    ta.text(text);


		this.innerDiv = jQuery("<div>").css({position:"absolute",
																					left: "5px",
																					top: "5px",
																					right: "5px",
																					bottom: "5px",
																					border: "1px"});
		this.innerDiv.append(ta);
    this.textArea = ta;
		this.div = jQuery("<div>").append(this.innerDiv);

    jQuery(this.parentHtmlElement).append(this.div);

    this.div.dialog({
      modal: true,
      title:title,
      buttons: {
        Ok: function() {
					this.done = true;
          var text = blockThis.textArea.val();
          EventBus.ui.dispatch({evtName:successEvtName, text:text });
					jQuery(this).dialog("close");
        },
				Cancel: function() {
          //behave same as cancel 'x' button
					this.done = true;
					blockThis.cancelled = true;
					EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					jQuery(this).dialog("close");
				}

      },
			close: function() {
					if( !this.done ) {
            blockThis.cancelled = true;
						EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					}
				}
    });

	},
	getDiv: function() {
		return this.div;
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include js/framework/EventDispatcher

function getRand(min, max) {
  return ~~(Math.random() * (max - min + 1)) + min
}

//get dictionary length
function dicLength( dictionary ) {
	return Object.keys(dictionary).length;
}


function jQueryIcon( strName ) {
	return jQuery("<span class='ui-icon "+strName+"' style='display:inline-block'></span>");
}

//options must be [{ value:"returnValue", text:"userVisible" } ..]
// text is optional, if not found value will be used for userVisible text
// if optDefaultSelectValue is set, the option with the same value will be selected by default
function create_select_div( options, optDefaultSelectValue ) {
	var selectHtml = "<select>";
	jQuery.each(options, function(selIdx, selValue){
		var selText = selValue.value;
		if( selValue["text"] ) selText = selValue.text;
		selectHtml += "<option value='"+selValue.value+"'>"+selText+"</option>";
	});
	selectHtml += "</select>";
	var div = jQuery(selectHtml);
	if(optDefaultSelectValue) {
		console.log("select default value " + optDefaultSelectValue);
		div.find("option[value='"+optDefaultSelectValue+"']").prop('selected', true);
	}
	return div;
}

function show_text_dialog(parentHtmlElem, title, text, btnText, successEvtName ) {
  var div = jQuery("<div><p>"+text+"</p></div>");

  parentHtmlElem.append(div);

  div.dialog({
      modal: true,
      title:title,
      buttons: [
        { text:btnText,
          click: function() {
            jQuery(this).dialog("close");
          }
      }],
			close: function() {
					if( !this.done ) {
						EventBus.ui.dispatch({evtName:successEvtName});
					}
				}
    });

  return div;
}
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js

var Vec2D = Class.create({
  initialize: function( x, y ){
		this.x = x;
		this.y = y;
	},
	initializeWithPos: function( posObj ) {
		this.x = posObj.x;
		this.y = posObj.y;
	},
	getUnitized: function() {
		var mag = this.getMag();
		return new Vec2D( this.x / mag, this.y / mag );
	},
	getMagSq: function() {
		return (this.x*this.x) + (this.y*this.y);
	},
	getMag: function() {
		return Math.sqrt((this.x*this.x) + (this.y*this.y));
	},
	getScalarMult: function( scalar ) {
		return new Vec2D( this.x * scalar, this.y * scalar );
	},
	getVecAdd: function( vec2 ) {
		return new Vec2D( this.x + vec2.x, this.y + vec2.y );
	},
	getVecSub: function( vec2 ) {
		return new Vec2D( this.x - vec2.x, this.y - vec2.y );
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//requires Service.get("galaxy") to have a GalaxySim object present (for location attachment)

/*
	events sent
	[self]:"agentUpdateCorp" - {agent:this}
	[self]:"agentUpdateVessel" - {agent:this}
*/

var AgentModel = Class.create(EventBus, {
  initialize: function($super){
		$super("AgentModel");
    this.vessel = null;
    this.name = "Peabody Humperdink";
    this.id = "";
		this._corp = null;
    this.AiMethod = this._AIGenericNoMove.bind(this);
		this.AiSpecialistCommodityType = null;
    this.idledLastTurn = false;
  },
  destroy: function() {
    //remove any listeners, etc
  },
  initializeWithJson: function( json ) {
    this.name = json["name"] || "Unknown Seller";
    this.id = json["id"] || uuid.v4();

    if( json["vessel"] ) {
      this.vessel = Service.get("galaxy").getVessel( json["vessel"] );
			this.vessel.setOwner(this);
      console.log( this.name + " claimed vessel " + this.vessel.name );
    }
    else {
      this.vessel = null;
    }
  },
	toJson: function() {
		var vesselId = this.vessel ? this.vessel.id : "";
		var json = { name:this.name, id:this.id, vessel:vesselId,
								 specialistType:this.AiSpecialistCommodityType
               };
    return json;
	},
	setCorporation: function( corpModel ) {
		if( this._corp != null ) {
			console.log("warning: agent losing corp " + this.id);
		}

		this._corp = corpModel;
		this.dispatch({evtName:"agentUpdateCorp", agent:this});
	},
	getCorporation: function() {
		return this._corp;
	},
	setVessel: function( vModel ) {
		if(this.vessel) {
			this.vessel.setOwner(null);
			console.log("agent " + this.name + " abandoning vessel " + vModel.name);
		}

		this.vessel = vModel;

		this.dispatch({evtName:"agentUpdateVessel", agent:this});

		if( this.vessel == null ) return;
		console.log("agent "+ this.name + " claimed vessel " + vModel.name);
	},
	getLocation: function() {
		if(!this.vessel) return null;
		return this.vessel.location;
	},
  getNumCredits: function() {
		if(!this._corp) return 0;
    return this._corp.getNumCredits();
  },
	incCredits: function( delta ) {
		if(!this._corp) {
			console.log("warning: agent getting credits but has no corp " + this.name);
			return;
		}

		this._corp.incCredits(delta);
	},
  update: function( currTime, dt ) {
    if(!this.vessel) return;

    //console.log("agent update at " + currTime);

    if(this.AiMethod) {
      this.AiMethod(currTime, dt);
    }
  },

	setIdleAI: function() {
		this.AiMethod = this._AIIdle.bind(this);
	},
	setGenericAI: function() {
		this.AiMethod = this._AIGenericNoMove.bind(this);
	},

	_AIIdle: function( currTime, dt ) {
		//do nothing
	},
  _AIGenericNoMove: function( currTime, dt ) {
    var location = this.vessel.location;
    var blockThis = this;

		if(!this._corp) return;
		if(!this.vessel) return;
		var credits = this._corp.getNumCredits();

    //behaviors = 1) sell, 2) purchase, 3) move, 4) wait

    var cmdyFilter = undefined;
    if(this.AiSpecialistCommodityType) {
      cmdyFilter = [ this.AiSpecialistCommodityType ];
      //console.log( this.name + " specializing in " + this.AiSpecialistCommodityType );
    }

		if( dicLength(location.factories) == 0 ) return;

		//try to sell
    //returns dict of { factId1:{ cid1:{ cid, pricePerUnit, qty } .. cidN:{} } .. factIdN:{} }
    var sellChoice = null;
    var inputs = location.queryFactoryInputs(cmdyFilter);
    jQuery.each(inputs, function(factId, factory){
      jQuery.each(factory, function(cid, offer){
        //console.log("look at sell choice " + cid + " at " + factId )
        var amtOwned = blockThis.vessel.getCargoQty(offer.cid);
        if( amtOwned > 0 ) {

					if( offer.pricePerUnit < blockThis.vessel.getCargoPurchasedVal(offer.cid) ) {
						console.log("Avoid selling cmdy " + offer.cid + " at ppu " + offer.pricePerUnit + " when our val is " + blockThis.vessel.getCargoPurchasedVal(offer.cid));
						return true; //continue;
					}

          //found something to sell
          offer.qty = Math.min( amtOwned, offer.qty ); //cap to what we have available

          if( sellChoice == null ) {
            //console.log(blockThis.name + " found something to sell " + offer.cid + " to "+ factId );
            sellChoice = offer;
            sellChoice.fid = factId;
          }
          else {
            //check if better
            if( offer.qty * offer.pricePerUnit > sellChoice.qty * sellChoice.pricePerUnit ) {
              //console.log(blockThis.name + " found something BETTER to sell " + offer.cid + " to " + factId);
              sellChoice = offer;
              sellChoice.fid = factId;
            }
          }
        }
      });
    });

    if( sellChoice ) {

      Service.get("galaxy").actionSellFromVesselToFactory( this.vessel.id, location.id, sellChoice.fid, sellChoice.cid,
                                                 sellChoice.qty, sellChoice.pricePerUnit, this);

      this.idledLastTurn = false;
      return;
    }

		//try to buy
    //returns dict of { factId:{ cid:{ cid, pricePerUnit, qty } } }
    var buyChoice = null;
    var outputs = location.queryFactoryOutputs(cmdyFilter);
    jQuery.each(outputs, function(factId, factory){
      jQuery.each(factory, function(cid, offer){
        //console.log("look at buy choice " + cid + " at " + factId )
        var amtOwned = blockThis.vessel.getCargoQty(offer.cid);
        if( amtOwned == 0 ) { //dont buy if you already have some (todo: better logic)
          //found something to buy
          var maxAfford = Math.floor( credits / offer.pricePerUnit ); //force int
          offer.qty = Math.min( maxAfford, offer.qty ); //cap to what we can pay for

          if( buyChoice == null ) {
            //console.log(blockThis.name + " found something to buy " + offer.cid + " from "+ factId);
            buyChoice = offer;
            buyChoice.fid = factId;
          }
          else {
            //check if better
            if( offer.qty * offer.pricePerUnit < buyChoice.qty * buyChoice.pricePerUnit ) {
              //console.log(blockThis.name + " found something BETTER to buy " + offer.cid + " from " + factId);
              buyChoice = offer;
              buyChoice.fid = factId;
            }
          }
        }
      });
    });

    if( buyChoice ) {

      Service.get("galaxy").actionSellToVesselFromFactory( this.vessel.id, location.id, buyChoice.fid,  buyChoice.cid,
                                                 buyChoice.qty, buyChoice.pricePerUnit, this);

      this.idledLastTurn = false;
      return;
    }

    //console.log( this.name + " couldnt buy or sell");

    if(this.idledLastTurn) {
      //move to random other sector
      if( location.destinations.length > 0 ) {
        //console.log( this.name + " says: lets blow this popsicle stand");
				var destination = location.destinations[ getRand(0, location.destinations.length - 1 ) ];

				//console.log( this.name + " says: on  my way to " + destination );
				this.actionMoveToLocation(destination);

      }
    }

    //did nothing this turn
    this.idledLastTurn = true;
  },
	actionMoveToLocation: function( locationId ) {
		var newLocation = Service.get("galaxy").getLocation( locationId );
		newLocation.addVessel( this.vessel );
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>


var CommodityType = Class.create({
  initialize: function() {
    this.name = "";
    this.id = "undefined_id";
    this.minVal = 0;
    this.maxVal = 0;
  },
  g_types: {},
  initializeWithJson: function(json) {
    this.name = json["name"]  || "";
    this.id = json["id"]  || "undefined_idj";
    this.minVal = json["minVal"] || 0;
    this.maxVal = json["maxVal"] || 0;

    CommodityType.prototype.g_types[ this.id ] = this;
  },
  getValWithCapacityPct: function(capPct) {
    var diff = this.maxVal - this.minVal;
    return ~~(this.maxVal - (diff * capPct)); //convert to int

    //NOTE: double tilde "~~" is a fast, negative-safe alternative to Math.floor()
  },
  getAvgTradeValue: function() {
    return Math.ceil( this.minVal * 1.5 )
  }
});

//class methods for getting types
CommodityType.get = function( strTypeId )
{
  return CommodityType.prototype.g_types[ strTypeId ];
}

CommodityType.loadTypesWithJson = function( json )
{
  jQuery.each(json, function(key, value){
    var cmdyType = new CommodityType();
    cmdyType.initializeWithJson( value );
  });
}

var CommodityModel = Class.create({
  initialize: function( )
  {
    this.type = null;
    this.maxQty = 1;
    this.currQty = 0;
    this.name = "";

		//purchased value, used by AI when buying to describe the value the goods were purchased at
		// useful to ensure they sell at an equal or higher rate to not lose money
		this._val = 0;
  },
	//accepts both {type:xxx, currQty:xxx} and {cid:xxx, qty:xxx}
  initializeWithJson: function( json) {
    this.initialize();

    var cmdyTypeId = json["type"] || json["cid"] || "invalid_idj";
    var cmdyType = CommodityType.get( cmdyTypeId );

    this.type = cmdyType;
    this.name = cmdyType.name;
    this.maxQty = json["maxQty"] || this.maxQty;
    this.currQty = json["currQty"] || json["qty"] || this.currQty;
		this._val = json["_val"] || this._val;
  },
	toJson: function(){
		var json = { type:this.type.id, maxQty:this.maxQty, currQty:this.currQty, innVal:this.innVal };
		return json;
	},
  getValue: function() {
    return this.type.getValWithCapacityPct( this.currQty / this.maxQty );
  },
	getPurchasedVal: function() {
		return Math.ceil(this._val);
	},

	//NOTE: does not obey maxQty, you must ensure those rules yourself
	incQtyWithPrice: function( qty, price) {
		if( qty <= 0 ) {
			//removing qty does not change the purchase value of the rest
			this.currQty += qty; //remember, this is negative
			return;
		}

		if(!price) {
			console.log("WARNING: no price given for incQtyWithPrice");
		}

		var Q3 = this.currQty + qty;
		var VT1 = this.currQty * this._val;
		var VT2 = qty * price;
		var VT3 = VT1 + VT2;
		var PPU3 = VT3 / Q3;
		this.currQty = Q3;
		this._val = PPU3;
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/AgentModel.js

/*
  events sent
  [self]:"corpUpdateCredits": { corp:self }
	[self]:"corpUpdateAgents": { corp:self }
*/

var CorporationModel = Class.create(EventBus, {
	initialize: function( $super ) {
		$super("CorporationModel");
		this.name = "";
		this.id = "";
		this.agents = {};
		this._credits = 0;

		this.lastAgentProcessTime = 0;
		this.agentProcessPeriod = 5; //seconds
	},
	initializeWithJson: function( json ) {
    this.name = json["name"] || "Anon Corp";
    this.id = json["id"] || uuid.v4();
    this._credits = json["credits"] || 0;

    if( json["agents"] ) {
			var blockThis = this;
			var galaxySim = Service.get("galaxy");
			jQuery.each(json["agents"], function(key, value){
				var agent = new AgentModel();
				agent.initializeWithJson(value);
				agent.setCorporation(blockThis);
				blockThis.addAgent(agent);
			});
    }
    else {
			this.agents = {};
    }
  },
	addAgent: function( agent ) {
		this.agents[agent.id] = agent;
		agent.setCorporation( this );
		Service.get("galaxy").addAgent(agent);
		this.dispatch({evtName:"corpUpdateAgents", corp:this});
	},
	getAgent: function( agentId ) {
		return this.agents[agentId];
	},
	toJson: function() {
		var agents = [];
		var blockThis = this;
		jQuery.each(this.agents, function(key, value){
			agents.push( value.toJson() );
		});
		var json = { name:this.name, id:this.id, credits:this._credits,
								agents:agents
               };
    return json;
	},
  getNumCredits: function() {
    return this._credits;
  },
	incCredits: function( delta ) {
		this._credits += ~~(delta); //force int
		if( this._credits < 0 ) {
			console.log("CorpModel:incCredits - went below zero " + this._credits);
			this._credits = 0;
		}

		var blockThis = this;
		this.dispatch({evtName:"corpUpdateCredits", corp:blockThis});
	},

	update: function( currTime, dt ) {

		var blockThis = this;

		if( currTime > this.lastAgentProcessTime + this.agentProcessPeriod ) {
      jQuery.each(this.agents, function(key, value){
        value.update( currTime, blockThis.agentProcessPeriod );
      });

      this.lastAgentProcessTime = currTime;
    }
	}


});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//requires Service.get("galaxy") to have a GalaxySim object present (for location attachment)

/*
  FactoryType
    represents a specific type of factory (unique per each type)

  FactoryModel
    represents an instance of a factory (unique per each instance)
    has a reference to a FactoryType (multiple Models can point to one Type)



    is an EventBus
     sends [self]"updateStorage" : {evtName:"updateStorage", from:this }  - on start/stop processing
     sends [self]"updateProcess" : {evtName:"updateProcess", from:this }  - on processing progress
     sends [game]"needCommodity" : {evtName:"needCommodity", from:this, cid:commodityId, maxQty:intMax } - if start fails because resource is lacking
 */

var FactoryType = Class.create({
  initialize: function() {
    this.name = "";
    this.id = "invalid_id";
    this.inputs = {};  //{ "cid" : <str commodityTypeId>, "qty":<int quantity>, "maxQty":<int max> }
		this.outputs = {}; //{ "cid" : <str commodityTypeId>, "qty":<int quantity>, "maxQty":<int max> }
    this.processTime = 0;
  },
  g_types: {},
  initializeWithJson: function( json ) {
    this.name = json["name"] || "";
    this.id = json["id"] || "invalid_idj";
		this.inputs = json["inputs"] || {};
		this.outputs = json["outputs"] || {};
    this.processTime = json["processTime"] || 0;
    FactoryType.prototype.g_types[ this.id ] = this;
  },
  get: function( strTypeId )
  {
    return g_types[strTypeId];
  }
});

//class methods for getting types
FactoryType.get = function( strTypeId )
{
  return FactoryType.prototype.g_types[ strTypeId ];
}

FactoryType.loadTypesWithJson = function( json )
{
  jQuery.each(json, function(key, value){
    var factoryType = new FactoryType();
    factoryType.initializeWithJson( value );
  });
}

var FactoryModel = Class.create(EventBus, {
  initialize: function( $super ) {
    $super("FactoryModel"); //initialize EventBus
    this.type = null;
    this.name = "";
    this.id = "";
    this.owner = null;
    this.location = null;
    this._currentProcessStartTime = 0;
    this._currentProcessEndTime = 0;
    this._processSpeedModifier = 1.0;
    this.inputStorage = {}; //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
		this.outputStorage = {}; //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
  },
  initializeWithJson: function( json ) {
    this.initialize();

    var factoryTypeId = json["type"] || "invalid_idj";
    var factoryType = FactoryType.get( factoryTypeId );

    this.type = factoryType;
    this.name = json["name"] || factoryType.name;
    this.id = json["id"] || uuid.v4();
    this._processSpeedModifier = json["processSpeedModifier"] || this._processSpeedModifier;
		this.inputStorage = json["inputStorage"] || {};
		this.outputStorage = json["outputStorage"] || {};

		if( json["owner"] ) {
      this.owner = Service.get("galaxy").getAgent( json["owner"] );
    }
    else {
      this.owner = null;
    }

    //cant set location directly here-- need to search galaxy for it
    if( json["location"] ) {
      this.location = Service.get("galaxy").getLocation( json["location"] );
    }
    else {
      this.location = null;
    }

    //load empty storage descriptors from type
    if( jQuery.isEmptyObject(this.inputStorage) && !jQuery.isEmptyObject(this.type.inputs) )
    {
      var blockThis = this;
      jQuery.each( this.type.inputs, function( key, value ) {
        blockThis.inputStorage[key] = { cid:value.cid, currQty:0, maxQty:value.maxQty };
      });
    }

    if( jQuery.isEmptyObject(this.outputStorage) && !jQuery.isEmptyObject(this.type.outputs) )
    {
      var blockThis = this;
      jQuery.each( this.type.outputs, function( key, value ) {
        blockThis.outputStorage[key] = { cid:value.cid, currQty:0, maxQty:value.maxQty };
      });
    }
  },
  toJson: function() {
		var ownerId = this.owner ? this.owner.id : "";
    var json = { type:this.type.id, name:this.name, id:this.id, processSpeedModifier:this._processSpeedModifier,
                inputStorage:this.inputStorage, outputStorage:this.outputStorage, owner:ownerId,
                processStartTime:this._currentProcessStartTime, processEndTime:this._currentProcessEndTime
               };
    return json;
  },
	_getPricePerUnit: function( cid, currQty, maxQty, bIsInput ) {
		var cmdyType = CommodityType.get(cid);
  	var pricePerUnit = cmdyType.getValWithCapacityPct( currQty / maxQty );
		if( bIsInput && currQty == 0 ) {
			var incentive = Math.floor(pricePerUnit * 0.1);
			if( incentive < 1 ) incentive = 1;
			pricePerUnit += incentive;
		}
		return pricePerUnit;
	},
	//returns offer object: { qtyAvailable:int, pricePerUnit:int } (NOTE: pricePerUnit only non-zero if qty > 0)
  getCommodityUnitsAvailable: function( cid ) {
		var offer = {qtyAvailable:0, pricePerUnit:0};
		var value = this.outputStorage[cid];

		if( value.currQty > 0 ) {
			var pricePerUnit = this._getPricePerUnit(cid, value.currQty, value.maxQty, false );

			offer.qtyAvailable = value.currQty;
			offer.pricePerUnit = pricePerUnit;
			//console.log( "got amtsAvail for " + cid)
		}

    return offer;
  },
	//returns offer object: { qtyNeeded:int, pricePerUnit:int } (NOTE: pricePerUnit only non-zero if qty > 0)
	getInputCommodityUnitsNeeded: function( cid ) {
		var offer = {qtyNeeded:0, pricePerUnit:0};
		var value = this.inputStorage[cid];

		if(value.currQty < value.maxQty ) {
			var pricePerUnit = this._getPricePerUnit(cid, value.currQty, value.maxQty, true );

			offer.qtyNeeded = value.maxQty - value.currQty;
			offer.pricePerUnit = pricePerUnit;
			//console.log( "got amtsNeeded for " + cid)
		}

    return offer;
	},
  //returns amt sold (assumes full amtPaid is paid)
  purchaseCommodityUnitsForSale: function( cid, maxQty, amtPaid ) {
    //its okay if they overpaid, but only return as many units as they can afford
    // its up to the caller to make sure they're not over-paying (note: NOT THREAD SAFE)
    var amtSold = 0;

		var value = this.outputStorage[cid];

		var pricePerUnit = this._getPricePerUnit(cid, value.currQty, value.maxQty, false );
		var canAffordUnits = Math.floor( amtPaid / pricePerUnit ); //force int

		//buy the minimum between the maxQty requested, the max affordable, and the qty available
		var amtToBuy = Math.min(maxQty, canAffordUnits, value.currQty);
		amtSold = amtToBuy;

		this.outputStorage[cid].currQty -= amtSold;

		//debug code: //TODO: remove this when everything is cool
		var correctPrice = amtSold * pricePerUnit;

		//console.log("sold "+cid+" qty "+amtSold+" tot: "+correctPrice);
		if( correctPrice != amtPaid ) {
			console.log("inaccurate price - paid: "+amtPaid);
		}



    if(amtSold > 0) {
      this.dispatch({evtName:"updateStorage", from:this });
    }

    return amtSold;
  },
  //returns purchased object: { qty:int, totalPrice:float }
  sellCommodityUnitsToFactory: function( cid, amt ) {
    var offer = { qty:0, totalPrice:0 };

		var value = this.inputStorage[cid];

		var spaceAvailable = value.maxQty - value.currQty;
		var amtToBuy = Math.min( spaceAvailable, amt );
		var pricePerUnit = this._getPricePerUnit(cid, value.currQty, value.maxQty, true );

		//console.log(" seller intended amt " + amt)
		//console.log(" fact space avail " + spaceAvailable)
		//console.log(" factory bought " + amtToBuy + " units ")

		offer.qty = amtToBuy;
		offer.totalPrice = amtToBuy * pricePerUnit;

		this.inputStorage[cid].currQty += amtToBuy;

		if( value.currQty != ~~(value.currQty) ) {
			console.log("WARNING: qty corrupt, inc'd by " + amtToBuy)
		}


    if( offer.qty > 0 ) {
      this.dispatch({evtName:"updateStorage", from:this });
    }

    return offer;
  },
  getProcessingPct: function( currTime ) {
    if(!this.isProcessing()) return 0.0;

    var dt = Math.min( currTime, this._currentProcessEndTime) - this._currentProcessStartTime;
    var period = this._currentProcessEndTime - this._currentProcessStartTime;

    return dt / period;
  },
  getProcessingTimeLeft: function( currTime ) {
    if(!this.isProcessing()) return 0.0;
    var dt = Math.min( currTime, this._currentProcessEndTime) - this._currentProcessStartTime;
    return dt;
  },
  isProcessing: function() {
    if( this._currentProcessEndTime != 0 ) return true;
    return false;
  },
  startProcessing: function( startTime ) {
    if( this.isProcessing() ) return; //already processing

    var blockThis = this;

    //check for valid input resources
    var bHasInputs = true;
    jQuery.each(this.type.inputs, function(key, value){
      if( blockThis.inputStorage[key].currQty < value.qty ) {
        bHasInputs = false;

        EventBus.game.dispatch({evtName:"needCommodity", from:blockThis, cid:blockThis.inputStorage[key].cid, maxQty:blockThis.inputStorage[key].maxQty });

        return false; //break;
      }
    });
    if(!bHasInputs) return; //cant start processing, you have not enough minerals

    //check outputStorage has enough capacity to output a whole batch
    var bHasCapacity = true;
    jQuery.each(this.type.outputs, function(key, value){
      if( blockThis.outputStorage[key].maxQty < blockThis.outputStorage[key].currQty + value.qty ) {
        bHasCapacity = false;
        return false; //break;
      }
    });
    if(!bHasCapacity) return; //cant start processing, not enough storage output capacity

    //console.log("starting production of " + this.type.id );

    //start timer
    this._currentProcessStartTime = startTime;
    var processTimeMS = this.type.processTime;
    this._currentProcessEndTime = startTime + (processTimeMS * this._processSpeedModifier);

    //consume input resources
    jQuery.each(this.type.inputs, function(key, value){
      //consume input
      blockThis.inputStorage[key].currQty -= value.qty;
    });

    //TODO -- set a timer to expire at endTime?
    // -- for now we're bruteforce calling update on all the things

    //alert listeners of changes
    this.dispatch({evtName:"updateStorage", from:this });
  },
  finishProcessing: function( currTime ) {
    if( !this.isProcessing() ) return; //nothing to finish
    if( currTime < this._currentProcessEndTime)
    {
      this.dispatch({evtName:"updateProcess", from:this });
      return; //too to finish
    }

    //console.log("process finished at " + this._currentProcessEndTime);

    var blockThis = this;
    //reward outputs
    jQuery.each(this.type.outputs, function(key, value) {
      blockThis.outputStorage[key].currQty += value.qty;
      //cap to maxQty
      if( blockThis.outputStorage[key].currQty > blockThis.outputStorage[key].maxQty ) {
        blockThis.outputStorage[key].currQty = blockThis.outputStorage[key].maxQty;
      }
    });

    //reset timer
    this._currentProcessStartTime = 0;
    this._currentProcessEndTime = 0;

    //alert listeners of changes
    this.dispatch({evtName:"updateStorage", from:this });
  },
  setLocation: function( location ) {
    if( this.location ) { //if defined and not null
      var oldLocation = this.location;
      this.location = null;
      oldLocation.removeFactory(this);
    }
    this.location = location;
  },
  update: function( currTime, dt ) {
    if( this.isProcessing() ) {
      //try to finish
      this.finishProcessing( currTime );
    }
    else {
      //try to start
      this.startProcessing( currTime );
    }
  }
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js

/*

guaranteed order of instantiation:
 1) GalaxySim
 2) for each( gxy.locations )
 2.1) LocationModel
 2.2) for each( loc.factories )
 2.2.1) FactoryModel
 2.3) for each( loc.stations )
 2.3.1) StationModel
 2.4) for each( loc.vessels )
 2.4.1) VesselModel
 		- register in gxy._allVessels
 3) for each( gxy.corporations )
 3.1) CorpModel
 3.2) for each( crp.agent )
 3.2.1) AgentModel
 		- register in gxy._allAgents
 		- attach to vessel

*/

var GalaxySim = Class.create({
  initialize : function() {
    this.locations = {};
		this.corporations = {};

		this.lastSaveTime = 0;
		this.autoSavePeriod = 3;

    this._allVessels = {};
		this._allAgents = {};

		this.gameTime = 0; //Secs

		Service.add("galaxy", this);
  },
	initializeWithJson: function( json ) {
		console.log("GalaxySim load from json")

		var blockThis = this;

		var locations = json["locations"];
		if(locations) {
		jQuery.each(locations, function(key,value){
			var location = new LocationModel();
			location.initializeWithJson(value);
			blockThis.addLocation(location);
		});
		}

		var corporations = json["corporations"];
		if(corporations) {
			jQuery.each(corporations, function(key,value){
				var corporation = new CorporationModel();
				corporation.initializeWithJson(value);
				blockThis.addCorporation(corporation);
			});
		}
	},
	toJson: function() {

		var locations = {}
		jQuery.each(this.locations, function(key,value){
			locations[ value.id ] = value.toJson();
		});

		var corporations = {};
		jQuery.each(this.corporations, function(key,value){
			corporations[ value.id ] = value.toJson();
		});

		var json = { gameTime:this.gameTime, locations:locations,
								corporations:corporations };
		return json;
	},

  addLocation: function( location ) {
    if( location.id == "" ) {
      console.log("invalid location id");
      return;
    }
    this.locations[ location.id ] = location;
  },
  getLocation: function( locationId ) {
    return this.locations[ locationId ];
  },

  addVessel: function( vessel ) {
    if( vessel.id == "" ) {
      console.log("invalid vessel id");
      return;
    }
    this._allVessels[ vessel.id ] = vessel;
  },
  getVessel: function( vesselId ) {
    return this._allVessels[ vesselId ];
  },

  addCorporation: function( corporation ) {
    if( corporation.id == "" ) {
      console.log("invalid corporation id");
      return;
    }
    this.corporations[ corporation.id ] = corporation;
  },
  getCorporation: function( corporationId ) {
    return this.corporations[ corporationId ];
  },

  addAgent: function( agent ) {
    if( agent.id == "" ) {
      console.log("invalid agent id");
      return;
    }
    this._allAgents[ agent.id ] = agent;
  },
	getAgent: function( agentId ) {
		return this._allAgents[ agentId ];
	},

  //simulation functions
  update : function( stepDt ) {

		this.gameTime += stepDt;

		var blockThis = this;
    //update locations
    jQuery.each(this.locations, function(key, value){
      value.update( blockThis.gameTime, stepDt );
    });

		//update corporations
    jQuery.each(this.corporations, function(key, value){
      value.update( blockThis.gameTime, stepDt );
    });

		//check autoSavePeriod
		if( this.gameTime > this.lastSaveTime + this.autoSavePeriod ) {
			EventBus.game.dispatch({evtName:"requestSaveGame"});
			this.lastSaveTime = this.gameTime;
		}
  },

  // vesselId, locationId, factoryId, commodityId, quantity, pricePerUnit, sellingAgentModel
  actionSellFromVesselToFactory: function( vid, lid, fid, cid, qty, ppu, sellAgent )
  {
    var vessel = this._allVessels[vid];
    var location = this.locations[lid];
    var factory = location.getFactory(fid);

		//console.log( " ptot = " + qty + " * " + ppu)
    var purchaseTotal = qty * ppu;
    var result = factory.sellCommodityUnitsToFactory( cid, qty );
    if( result.qty > 0 ) {
      //gain price, remove cargo
      vessel.removeCargo(cid, qty);
			sellAgent.incCredits(result.totalPrice );

      if( result.qty != qty ) {
        console.log("WARNING: vessel sold "+result.qty+" to " + factory.name + " was expecting " + qty);
      }
    }
  },

  //vessel 'purchase' from factory
  actionSellToVesselFromFactory: function( vid, lid, fid, cid, qty, ppu, buyAgent )
  {
    var vessel = this._allVessels[vid];
    var location = this.locations[lid];
    var factory = location.getFactory(fid);

    var purchaseTotal = qty * ppu;

    if( purchaseTotal > buyAgent.getNumCredits() ) {
      console.log("WARNING: agent tried to buy more than he could afford " + buyAgent.getNumCredits() );
      return;
    }

    var amtSold = factory.purchaseCommodityUnitsForSale(cid, qty, purchaseTotal);
    if( amtSold > 0 ) {
      //take cost and add cargo
      vessel.addCargo( cid, amtSold, ppu );
			buyAgent.incCredits( -1 * purchaseTotal ); //use negative to subtract
      if( amtSold != qty ) {
        console.log("WARNING: vessel bought "+amtSold+" from " + factory.name + " was expecting " + qty);
      }
    }
  },

	  // vesselId, locationId, StationId, commodityId, quantity, pricePerUnit, sellingAgentModel
  actionSellFromVesselToStation: function( vid, lid, sid, cid, qty, ppu, sellAgent )
  {
    var vessel = this._allVessels[vid];
    var location = this.locations[lid];
    var station = location.getStation(sid);

		console.log( " ptot = " + qty + " * " + ppu)
    var purchaseTotal = qty * ppu;
    var result = station.sellCommodityUnitsToStation( cid, qty );
		console.log("sold " + result.qty);
    if( result.qty > 0 ) {
      //gain price, remove cargo
      vessel.removeCargo(cid, qty);
			sellAgent.incCredits(result.totalPrice );

      if( result.qty != qty ) {
        console.log("WARNING: vessel sold "+result.qty+" to " + station.name + " was expecting " + qty);
      }
    }
  },

  //vessel 'purchase' from factory
  actionSellToVesselFromStation: function( vid, lid, sid, cid, qty, ppu, buyAgent )
  {
    var vessel = this._allVessels[vid];
    var location = this.locations[lid];
    var station = location.getStation(sid);

    var purchaseTotal = qty * ppu;

    if( purchaseTotal > buyAgent.getNumCredits() ) {
      console.log("WARNING: agent tried to buy more than he could afford " + buyAgent.getNumCredits() );
      return;
    }

    var amtSold = station.purchaseCommodityUnitsForSale(cid, qty, purchaseTotal);
    if( amtSold > 0 ) {
      //take cost and add cargo
      vessel.addCargo( cid, amtSold, ppu );
			buyAgent.incCredits( -1 * purchaseTotal ); //use negative to subtract
      if( amtSold != qty ) {
        console.log("WARNING: vessel bought "+amtSold+" from " + station.name + " was expecting " + qty);
      }
    }
  }

});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/StationModel.js

var LocationModel = Class.create(EventBus, {
  initialize: function( $super ) {
    $super("LocationModel"); //initialize EventBus
    this.name = "";
    this.id = "";
    this.factories = {};
    this.stations = {};
    this.vessels = {};
    this.destinations = [];
		this.coords = {x:0, y:0};

  },
	destroy: function(){
		//if we ever add listeners, remove them here
		//todo: for each factory, station, vessel -- destroy
	},
  initializeWithJson: function( json ) {
    this.name = json["name"] || "";
    this.id = json["id"] || uuid.v4();
    this.factories = {};
    this.vessels = {};
    this.destinations = json["destinations"] || [];
		this.coords = json["loc"] || this.coords;

    var blockThis = this;
    if(json["factories"]) {
    jQuery.each(json["factories"], function(key, val){
      var factory = new FactoryModel();
      factory.initializeWithJson( val );
      blockThis.addFactory(factory);
    });
    }

    if( json["stations"] ) {
    jQuery.each(json["stations"], function(key, val){
      var station = new StationModel();
      station.initializeWithJson( val );
      blockThis.addStation(station); //lump in with factories
    });
    }

    if( json["vessels"] ) {
    jQuery.each(json["vessels"], function(key, val){
      var vessel = new VesselModel();
      vessel.initializeWithJson( val );
      blockThis.addVessel(vessel);
    });
    }
  },

	toJson: function() {

		var factories = {}
		jQuery.each(this.factories, function(key,value){
			factories[ value.id ] = value.toJson();
		});
		var stations = {};
		jQuery.each(this.stations, function(key,value){
			stations[ value.id ] = value.toJson();
		});
		var vessels = {};
		jQuery.each(this.vessels, function(key,value){
			vessels[ value.id ] = value.toJson();
		});

		var json = { name:this.name, id:this.id,
								loc:this.coords, factories:factories,
								stations:stations, vessels:vessels,
								destinations:this.destinations
               };
    return json;
	},

  addFactory: function( factory ) {
    this.factories[ factory.id ] = factory;
    factory.setLocation(this);
  },
  removeFactory: function( factory ) {
    delete this.factories[ factory.id ];
    factory.setLocation(null);
  },
  hasFactory: function( factoryId ) {
    if( this.factories[ factoryId ] ) return true;
    return false;
  },
  getFactory: function( factoryId ) {
    return this.factories[ factoryId ];
  },

  addStation: function( station ) {
    this.stations[ station.id ] = station;
    station.setLocation(this);
  },
  removeStation: function( station ) {
    delete this.stations[ station.id ];
    station.setLocation(null);
  },
  hasStation: function( stationId ) {
    if( this.stations[ stationId ] ) return true;
    return false;
  },
  getStation: function( stationId ) {
    return this.stations[ stationId ];
  },

  addVessel: function( vessel ) {
    this.vessels[ vessel.id ] = vessel;
    vessel.setLocation(this);
    //make sure vessel gets registered at the GalaxySim level
    Service.get("galaxy").addVessel(vessel);

    //alert listeners of changes
		this.dispatch({evtName:"vesselAdded", from:this, vessel:vessel });
  },
  removeVessel: function( vessel ) {
    delete this.vessels[ vessel.id ];
    vessel.setLocation(null);

		//alert listeners of changes
    this.dispatch({evtName:"vesselRemoved", from:this, vessel:vessel });
  },

  //returns dict of { factId:{ cid:{ cid, pricePerUnit, qty } } }
  queryFactoryInputs: function( filterCids, filterFactoryTypeIds ) {
    var result = {};
    jQuery.each( this.factories, function(key, factory){
      if( filterFactoryTypeIds && jQuery.inArray(factory.type.id, filterFactoryTypeIds) == -1 ) return true; //continue;
      jQuery.each( factory.inputStorage, function(key, input){
        if( filterCids && jQuery.inArray(input.cid, filterCids) == -1 ) return true; //continue;
        var availQty = input.maxQty - input.currQty; //get EMPTY space
        if( availQty > 0 ) {
          if(!result[factory.id]) result[factory.id] = {}; //add entry for factory (only if something is avail)

          //add entry for cid, for this factory
          var cmdyType = CommodityType.get(input.cid);
          var pricePerUnit = cmdyType.getValWithCapacityPct( input.currQty / input.maxQty );
          result[factory.id][input.cid] = { qty:availQty, pricePerUnit:pricePerUnit, cid:input.cid };
        }
      });
    });
    return result;
  },

  //returns dict of { factId:{ cid:{ cid, pricePerUnit, qty } } }
  queryFactoryOutputs: function( filterCids, filterFactoryTypeIds ) {
    var result = {};
    jQuery.each( this.factories, function(key, factory){
      if( filterFactoryTypeIds && jQuery.inArray(factory.type.id, filterFactoryTypeIds) == -1 ) return true; //continue;
      jQuery.each( factory.outputStorage, function(key, output){
        if( filterCids && jQuery.inArray(output.cid, filterCids) == -1 ) return true; //continue;
        var availQty = output.currQty; //get USED space
        if( availQty > 0 ) {
          if(!result[factory.id]) result[factory.id] = {}; //add entry for factory (only if something is avail)

          //add entry for cid, for this factory
          var cmdyType = CommodityType.get(output.cid);
          var pricePerUnit = cmdyType.getValWithCapacityPct( output.currQty / output.maxQty );
          result[factory.id][output.cid] = { qty:availQty, pricePerUnit:pricePerUnit, cid:output.cid };
        }
      });
    });
    return result;
  },

  //simulation functions
  update : function( gameTime, stepDt ) {
    jQuery.each(this.factories, function(key, value){
      value.update( gameTime, stepDt );
    });
  }

});

//Object Creation code
LocationModel.create_factory = function( strFactoryType )
{
  return this.load_factory( { type: strFactoryType } );
};

LocationModel.load_factory = function( factoryJson )
{
  var factory = new FactoryModel();
  factory.initializeWithJson(factoryJson);
  return factory;
};
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js

/*
  events sent
  game:"playerDiscoveredLocation": { locationId:locationId }
	game:"playerCorporationUpdated": { }
	game:"activeAgentSelected" : { agent:agent }
*/

var PlayerModel = Class.create(EventBus, {
  initialize: function( $super ) {
		$super();
		this.currentLocation = "";
    this._knownLocations = {};
		this.activeUserAgent = null;

		this._corporation = null;

		EventBus.ui.addListener("activeAgentSelected", this.onActiveAgentSelected.bind(this));

		Service.add("player", this);
	},
	destroy: function() {
		EventBus.ui.removeListener("activeAgentSelected", this.onActiveAgentSelected.bind(this));
	},
	toJson: function() {
		var knownLocations = [];
		jQuery.each(this._knownLocations, function(key, value){
			knownLocations.push(value);
		});

		var activeUserAgentId = this.activeUserAgent ? this.activeUserAgent.id : "";
		var playerCorporation = this._corporation ? this._corporation.id : "";
    var json = { currentLocation:this.currentLocation,
                 knownLocations:knownLocations,
								 activeAgent:activeUserAgentId,
								 corporation:playerCorporation
							 	};
		return json;
	},
	initializeWithJson: function( json ) {
		if(!json) json = {}; //be extra fault tolerant during THE REMAKING
		this.currentLocation = json["currentLocation"] || "";

		var galaxySim = Service.get("galaxy");
		var blockThis = this;
		if(json["knownLocations"]) {
			jQuery.each(json["knownLocations"], function(key, value){
				blockThis._knownLocations[ value ] = value;
			});
		}else {
			this._knownLocations = {};
		}

		if( json["corporation"] ) {
			var corporationId = json["corporation"];
			this._corporation = galaxySim.getCorporation(corporationId);
		}else {
			this._corporation = null;
		}

		if( json["activeAgent"] ) {
			var activeAgentId = json["activeAgent"];
			var agent = galaxySim.getAgent(activeAgentId);
			this.setActiveUserAgent(agent);
		}else {
			this.activeUserAgent = null;
		}

    this.setCurrentLocation( this.currentLocation ); //enforce known from start location
	},
	setCorporation: function( corpModel ) {
		this._corporation = corpModel;
		EventBus.game.dispatch({evtName:"playerCorporationUpdated"});
	},
	getCorporation: function() {
		return this._corporation;
	},
  setCurrentLocation: function( locationId ) {
    this.currentLocation = locationId;

		if( locationId == "" ) return;

    var discoveredNewLocation = false;
    if(!this.isLocationKnown(locationId)) discoveredNewLocation = true;
    this._setLocationKnown( locationId );

    if(discoveredNewLocation) {
      EventBus.game.dispatch({evtName:"playerDiscoveredLocation", locationId:locationId});
    }
  },
	getCurrentLocation: function() {
		return this.currentLocation;
	},
  _setLocationKnown: function( locationId ) {
    this._knownLocations[locationId] = locationId;
  },
  isLocationKnown: function( locationId ) {
    if( this._knownLocations[locationId]) return true;
    return false;
  },
	setActiveUserAgent: function( userAgent ) {
		if(this.activeUserAgent) {
			this.activeUserAgent.setGenericAI();
			this.activeUserAgent = null;
		}

		this.activeUserAgent = userAgent;
		if(!userAgent) return;

		this.activeUserAgent.setIdleAI();
		console.log("active agent selected - " +this.activeUserAgent.name);

		EventBus.game.dispatch({evtName:"activeAgentSelected", agent:userAgent});
	},

	//event handlers
	onActiveAgentSelected: function(evt){
		var activeAgentId = evt.agentId
		var agent = this._corporation.getAgent(activeAgentId);
		this.setActiveUserAgent(agent);
	}
});
;
var genesis = function( template )
{
	var result = {galaxy:{locations:{}}, player:{currentLocation:""}};
	var clusterWeb = new web();
	jQuery.each(template.clusters, function(i, cluster){
		var barycenter = new Vec2D();
		barycenter.initializeWithPos(cluster.pos);
		var type = clusterTypes[cluster.type];

		if(!type) {
			console.log("GENESIS: error instanciating cluster type " + cluster.type);
		}

		var systemWeb = new web();
		jQuery.each(type.systems, function(idx, system){
			var systemType = systemTypes[system.type];
			if(!systemType) {
				console.log("GENESIS: error instanciating system type " + system.type);
				return true; //continue
			}

			var uniPos = barycenter.getVecAdd(system.pos);

			var name = system.name;
			if(name == "random") {
				name = randLocationNames[getRand(0, randLocationNames.length-1)];
			}

			var location = new LocationModel();
			location.initializeWithJson({name:name, loc:uniPos});
			console.log("GENESIS: create location " + name);

			if( idx == 0 ) {
				clusterWeb.add(location);
			}

			systemWeb.add(location);

			if( !result.player.currentLocation ) {
				console.log("GENESIS: set starting location " + name);
				result.player.currentLocation = location.id;
			}

			if( systemType.factories ) {
				jQuery.each(systemType.factories, function(idx, factType){
					console.log("GENESIS:    create factory " + factType);
					var factory = new FactoryModel();
					factory.initializeWithJson({type:factType});
					location.addFactory(factory);
				});
			}
			if( systemType.stations ) {
				jQuery.each(systemType.stations, function(idx, statType){
					console.log("GENESIS:    create station " + statType);
					var station = new StationModel();
					station.initializeWithJson({type:statType});
					location.addStation(station);
				});
			}

			result.galaxy.locations[ location.id ] = location.toJson();

			location.destroy();
		});
		systemWeb.execute();


	});
	clusterWeb.execute();

	return result;

}

//connects destinations together to first element
var web = function() {
	this.list = [];
	this.add = function( location ) {
		this.list.push(location);
	}
	this.execute = function() {
		for(var i=1; i<this.list.length; i++){
			this.list[0].destinations.push( this.list[i].id );
			this.list[i].destinations.push( this.list[0].id );
		}
		this.list = []; //clear list
	}
}

//random world generation
var random_template = {"clusters":[
	{"name":"Milky Way", "type":"type1", pos:{"x":1000, "y":1000}},
	{"name":"Next Door", "type":"type2", pos:{"x":-1000, "y":-1000}},
	{"name":"UniCenter", "type":"type3", pos:{"x":0, "y":0}}
]};


var clusterTypes = {
	"type1":{
		"systems":[{name:"SolSystem", pos:{"x":0, "y":0}, type:"epicenter"},
							 {name:"Alpha Centauri", pos:{"x":150, "y":150}, type:"tradeHub1"},
							 {name:"random", pos:{"x":-150, "y":-200}, type:"ranch"},
							 {name:"random", pos:{"x":-50, "y":200}, type:"solarFact"},
							 {name:"random", pos:{"x":-250, "y":150}, type:"tradeHub2"}
							]
	},
	"type2":{
		"systems":[{name:"Barus 5", pos:{"x":0, "y":0}, type:"epicenter"},
							 {name:"random", pos:{"x":-150, "y":150}, type:"tradeHub1"},
							 {name:"random", pos:{"x":150, "y":-200}, type:"ranch"}
							]
	},
	"type3":{
		"systems":[{name:"Gemini Alpha", pos:{"x":-50, "y":50}, type:"solarFact"},
							 {name:"Gemini Beta", pos:{"x":50, "y":-50}, type:"tradeHub1"},
							 {name:"random", pos:{"x":150, "y":-200}, type:"empty"}
							]
	}
};

var systemTypes = {
	"empty":{},
	"solarFact":{
		"factories":["ftEcell_solar1"]
	},
	"ranch":{
		"factories":["ftEcell_solar1", "ftBioT1_farm1", "ftBioT2_ranch1"]
	},
	"tradeHub1":{
		"factories":["ftOreT1_forge1"],
		"stations":["stCGoods"]
	},
	"tradeHub2":{
		"factories":["ftOreT2_forge1"],
		"stations":["stT2Goods"]
	},
	"epicenter":{
		"factories":["ftEcell_solar1", "ftCosmetics"],
		"stations":["stCGoods", "stT2Goods"]
	}
};

//random names
var randCorpNames = [
	"Energent",
	"Synergen",
	"MaxiLift",
	"Oreacle",
	"Sol Systems",
	"iCorp",
	"Rudolfino",
	"GZCor",
	"ChemiCorp",
	"Plaztipal"
];

var randShipNames = [
	"HMS Lollipop",
	"SS Skipper",
	"USN Manhattan",
	"Excalibur",
	"Nautilus",
	"Nectarine",
	"Red Dwarf",
	"Victory",
	"Viceroy"
];

var randAgentNames = [
	"Peppermint Larry",
	"Candy Wife",
	"Agent 001",
	"Agent 002",
	"Agent 003",
	"Agent 004",
	"Agent 005",
	"Agent 006",
	"Agent 007",
	"Agent 008",
	"Agent 009",
	"Agent 010",
	"Provocatuer"
];

var randLocationNames = [
	"Vesuvius",
	"Alpha Centauri",
	"Sirius Binar",
	"Messier 81",
	"NGC 4826",
	"Canis Major",
	"Canis Minor",
	"Andromeda",
	"Dorado",
	"Mensa",
	"Azophi",
	"Hive of Scum and Villany",
	"A Phone Booth",
	"Restaurant at the End"
];
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js

var StationType = Class.create({
  initialize: function() {
    this.name = "";
    this.id = "invalid_id";
    this.commodities = {};  //{ "cid" : <str commodityTypeId>, "qty":<int quantity>, "maxQty":<int max> }
  },
  g_types: {},
  initializeWithJson: function( json ) {
    this.name = json["name"] || "";
    this.id = json["id"] || "invalid_idj";
		this.commodities = json["commodities"] || {};
    StationType.prototype.g_types[ this.id ] = this;
  },
  get: function( strTypeId )
  {
    return g_types[strTypeId];
  }
});

//class methods for getting types
StationType.get = function( strTypeId )
{
  return StationType.prototype.g_types[ strTypeId ];
}

StationType.loadTypesWithJson = function( json )
{
  jQuery.each(json, function(key, value){
    var stationType = new StationType();
    stationType.initializeWithJson( value );
  });
}

var StationModel = Class.create(EventBus, {
  initialize: function( $super ) {
    $super("StationModel"); //initialize EventBus
    this.type = null;
    this.name = "";
    this.id = "";
		this.owner = null;
		this.location = "";
		this._lastConsumeTime = 0;
		this._consumePeriod = 5500;
    this.commodities = {}; //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
  },
  initializeWithJson: function( json ) {
    this.initialize();

    var stationTypeId = json["type"] || "invalid_idj";
    var stationType = StationType.get( stationTypeId );

    this.type = stationType;
    this.name = json["name"] || stationType.name;
    this.id = json["id"] || uuid.v4();
    this.commodities = json["commodities"] || {};
		this._consumePeriod = json["consumePeriod"] || this._consumePeriod;


		if( json["owner"] ) {
      this.owner = Service.get("galaxy").getAgent( json["owner"] );
    }
    else {
      this.owner = null;
    }

    //cant set location directly here-- need to search galaxy for it
    if( json["location"] ) {
      this.location = Service.get("galaxy").getLocation( json["location"] );
    }
    else {
      this.location = null;
    }

    //load empty storage descriptors from type
    if( jQuery.isEmptyObject(this.commodities) && this.type && !jQuery.isEmptyObject(this.type.commodities) )
    {
      var blockThis = this;
      jQuery.each( this.type.commodities, function( key, value ) {
        blockThis.commodities[key] = { cid:value.cid, currQty:0, maxQty:value.maxQty };
      });
    }
	},
  toJson: function() {
		var ownerId = this.owner ? this.owner.id : "";
    var json = { type:this.type.id, name:this.name, id:this.id, consumePeriod:this._consumePeriod,
                commodities:this.commodities, owner:ownerId };
    return json;
  },
	_getPricePerUnit: function( cid ) {
		var cmdyType = CommodityType.get(cid);
		var pricePerUnit = cmdyType.getAvgTradeValue();
		return pricePerUnit;
	},
	getCommodityUnitsAvailable: function( cid ) {
		var offer = {qtyAvailable:0, pricePerUnit:0, maxQty:0};
		if( this.commodities[ cid ] ) {
      var value = this.commodities[cid];
			var pricePerUnit = this._getPricePerUnit(cid);

      offer.qtyAvailable = value.currQty;
      offer.pricePerUnit = pricePerUnit;
			offer.maxQty = value.maxQty;
		}
		return offer;
	},
  //returns amt sold (assumes full amtPaid is paid)
  purchaseCommodityUnitsForSale: function( cid, maxQty, amtPaid ) {
		if( ! this.commodities[cid] || this.commodities[cid].qty == 0 ) return 0;
		var value = this.commodities[cid];

		var amtSold = 0;
		var pricePerUnit = this._getPricePerUnit(cid);
		var canAffordUnits = Math.floor( amtPaid / pricePerUnit ); //force int

		//buy the minimum between the maxQty requested, the max affordable, and the qty available
    var amtToBuy = Math.min(maxQty, canAffordUnits, value.currQty);
    amtSold = amtToBuy;

		this.commodities[cid].currQty -= amtSold;

		//debug code: //TODO: remove this when everything is cool
		var correctPrice = amtSold * pricePerUnit;

		//console.log("sold "+cid+" qty "+amtSold+" tot: "+correctPrice);
		if( correctPrice != amtPaid )
		{
			console.log("inaccurate price - paid: "+amtPaid);
		}

    if(amtSold > 0) {
      this.dispatch({evtName:"updateStorage", from:this, cid:cid });
    }

		return amtSold;
	},
	//returns purchased object: { qty:int, totalPrice:float }
  sellCommodityUnitsToStation: function( cid, amt ) {
    var offer = { qty:0, totalPrice:0 };

		if( !this.commodities[cid] ) return offer; //we dont deal with that cid
		var value = this.commodities[cid];

		var spaceAvailable = value.maxQty - value.currQty;
		var amtToBuy = Math.min( spaceAvailable, amt );
		var pricePerUnit = this._getPricePerUnit(cid);

		//console.log(" seller intended amt " + amt)
		//console.log(" stat space avail " + spaceAvailable)
		//console.log(" stat bought " + amtToBuy + " units ")

		offer.qty = amtToBuy;
		offer.totalPrice = amtToBuy * pricePerUnit;

		this.commodities[cid].currQty += amtToBuy;

		if( value.currQty != ~~(value.currQty) ) {
			console.log("WARNING: qty corrupt, inc'd by " + amtToBuy)
		}

    if( offer.qty > 0 ) {
      this.dispatch({evtName:"updateStorage", from:this, cid:cid });
    }

    return offer;
	},
  setLocation: function( location ) {
    if( this.location ) { //if defined and not null
      var oldLocation = this.location;
      this.location = null;
      oldLocation.removeStation(this);
    }
    this.location = location;
  },
  update: function( currTime, dt ) {
    if( currTime > this._lastConsumeTime + this._consumePeriod ) {
			this._lastConsumeTime = currTime;

			//xxx perform random consumption of commodities
		}
  }
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//requires Service.get("galaxy") to have a GalaxySim object present (for location attachment)

var VesselType = Class.create({
  initialize: function(){
    this.name = "";
    this.id = "";
    this.speed = 1;
    this.cargoVol = 100;
  },
  g_types: {},
  initializeWithJson: function(json) {
    this.name = json["name"]  || "";
    this.id = json["id"]  || "undefined_idj";
    this.speed = json["speed"] || 1;
    this.cargoVol = json["cargoVol"] || 0;

    VesselType.prototype.g_types[ this.id ] = this;
  }
});

//class methods for getting types
VesselType.get = function( strTypeId )
{
  return VesselType.prototype.g_types[ strTypeId ];
}

VesselType.loadTypesWithJson = function( json )
{
  jQuery.each(json, function(key, value){
    var vesselType = new VesselType();
    vesselType.initializeWithJson( value );
  });
}

var VesselModel = Class.create(EventBus, {
  initialize: function( $super ){
    $super("VesselModel"); //initialize EventBus
    this.type = null;
    this.name = "";
		this._owner = null;
    this.speed = 1;
    this.maxQty = 1;
    this._currQty = 0;
    this._cargo = {};  //dict of CommodityModel
    this.location = null;
  },
  initializeWithJson: function( json ) {
    this.initialize();

    var vesselTypeId = json["type"] || "invalid_idj";
    var vesselType = VesselType.get( vesselTypeId );

    this.type = vesselType;
    this.name = json["name"] || vesselType.name;
    this.id = json["id"] || uuid.v4();
    this.speed = json["speed"] || vesselType.speed;
    this.maxQty = json["maxQty"] || vesselType.cargoVol;
    this._currQty = json["currQty"] || 0;

		//xxx this._cargo = json["cargo"] || {}; //{ cid:"cmdyId", qty:int }
		if(json["cargo"]) {
			var blockThis = this;
			jQuery.each(json["cargo"], function(key, value){
				var cmdyModel = new CommodityModel();
				cmdyModel.initializeWithJson(value);
				blockThis._cargo[ cmdyModel.type.id ] = cmdyModel;
			});
		}else {
			this._cargo = {};
		}

		// NOTE: its up to owners to claim vessels, because vessels are deserialized before agents
		//this._owner
		// NOTE: locations spawn vessels in deserialization and will handle attaching
		//this.location
  },
	toJson: function() {
		var blockThis = this;
		var cargo = {};
		jQuery.each(this._cargo, function(key, value){
			cargo[ value.type.id ] = value.toJson();
		});

		var ownerId = this._owner ? this._owner.id : "";
    var json = { type:this.type.id, name:this.name, id:this.id, owner:ownerId,
								speed:this.speed, maxQty:this.maxQty, currQty:this._currQty,
								cargo:cargo
               };
    return json;
	},

  setLocation: function( location ) {
    if( this.location ) { //if defined and not null
      var oldLocation = this.location;
      this.location = null;
      oldLocation.removeVessel(this);
    }
    this.location = location;
  },
  getCurrentVolume: function() {
    return this._currQty;
  },
	getAvailableVolume: function() {
		return (this.maxQty - this._currQty);
	},
  getCargoQty: function( cid ) {
    if( !this._cargo[cid] ) {
      return 0;
    }
    return this._cargo[cid].currQty;
  },
	getCargoPurchasedVal: function( cid ) {
    if( !this._cargo[cid] ) {
      return 0;
    }
    return this._cargo[cid].getPurchasedVal();
	},
  getCargo: function() {
    return this._cargo;
  },

	setOwner: function( agent ) {
		this._owner = agent;
		this.dispatch({evtName:"updateVessel", from:this });
	},
	getOwner: function() {
		return this._owner;
	},

  //this will fill holds with QTY up to max, returning amt actually stored
  // tracks price per unit
  addCargo: function( cid, qty, ppu ) {

    var spaceAvailable = this.maxQty - this._currQty;
    if( spaceAvailable == 0 ) return 0;

    //ensure entry for cargo type
    if( !this._cargo[cid] ) {
			var cmdyModel = new CommodityModel();
			cmdyModel.initializeWithJson({type:cid, maxQty:this.maxQty});
      this._cargo[cid] = cmdyModel;
    }

    var amt = Math.min( qty, spaceAvailable );

		this._cargo[cid].incQtyWithPrice(amt, ppu);
    this._currQty += amt;

    this.dispatch({evtName:"updateVessel", from:this });

    return amt;
  },

  //this will remove the QTY up to the amt available in holds, returning amt actually removed
  removeCargo: function( cid, qty ) {
    if( !this._cargo[cid] ) {
      return 0;
    }

    var amt = Math.min( qty, this._cargo[cid].currQty );
    this._cargo[cid].incQtyWithPrice( -1*amt, 0);
    this._currQty -= amt;

		if( this._cargo[cid].currQty < 1 ) {
			delete this._cargo[cid];
		}

    this.dispatch({evtName:"updateVessel", from:this });

    return amt;
  }
});

;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/CommodityModel.js

var CommodityView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box", width:"400px"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this._name = "";
    this._qty = 0;
    this._price = 0;
    this.showPrice = true;
		this.purchasePrice = false;
		this.tradePrice = false;

    this.pbCapacity = jQuery("<div>").progressbar();
    this.pbCapacity.css("height", 10);
    this.div.append(this.pbCapacity);
  },
  setName: function( strName ) {
    this._name = strName;
    this._updateLabel();
  },
  setPrice: function( price ) {
    this._price = price;
    this._updateLabel();
  },
	setSellCursor: function() {
		this.div.css({"cursor":"url(css/images/bank.png) 15 20,default"});
	},
	setBuyCursor: function() {
		this.div.css({"cursor":"url(css/images/symbol_dollar.png) 15 20,default"});
	},
	setTradeCursor: function() {
		this.div.css({"cursor":"url(css/images/gavel.png) 15 20,default"});
	},
  setQty: function( minQty, maxQty, currQty ) {
    var range = maxQty - minQty;
    var pct = ( currQty - minQty ) / range;
    this.setQtyPct( pct * 100 ); //update progressbar

    this._qty = currQty;
    this._updateLabel();
  },
  setQtyPct: function( qtyPct ) {
    Math.max(100, Math.min(qtyPct, 0)); //clamp to range [0, 100]
    this.pbCapacity.progressbar( "value",  qtyPct ); //update progressbar value
  },
  _updateFromModel: function( cmdyModel ) {
    this._name = cmdyModel.name;
		if( this.purchasePrice ) {
			this._price = cmdyModel.getPurchasedVal();
		}else if( this.tradePrice ) {
			this._price = cmdyModel.type.getAvgTradeValue();
		} else {
			this._price = cmdyModel.getValue();
		}

    this.setQty(0, cmdyModel.maxQty, cmdyModel.currQty);
    this.div.prop('title', cmdyModel.id);
  },
  _updateLabel: function() {
    //TODO: format price number
    if(this.showPrice) {
      this.lblName.text( this._name + " - " + this._qty + " units @ $" + this._price );
    }
    else {
      this.lblName.text( this._name + " - " + this._qty + " units" );
    }

  }
})
;//0) ftue progress
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
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js

//NOTE: expects Service.get("galaxy").gameTime to represent the current game time (in same format sent to update)

var FactoryView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this.pbProcessing = jQuery("<div>").progressbar();
    this.pbProcessing.css("height", 20);
    this.pbProcessing.css("marginBottom", 5);
    this.div.append(this.pbProcessing);

    //inputs
    this.divInputs = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divInputs.css("border-color", "#BBBBCC");
    this.div.append(this.divInputs);
    this.inputViews = {}; //todo //xxx - use these to recycle views

    //outputs
    this.divOutputs = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divOutputs.css("border-color", "#BBBBCC");
    this.div.append(this.divOutputs);
    this.outputViews = {}; //todo //xxx - use these to recycle views
  },
  destroy: function( $super ) {
    $super();
    jQuery.each(this.inputViews, function(key, value){
      value.destroy();
    });
    jQuery.each(this.outputViews, function(key, value){
      value.destroy();
    });
  },
  setName: function( strName ) {
    this.lblName.text( strName );
  },
  _updateFromModel: function( fModel ) {
    this.setName( fModel.name );
    this.div.prop('title', fModel.id);

    this.pbProcessing.progressbar( "value", fModel.getProcessingPct( Service.get("galaxy").gameTime ) * 100 );

    var blockThis = this;

    //TODO: update input/output divs instead of recreating them!!!
    //fill input storage views
    blockThis.divInputs.empty();
		blockThis.divInputs.append(jQueryIcon("ui-icon-arrowthickstop-1-s")).append("Inputs");
    jQuery.each(fModel.inputStorage, function( key, value )
    {
      //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
      var cmm1 = new CommodityModel();
      cmm1.initializeWithJson( {type: value.cid } );
      cmm1.currQty = value.currQty;
      cmm1.maxQty = value.maxQty;

      var cmv1 = new CommodityView();
      cmv1.updateFromModel(cmm1);
			cmv1.setSellCursor();
			cmv1.setPrice( fModel._getPricePerUnit( value.cid, value.currQty, value.maxQty, true) ); //potentially show incentive value
      cmv1.getDiv().width(160);

      blockThis.divInputs.append(cmv1.getDiv());

      cmv1.getDiv().click( function(e){
        //console.log(" clicked input " + fModel.name + " " + value.cid );
        EventBus.ui.dispatch({evtName:"factInputClicked", cid:value.cid, factId:fModel.id});
      });

    });

    //fill output storage views
    blockThis.divOutputs.empty();
    //blockThis.divOutputs.append(jQuery("<p>Outputs</p>")).addClass("tg-name");
		blockThis.divOutputs.append(jQueryIcon("ui-icon-extlink")).append("Outputs");
    jQuery.each(fModel.outputStorage, function( key, value )
    {
      //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
      var cmm1 = new CommodityModel();
      cmm1.initializeWithJson( {type: value.cid } );
      cmm1.currQty = value.currQty;
      cmm1.maxQty = value.maxQty;

      var cmv1 = new CommodityView();
      cmv1.updateFromModel(cmm1);
			cmv1.setBuyCursor();
			cmv1.setPrice( fModel._getPricePerUnit( value.cid, value.currQty, value.maxQty, false) ); //potentially show incentive value
      cmv1.getDiv().width(160);

      blockThis.divOutputs.append(cmv1.getDiv());

      cmv1.getDiv().click( function(e){
        //console.log(" clicked output " + fModel.name + " " + value.cid );
        EventBus.ui.dispatch({evtName:"factOutputClicked", cid:value.cid, factId:fModel.id });
      });
    });
  },
	_detachTarget: function( target ) {
		  target.removeListener("updateStorage", this.onTargetUpdate.bind(this) );
      target.removeListener("updateProcess", this.onTargetProcess.bind(this) );
	},
	_attachTarget: function( target ) {
		  target.addListener("updateStorage", this.onTargetUpdate.bind(this) );
      target.addListener("updateProcess", this.onTargetProcess.bind(this) );
	},
  onTargetUpdate: function( evt ) {
    this.updateFromModel( this.updateTarget, false ); //TODO: dont reload entire view
  },
  onTargetProcess: function( evt ) {
    //just update the progress bar
    this.pbProcessing.progressbar( "value", this.updateTarget.getProcessingPct( Service.get("galaxy").gameTime ) * 100 );
  }

});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/BaseView.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js
//#include js/model/StationModel.js

var makeAccordionContent = function( accordionId, strTitle ) {
  var h3 = jQuery("<h>"+strTitle+"</h>");
  var cDiv = jQuery("<div id='"+accordionId+"_content'></div>");
  var accDiv = jQuery("<div id='"+accordionId+"'></div>").append(h3).append(cDiv);
  jQuery(accDiv).accordion({
    collapsible: true,
    heightStyle: "content"
  });

  return accDiv;
}

var LocationView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box", width:"720px", height:"720px"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this.accFactories = makeAccordionContent( "accFacts", "Factories & Stations" );
    this.accFactoriesContent = this.accFactories.find("#accFacts_content");
    this.div.append(this.accFactories);

    this.accDestinations = makeAccordionContent( "accDests", "Star Gates" );
    this.accDestinationsContent = this.accDestinations.find("#accDests_content");
    this.div.append(this.accDestinations);

    this.accVessels = makeAccordionContent( "accVessels", "Vessels" );
    this.accVesselsContent = this.accVessels.find("#accVessels_content");
    this.div.append(this.accVessels);

    this.factoryViews = [];
    this.vesselViews = [];
  },
  destroy: function($super) {
		$super();

    //destroy child views
    jQuery.each(this.factoryViews, function(key,value){
      value.destroy();
    });
    jQuery.each(this.vesselViews, function(key,value){
      value.destroy();
    });
  },
  _updateFromModel: function( locModel ) {
    this.lblName.text( locModel.name );

    var blockThis = this;
		blockThis.accFactoriesContent.empty();
    jQuery.each(locModel.factories, function(key,value){
      var fcv1 = new FactoryView();
      fcv1.updateFromModel(value, true);

      blockThis.accFactoriesContent.append(fcv1.getDiv());
      blockThis.factoryViews.push(fcv1);
    });

    // add stations to factories tab
    jQuery.each(locModel.stations, function(key,value){
      var fcv1 = new StationView();
      fcv1.updateFromModel(value, true);

      blockThis.accFactoriesContent.append(fcv1.getDiv());
      blockThis.factoryViews.push(fcv1);
    });

		blockThis.accDestinationsContent.empty();
    jQuery.each(locModel.destinations, function(key,value) {
			var destModel = Service.get("galaxy").getLocation( value );
			var icon = jQueryIcon( "ui-icon-seek-next" );
      var sg = jQuery("<a>").append(icon).append( destModel.name );
			//sg.append(icon);
      blockThis.accDestinationsContent.append( sg );
      blockThis.accDestinationsContent.append("<br>");

      //clicking the destination will send an event to the bus
      sg.click(function(evt){
        evt.preventDefault();
        EventBus.game.dispatch({evtName:"destination", value:value});
      });
    });

		blockThis.accVesselsContent.empty();
    jQuery.each(locModel.vessels, function(key,value){
      var vv1 = new VesselView();
      vv1.updateFromModel(value, true);

      blockThis.accVesselsContent.append(vv1.getDiv());
      blockThis.vesselViews.push(vv1);
    });
  },
	_detachTarget: function( locModel ) {
		locModel.removeListener("vesselAdded", this.onVesselAdded.bind(this) );
		locModel.removeListener("vesselRemoved", this.onVesselRemoved.bind(this) );
	},
	_attachTarget: function( locModel ) {
    locModel.addListener("vesselAdded", this.onVesselAdded.bind(this) );
		locModel.addListener("vesselRemoved", this.onVesselRemoved.bind(this) );
	},
	onVesselAdded: function( evt ) {
		var vesselModel = evt.vessel;
		var blockThis = this;

		//create new vessel view and add to dom
		var vv1 = new VesselView();
		vv1.updateFromModel(vesselModel, true);

		blockThis.accVesselsContent.append(vv1.getDiv());
		blockThis.vesselViews.push(vv1);
	},
  onVesselRemoved: function( evt ) {
		var vesselModel = evt.vessel;
		var blockThis = this;
		jQuery.each(this.vesselViews, function(idx, value){
			if( value.updateTarget == vesselModel ) {
				//destroy and remove target vesselView
				value.destroy();
				jQuery(value.getDiv()).remove();
				blockThis.vesselViews.splice(idx, 1);
				return false; //break;
			}
		});
  }
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/BaseView.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js
//#include js/model/StationModel.js

var MapNode = Class.create(BaseView, {
	initialize: function($super) {
		$super();
		this.origX = 0;
		this.origY = 0;
		this.w = 100;
		this.h = 100;
		this.w_h = this.w/2;
		this.h_h = this.h/2;
		this.isHighlighted = false;
		this.div = jQuery("<div>", {"class":"tg-box tg-map-node", width:this.w, height:this.h});
		this.div.css("z-index",10);
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

		this.lblName.text("location");

		this.divIcons = jQuery("<div>");
		this.div.append(this.divIcons);

		var blockThis = this;
		this.div.click( function(evt){
			evt.stopPropagation();
			EventBus.ui.dispatch({evtName:"mapNodeClicked", node:blockThis});
		});

		this.div.bind('contextmenu', function(e) {
    	e.preventDefault();

			//send intent to move -- this will fail (gracefully) if not adjacent
			var locId = blockThis.updateTarget.id;
			EventBus.game.dispatch({evtName:"destination", value:locId});

		});

		EventBus.ui.addListener("MapNodeHighlight", this.onSiblingHighlighted.bind(this));
	},
	destroy: function($super) {
		$super();
		EventBus.ui.removeListener("MapNodeHighlight", this.onSiblingHighlighted.bind(this));
	},
	_updateFromModel: function( locModel ) {
		//console.log("map node for " + locModel.name);
		this.origX = locModel.coords.x;
		this.origY = locModel.coords.y;
		this.lblName.text( locModel.name );

		this._refreshIcons();
	},
	_refreshIcons: function() {
		this.divIcons.empty();
		if( dicLength(this.updateTarget.factories) > 0 ) {
			this.divIcons.append(jQueryIcon("ui-icon-arrowthickstop-1-s"));
		}
		if( dicLength(this.updateTarget.stations) > 0 ) {
			this.divIcons.append(jQueryIcon("ui-icon-transfer-e-w"));
		}
		if( dicLength(this.updateTarget.vessels) > 0 ) {
			this.divIcons.append(jQueryIcon("ui-icon-circlesmall-close"));
		}
	},
	_detachTarget: function( target ) {
		target.removeListener("vesselRemoved", this.onVesselsChanged.bind(this) );
		target.removeListener("vesselAdded", this.onVesselsChanged.bind(this) );
	},
	_attachTarget: function( target ) {
		//nothing
		target.addListener("vesselRemoved", this.onVesselsChanged.bind(this) );
		target.addListener("vesselAdded", this.onVesselsChanged.bind(this) );
	},
	setHighlighted: function( highlight ) {
		if( highlight ) {
			this.div.addClass("tg-border-hi-green");
			this.isHighlighted = true;
			EventBus.ui.dispatch({evtName:"MapNodeHighlight", node:this});
		}else {
			this.div.removeClass("tg-border-hi-green");
			this.isHighlighted = false;
		}
	},
	setScale: function( scale, animate ) {
		if( animate ) {
			TweenLite.to( this.div, 1, { scale:scale  });
		}else {
			this.div.css({'-webkit-transform': 'scale(' + scale + ')'});

		}
	},
	setPos: function( x, y, animate ) {
		if( animate ) {
			var unitsPerSecond = 2;
			var pos = this.getPos();
			var dx = pos.x - x;
			var dy = pos.y - y;
			var dist = (dx*dx + dy*dy)/2;
			TweenLite.to(this.div, 1, { left:x, top:y });
		}else {
			this.div.css({top:y, left:x});
		}
	},
	getPos: function() {
		var jqp = this.div.position();
		var pos = { x:jqp.left, y:jqp.top };
		return pos;
	},

	//Event handlers
	onSiblingHighlighted: function(evt){
		if( evt.node == this ) return;
		if(this.isHighlighted) {
			//turn off all other highlights
			this.setHighlighted(false);
		}
	},

	onVesselsChanged: function(evt){
		this._refreshIcons();
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/BaseView.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js
//#include js/model/StationModel.js

var svgLineBetweenPts = function( x1, y1, x2, y2, r,g,b )
{
	var w = Math.abs( x1 - x2 );
	var h = Math.abs( y1 - y2 );

	//always left to right
	if( x2 > x1 ) {
		//swap points
		var tx = x1;
		x1 = x2;
		x2 = tx;
		var ty = y1;
		y1 = y2;
		y2 = ty;
	}

	var oy1 = 0; //topleft origin default
	var oy2 = h;

	//should origin be top left or bottom left?
	if( y1 > y2 ) {
		//origin is bottom-left
		oy1 = h;
		oy2 = 0;
	}

	var div = jQuery("<svg width='"+w+"' height='"+h+"'><line x1='0' y1='"+oy1+"' x2='"+w+"' y2='"+oy2+"' style='stroke:rgb("+r+","+g+","+b+");stroke-width:2' /></svg>").addClass("tg-map-node");

	//add utility function to know where to place this in absolute pixels
	div.getWorldPosition = function() {
		return { x: x1, y: y1 + oy1 };
	}

	div.setPos = function( x, y ) {
		this.css({top:y+"px", left:x+"px"});
	}

	return div;
}

var DotNode = Class.create(BaseView, {
	initialize: function( worldX, worldY ) {
		this.div = jQueryIcon("ui-icon-radio-off").addClass("tg-map-node").css({top:100, left:100, "z-index":2 });
		this.origX = worldX;
		this.origY = worldY;
		this.w = 10;
		this.h = 10;
		this.w_h = this.w/2;
		this.h_h = this.h/2;
	},
	setScale: function( scale, animate ) {
		if( animate ) {
			TweenLite.to( this.div, 1, { scale:scale  });
		}else {
			this.div.css({'-webkit-transform': 'scale(' + scale + ')'});

		}
	},
	setPos: function( x, y, animate ) {
		if( animate ) {
			var unitsPerSecond = 2;
			var pos = this.getPos();
			var dx = pos.x - x;
			var dy = pos.y - y;
			var dist = (dx*dx + dy*dy)/2;
			TweenLite.to(this.div, 1, { left:x, top:y });
		}else {
			this.div.css({top:y, left:x});
			//this.div.css("background-position-x",x);
			//this.div.css("background-position-y",y);
		}
	},
	getPos: function() {
		var jqp = this.div.position();
		var pos = { x:jqp.left, y:jqp.top };
		return pos;
	}
});


//fromto is unique per str1<->str2 pair
var uniqueFromTo = function( str1, str2 ) {
	return str1.localeCompare(str2) ? (str1+str2) : (str2+str1);
}

var MapView = Class.create(BaseView, {
	initialize: function($super) {
		$super();
		this.w = 720;
		this.w_h = this.w/2;
		this.h = 720;
		this.h_h = this.h/2;
		this.div = jQuery("<div>", {"class":"tg-box tg-map-base", width:this.w, height:this.h, position:"relative"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

		this.nodes = [];
		this.dotNodes = [];
		this.linkMap = {};
		this.scroll = { x:-1*this.w_h, y:-1*this.h_h };

		this.drag = null;

		var blockThis = this;

		/*
		this.div.click( function(evt){
			var parentOffset = blockThis.div.offset();
			console.log(" offset of "+ parentOffset.left+","+parentOffset.top)
      var posX = (evt.pageX - parentOffset.left);
      var posY = (evt.pageY - parentOffset.top);

			var offX = blockThis.div.width()/2 - posX;
			var offY = blockThis.div.height()/2 - posY;

			//blockThis.node.setPos( relativeXPosition, relativeYPosition );
			blockThis.scrollMapBy( -offX/2, -offY/2 );
		})
		*/
		this.div.mousedown( function(evt){
			if( blockThis.drag == null ) {
				var parentOffset = blockThis.div.offset();
      	var posX = (evt.pageX - parentOffset.left);
      	var posY = (evt.pageY - parentOffset.top);
				blockThis.drag = { x:posX, y:posY };
				evt.preventDefault();
			}
		})
		this.div.mousemove( function(evt){
			if( blockThis.drag != null ) {
				var parentOffset = blockThis.div.offset();
      	var posX = (evt.pageX - parentOffset.left);
      	var posY = (evt.pageY - parentOffset.top);
				var dx = blockThis.drag.x - posX;
				var dy = blockThis.drag.y - posY;
				blockThis.drag.x = posX;
				blockThis.drag.y = posY;
				blockThis.scrollMapBy(dx, dy);
				evt.preventDefault();
			}
		})
		this.div.mouseup( function(evt){
			if( blockThis.drag != null ) {
				blockThis.drag = null;
			}
		})
		this.div.mouseleave( function(evt){
			if( blockThis.drag != null ) {
				blockThis.drag = null;
			}
		})
		this.div.bind('contextmenu', function(e) {
    	e.preventDefault();
		});
		this.lblName.text( "Universe" );

		EventBus.ui.addListener("mapNodeClicked", this.onNodeClicked.bind(this));
    EventBus.game.addListener("playerDiscoveredLocation", this.onDiscoveredLocation.bind(this));
	},
	destroy: function($super) {
		$super();

		this.linkMap = {};

		EventBus.ui.removeListener("mapNodeClicked", this.onNodeClicked.bind(this));
    EventBus.game.removeListener("playerDiscoveredLocation", this.onDiscoveredLocation.bind(this));

		jQuery.each( this.nodes, function(key, value){
			value.destroy();
		});
		this.nodes = [];

		jQuery.each( this.dotNodes, function(key, value){
			value.destroy();
		});
		this.dotNodes = [];
	},
	initializeWithGalaxySim: function( galaxy ) {

		//clean up previous attachment
		this.linkMap = {};
		jQuery.each( this.nodes, function(key, value){
			value.destroy();
			value.getDiv().remove();
		});
		this.nodes = [];
		jQuery.each( this.dotNodes, function(key, value){
			value.destroy();
			value.getDiv().remove();
		});
		this.dotNodes = [];
		///

		var blockThis = this;

    var cx = this.w_h;
		var cy = this.h_h;

    //this.scrollMapTo( -1*this.w_h, -1*this.h_h, false); //center to zero-zero
    var player = Service.get("player");
		jQuery.each( galaxy.locations, function(key, value){
      var isKnown = player.isLocationKnown(value.id);
			if(!isKnown) return true; //continue; //skip over unknown location

			var node = new MapNode();
			//node.initializeWithJson(value);
			node.updateFromModel( value, true );
			node.setPos( node.origX - blockThis.scroll.x, node.origY - blockThis.scroll.y );
			blockThis.div.append( node.getDiv() );
			blockThis.nodes.push( node );


			var from = value.id;
			var fromLoc = value;
			jQuery.each(value.destinations, function(k, destId) {
				var toLoc = Service.get("galaxy").getLocation( destId );
				var to = toLoc.id;
				var fromTo = uniqueFromTo(from, to);

				blockThis.linkMap[ fromTo ] = { from:new Vec2D( fromLoc.coords.x, fromLoc.coords.y ), to:new Vec2D( toLoc.coords.x, toLoc.coords.y ) };
			});
		});

		//todo: create link dots
		jQuery.each(this.linkMap, function(key, value){
			//from value.x1, value.y1;
			//to value.x2, value.y2;

			//1) calc dist
			var dv = value.to.getVecSub( value.from );
			var distance = dv.getMag();
			//2) calc num dots
			var targetDistPerSeg = 35;
			var numSegs = Math.floor(distance / targetDistPerSeg);
			var numDots = numSegs - 1; //dont do dot at first or last end
			var distPerSegment = distance / numSegs;
			//3) create dots along path
			//3.1) unitize from->to vector
			dv = dv.getUnitized();
			//3.2) multiply (3.1) by dist/numDots;
			for( var idx = 1; idx < numDots; idx++ ) { //start at 1 to skip first dot
				//3.3) for(numDots: i ) create dot at from + (3.2) * i
				var pos = value.from.getVecAdd( dv.getScalarMult( idx * distPerSegment ) );
				var dot = new DotNode( pos.x, pos.y );
        dot.setPos( dot.origX - blockThis.scroll.x, dot.origY - blockThis.scroll.y );
				blockThis.div.append( dot.getDiv() );
				blockThis.dotNodes.push( dot );
			}

		});
	},
  setCurrentLocation: function( locModel ) {
    var blockThis = this;
    jQuery.each( this.nodes, function(key, value){
      if( value.updateTarget == locModel ) {
        value.setHighlighted(true);
        blockThis.scrollToNode( value, true );
        return false;
      }
    });
  },
  scrollToNode: function( node, animate ) {
    this.scrollMapTo(  (node.origX) - this.w_h  , (node.origY) - this.h_h, animate );
  },
	scrollMapBy: function( x, y, animate ) {
		this.scroll.x += x;
		this.scroll.y += y;

		this._updateAfterScroll();
	},
	scrollMapTo: function( x, y, animate ) {
		this.scroll.x = x;
		this.scroll.y = y;

		this._updateAfterScroll( animate );
	},
	_updateAfterScroll: function( animate ){
		var cx = this.w_h;
		var cy = this.h_h;

    var margin = 20;

		//update existing nodes
		var blockThis = this;
		jQuery.each( this.nodes.concat(this.dotNodes) , function(idx, value){
			var nx = value.origX;// + blockThis.w_h;
			var ny = value.origY;// + blockThis.h_h;

			var dx = Math.abs(cx - nx + blockThis.scroll.x );
			var dy = Math.abs(cy - ny + blockThis.scroll.y );
			var axis = (dx + dy)/2;
			var scale = 1 - (axis / cx);
			if( scale < 0.2 ) scale = 0.2;

			//set scale based on distance from center of view

			//clip to inside of view area  all sides
			var x = nx - blockThis.scroll.x;
			var y = ny - blockThis.scroll.y;
			if( x < margin ) x = margin;
			if( x >= blockThis.w - margin ) x = blockThis.w - margin;
			if( y < margin ) y = margin;
			if( y >= blockThis.h - margin ) y = blockThis.h - margin;
			value.setPos( x - value.w_h, y - value.h_h, animate );

			value.setScale( scale, animate );
		});


		this.lblName.text( "Universe (" + (this.scroll.x + this.w_h )+","+ (this.scroll.y+this.h_h)+")");
	},
	onNodeClicked: function(evt){
    this.scrollToNode( evt.node, true );
    //evt.node.setHighlighted(true);
	},
  onDiscoveredLocation: function(evt){
    //reload to render new location
    //TODO: optimize-- only add new MapNode and DotNodes

    var galaxy = Service.get("galaxy");
    this.initializeWithGalaxySim( galaxy );
  }
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js
//#include js/view/MenuView.js


var PlayerHud = Class.create(BaseView, {
	initialize: function($super) {
		$super();
		this.menu = null;

		this.div = jQuery("<div>", {"class":"top-hud", width:"100%", height:"50px"}); //note: class here is the HTML-element-class

		//todo: push the following off to the right

		this.lblName = jQuery("<p>", {"class":"leftAlignText"}).css({
    position:  'absolute',
    left:      160});
    this.div.append(this.lblName);

		this.selAgents = null;

		this.lblCredits = jQuery("<p>", {"class":"rightAlignText"});
		this.div.append(this.lblCredits);

		this.createMenu();
		//calls createMenu on getDiv() to allow for reloading at different locations
	},
	createMenu: function() {

		if( this.menu != null ) {
			//destroy previous menu
			this.menu.destroy();
			this.menu = null;
		}

		this.menu = new MenuView();
		this.menu.initializeWithJson({ name: "root",
					opts:[{ name: "Menu", opts:[
									{ name: "Run",
										opts:[
											{ name: "Pause", evt:"menuPause" },
											{ name: "Resume", evt:"menuResume" }
										]
									},
                  {
                    name: "Create",
                    opts:[
                      { name: "Location", evt:"menuCreateLocation" },
                      { name: "Destination", evt:"menuCreateDestination" },
                      { name: "Factory", evt:"menuCreateFactory" },
                      { name: "Station", evt:"menuCreateStation" },
											{ name: "-" },
											{ name: "Corporation", evt:"menuCreateCorporation" },
											{ name: "Agent", evt:"menuCreateAgent" },
											{ name: "Vessel", evt:"menuCreateVessel" }
                    ]
                  },
									{ name: "-"},
									{ name: "Export", evt:"menuExportGame" },
                  { name: "Import", evt:"menuImportGame" },
									{	name: "Nuke", evt:"menuNuke", icon:"ui-icon-power" }
					]}
				]
		 });
		this.div.append(this.menu.getDiv());
	},
	updateCredits: function( amt ) {
		this.lblCredits.text( "$" + amt );
	},
	_updateFromModel: function( corpModel ) {

		if(this.selAgents) {
			this.selAgents.remove();
		}

		if( corpModel ) { //be extra fault tolerant during THE REMAKING
			this.lblName.text( corpModel.name );
			this.updateCredits( corpModel.getNumCredits() );

			if( dicLength(corpModel.agents) > 0 ) {
				var agentVals = [];
				jQuery.each(corpModel.agents, function(key, value){
					agentVals.push({ value:value.id, text:value.name});
				});

				var player = Service.get("player");
				var activeAgent = undefined;
				if( player.activeUserAgent ) {
					activeAgent = player.activeUserAgent.id;
				}

				this.selAgents = create_select_div(agentVals, activeAgent);
				this.selAgents.css({
						position:  'absolute',
						left:      360});
				this.div.append(this.selAgents);

				this.selAgents.change(function(e){
					var selectedValue = jQuery(this).val();
					EventBus.ui.dispatch({ evtName:"activeAgentSelected", agentId:selectedValue });
				});
			}

		}else {
			//Nuked, reset all labels
			this.lblName.text("");
		}
	},
	_detachTarget: function( target ) {
		this.updateTarget.removeListener("corpUpdateCredits", this.onCorpCreditsUpdated.bind(this) );
		this.updateTarget.removeListener("corpUpdateAgents", this.onCorpAgentsUpdated.bind(this) );
	},
	_attachTarget: function( target ) {
		this.updateTarget.addListener("corpUpdateCredits", this.onCorpCreditsUpdated.bind(this) );
		this.updateTarget.addListener("corpUpdateAgents", this.onCorpAgentsUpdated.bind(this) );
	},

	//event handlers
	onCorpCreditsUpdated: function( evt ) {
		this.updateCredits( this.updateTarget.getNumCredits() );
	},
	onCorpAgentsUpdated: function( evt ) {
		this._updateFromModel( this.updateTarget );
	},
})
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

Represents either a vessel BUYING from a factory or SELLING to a factory.
If sellMode = true, then SELLING.  Can only do one of the two.

Text is represented relative to the vessel's point of view.

events sent
ui:"PurchaseDialogOk": { dialog:this, qty:int, cid:cid, factId:fid }
ui:"DialogCancel": { dialog:this }

*/

var PurchaseDialog = Class.create({
	initialize: function( parentHtmlElement, boolSellMode ) {
		this.parent = parentHtmlElement;
    this.cid = "";
    this.factId = "";
    this.locId = "";
    this.qty = 0;
		this.pricePerUnit = 0;
    this.cancelled = false;
		this.sellMode = boolSellMode;
	},
  setQtyAndTotal: function( qty ) {
    this.qty = qty;
    var total = qty * this.pricePerUnit;
    this.qtyNum.text( "x" + qty + " = $" + total);
  },
	initWithCidQtyPriceFactoryAndElem: function( cid, qty, pricePerUnit, locId, factId ) {
		this.cid = cid;
    this.factId = factId;
    this.locId = locId;
    this.qty = qty;
		this.pricePerUnit = pricePerUnit;
    this.cancelled = false;
    var blockThis = this;

		var cmdyType = CommodityType.get(cid);
		var text = cmdyType.name + " @ $" + pricePerUnit;

    var desc = jQuery("<p>", {text:text});
    var qtyNum = jQuery("<p id='qnum'>");
    var qtySel = jQuery("<div>", {name:'qty'});

    qtySel.slider({
      range: "min",
      min: 1,
      max: qty,
      value: qty,
      slide: function( event, ui ) {
        blockThis.setQtyAndTotal(qtySel.slider("value"));
      },
      stop: function( event, ui ) {
        blockThis.setQtyAndTotal(qtySel.slider("value"));
      }
    });

    this.qtySel = qtySel;
    this.qtyNum = qtyNum;

		if(this.sellMode) {
			this.div = jQuery("<div>", {title:"Sell", id:"SellDialog"}).append(desc).append(qtySel).append(qtyNum);
		}else {
			this.div = jQuery("<div>", {title:"Buy", id:"BuyDialog"}).append(desc).append(qtySel).append(qtyNum);
		}

		jQuery(this.parentHtmlElement).append(this.div);

    this.setQtyAndTotal(qty);

		this.div.dialog({
      modal: true,
      buttons: {
        Ok: function() {
					this.done = true;
					var qty = blockThis.qty;
					EventBus.ui.dispatch({evtName:"PurchaseDialogOk", dialog:blockThis, qty:qty, cid:cid, factId:factId});
					jQuery(this).dialog("close");
        },
				Cancel: function() {
          //behave same as cancel 'x' button
					this.done = true;
					blockThis.cancelled = true;
					EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					jQuery(this).dialog("close");
				}

      },
			close: function() {
					if( !this.done ) {
            blockThis.cancelled = true;
						EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					}
				}
    });

	},
	getDiv: function() {
		return this.div;
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/CommodityModel.js
//#include js/model/StationModel.js

var StationView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    //commodities
    this.divCommodities = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divCommodities.css("border-color", "#BBBBCC");
    this.div.append(this.divCommodities);

    this.commodityViews = {};
  },
  destroy: function( $super ) {
    $super();
    jQuery.each(this.commodityViews, function(key, value){
      value.destroy();
    });
  },
  setName: function( strName ) {
    this.lblName.text( strName );
  },
  _updateFromModel: function( sModel ) {
    this.setName( sModel.name );
    this.div.prop('title', sModel.id);

    var blockThis = this;

    //TODO: update input/output divs instead of recreating them!!!
    //fill input storage views
    blockThis.divCommodities.empty();
		blockThis.divCommodities.append(jQueryIcon("ui-icon-transfer-e-w")).append("Trade Goods");
    jQuery.each(sModel.commodities, function( key, value )
    {
      //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
      var cmm1 = new CommodityModel();
      cmm1.initializeWithJson( {type: value.cid } );
      cmm1.currQty = value.currQty;
      cmm1.maxQty = value.maxQty;

      var cmv1 = new CommodityView();
			cmv1.tradePrice = true;
			cmv1.setTradeCursor();
      cmv1.updateFromModel(cmm1);
      cmv1.getDiv().width(160);

      blockThis.divCommodities.append(cmv1.getDiv());
      blockThis.commodityViews[ value.cid ] = cmv1;

      cmv1.getDiv().click( function(e){
        //console.log(" clicked input " + fModel.name + " " + value.cid );
        EventBus.ui.dispatch({evtName:"tradeCmdyClicked", cid:value.cid,
                              statId:sModel.id, qty:(value.maxQty - value.currQty),
                              pricePerUnit:cmm1.type.getAvgTradeValue() });
      });

    });
  },
	_detachTarget: function( target ) {
		  target.removeListener("updateStorage", this.onTargetUpdate.bind(this) );
	},
	_attachTarget: function( target ) {
		  target.addListener("updateStorage", this.onTargetUpdate.bind(this) );
	},
  onTargetUpdate: function( evt ) {
    //TODO: only update target commodity
    //this.updateFromModel( this.updateTarget, false );
		var value = this.updateTarget.getCommodityUnitsAvailable(evt.cid);

		var cmm1 = new CommodityModel();
		cmm1.initializeWithJson( {type: evt.cid } );
		cmm1.currQty = value.qtyAvailable;
		cmm1.maxQty = value.maxQty;

    var cmv1 = this.commodityViews[ evt.cid ];
		cmv1.updateFromModel(cmm1);

  }

});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

Represents a vessel BUYING or SELLING to a station (can do either from the same view).

Text is represented relative to the vessel's point of view.

The slider range is  vessel.qty + station.qty;
The slider start position = vessel.qty, where trade qty = 0;
 moving the slider left will result in qty going negative (meaning vessel is SELLING qty)
 moving the slider right will result in qty going positive (meaning vessel is BUYING qty)

todo: handle max cargo space available for both vessel and station
todo: handle max $balance available from vessel

events sent
ui:"TradeDialogOk": { dialog:this, qty:int, cid:cid, factId:fid }
ui:"DialogCancel": { dialog:this }

*/

var TradeDialog = Class.create({
	initialize: function( parentHtmlElement ) {
		this.parent = parentHtmlElement;
    this.cid = "";
    this.statId = "";
    this.locId = "";
    this.qty = 0;
    this.vQty = 0;
    this.sQty = 0;
		this.pricePerUnit = 0;
    this.cancelled = false;
    this.sellMode = false; //gets toggled as slider goes left/right of start point
  },
  setQtyAndTotal: function( qty ) {
    this.qty = qty;
    if( qty < 0 ) this.sellMode = true;
    else this.sellMode = false;
    var total = Math.abs(qty * this.pricePerUnit);
    var action = (  this.sellMode ) ? "SELL" : "BUY";
    this.qtyNum.text( action + " x" + Math.abs(qty) + " = $" + total);
  },
  initWithCidQtyPriceFactoryAndElem: function( cid, vQty, sQty, pricePerUnit, locId, statId ) {
		this.cid = cid;
    this.statId = statId;
    this.locId = locId;
    this.qty = 0;
    this.vQty = vQty;
    this.sQty = sQty;
		this.pricePerUnit = pricePerUnit;
    this.cancelled = false;
    var blockThis = this;

		var cmdyType = CommodityType.get(cid);
		var text = cmdyType.name + " @ $" + pricePerUnit;

    var desc = jQuery("<p>", {text:text});
    var qtyNum = jQuery("<p id='qnum'>");
    var qtySel = jQuery("<div>", {name:'qty'});
		var qty = 0;
    qtySel.slider({
      range: "min",
      min: -vQty,
      max: sQty,
      value: qty,
      slide: function( event, ui ) {
        blockThis.setQtyAndTotal(qtySel.slider("value"));
      },
      stop: function( event, ui ) {
        blockThis.setQtyAndTotal(qtySel.slider("value"));
      }
    });

    this.qtySel = qtySel;
    this.qtyNum = qtyNum;


		this.div = jQuery("<div>", {title:"Trade", id:"TradeDialog"}).append(desc).append(qtySel).append(qtyNum);

		jQuery(this.parentHtmlElement).append(this.div);

    this.setQtyAndTotal(qty);

		this.div.dialog({
      modal: true,
      buttons: {
        Ok: function() {
					this.done = true;
					var qty = blockThis.qty;
					EventBus.ui.dispatch({evtName:"TradeDialogOk", dialog:blockThis, qty:qty, cid:cid, statId:statId});
					jQuery(this).dialog("close");
        },
				Cancel: function() {
          //behave same as cancel 'x' button
					this.done = true;
					blockThis.cancelled = true;
					EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					jQuery(this).dialog("close");
				}

      },
			close: function() {
					if( !this.done ) {
            blockThis.cancelled = true;
						EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					}
				}
    });

	},
	getDiv: function() {
		return this.div;
	}
});
;//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/VesselModel.js

var VesselView = Class.create(BaseView, {
  initialize: function($super){
		$super();
    this.div = jQuery("<div>", {"class":"tg-box"});
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this.divCargo = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divCargo.css("border-color", "#AAAAAA");
    this.div.append(this.divCargo);
  },
  _updateFromModel: function( vModel ) {
		var name = vModel.name;
		if( vModel.getOwner() ) name += ", " + vModel.getOwner().name;
		this.lblName.text( name );
    this.div.prop('title', vModel.id);

    var blockThis = this;

    blockThis.divCargo.empty();
    blockThis.divCargo.append(jQueryIcon("ui-icon-circlesmall-close")).append("Cargo ("+vModel.getCurrentVolume()+"/"+vModel.maxQty+")");
		//append(jQuery("<p>Cargo ("+vModel.getCurrentVolume()+"/"+vModel.maxQty+")</p>")).addClass("tg-name");
    jQuery.each(vModel.getCargo(), function(key, value){

      var cmv1 = new CommodityView();
      cmv1.purchasePrice = true;
      cmv1.updateFromModel(value);
      cmv1.getDiv().width(160);

      blockThis.divCargo.append(cmv1.getDiv());
    });
  },
	_detachTarget: function( vessel ) {
		vessel.removeListener("updateVessel", this.onTargetUpdate.bind(this) );
	},
	_attachTarget: function( vessel ) {
		vessel.addListener("updateVessel", this.onTargetUpdate.bind(this) );
	},
  onTargetUpdate: function( evt ) {
    //console.log("update vessel view");
    this.updateFromModel( this.updateTarget, false );
  }
});
;var data = {
  "commodityTypes" : {
    "cmdyEcell" : { "id":"cmdyEcell", "name":"Ecell", "minVal":10, "maxVal":20 },
    "cmdyOreT1" : { "id":"cmdyOreT1", "name":"Ore T1", "minVal":5, "maxVal":50 },
		"cmdyOreT2" : { "id":"cmdyOreT2", "name":"Ore T2", "minVal":50, "maxVal":500 },
		"cmdyBioT1" : { "id":"cmdyBioT1", "name":"Grains", "minVal":1, "maxVal":10 },
		"cmdyBioT2" : { "id":"cmdyBioT2", "name":"Livestock", "minVal":2, "maxVal":25 },
		"cmdyBioT3" : { "id":"cmdyBioT3", "name":"Pharmaceuticals", "minVal":50, "maxVal":500 },
    "cmdyCosmetics" : { "id":"cmdyCosmetics", "name":"Cosmetics", "minVal":50, "maxVal":500 },
		"cmdyConstMats" : { "id":"cmdyConstMats", "name":"Construction Materials", "minVal":5, "maxVal":50 }
  },
  "factoryTypes" : {
		"ftEcell_solar1" : { "id":"ftEcell_solar1", "name":"Solar Plant",  "outputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":10, "maxQty":1000}}, "processTime":4.0 },
    "ftOreT1_forge1" : { "id":"ftOreT1_forge1", "name":"T1 Ore Forge", 	"inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":1,  "maxQty":1000}}, "outputs":{"cmdyOreT1":{"cid":"cmdyOreT1","qty":10, "maxQty":10000}}, "processTime":15.0 },
    "ftOreT2_forge1" : { "id":"ftOreT2_forge1", "name":"T2 Ore Forge", 	"inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":10, "maxQty":1000}}, "outputs":{"cmdyOreT2":{"cid":"cmdyOreT2","qty":1, "maxQty":1000}}, "processTime":15.0 },
		"ftBioT1_farm1"  : { "id":"ftBioT1_farm1", "name":"Grain Farm", 		"inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":10, "maxQty":1000}}, "outputs":{"cmdyBioT1":{"cid":"cmdyBioT1","qty":100, "maxQty":10000}}, "processTime":20.0 },
		"ftBioT2_ranch1" : { "id":"ftBioT2_ranch1", "name":"Cattle Ranch", 	"inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":10, "maxQty":1000}}, "outputs":{"cmdyBioT2":{"cid":"cmdyBioT2","qty":100, "maxQty":10000}}, "processTime":30.0 },
		"ftBioT3_lab1" 	 : { "id":"ftBioT3_lab1", "name":"Rx Laboratory", 	"inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":10, "maxQty":1000},"cmdyOreT2":{"cid":"cmdyOreT2","qty":1, "maxQty":100}}, "outputs":{"cmdyBioT3":{"cid":"cmdyBioT3","qty":5, "maxQty":1000}}, "processTime":30.0 },
		"ftCosmetics" : { "id":"ftCosmetics", "name":"Adriana's Cosmetics", "inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":1,  "maxQty":1000},"cmdyOreT2":{"cid":"cmdyOreT2","qty":1, "maxQty":100}}, "outputs":{"cmdyCosmetics":{"cid":"cmdyCosmetics","qty":10, "maxQty":10000}}, "processTime":15.0 },
		"ftConstFab"  : {"id":"ftConstFab", "name":"Construction Fabrications", "inputs":{"cmdyEcell":{"cid":"cmdyEcell","qty":1, "maxQty":1000},"cmdyOreT1":{"cid":"cmdyOreT1","qty":10, "maxQty":10000}}, "outputs":{"cmdyConstMats":{"cid":"cmdyConstMats","qty":100, "maxQty":10000}}, "processTime":6.0 }
  },
  "stationTypes" :  {
    "stCGoods" : { "id":"stCGoods", "name":"Common Goods", "commodities":{"cmdyEcell":{"cid":"cmdyEcell","qty":10,"maxQty":1000},"cmdyOreT1":{"cid":"cmdyOreT1","qty":10, "maxQty":1000},"cmdyBioT1":{"cid":"cmdyBioT1","qty":100, "maxQty":1000} } },
    "stT2Goods": { "id":"stT2Goods", "name":"Tier 2 Goods", "commodities":{ "cmdyOreT2":{"cid":"cmdyOreT2","qty":1, "maxQty":10}, "cmdyBioT2":{"cid":"cmdyBioT2","qty":100, "maxQty":100} } }
  },
  "vesselTypes" : {
    "vtFFt1" : { "id":"vtFFt1", "name":"Firefly FFt1", "speed":10, "cargoVol":100 },
    "vtMLsG" : { "id":"vtMLsG", "name":"Megolith SG", "speed":1, "cargoVol":10000 },
    "vtPCvc" : { "id":"vtPCvc", "name":"Corvette Pvc", "speed":100, "cargoVol":5 }
  }
}

;var world_seed = {"galaxy":{"gameTime":10.872999999999966,"locations":{"0c77d087-2e53-4600-89ca-fc4e3fff96e3":{"name":"Someplace","id":"0c77d087-2e53-4600-89ca-fc4e3fff96e3","loc":{"x":0,"y":0},"factories":{},"stations":{},"vessels":{},"destinations":[]}},"corporations":{}},"player":{"currentLocation":"0c77d087-2e53-4600-89ca-fc4e3fff96e3","knownLocations":["0c77d087-2e53-4600-89ca-fc4e3fff96e3"],"activeAgent":""}}
