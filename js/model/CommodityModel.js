//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>


var CommodityType = Class.create({
  initialize: function() {
    this.name = "";
    this.id = "undefined_id";
    this.minVal = 0;
    this.maxVal = 0;
  },
  g_types : [],
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
    this.id = "";
  },
  initializeWithJson: function( json) {
    this.initialize();

    var cmdyTypeId = json["type"] || "invalid_idj";
    var cmdyType = CommodityType.get( cmdyTypeId );

    this.type = cmdyType;
    this.name = cmdyType.name;
    this.id = json["id"] || uuid.v4();
    this.maxQty = json["maxQty"] || this.maxQty;
    this.currQty = json["currQty"] || this.currQty;
  },
  getValue: function() {
    return this.type.getValWithCapacityPct( this.currQty / this.maxQty );
  }
});
