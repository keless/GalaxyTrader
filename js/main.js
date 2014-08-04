game_init = function()
{
	//LOAD DATA
  CommodityType.loadTypesWithJson( data["commodityTypes"] );
  FactoryType.loadTypesWithJson( data["factoryTypes"] );
  VesselType.loadTypesWithJson( data["vesselTypes"] );

  var galaxy = new GalaxySim();
  window.galaxy = galaxy; //save into window context

	window.hud = new PlayerHud();
  window.map = new MapView();


  //handle buy/sell interactions
  window.onPurchaseClickRcv = function(evt) {
    var locId = window.currentLocation;
		var sellMode = false; //because we're buying
    window.startPurchaseDialog(sellMode, evt.cid, locId, evt.factId);
  }
  EventBus.ui.addListener("factOutputClicked", window.onPurchaseClickRcv.bind(window));

  window.onSellClickRcv = function(evt) {
    var locId = window.currentLocation;
		var sellMode = true; //because we're selling
    window.startPurchaseDialog(sellMode, evt.cid, locId, evt.factId);
  }
  EventBus.ui.addListener("factInputClicked", window.onSellClickRcv.bind(window));

  window.onTradeClickRcv = function(evt) {
    var locId = window.currentLocation;

    window.startTradeDialog(evt.cid, evt.qty, evt.pricePerUnit, locId, evt.statId);
  }
  EventBus.ui.addListener("tradeCmdyClicked", window.onTradeClickRcv.bind(window));

  //handle system travel event
  window.onDestinationRcv = function(evt) {
    var destination = evt.value;
		//move userAgent to destination
		window.galaxy.activeUserAgent.actionMoveToLocation( destination );

    //clear view
    window.clearView();
    window.currentLocation = destination;
    window.createView();
  }
  EventBus.game.addListener("destination", window.onDestinationRcv.bind(window));

  window.clearView = function() {
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

    var location = window.galaxy.getLocation( window.currentLocation );
    window.map.setCurrentLocation( location );


    var lv = new LocationView();
    lv.updateFromModel( location, true );
    window.currentLocationView = lv;
		lv.getDiv().width(720);
    console.log("add locationView");
    jQuery("#content").append(lv.getDiv());
    jQuery("#content").append("<br>");
  }

	//show buy/sell dialogs
	window.startPurchaseDialog = function( bSellMode, cid, locId, factId ) {
		var location = window.galaxy.getLocation(locId);
		var factory = location.getFactory(factId);

		var ppu = 0;
		var qty = 0;
		var vessel = window.galaxy.activeUserAgent.vessel;
		var maxQty = 0;
		if( !bSellMode ) {
			//buy from factory
			var offer = factory.getCommodityUnitsAvailable(cid);
			ppu = offer.pricePerUnit;
			qty = offer.qtyAvailable;

			//cap by amt user can pay for
			var maxCash = window.galaxy.activeUserAgent.getNumCredits();
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
      console.log("Vessel cargo qty " + cargoQty)
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
    var vessel = window.galaxy.activeUserAgent.vessel;
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
  EventBus.ui.addListener("DialogCancel", function(evt){
    window.currentDialog = null;
    game_start(); //resume
  });

  EventBus.ui.addListener("PurchaseDialogOk", function(evt){
    //buy/sell items for UserAgentModel

    var dialog = window.currentDialog;
    var lid = dialog.locId;
    var fid = dialog.factId;
    var cid = dialog.cid;
    var ppu = dialog.pricePerUnit;
    var qty = dialog.qty;
    var agent = window.galaxy.activeUserAgent;
    var vid = agent.vessel.id;

		if( dialog.sellMode ){
			//vid, lid, fid, cid, qty, ppu, buyAgent - diff order than BUY mode
			window.galaxy.actionSellFromVesselToFactory(vid, lid, fid, cid, qty, ppu, agent );
		}else {
			//lid, fid, vid, cid, qty, ppu, buyAgent - diff order than SELL mode
			window.galaxy.actionSellToVesselFromFactory(vid, lid, fid, cid, qty, ppu, agent);
		}

    game_start(); //resume
  });

	EventBus.ui.addListener("TradeDialogOk", function(evt){
    var dialog = window.currentDialog;
    var lid = dialog.locId;
    var sid = dialog.statId;
    var cid = dialog.cid;
    var ppu = dialog.pricePerUnit;
    var qty = Math.abs(dialog.qty);
    var agent = window.galaxy.activeUserAgent;
    var vid = agent.vessel.id;

		if( dialog.sellMode ){
			//vid, lid, fid, cid, qty, ppu, buyAgent - diff order than BUY mode
			window.galaxy.actionSellFromVesselToStation(vid, lid, sid, cid, qty, ppu, agent );
		}else {
			//lid, fid, vid, cid, qty, ppu, buyAgent - diff order than SELL mode
			window.galaxy.actionSellToVesselFromStation(vid, lid, sid, cid, qty, ppu, agent);
		}

		game_start(); //resume
	});

	//handle menu events
	EventBus.ui.addListener("menuPause", function(evt){ game_pause(); });
	EventBus.ui.addListener("menuResume", function(evt){ game_start(); });
	EventBus.ui.addListener("menuSaveGame", function(evt){ game_save(); });
	EventBus.ui.addListener("menuLoadGame", function(evt){ game_load(); });
	EventBus.ui.addListener("menuExportGame", function(evt){ game_export(); });

  //setup simulation update loop
  //  note: you still have to call window.runUpdateLoop() to begin
  window.lastUpdateTick = 0;
  window.runUpdateLoop = function() {
    window.lastUpdateTick = (new Date()).getTime();
    window.UpdateLoopInterval = setInterval( window.UpdateLoop, 30 );  } //30ms = ~33fps
  window.stopUpdateLoop = function() {
    clearInterval( window.UpdateLoopInterval ); window.UpdateLoopInterval = null; }

	//load from world_seed
	game_fresh();

  //start the game
  game_start();

}


game_export = function()
{
	game_save();
	var jsonStr = localStorage.getItem("save");

	window.prompt("Copy to clipboard: Ctrl+C, Enter", jsonStr);
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
	var ui = { currentLocation: window.currentLocation };
	var json = { galaxy:galaxy, ui:ui };
	localStorage.setItem("save", JSON.stringify( json ));
	console.log("saved data to local storage")
}

game_load = function()
{
	console.log("load data from local storage")
	var json = JSON.parse( localStorage.getItem("save") );
	var galaxy = new GalaxySim();
	galaxy.initializeWithJson( json["galaxy"] );
	window.galaxy = galaxy;

  window.map.initializeWithGalaxySim( galaxy );

	//clear view
	window.clearView();
	window.currentLocation = json["ui"]["currentLocation"];
	window.createView();
}

game_fresh = function()
{
	var galaxy = new GalaxySim();
	galaxy.initializeWithJson( world_seed["galaxy"] );
	window.galaxy = galaxy;

  window.hud.updateFromModel( galaxy.activeUserAgent );
  window.map.initializeWithGalaxySim( galaxy );

	//create view
	window.currentLocation = world_seed["ui"]["currentLocation"];
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
