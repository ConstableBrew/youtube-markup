var tag = document.createElement('script'),
	firstScriptTag = document.getElementsByTagName('script')[0],
	player,
	canvas = document.getElementById('markupOverlay'),
	context = canvas.getContext('2d'), // TODO: improve the interface between this and the ToolBelt's tools
	videoAnnotations = {}, // TODO: this should be coupled with the appropriate player and context for multi-video views
	currentAnnotation = -1, // Indicates what annotation to ignore when the player is resumed, prevents the player from being stopped again instantly for coming across an annotation.
	toolBelt = {
		activeTool: null, // TODO: make this the actual active tool instead of just a string reference (would require a significant change to this API...)
		context: canvas.getContext('2d'),
		init: function () { // Called when switching/resetting tools
			'use strict';
			// TODO: integrate into the setter property of the activeTool setting
			toolBelt[toolBelt.activeTool].init.call(toolBelt); // TODO: Better define what "this" properties are availalbe to Tools to make use of
		},
		mouseMove: function (event) {
			'use strict';
			toolBelt[toolBelt.activeTool].mouseMove.call(toolBelt, event);
		},
		mouseDown: function (event) {
			'use strict';
			var t, markup;
			
			player.pauseVideo();
			player.currentTime = player.getCurrentTime();
			t = getFrameTime(player.currentTime);
			markup = videoAnnotations[t];
			if (typeof markup === 'undefined') {
				markup = new VideoMarkup(player.getCurrentTime()); // Exact frame is held within the VideoMarkup object, 
				videoAnnotations[t] = markup; // while the general time step is held in the videoAnnotation object keys.
			} else {
				markup.render();
				player.seekTo(markup.time, true);
			}
			currentAnnotation = t;
			markup.markup.push([]);
			toolBelt[toolBelt.activeTool].mouseDown.call(toolBelt, event, markup); // TODO: This whole technique feels clunky
		},
		mouseUp: function (event) {
			'use strict';
			var t = getFrameTime(player.getCurrentTime()),
				markup = videoAnnotations[t];
			toolBelt[toolBelt.activeTool].mouseUp.call(toolBelt, event, markup);
		}
	};




//------------------------------------------------------------------------------
// Tool Object Interface
function Tool() {}
Tool.prototype.init = function () {}; // used when switching tools
Tool.prototype.mouseMove = function () {};
Tool.prototype.mouseDown = function () {};
Tool.prototype.mouseUp = function () {};
Tool.prototype.finish = function () {};

// Pen inherits from Tool
// Freehand drawing while the mouse is down
// TODO: Allow custom stroke style and line width
function Pen() {}
Pen.prototype = new Tool();
Pen.prototype.init = function () {
	'use strict';
	this.penDown = false;
	this.x = 0;
	this.y = 0;
};
Pen.prototype.mouseMove = function (event) {
	'use strict';
	var t,
		markup,
		line;

	if (this.penDown && currentAnnotation !== -1) {
		markup = videoAnnotations[currentAnnotation];
		player.seekTo(markup.time, true); // Fixes problem with player advancing one frame inbetween mouseDown triggered pause command and then this mouse move event.
		line = {
			'x': this.x,
			'y': this.y,
			'dx': event.offsetX - this.x,
			'dy': event.offsetY - this.y
		};
		this.x = line.x;
		this.y = line.y;
		markup.markup[markup.markup.length - 1].push(line);
		context.lineTo(line.x + line.dx, line.y + line.dy);
		context.lineWidth = 4;
		context.strokeStyle = '#ffff00';
		context.lineCap = 'round';
		context.stroke(); // We complete the stroke now so that it is immediately displayed
		context.beginPath();
		context.moveTo(line.x + line.dx, line.y + line.dy);
		event.preventDefault();
	}
};
Pen.prototype.mouseDown = function (event, markup) {
	'use strict';
	this.penDown = true;
	context.beginPath();
	context.moveTo(event.offsetX, event.offsetY);
	this.x = event.offsetX | 0;
	this.y = event.offsetY | 0;
	event.preventDefault();
};
Pen.prototype.mouseUp = Pen.prototype.finish = function (event, markup) {
	'use strict';
	if (this.penDown) {
		this.penDown = false;
		context.lineWidth = 4;
		context.strokeStyle = '#ffff00';
		context.lineCap = 'round';
		context.stroke();
		event.preventDefault();
	}
};

//TODO: Add more tools

function VideoMarkup (t) {
	'use strict';
	this.time = t;
	this.markup = []; // TODO: needs a better name...
}
VideoMarkup.prototype.render = function () {
	'use strict';
	this.markup.forEach(function (markupGroup) {
		// TODO: make this specify the type of markup instead of assuming everything is a single line
		context.beginPath();
		context.lineWidth = 4;
		context.strokeStyle = '#ffff00';
		context.lineCap = 'round';
		context.moveTo(markupGroup[0].x, markupGroup[0].y);
		markupGroup.forEach(function (e) {
			context.lineTo(e.x + e.dx, e.y + e.dy);
		});
		context.stroke();
	});
};

// Set up the tool belt by initializing the default Tool
toolBelt['Pen'] = new Pen();
toolBelt.activeTool = 'Pen';
toolBelt.init();


canvas.width = '640'; //TODO: Make this size with the viewport resize events and integrate with the CSS better.
canvas.height = '354';
canvas.addEventListener('mousemove', toolBelt.mouseMove);
canvas.addEventListener('mousedown', toolBelt.mouseDown);
canvas.addEventListener('mouseup', toolBelt.mouseUp);


//------------------------------------------------------------------------------
// We use this function to clamp the video time to discrete time steps that we will use to stick our markup to.
// We need to do this since YT doesn't let you specify any given frame as a stopping point. So we have an interval
// constantly checking what time the video is currently at.
function getFrameTime(seconds) {
	'use strict';
	var t = seconds * 1000; // Convert to miliseconds
	t -= t % 250; // Clamp to 30 fps steps: FIX: Clamp time to 4 fps. The fastest interval seems to vary too widly,
	// so we have to limit to only 200ms steps. This is a low quality compromise, so we will need to explore other
	// options to have a higher fidelity.
	return t;
}





//------------------------------------------------------------------------------
// YouTube set up
tag.src = 'https://www.youtube.com/iframe_api';
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// The YT (You Tube) API will call this function when the API script has finished loading
function onYouTubeIframeAPIReady() {
	'use strict';
	player = new YT.Player('player', {
		height: '390',
		width: '640',
		videoId: '5TueN9ct1HU',
		events: {
			'onReady': onPlayerReady,
			'onStateChange': onPlayerStateChange
		}
	});
}

// The YT API will call this function when the video player is spun up and ready to play
function onPlayerReady(event) {
	'use strict';
	event.target.playVideo();
	event.target.intervalId = setInterval(videoPeek, 15);
}

// The YT API will call this function for the player when it changes states.
// We are looking for when it begins playing
function onPlayerStateChange(event) {
	'use strict';
	if (event.data === YT.PlayerState.PLAYING) {
		// Clear the markup whenever the player starts playing
		context.clearRect(0, 0, canvas.width, canvas.height);
	}
}

// Constantly check in on the video player to see if we have reached a videoAnnotation point
function videoPeek() {
	'use strict';
	var t = getFrameTime(player.getCurrentTime()),
		markup = videoAnnotations[t === currentAnnotation  ? -1 : t],
		timeDiff = Math.abs(player.currentTime - player.getCurrentTime());
	
	// Looking for large changes in the player's play position to detect user seeks on the video.
	if (timeDiff >= 0.250) {
		currentAnnotation = -1;
		context.clearRect(0, 0, canvas.width, canvas.height);
		markup = undefined;
	}
	player.currentTime = player.getCurrentTime();
	
	if (player.getPlayerState() === YT.PlayerState.PLAYING && typeof markup !== 'undefined') {
		// videoAnnotation point has been reached, pause the video and show the markup
		player.pauseVideo();
		markup.render();
		currentAnnotation = t;
	}
}


//------------------------------------------------------------------------------
// Hudl Player Controls
function togglePlay() {
	'use strict';
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo();
	} else {
		player.playVideo();
	}
}

function stepFwd() {
	'use strict';
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo();
	} else {
		player.seekTo(player.getCurrentTime()  +0.033, true);
	}
}

function stepRev() {
	'use strict';
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo();
	} else {
		player.seekTo(player.getCurrentTime() - 0.033, true);
	}
}
/*
function fastFwd() {
	var intervalId,
		callback = function(){
			player.seekTo(player.getCurrentTime()+0.2,true);
		};
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo();
		intervalId = setInterval(callback, 0.1);
	}else{
		clearInterval(intervalId);
		intervalId = 0;
		player.playVideo();
	}
}

function fastRev() {
	var intervalId,
		callback = function(){
			player.seekTo(player.getCurrentTime()-0.2,true);
		};
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo();
		intervalId = setInterval(callback, 0.1);
	}else{
		clearInterval(intervalId);
		intervalId = 0;
		player.playVideo();
	}
}
*/

document.getElementById('playButton').addEventListener('click', togglePlay);
document.getElementById('stepFwdButton').addEventListener('click', stepFwd);
document.getElementById('stepRevButton').addEventListener('click', stepRev);
//document.getElementById('fastRevButton').addEventListener('click', fastRev);
//document.getElementById('fastFwdButton').addEventListener('click', fastFwd);

//------------------------------------------------------------------------------
// Tests
var testMarkup = new VideoMarkup(6.99);
testMarkup.markup.push([
	{"x": 170, "y": 260, "dx": 0, "dy": 40}
]);
testMarkup.markup.push([
	{"x": 130, "y": 280, "dx": 40, "dy": 0}
]);
testMarkup.markup.push([
	{"x": 210, "y": 290, "dx": 20, "dy": 0}
]);
testMarkup.markup.push([
	{"x": 228, "y": 162, "dx": 10, "dy": 0},
	{"x": 238, "y": 162, "dx": 0, "dy": 10},
	{"x": 238, "y": 172, "dx": -10, "dy": 0},
	{"x": 228, "y": 172, "dx": 0, "dy": -10}
]);
videoAnnotations[getFrameTime(6.99)] = testMarkup;


//------------------------------------------------------------------------------
// Overlay (just faking it)
document.getElementById('overlay')
	.addEventListener('mouseup',function(event){
		var overlay = document.getElementById('overlay');
		overlay.style.visibility = 'hidden';
		overlay.removeEventListener('mouseup', arguments.callee);
		event.preventDefault();
	});