//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
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
