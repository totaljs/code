const SESSIONOPTIONS = { name: CONF.cookie, key: CONF.authkey, expire: '1 month' };

AUTH(function($) {
	MAIN.session.getcookie($, SESSIONOPTIONS, $.done());
});

ON('service', function(counter) {
	// Logged time
	if (counter % 10 === 0)
		MAIN.save(1);
});