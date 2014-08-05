//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
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
  g_types : [],
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
			console.log( "got amtsAvail for " + cid)
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
			console.log( "got amtsNeeded for " + cid)
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
