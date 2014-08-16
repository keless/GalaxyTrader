//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/CommodityModel.js
//#include js/model/FactoryModel.js

//NOTE: expects Service.get("galaxy").gameTime to represent the current game time (in same format sent to update)

var FactoryView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this.pbProcessing = jQuery("<div>").progressbar();
    this.pbProcessing.css("height", 20);
    this.pbProcessing.css("marginBottom", 5);
    this.div.append(this.pbProcessing);

    //inputs
    this.divInputs = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divInputs.css("border-color", "#BBBBCC");
    this.div.append(this.divInputs);
    this.inputViews = {}; //todo //xxx - use these to recycle views

    //outputs
    this.divOutputs = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divOutputs.css("border-color", "#BBBBCC");
    this.div.append(this.divOutputs);
    this.outputViews = {}; //todo //xxx - use these to recycle views
  },
  destroy: function( $super ) {
    $super();
    jQuery.each(this.inputViews, function(key, value){
      value.destroy();
    });
    jQuery.each(this.outputViews, function(key, value){
      value.destroy();
    });
  },
  setName: function( strName ) {
    this.lblName.text( strName );
  },
  _updateFromModel: function( fModel ) {
    this.setName( fModel.name );
    this.div.prop('title', fModel.id);

    this.pbProcessing.progressbar( "value", fModel.getProcessingPct( Service.get("galaxy").gameTime ) * 100 );

    var blockThis = this;

    //TODO: update input/output divs instead of recreating them!!!
    //fill input storage views
    blockThis.divInputs.empty();
		blockThis.divInputs.append(jQueryIcon("ui-icon-arrowthickstop-1-s")).append("Inputs");
    jQuery.each(fModel.inputStorage, function( key, value )
    {
      //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
      var cmm1 = new CommodityModel();
      cmm1.initializeWithJson( {type: value.cid } );
      cmm1.currQty = value.currQty;
      cmm1.maxQty = value.maxQty;

      var cmv1 = new CommodityView();
      cmv1.updateFromModel(cmm1);
			cmv1.setSellCursor();
			cmv1.setPrice( fModel._getPricePerUnit( value.cid, value.currQty, value.maxQty, true) ); //potentially show incentive value
      cmv1.getDiv().width(160);

      blockThis.divInputs.append(cmv1.getDiv());

      cmv1.getDiv().click( function(e){
        //console.log(" clicked input " + fModel.name + " " + value.cid );
        EventBus.ui.dispatch({evtName:"factInputClicked", cid:value.cid, factId:fModel.id});
      });

    });

    //fill output storage views
    blockThis.divOutputs.empty();
    //blockThis.divOutputs.append(jQuery("<p>Outputs</p>")).addClass("tg-name");
		blockThis.divOutputs.append(jQueryIcon("ui-icon-extlink")).append("Outputs");
    jQuery.each(fModel.outputStorage, function( key, value )
    {
      //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
      var cmm1 = new CommodityModel();
      cmm1.initializeWithJson( {type: value.cid } );
      cmm1.currQty = value.currQty;
      cmm1.maxQty = value.maxQty;

      var cmv1 = new CommodityView();
      cmv1.updateFromModel(cmm1);
			cmv1.setBuyCursor();
			cmv1.setPrice( fModel._getPricePerUnit( value.cid, value.currQty, value.maxQty, false) ); //potentially show incentive value
      cmv1.getDiv().width(160);

      blockThis.divOutputs.append(cmv1.getDiv());

      cmv1.getDiv().click( function(e){
        //console.log(" clicked output " + fModel.name + " " + value.cid );
        EventBus.ui.dispatch({evtName:"factOutputClicked", cid:value.cid, factId:fModel.id });
      });
    });
  },
	_detachTarget: function( target ) {
		  target.removeListener("updateStorage", this.onTargetUpdate.bind(this) );
      target.removeListener("updateProcess", this.onTargetProcess.bind(this) );
	},
	_attachTarget: function( target ) {
		  target.addListener("updateStorage", this.onTargetUpdate.bind(this) );
      target.addListener("updateProcess", this.onTargetProcess.bind(this) );
	},
  onTargetUpdate: function( evt ) {
    this.updateFromModel( this.updateTarget, false ); //TODO: dont reload entire view
  },
  onTargetProcess: function( evt ) {
    //just update the progress bar
    this.pbProcessing.progressbar( "value", this.updateTarget.getProcessingPct( Service.get("galaxy").gameTime ) * 100 );
  }

});
