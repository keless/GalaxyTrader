//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js

var StationModel = Class.create(EventBus, {
  initialize: function( $super ) {
    $super(); //initialize EventBus
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

    this.name = json["name"] || "Station";
    this.id = json["id"] || uuid.v4();
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

		var blockThis = this;
		//{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
		jQuery.each(json["commodities"], function(key, value){
			blockThis.commodities[ value.cid ] = value;
		});
	},
  toJson: function() {
		var ownerId = this.owner ? this.owner.id : "";
    var json = { name:this.name, id:this.id, consumePeriod:this._consumePeriod,
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
      oldLocation.removeFactory(this);
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
