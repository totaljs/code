ON('resize', function() {

	var el = $('#body,#panel,#content,.fullheight');

	el.each(function() {
		var el = $(this);
		el[0].offsetParent && el.css('height', WH - el.offset().top - (+(el.attrd('margin') || '0')));
	});

	if (WIDTH() === 'xs') {
		var mm = $('.mainmenu,.mainmenu .scroller-xs');
		mm.css('height', WH - 70);
	}

	SETTER('editor', 'resize');
	clipboardresize();
});

function clipboardresize() {
	var el = $('#clipboardbody');
	if (el.length && el[0].parentNode) {
		var parent = el.parent();
		var pw = parent.width();
		el.css('width', pw + SCROLLBARWIDTH());
	}
}

ON('ready', function() {

	$(window).on('resize', function() {
		setTimeout2('resize', function() {
			EMIT('resize');
		}, 100);
	});
	setTimeout(EXEC2('#resize'), 50);
});

var TTIC = ['#1abc9c','#2ecc71','#3498db','#9b59b6','#34495e','#16a085','#2980b9','#8e44ad','#2c3e50','#f1c40f','#e67e22','#e74c3c','#d35400','#c0392b'];

Thelpers.initials = function(value, coloronly) {
	var index = value.indexOf('.');
	var arr = value.substring(index + 1).replace(/\s{2,}/g, ' ').trim().split(' ');
	var initials = (arr[0].substring(0, 1) + (arr[1] || '').substring(0, 1));
	var sum = 0;

	for (var i = 0; i < value.length; i++)
		sum += value.charCodeAt(i);

	return coloronly ? TTIC[sum % value.length] : '<span class="initials" style="background-color:{1}" title="{2}">{0}</span>'.format(initials, TTIC[sum % value.length], value);
};

Thelpers.utc = function(dt) {
	return STRINGIFY(dt).replace(/"/g, '');
};

function hexrgba(hex, alpha){
	var c;
	if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
		c= hex.substring(1).split('');
		if(c.length === 3)
			c= [c[0], c[0], c[1], c[1], c[2], c[2]];
		c= '0x' + c.join('');
		return 'rgba(' + [(c>>16)&255, (c>>8)&255, c&255].join(',') + ',' + alpha + ')';
	}
	return 'rgba(0,0,0,' + alpha + ')';
}

setInterval(function() {
	$('.time').each(function() {
		var dt = new Date(this.getAttribute('data-time'));
		this.innerHTML = Thelpers.time(dt);
	});
}, 1000 * 30);