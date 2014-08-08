//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/BaseView.js
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js
//#include js/model/LocationModel.js
//#include js/model/StationModel.js

var makeAccordionContent = function( accordionId, strTitle ) {
  var h3 = jQuery("<h>"+strTitle+"</h>");
  var cDiv = jQuery("<div id='"+accordionId+"_content'></div>");
  var accDiv = jQuery("<div id='"+accordionId+"'></div>").append(h3).append(cDiv);
  jQuery(accDiv).accordion({
    collapsible: true,
    heightStyle: "content"
  });

  return accDiv;
}

var LocationView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box", width:"720px", height:"720px"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this.accFactories = makeAccordionContent( "accFacts", "Factories & Stations" );
    this.accFactoriesContent = this.accFactories.find("#accFacts_content");
    this.div.append(this.accFactories);

    this.accDestinations = makeAccordionContent( "accDests", "Star Gates" );
    this.accDestinationsContent = this.accDestinations.find("#accDests_content");
    this.div.append(this.accDestinations);

    this.accVessels = makeAccordionContent( "accVessels", "Vessels" );
    this.accVesselsContent = this.accVessels.find("#accVessels_content");
    this.div.append(this.accVessels);

    this.factoryViews = [];
    this.vesselViews = [];
  },
  destroy: function($super) {
		$super();

    //destroy child views
    jQuery.each(this.factoryViews, function(key,value){
      value.destroy();
    });
    jQuery.each(this.vesselViews, function(key,value){
      value.destroy();
    });
  },
  _updateFromModel: function( locModel ) {
    this.lblName.text( locModel.name );

    var blockThis = this;
		blockThis.accFactoriesContent.empty();
    jQuery.each(locModel.factories, function(key,value){
      var fcv1 = new FactoryView();
      fcv1.updateFromModel(value, true);

      blockThis.accFactoriesContent.append(fcv1.getDiv());
      blockThis.factoryViews.push(fcv1);
    });

    // add stations to factories tab
    jQuery.each(locModel.stations, function(key,value){
      var fcv1 = new StationView();
      fcv1.updateFromModel(value, true);

      blockThis.accFactoriesContent.append(fcv1.getDiv());
      blockThis.factoryViews.push(fcv1);
    });

		blockThis.accDestinationsContent.empty();
    jQuery.each(locModel.destinations, function(key,value) {
			var destModel = Service.get("galaxy").getLocation( value );
			var icon = jQueryIcon( "ui-icon-seek-next" );
      var sg = jQuery("<a>").append(icon).append( destModel.name );
			//sg.append(icon);
      blockThis.accDestinationsContent.append( sg );
      blockThis.accDestinationsContent.append("<br>");

      //clicking the destination will send an event to the bus
      sg.click(function(evt){
        evt.preventDefault();
        EventBus.game.dispatch({evtName:"destination", value:value});
      });
    });

		blockThis.accVesselsContent.empty();
    jQuery.each(locModel.vessels, function(key,value){
      var vv1 = new VesselView();
      vv1.updateFromModel(value, true);

      blockThis.accVesselsContent.append(vv1.getDiv());
      blockThis.vesselViews.push(vv1);
    });
  },
	_detachTarget: function( locModel ) {
		locModel.removeListener("vesselAdded", this.onVesselAdded.bind(this) );
		locModel.removeListener("vesselRemoved", this.onVesselRemoved.bind(this) );
	},
	_attachTarget: function( locModel ) {
    locModel.addListener("vesselAdded", this.onVesselAdded.bind(this) );
		locModel.addListener("vesselRemoved", this.onVesselRemoved.bind(this) );
	},
	onVesselAdded: function( evt ) {
		var vesselModel = evt.vessel;
		var blockThis = this;

		//create new vessel view and add to dom
		var vv1 = new VesselView();
		vv1.updateFromModel(vesselModel, true);

		blockThis.accVesselsContent.append(vv1.getDiv());
		blockThis.vesselViews.push(vv1);
	},
  onVesselRemoved: function( evt ) {
		var vesselModel = evt.vessel;
		var blockThis = this;
		jQuery.each(this.vesselViews, function(idx, value){
			if( value.updateTarget == vesselModel ) {
				//destroy and remove target vesselView
				value.destroy();
				jQuery(value.getDiv()).remove();
				blockThis.vesselViews.splice(idx, 1);
				return false; //break;
			}
		});
  }
});
