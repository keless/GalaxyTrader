//#include https://ajax.googleapis.com/ajax/libs/prototype/1.7.2.0/prototype.js

/*

	event handled:
		[sfx]:"play":{file:"audio/file.mp3"}

	events sent:

*/

var AudioManager = Class.create({
  initialize : function( ) {
		console.log("AudioManager created");


		Service.add("audio", this);

		EventBus.sfx.addListener("play", this.onSfxPlay.bind(this));
	},
	g_sfx: {},
	onSfxPlay: function(evt) {
		var file = evt.file;
		if( !AudioManager.prototype.g_sfx[ file ] ) {
			AudioManager.prototype.g_sfx[ file ] = new Audio(file);
		}

		var audio = AudioManager.prototype.g_sfx[ evt.file ];
		if(!audio.ended) {
			console.log("cutting sfx short " + file);
		}
		audio.play();
	}

});
