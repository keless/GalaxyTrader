//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
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
  g_types: [],
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
		this.owner = null;
    this.speed = 1;
    this.maxQty = 1;
    this._currQty = 0;
    this._cargo = {};
    this.location = null;
  },
  initializeWithJson: function( json ) {
    this.initialize();

    var vesselTypeId = json["type"] || "invalid_idj";
    var vesselType = VesselType.get( vesselTypeId );

    this.type = vesselType;
    this.name = vesselType.name;
    this.id = json["id"] || uuid.v4();
    this.speed = json["speed"] || vesselType.speed;
    this.maxQty = json["maxQty"] || vesselType.cargoVol;
    this._currQty = json["currQty"] || 0;
    this._cargo = json["cargo"] || {}; //{ cid:"cmdyId", qty:int }

		/* NOTE: its up to owners to claim vessels, because vessels are deserialized before agents
		if( json["owner"] ) {
      this.owner = Service.get("galaxy").getAgent( json["owner"] );
    }
    else {
      this.owner = null;
    }
		*/

		/* NOTE: locations spawn vessels in deserialization and will handle attaching
    if( json["location"] ) {
      this.location = Service.get("galaxy").getLocation( json["location"] );
    }
    else {
      this.location = null;
    }
		*/
  },
	toJson: function() {
		var ownerId = this.owner ? this.owner.id : "";
    var json = { type:this.type.id, name:this.name, id:this.id, owner:ownerId,
								speed:this.speed, maxQty:this.maxQty, currQty:this._currQty,
								cargo:this._cargo
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
    return this._cargo[cid].qty;
  },
  getCargo: function() {
    return this._cargo;
  },

  //this will fill holds with QTY up to max, returning amt actually stored
  //TODO: track pricePerUnit (to display to user, and for AI logic)
  addCargo: function( cid, qty ) {

    var spaceAvailable = this.maxQty - this._currQty;
    if( spaceAvailable == 0 ) return 0;

    //ensure entry for cargo type
    if( !this._cargo[cid] ) {
      this._cargo[cid] = { cid:cid, qty:0 };
    }

    var amt = Math.min( qty, spaceAvailable );

    this._cargo[cid].qty += amt;
    //TODO: this._cargo[cid].pricePerUnit = ??;
    this._currQty += amt;

    this.dispatch({evtName:"updateVessel", from:this });

    return amt;
  },

  //this will remove the QTY up to the amt available in holds, returning amt actually removed
  removeCargo: function( cid, qty ) {
    if( !this._cargo[cid] ) {
      return 0;
    }

    var amt = Math.min( qty, this._cargo[cid].qty );
    this._cargo[cid].qty -= amt;
    this._currQty -= amt;

		if( this._cargo[cid].qty < 1 ) {
			delete this._cargo[cid];
		}

    this.dispatch({evtName:"updateVessel", from:this });

    return amt;

  }
});

