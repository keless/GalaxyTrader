//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
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
						//console.log("Avoid selling cmdy " + offer.cid + " at ppu " + offer.pricePerUnit + " when our val is " + blockThis.vessel.getCargoPurchasedVal(offer.cid));
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
