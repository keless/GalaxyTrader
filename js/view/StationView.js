//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/CommodityModel.js
//#include js/model/StationModel.js

var StationView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    //commodities
    this.divCommodities = jQuery("<div>", {"class":"tg-box", width:"170px"});
    this.divCommodities.css("border-color", "#BBBBCC");
    this.div.append(this.divCommodities);

    this.commodityViews = {};
  },
  destroy: function( $super ) {
    $super();
    jQuery.each(this.commodityViews, function(key, value){
      value.destroy();
    });
  },
  setName: function( strName ) {
    this.lblName.text( strName );
  },
  _updateFromModel: function( sModel ) {
    this.setName( sModel.name );
    this.div.prop('title', sModel.id);

    var blockThis = this;

    //TODO: update input/output divs instead of recreating them!!!
    //fill input storage views
    blockThis.divCommodities.empty();
		blockThis.divCommodities.append(jQueryIcon("ui-icon-transfer-e-w")).append("Trade Goods");
    jQuery.each(sModel.commodities, function( key, value )
    {
      //{ "cid" : <str commodityTypeId>, "currQty":<int quantity>, "maxQty":<int maxQuantity> }
      var cmm1 = new CommodityModel();
      cmm1.initializeWithJson( {type: value.cid } );
      cmm1.currQty = value.currQty;
      cmm1.maxQty = value.maxQty;

      var cmv1 = new CommodityView();
			cmv1.tradePrice = true;
			cmv1.setTradeCursor();
      cmv1.updateFromModel(cmm1);
      cmv1.getDiv().width(160);

      blockThis.divCommodities.append(cmv1.getDiv());
      blockThis.commodityViews[ value.cid ] = cmv1;

      cmv1.getDiv().click( function(e){
        //console.log(" clicked input " + fModel.name + " " + value.cid );
        EventBus.ui.dispatch({evtName:"tradeCmdyClicked", cid:value.cid,
                              statId:sModel.id, qty:(value.maxQty - value.currQty),
                              pricePerUnit:cmm1.type.getAvgTradeValue() });
      });

    });
  },
	_detachTarget: function( target ) {
		  target.removeListener("updateStorage", this.onTargetUpdate.bind(this) );
	},
	_attachTarget: function( target ) {
		  target.addListener("updateStorage", this.onTargetUpdate.bind(this) );
	},
  onTargetUpdate: function( evt ) {
    //TODO: only update target commodity
    //this.updateFromModel( this.updateTarget, false );
		var value = this.updateTarget.getCommodityUnitsAvailable(evt.cid);

		var cmm1 = new CommodityModel();
		cmm1.initializeWithJson( {type: evt.cid } );
		cmm1.currQty = value.qtyAvailable;
		cmm1.maxQty = value.maxQty;

    var cmv1 = this.commodityViews[ evt.cid ];
		cmv1.updateFromModel(cmm1);

  }

});
