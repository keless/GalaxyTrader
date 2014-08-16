//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
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
