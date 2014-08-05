//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/jquery-1.10.2.js
//#include js/ext/uuid.js <https://github.com/broofa/node-uuid>
//#include js/framework/EventBus.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/StationModel.js

var LocationModel = Class.create(EventBus, {
  initialize: function( $super ) {
    $super("LocationModel"); //initialize EventBus
    this.name = "";
    this.id = "";
    this.factories = {};
    this.stations = {};
    this.visitors = {};
    this.destinations = [];
		this.coords = {x:0, y:0};

  },
  initializeWithJson: function( json ) {
    this.name = json["name"] || "";
    this.id = json["id"] || uuid.v4();
    this.factories = {};
    this.vessels = {};
    this.destinations = json["destinations"] || [];
		this.coords = json["loc"] || this.coords;

    var blockThis = this;
    jQuery.each(json["factories"], function(key, val){
      var factory = new FactoryModel();
      factory.initializeWithJson( val );
      blockThis.addFactory(factory);
    });

    if( json["stations"] ) {
    jQuery.each(json["stations"], function(key, val){
      var station = new StationModel();
      station.initializeWithJson( val );
      blockThis.addStation(station); //lump in with factories
    });
    }

    if( json["vessels"] ) {
    jQuery.each(json["vessels"], function(key, val){
      var vessel = new VesselModel();
      vessel.initializeWithJson( val );
      blockThis.addVessel(vessel);
    });
    }
  },

	toJson: function() {

		var factories = {}
		jQuery.each(this.factories, function(key,value){
			factories[ value.id ] = value.toJson();
		});
		var stations = {};
		jQuery.each(this.stations, function(key,value){
			stations[ value.id ] = value.toJson();
		});
		var vessels = {};
		jQuery.each(this.vessels, function(key,value){
			vessels[ value.id ] = value.toJson();
		});

		var json = { name:this.name, id:this.id,
								loc:this.coords, factories:factories,
								stations:stations, vessels:vessels,
								destinations:this.destinations
               };
    return json;
	},

  addFactory: function( factory ) {
    this.factories[ factory.id ] = factory;
    factory.setLocation(this);
  },
  removeFactory: function( factory ) {
    delete this.factories[ factory.id ];
    factory.setLocation(null);
  },
  hasFactory: function( factoryId ) {
    if( this.factories[ factoryId ] ) return true;
    return false;
  },
  getFactory: function( factoryId ) {
    return this.factories[ factoryId ];
  },

  addStation: function( station ) {
    this.stations[ station.id ] = station;
    station.setLocation(this);
  },
  removeStation: function( station ) {
    delete this.stations[ station.id ];
    station.setLocation(null);
  },
  hasStation: function( stationId ) {
    if( this.stations[ stationId ] ) return true;
    return false;
  },
  getStation: function( stationId ) {
    return this.stations[ stationId ];
  },

  addVessel: function( vessel ) {
    this.vessels[ vessel.id ] = vessel;
    vessel.setLocation(this);
    //make sure vessel gets registered at the GalaxySim level
    Service.get("galaxy").addVessel(vessel);

    //alert listeners of changes
		this.dispatch({evtName:"vesselAdded", from:this, vessel:vessel });
  },
  removeVessel: function( vessel ) {
    delete this.vessels[ vessel.id ];
    vessel.setLocation(null);

		//alert listeners of changes
    this.dispatch({evtName:"vesselRemoved", from:this, vessel:vessel });
  },

  //returns dict of { factId:{ cid:{ cid, pricePerUnit, qty } } }
  queryFactoryInputs: function( filterCids, filterFactoryTypeIds ) {
    var result = {};
    jQuery.each( this.factories, function(key, factory){
      if( filterFactoryTypeIds && jQuery.inArray(factory.type.id, filterFactoryTypeIds) == -1 ) return true; //continue;
      jQuery.each( factory.inputStorage, function(key, input){
        if( filterCids && jQuery.inArray(input.cid, filterCids) == -1 ) return true; //continue;
        var availQty = input.maxQty - input.currQty; //get EMPTY space
        if( availQty > 0 ) {
          if(!result[factory.id]) result[factory.id] = {}; //add entry for factory (only if something is avail)

          //add entry for cid, for this factory
          var cmdyType = CommodityType.get(input.cid);
          var pricePerUnit = cmdyType.getValWithCapacityPct( input.currQty / input.maxQty );
          result[factory.id][input.cid] = { qty:availQty, pricePerUnit:pricePerUnit, cid:input.cid };
        }
      });
    });
    return result;
  },

  //returns dict of { factId:{ cid:{ cid, pricePerUnit, qty } } }
  queryFactoryOutputs: function( filterCids, filterFactoryTypeIds ) {
    var result = {};
    jQuery.each( this.factories, function(key, factory){
      if( filterFactoryTypeIds && jQuery.inArray(factory.type.id, filterFactoryTypeIds) == -1 ) return true; //continue;
      jQuery.each( factory.outputStorage, function(key, output){
        if( filterCids && jQuery.inArray(output.cid, filterCids) == -1 ) return true; //continue;
        var availQty = output.currQty; //get USED space
        if( availQty > 0 ) {
          if(!result[factory.id]) result[factory.id] = {}; //add entry for factory (only if something is avail)

          //add entry for cid, for this factory
          var cmdyType = CommodityType.get(output.cid);
          var pricePerUnit = cmdyType.getValWithCapacityPct( output.currQty / output.maxQty );
          result[factory.id][output.cid] = { qty:availQty, pricePerUnit:pricePerUnit, cid:output.cid };
        }
      });
    });
    return result;
  },

  //simulation functions
  update : function( gameTime, stepDt ) {
    jQuery.each(this.factories, function(key, value){
      value.update( gameTime, stepDt );
    });
  }

});

//Object Creation code
LocationModel.create_factory = function( strFactoryType )
{
  return this.load_factory( { type: strFactoryType } );
};

LocationModel.load_factory = function( factoryJson )
{
  var factory = new FactoryModel();
  factory.initializeWithJson(factoryJson);
  return factory;
};
