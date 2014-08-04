//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js
//#include https://code.jquery.com/ui/1.11.0/jquery-ui.min.js
//NOTE: $() is reserved for Prototype, jQuery must use jQuery() format
//#include js/framework/EventBus.js

/*

Represents a vessel BUYING or SELLING to a station (can do either from the same view).

Text is represented relative to the vessel's point of view.

The slider range is  vessel.qty + station.qty;
The slider start position = vessel.qty, where trade qty = 0;
 moving the slider left will result in qty going negative (meaning vessel is SELLING qty)
 moving the slider right will result in qty going positive (meaning vessel is BUYING qty)

todo: handle max cargo space available for both vessel and station
todo: handle max $balance available from vessel

events sent
ui:"TradeDialogOk": { dialog:this, qty:int, cid:cid, factId:fid }
ui:"DialogCancel": { dialog:this }

*/

var TradeDialog = Class.create({
	initialize: function( parentHtmlElement ) {
		this.parent = parentHtmlElement;
    this.cid = "";
    this.statId = "";
    this.locId = "";
    this.qty = 0;
    this.vQty = 0;
    this.sQty = 0;
		this.pricePerUnit = 0;
    this.cancelled = false;
    this.sellMode = false; //gets toggled as slider goes left/right of start point
  },
  setQtyAndTotal: function( qty ) {
    this.qty = qty;
    if( qty < 0 ) this.sellMode = true;
    else this.sellMode = false;
    var total = Math.abs(qty * this.pricePerUnit);
    var action = (  this.sellMode ) ? "SELL" : "BUY";
    this.qtyNum.text( action + " x" + Math.abs(qty) + " = $" + total);
  },
  initWithCidQtyPriceFactoryAndElem: function( cid, vQty, sQty, pricePerUnit, locId, statId ) {
		this.cid = cid;
    this.statId = statId;
    this.locId = locId;
    this.qty = 0;
    this.vQty = vQty;
    this.sQty = sQty;
		this.pricePerUnit = pricePerUnit;
    this.cancelled = false;
    var blockThis = this;

		var cmdyType = CommodityType.get(cid);
		var text = cmdyType.name + " @ $" + pricePerUnit;

    var desc = jQuery("<p>", {text:text});
    var qtyNum = jQuery("<p id='qnum'>");
    var qtySel = jQuery("<div>", {name:'qty'});
		var qty = 0;
    qtySel.slider({
      range: "min",
      min: -vQty,
      max: sQty,
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


		this.div = jQuery("<div>", {title:"Trade", id:"TradeDialog"}).append(desc).append(qtySel).append(qtyNum);

		jQuery(this.parentHtmlElement).append(this.div);

    this.setQtyAndTotal(qty);

		this.div.dialog({
      modal: true,
      buttons: {
        Ok: function() {
					this.done = true;
					var qty = blockThis.qty;
					EventBus.ui.dispatch({evtName:"TradeDialogOk", dialog:blockThis, qty:qty, cid:cid, statId:statId});
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
