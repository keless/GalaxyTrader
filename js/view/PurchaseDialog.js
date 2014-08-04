//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

Represents either a vessel BUYING from a factory or SELLING to a factory.
If sellMode = true, then SELLING.  Can only do one of the two.

Text is represented relative to the vessel's point of view.

events sent
ui:"PurchaseDialogOk": { dialog:this, qty:int, cid:cid, factId:fid }
ui:"DialogCancel": { dialog:this }

*/

var PurchaseDialog = Class.create({
	initialize: function( parentHtmlElement, boolSellMode ) {
		this.parent = parentHtmlElement;
    this.cid = "";
    this.factId = "";
    this.locId = "";
    this.qty = 0;
		this.pricePerUnit = 0;
    this.cancelled = false;
		this.sellMode = boolSellMode;
	},
  setQtyAndTotal: function( qty ) {
    this.qty = qty;
    var total = qty * this.pricePerUnit;
    this.qtyNum.text( "x" + qty + " = $" + total);
  },
	initWithCidQtyPriceFactoryAndElem: function( cid, qty, pricePerUnit, locId, factId ) {
		this.cid = cid;
    this.factId = factId;
    this.locId = locId;
    this.qty = qty;
		this.pricePerUnit = pricePerUnit;
    this.cancelled = false;
    var blockThis = this;

		var cmdyType = CommodityType.get(cid);
		var text = cmdyType.name + " @ $" + pricePerUnit;

    var desc = jQuery("<p>", {text:text});
    var qtyNum = jQuery("<p id='qnum'>");
    var qtySel = jQuery("<div>", {name:'qty'});

    qtySel.slider({
      range: "min",
      min: 1,
      max: qty,
      value: qty,
      slide: function( event, ui ) {
        blockThis.setQtyAndTotal(qtySel.slider("value"));
      },
      stop: function( event, ui ) {
        blockThis.setQtyAndTotal(qtySel.slider("value"));
      }
    });

    this.qtySel = qtySel;
    this.qtyNum = qtyNum;

		if(this.sellMode) {
			this.div = jQuery("<div>", {title:"Sell", id:"SellDialog"}).append(desc).append(qtySel).append(qtyNum);
		}else {
			this.div = jQuery("<div>", {title:"Buy", id:"BuyDialog"}).append(desc).append(qtySel).append(qtyNum);
		}

		jQuery(this.parentHtmlElement).append(this.div);

    this.setQtyAndTotal(qty);

		this.div.dialog({
      modal: true,
      buttons: {
        Ok: function() {
					this.done = true;
					var qty = blockThis.qty;
					EventBus.ui.dispatch({evtName:"PurchaseDialogOk", dialog:blockThis, qty:qty, cid:cid, factId:factId});
					jQuery(this).dialog("close");
        },
				Cancel: function() {
          //behave same as cancel 'x' button
					this.done = true;
					blockThis.cancelled = true;
					EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					jQuery(this).dialog("close");
				}

      },
			close: function() {
					if( !this.done ) {
            blockThis.cancelled = true;
						EventBus.ui.dispatch({evtName:"DialogCancel", dialog:blockThis});
					}
				}
    });

	},
	getDiv: function() {
		return this.div;
	}
});
