//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
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
 2.3) for each( loc.vessels )
 2.3.1) VesselModel
 3) for each( gxy.corporation )
 3.1) CorpModel
 3.2) for each( crp.agent ) //TODO: currently gxy.agents until i implement corps
 3.2.1) AgentModel

*/

var GalaxySim = Class.create({
  initialize : function() {
    this.agents = {};
    this.activeUserAgent = null;
    this.locations = {};

    this.lastAgentProcessTime = 0;
    this.agentProcessPeriod = 5; //Secs

    this._allVessels = {};

		this.gameTime = 0; //Secs

		Service.add("galaxy", this);
  },
	initializeWithJson: function( json ) {
		console.log("GalaxySim load from json")

		var blockThis = this;

		var locations = json["locations"];
		jQuery.each(locations, function(key,value){
			var location = new LocationModel();
			location.initializeWithJson(value);
			blockThis.addLocation(location);
		});

		var agents = json["agents"];
		jQuery.each(agents, function(key,value){
			var agent;
			if( value["isUserAgent"] ) {
				agent = new UserAgentModel();
				console.log("loaded user agent " + value.name)
        blockThis.setActiveUserAgent( agent );
			}else {
				agent = new AgentModel();
				console.log("loaded AI agent " + value.name)
			}

			agent.initializeWithJson(value);
			blockThis.addAgent(agent);
		});
	},
	toJson: function() {

		var locations = {}
		jQuery.each(this.locations, function(key,value){
			locations[ value.id ] = value.toJson();
		});

		var agents = {}
		jQuery.each(this.agents, function(key,value){
			agents[ value.id ] = value.toJson();
		});

		var json = { gameTime:this.gameTime, locations:locations,
								agents:agents };
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

  addAgent: function( agent ) {
    if( agent.id == "" ) {
      console.log("invalid agent id");
      return;
    }
    this.agents[ agent.id ] = agent;
  },

  setActiveUserAgent: function( agent ) {
    this.activeUserAgent = agent;
  },

  //simulation functions
  update : function( stepDt ) {

		this.gameTime += stepDt;
		//console.log("game time step + "+stepDt+" = "+this.gameTime)

		var blockThis = this;
    //update locations
    jQuery.each(this.locations, function(key, value){
      value.update( blockThis.gameTime, stepDt );
    });

    //update agents
    if( this.gameTime > this.lastAgentProcessTime + this.agentProcessPeriod ) {
      //TODO: use less spikey interval processing
      jQuery.each(this.agents, function(key, value){
        value.update( blockThis.gameTime, stepDt );
      });

      this.lastAgentProcessTime = this.gameTime;
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
      vessel.addCargo( cid, amtSold );
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
      vessel.addCargo( cid, amtSold );
			buyAgent.incCredits( -1 * purchaseTotal ); //use negative to subtract
      if( amtSold != qty ) {
        console.log("WARNING: vessel bought "+amtSold+" from " + station.name + " was expecting " + qty);
      }
    }
  }

});
