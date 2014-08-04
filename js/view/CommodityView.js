//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/model/CommodityModel.js

var CommodityView = Class.create(BaseView, {
  initialize: function($super) {
		$super();
    this.div = jQuery("<div>", {"class":"tg-box", width:"400px"}); //note: class here is the HTML-element-class
    this.lblName = jQuery("<p>", {"class":"labelName tg-name"});
    this.div.append(this.lblName);

    this._name = "";
    this._qty = 0;
    this._price = 0;
    this.showPrice = true;
		this.tradePrice = false;

    this.pbCapacity = jQuery("<div>").progressbar();
    this.pbCapacity.css("height", 10);
    this.div.append(this.pbCapacity);
  },
  setName: function( strName ) {
    this._name = strName;
    this._updateLabel();
  },
  setPrice: function( price ) {
    this._price = price;
    this._updateLabel();
  },
  setQty: function( minQty, maxQty, currQty ) {
    var range = maxQty - minQty;
    var pct = ( currQty - minQty ) / range;
    this.setQtyPct( pct * 100 ); //update progressbar

    this._qty = currQty;
    this._updateLabel();
  },
  setQtyPct: function( qtyPct ) {
    Math.max(100, Math.min(qtyPct, 0)); //clamp to range [0, 100]
    this.pbCapacity.progressbar( "value",  qtyPct ); //update progressbar value
  },
  _updateFromModel: function( cmdyModel ) {
    this._name = cmdyModel.name;
		if( this.tradePrice ) {
			this._price = cmdyModel.type.getAvgTradeValue();
		} else {
			this._price = cmdyModel.getValue();
		}

    this.setQty(0, cmdyModel.maxQty, cmdyModel.currQty);
    this.div.prop('title', cmdyModel.id);
  },
  _updateLabel: function() {
    //TODO: format price number
    if(this.showPrice) {
      this.lblName.text( this._name + " - " + this._qty + " units @ $" + this._price );
    }
    else {
      this.lblName.text( this._name + " - " + this._qty + " units" );
    }

  }
})
