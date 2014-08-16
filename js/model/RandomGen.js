
var genesis = function( template )
{
	var result = {galaxy:{locations:{}}, player:{currentLocation:""}};
	var clusterWeb = new web();
	jQuery.each(template.clusters, function(i, cluster){
		var barycenter = new Vec2D();
		barycenter.initializeWithPos(cluster.pos);
		var type = clusterTypes[cluster.type];

		if(!type) {
			console.log("GENESIS: error instanciating cluster type " + cluster.type);
		}

		var systemWeb = new web();
		jQuery.each(type.systems, function(idx, system){
			var systemType = systemTypes[system.type];
			if(!systemType) {
				console.log("GENESIS: error instanciating system type " + system.type);
				return true; //continue
			}

			var uniPos = barycenter.getVecAdd(system.pos);

			var name = system.name;
			if(name == "random") {
				name = randLocationNames[getRand(0, randLocationNames.length-1)];
			}

			var location = new LocationModel();
			location.initializeWithJson({name:name, loc:uniPos});
			console.log("GENESIS: create location " + name);

			if( idx == 0 ) {
				clusterWeb.add(location);
			}

			systemWeb.add(location);

			if( !result.player.currentLocation ) {
				console.log("GENESIS: set starting location " + name);
				result.player.currentLocation = location.id;
			}

			if( systemType.factories ) {
				jQuery.each(systemType.factories, function(idx, factType){
					console.log("GENESIS:    create factory " + factType);
					var factory = new FactoryModel();
					factory.initializeWithJson({type:factType});
					location.addFactory(factory);
				});
			}
			if( systemType.stations ) {
				jQuery.each(systemType.stations, function(idx, statType){
					console.log("GENESIS:    create station " + statType);
					var station = new StationModel();
					station.initializeWithJson({type:statType});
					location.addStation(station);
				});
			}

			result.galaxy.locations[ location.id ] = location.toJson();

			location.destroy();
		});
		systemWeb.execute();


	});
	clusterWeb.execute();

	return result;

}

//connects destinations together to first element
var web = function() {
	this.list = [];
	this.add = function( location ) {
		this.list.push(location);
	}
	this.execute = function() {
		for(var i=1; i<this.list.length; i++){
			this.list[0].destinations.push( this.list[i].id );
			this.list[i].destinations.push( this.list[0].id );
		}
		this.list = []; //clear list
	}
}

//random world generation
var random_template = {"clusters":[
	{"name":"Milky Way", "type":"type1", pos:{"x":1000, "y":1000}},
	{"name":"Next Door", "type":"type2", pos:{"x":-1000, "y":-1000}},
	{"name":"UniCenter", "type":"type3", pos:{"x":0, "y":0}}
]};


var clusterTypes = {
	"type1":{
		"systems":[{name:"SolSystem", pos:{"x":0, "y":0}, type:"epicenter"},
							 {name:"Alpha Centauri", pos:{"x":150, "y":150}, type:"tradeHub1"},
							 {name:"random", pos:{"x":-150, "y":-200}, type:"ranch"},
							 {name:"random", pos:{"x":-50, "y":200}, type:"solarFact"},
							 {name:"random", pos:{"x":-250, "y":150}, type:"tradeHub2"}
							]
	},
	"type2":{
		"systems":[{name:"Barus 5", pos:{"x":0, "y":0}, type:"epicenter"},
							 {name:"random", pos:{"x":-150, "y":150}, type:"tradeHub1"},
							 {name:"random", pos:{"x":150, "y":-200}, type:"ranch"}
							]
	},
	"type3":{
		"systems":[{name:"Gemini Alpha", pos:{"x":-50, "y":50}, type:"solarFact"},
							 {name:"Gemini Beta", pos:{"x":50, "y":-50}, type:"tradeHub1"},
							 {name:"random", pos:{"x":150, "y":-200}, type:"empty"}
							]
	}
};

var systemTypes = {
	"empty":{},
	"solarFact":{
		"factories":["ftEcell_solar1"]
	},
	"ranch":{
		"factories":["ftEcell_solar1", "ftBioT1_farm1", "ftBioT2_ranch1"]
	},
	"tradeHub1":{
		"factories":["ftOreT1_forge1"],
		"stations":["stCGoods"]
	},
	"tradeHub2":{
		"factories":["ftOreT2_forge1"],
		"stations":["stT2Goods"]
	},
	"epicenter":{
		"factories":["ftEcell_solar1", "ftCosmetics"],
		"stations":["stCGoods", "stT2Goods"]
	}
};

//random names
var randCorpNames = [
	"Energent",
	"Synergen",
	"MaxiLift",
	"Oreacle",
	"Sol Systems",
	"iCorp",
	"Rudolfino",
	"GZCor",
	"ChemiCorp",
	"Plaztipal"
];

var randShipNames = [
	"HMS Lollipop",
	"SS Skipper",
	"USN Manhattan",
	"Excalibur",
	"Nautilus",
	"Nectarine",
	"Red Dwarf",
	"Victory",
	"Viceroy"
];

var randAgentNames = [
	"Peppermint Larry",
	"Candy Wife",
	"Agent 001",
	"Agent 002",
	"Agent 003",
	"Agent 004",
	"Agent 005",
	"Agent 006",
	"Agent 007",
	"Agent 008",
	"Agent 009",
	"Agent 010",
	"Provocatuer"
];

var randLocationNames = [
	"Vesuvius",
	"Alpha Centauri",
	"Sirius Binar",
	"Messier 81",
	"NGC 4826",
	"Canis Major",
	"Canis Minor",
	"Andromeda",
	"Dorado",
	"Mensa",
	"Azophi",
	"Hive of Scum and Villany",
	"A Phone Booth",
	"Restaurant at the End"
];
