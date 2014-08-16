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
